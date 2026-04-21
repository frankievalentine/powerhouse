import {
  buildCatalogLedgerEntries,
  detectPlatform,
  findMcpServers,
  getPowerhousePaths,
  installMcpServers,
  isPlanPlatform,
  loadLedger,
  loadRegistry,
  loadState,
  saveLedger,
  saveState,
  upsertLedgerEntries,
  type InstalledCatalogState,
  type PlatformTarget
} from '@powerhouse/core';

import { formatCatalogExecutionSummary, printCatalogInstallResult, printCatalogList } from '../ui/output.ts';

export interface McpCatalogOptions {
  agent?: string[];
  profile?: string;
}

export interface McpInstallCommandOptions {
  dryRun?: boolean;
  scope?: 'auto' | 'global' | 'project' | 'local';
}

export async function runMcpListCommand(options: McpCatalogOptions): Promise<void> {
  const context = await buildCatalogContext(options);
  const items = findMcpServers(context.registry, {
    agents: context.agents,
    platform: context.platform
  });
  printCatalogList(
    items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      target: item.targetAgents.join(', '),
      scopes: item.supportedScopes,
      source: item.source
    }))
  );
}

export async function runMcpFindCommand(query: string | undefined, options: McpCatalogOptions): Promise<void> {
  const context = await buildCatalogContext(options);
  const items = findMcpServers(context.registry, {
    agents: context.agents,
    platform: context.platform,
    query
  });
  printCatalogList(
    items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      target: item.targetAgents.join(', '),
      scopes: item.supportedScopes,
      source: item.source
    }))
  );
}

export async function runMcpShowCommand(serverId: string): Promise<void> {
  const registry = await loadRegistry();
  const server = registry.mcpServers.find((entry) => entry.id === serverId);
  if (!server) {
    throw new Error(`Unknown MCP server "${serverId}".`);
  }

  console.log(`id: ${server.id}`);
  console.log(`title: ${server.title}`);
  console.log(`description: ${server.description}`);
  console.log(`server name: ${server.serverName}`);
  console.log(`target agents: ${server.targetAgents.join(', ')}`);
  console.log(`platforms: ${server.supportedPlatforms.join(', ')}`);
  console.log(`scopes: ${server.supportedScopes.join(', ')}`);
  console.log(`server kind: ${server.serverKind}`);
  console.log(`source: ${server.source}`);
  console.log(`tags: ${server.tags.join(', ') || 'none'}`);
}

export async function runMcpInstallCommand(serverId: string, options: McpInstallCommandOptions): Promise<void> {
  const registry = await loadRegistry();
  const server = registry.mcpServers.find((entry) => entry.id === serverId);
  if (!server) {
    throw new Error(`Unknown MCP server "${serverId}".`);
  }

  const platform = detectPlatform();
  if (!isPlanPlatform(platform)) {
    throw new Error(`Unsupported platform "${platform.os}".`);
  }

  const paths = getPowerhousePaths(platform);
  const [state, ledger] = await Promise.all([loadState(paths), loadLedger(paths)]);

  const results = await installMcpServers([server], platform, {
    dryRun: options.dryRun,
    scope: options.scope ?? 'auto',
    onLog: undefined
  });

  if (!options.dryRun && state) {
    const updatedAt = new Date().toISOString();
    await saveState(paths, {
      ...state,
      schemaVersion: 2,
      updatedAt,
      installedMcpServers: [...state.installedMcpServers, ...toInstalledCatalogState(results)]
    });
    const nextLedger = upsertLedgerEntries(
      ledger,
      buildCatalogLedgerEntries(
        'mcp',
        results,
        {
          profileId: state.activeProfileId,
          domainId: state.activeDomainId
        },
        updatedAt
      ),
      updatedAt
    );
    await saveLedger(paths, nextLedger);
  }

  for (const result of results) {
    printCatalogInstallResult(result);
  }
  console.log(formatCatalogExecutionSummary('MCP', results));
}

async function buildCatalogContext(options: McpCatalogOptions): Promise<{
  registry: Awaited<ReturnType<typeof loadRegistry>>;
  platform?: PlatformTarget;
  agents: string[];
}> {
  const platform = detectPlatform();
  const registry = await loadRegistry();
  const state = await loadState(getPowerhousePaths(platform));
  let agents = options.agent ?? [];

  if (agents.length === 0 && options.profile) {
    const profile = registry.profiles.find((entry) => entry.id === options.profile);
    if (!profile) {
      throw new Error(`Unknown profile "${options.profile}".`);
    }
    agents = profile.defaultAgents;
  }

  if (agents.length === 0 && state?.installedAgents.length) {
    agents = state.installedAgents;
  }

  return {
    registry,
    platform: isPlanPlatform(platform) ? platform.os : undefined,
    agents
  };
}

function toInstalledCatalogState(
  results: Array<{
    id: string;
    scope: 'global' | 'project' | 'local';
    status: InstalledCatalogState['status'];
  }>
): InstalledCatalogState[] {
  return results.map((result) => ({
    id: result.id,
    scope: result.scope,
    status: result.status
  }));
}
