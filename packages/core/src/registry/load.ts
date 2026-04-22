import fs from 'node:fs/promises';
import path from 'node:path';

import {
  domainManifestSchema,
  harnessManifestSchema,
  integrationManifestSchema,
  mcpManifestSchema,
  toolManifestSchema,
  type DomainManifest,
  type HarnessManifest,
  type IntegrationManifest,
  type McpManifest,
  type ToolManifest
} from './schema.ts';
import { findWorkspaceRoot } from '../workspace.ts';

export interface RegistryData {
  rootDir: string;
  tools: ToolManifest[];
  harnesses: HarnessManifest[];
  domains: DomainManifest[];
  integrations: IntegrationManifest[];
  mcpServers: McpManifest[];
}

export async function loadRegistry(startDir = process.cwd()): Promise<RegistryData> {
  const rootDir = await findWorkspaceRoot(startDir);
  const harnessDirectory =
    (await existingDirectory(path.join(rootDir, 'registry', 'harnesses'))) ??
    (await existingDirectory(path.join(rootDir, 'registry', 'profiles')));
  if (!harnessDirectory) {
    throw new Error('Unable to find registry/harnesses or registry/profiles.');
  }

  const [tools, harnesses, domains, integrations, mcpServers] = await Promise.all([
    loadDirectory(path.join(rootDir, 'registry', 'tools'), toolManifestSchema.parse),
    loadDirectory(harnessDirectory, parseHarnessManifest),
    loadDirectory(path.join(rootDir, 'registry', 'domains'), parseDomainManifest),
    loadOptionalDirectory(path.join(rootDir, 'registry', 'integrations'), integrationManifestSchema.parse),
    loadOptionalDirectory(path.join(rootDir, 'registry', 'mcp'), mcpManifestSchema.parse)
  ]);

  return { rootDir, tools, harnesses, domains, integrations, mcpServers };
}

async function loadDirectory<T>(dirPath: string, parse: (input: unknown) => T): Promise<T[]> {
  const entries = await fs.readdir(dirPath);
  const files = entries.filter((entry) => entry.endsWith('.json')).sort();

  return Promise.all(
    files.map(async (fileName) => {
      const content = await fs.readFile(path.join(dirPath, fileName), 'utf8');
      return parse(JSON.parse(content));
    })
  );
}

async function loadOptionalDirectory<T>(dirPath: string, parse: (input: unknown) => T): Promise<T[]> {
  try {
    return await loadDirectory(dirPath, parse);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function existingDirectory(dirPath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory() ? dirPath : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function parseHarnessManifest(input: unknown): HarnessManifest {
  const normalized = normalizeManifestObject(input);
  return harnessManifestSchema.parse({
    ...normalized,
    requiredToolIds: normalized.requiredToolIds ?? normalized.toolIds ?? []
  });
}

function parseDomainManifest(input: unknown): DomainManifest {
  const normalized = normalizeManifestObject(input);
  return domainManifestSchema.parse({
    ...normalized,
    recommendedToolIds: normalized.recommendedToolIds ?? normalized.extraToolIds ?? []
  });
}

function normalizeManifestObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}
