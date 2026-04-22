import fs from 'node:fs/promises';
import path from 'node:path';

import { findWorkspaceRoot } from '../workspace.ts';

export type RegistryScaffoldKind = 'domain' | 'harness' | 'tool' | 'integration' | 'mcp';

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
  const directory = getRegistryDirectory(kind);
  const filePath = path.join(rootDir, 'registry', directory, `${id}.json`);

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

function getRegistryDirectory(kind: RegistryScaffoldKind): string {
  if (kind === 'harness') {
    return 'harnesses';
  }

  if (kind === 'mcp') {
    return 'mcp';
  }

  return `${kind}s`;
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
          recommendedToolIds: [],
          skillPackages: [],
          notes: []
        },
        null,
        2
      ) + '\n'
    );
  }

  if (kind === 'harness') {
    return (
      JSON.stringify(
        {
          id,
          title: manifestTitle,
          description: `${manifestTitle} AI harness.`,
          supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
          requiredToolIds: [],
          defaultAgents: [],
          notes: []
        },
        null,
        2
      ) + '\n'
    );
  }

  if (kind === 'integration') {
    return (
      JSON.stringify(
        {
          id,
          title: manifestTitle,
          description: `${manifestTitle} integration.`,
          targetAgent: 'claude-code',
          supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
          supportedScopes: ['global'],
          installKind: 'manual',
          source: 'replace-me',
          tags: [],
          bundledMcpIds: [],
          install: {
            kind: 'manual',
            instructions: [`Document how to install ${manifestTitle}.`],
            restartRequired: false
          }
        },
        null,
        2
      ) + '\n'
    );
  }

  if (kind === 'mcp') {
    return (
      JSON.stringify(
        {
          id,
          title: manifestTitle,
          description: `${manifestTitle} MCP server.`,
          serverName: id,
          targetAgents: ['claude-code'],
          supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
          supportedScopes: ['global'],
          serverKind: 'stdio',
          source: 'replace-me',
          tags: [],
          install: {
            kind: 'manual',
            instructions: [`Document how to configure ${manifestTitle} for each target agent.`],
            restartRequired: false
          }
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
        supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
        check: {
          command: id,
          args: ['--version']
        },
        doctorHint: `Install ${manifestTitle} or update this manifest with the correct detection command.`,
        installs: {
          darwin: [],
          linux: [],
          win32: [],
          wsl: []
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
