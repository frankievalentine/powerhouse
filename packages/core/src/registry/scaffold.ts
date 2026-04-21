import fs from 'node:fs/promises';
import path from 'node:path';

import { findWorkspaceRoot } from '../workspace.ts';

export type RegistryScaffoldKind = 'domain' | 'profile' | 'tool';

export interface ScaffoldOptions {
  dryRun?: boolean;
  title?: string;
}

export interface ScaffoldResult {
  path: string;
  content: string;
  written: boolean;
}

export async function scaffoldRegistryManifest(
  kind: RegistryScaffoldKind,
  id: string,
  options: ScaffoldOptions = {},
  startDir = process.cwd()
): Promise<ScaffoldResult> {
  assertManifestId(id);

  const rootDir = await findWorkspaceRoot(startDir);
  const filePath = path.join(rootDir, 'registry', `${kind}s`, `${id}.json`);

  try {
    await fs.access(filePath);
    throw new Error(`Registry ${kind} "${id}" already exists at ${filePath}.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  const content = renderManifest(kind, id, options.title);

  if (!options.dryRun) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
  }

  return {
    path: filePath,
    content,
    written: !options.dryRun
  };
}

function renderManifest(kind: RegistryScaffoldKind, id: string, title?: string): string {
  const manifestTitle = title ?? humanizeId(id);

  if (kind === 'domain') {
    return (
      JSON.stringify(
        {
          id,
          title: manifestTitle,
          description: `Curated skills and optional tooling for ${manifestTitle.toLowerCase()} workflows.`,
          extraToolIds: [],
          skillPackages: [],
          notes: []
        },
        null,
        2
      ) + '\n'
    );
  }

  if (kind === 'profile') {
    return (
      JSON.stringify(
        {
          id,
          title: manifestTitle,
          description: `${manifestTitle} workstation profile.`,
          supportedPlatforms: ['darwin', 'linux'],
          toolIds: [],
          defaultAgents: [],
          notes: []
        },
        null,
        2
      ) + '\n'
    );
  }

  return (
    JSON.stringify(
      {
        id,
        title: manifestTitle,
        description: `${manifestTitle} tool manifest.`,
        kind: 'utility',
        priority: 100,
        supportedPlatforms: ['darwin', 'linux'],
        checkCommand: `${id} --version`,
        doctorHint: `Install ${manifestTitle} or update this manifest with the correct detection command.`,
        installs: {
          darwin: [],
          linux: []
        }
      },
      null,
      2
    ) + '\n'
  );
}

function humanizeId(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function assertManifestId(id: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid manifest id "${id}". Use lowercase letters, numbers, and hyphens only.`);
  }
}

