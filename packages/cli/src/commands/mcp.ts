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

import {
  formatCatalogExecutionSummary,
  formatPlatformList,
  printBulletSection,
  printCatalogInstallResult,
  printCatalogList,
  printKeyValueRows,
  summarizeDescription
} from '../ui/output.ts';

export interface McpCatalogOptions {
  agent?: string[];
  harness?: string;
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
      source: item.source,
      kind: 'mcp'
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
      source: item.source,
      kind: 'mcp'
    }))
  );
}

export async function runMcpShowCommand(serverId: string): Promise<void> {
  const registry = await loadRegistry();
  const server = registry.mcpServers.find((entry) => entry.id === serverId);
  if (!server) {
    throw new Error(`Unknown MCP server "${serverId}".`);
  }

  console.log(server.title);
  console.log(summarizeDescription(server.description, 'mcp'));
  console.log('');
  printKeyValueRows([
    { label: 'ID', value: server.id },
    { label: 'Server name', value: server.serverName },
    { label: 'Target agents', value: server.targetAgents.join(', ') },
    { label: 'Platforms', value: formatPlatformList(server.supportedPlatforms) },
    { label: 'Scopes', value: server.supportedScopes.join(', ') },
    { label: 'Server kind', value: formatServerKind(server.serverKind) },
    { label: 'Source', value: server.source }
  ]);

  if (server.tags.length > 0) {
    console.log('');
    printBulletSection('Tags', [server.tags.join(', ')]);
  }
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
      schemaVersion: 4,
      updatedAt,
      installedMcpServers: [...state.installedMcpServers, ...toInstalledCatalogState(results)]
    });
    const nextLedger = upsertLedgerEntries(
      ledger,
      buildCatalogLedgerEntries('mcp', results, updatedAt),
      updatedAt
    );
    await saveLedger(paths, nextLedger);
  }

  for (const result of results) {
    printCatalogInstallResult(result);
  }
  console.log(formatCatalogExecutionSummary('MCP servers', results));
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

  if (agents.length === 0 && options.harness) {
    const harness = registry.harnesses.find((entry) => entry.id === options.harness);
    if (!harness) {
      throw new Error(`Unknown harness "${options.harness}".`);
    }
    agents = harness.defaultAgents;
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

function formatServerKind(kind: string): string {
  switch (kind) {
    case 'stdio':
      return 'stdio';
    case 'http':
      return 'HTTP';
    default:
      return kind;
  }
}
