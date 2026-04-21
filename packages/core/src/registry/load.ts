import fs from 'node:fs/promises';
import path from 'node:path';

import {
  domainManifestSchema,
  integrationManifestSchema,
  mcpManifestSchema,
  profileManifestSchema,
  toolManifestSchema,
  type DomainManifest,
  type IntegrationManifest,
  type McpManifest,
  type ProfileManifest,
  type ToolManifest
} from './schema.ts';
import { findWorkspaceRoot } from '../workspace.ts';

export interface RegistryData {
  rootDir: string;
  tools: ToolManifest[];
  profiles: ProfileManifest[];
  domains: DomainManifest[];
  integrations: IntegrationManifest[];
  mcpServers: McpManifest[];
}

export async function loadRegistry(startDir = process.cwd()): Promise<RegistryData> {
  const rootDir = await findWorkspaceRoot(startDir);

  const [tools, profiles, domains, integrations, mcpServers] = await Promise.all([
    loadDirectory(path.join(rootDir, 'registry', 'tools'), toolManifestSchema.parse),
    loadDirectory(path.join(rootDir, 'registry', 'profiles'), profileManifestSchema.parse),
    loadDirectory(path.join(rootDir, 'registry', 'domains'), domainManifestSchema.parse),
    loadOptionalDirectory(path.join(rootDir, 'registry', 'integrations'), integrationManifestSchema.parse),
    loadOptionalDirectory(path.join(rootDir, 'registry', 'mcp'), mcpManifestSchema.parse)
  ]);

  return { rootDir, tools, profiles, domains, integrations, mcpServers };
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
