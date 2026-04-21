import {
  buildCatalogLedgerEntries,
  detectPlatform,
  findIntegrations,
  installMcpServers,
  getPowerhousePaths,
  installIntegrations,
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

export interface IntegrationCatalogOptions {
  agent?: string[];
  profile?: string;
}

export interface IntegrationInstallCommandOptions {
  dryRun?: boolean;
  scope?: 'auto' | 'global' | 'project' | 'local';
}

export async function runIntegrationListCommand(options: IntegrationCatalogOptions): Promise<void> {
  const context = await buildCatalogContext(options);
  const items = findIntegrations(context.registry, {
    agents: context.agents,
    platform: context.platform
  });
  printCatalogList(
    items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      target: item.targetAgent,
      scopes: item.supportedScopes,
      source: item.source
    }))
  );
}

export async function runIntegrationFindCommand(query: string | undefined, options: IntegrationCatalogOptions): Promise<void> {
  const context = await buildCatalogContext(options);
  const items = findIntegrations(context.registry, {
    agents: context.agents,
    platform: context.platform,
    query
  });
  printCatalogList(
    items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      target: item.targetAgent,
      scopes: item.supportedScopes,
      source: item.source
    }))
  );
}

export async function runIntegrationShowCommand(integrationId: string): Promise<void> {
  const registry = await loadRegistry();
  const integration = registry.integrations.find((entry) => entry.id === integrationId);
  if (!integration) {
    throw new Error(`Unknown integration "${integrationId}".`);
  }

  console.log(`id: ${integration.id}`);
  console.log(`title: ${integration.title}`);
  console.log(`description: ${integration.description}`);
  console.log(`target agent: ${integration.targetAgent}`);
  console.log(`platforms: ${integration.supportedPlatforms.join(', ')}`);
  console.log(`scopes: ${integration.supportedScopes.join(', ')}`);
  console.log(`install kind: ${integration.installKind}`);
  console.log(`source: ${integration.source}`);
  console.log(`bundled mcp: ${integration.bundledMcpIds.join(', ') || 'none'}`);
  console.log(`tags: ${integration.tags.join(', ') || 'none'}`);
}

export async function runIntegrationInstallCommand(
  integrationId: string,
  options: IntegrationInstallCommandOptions
): Promise<void> {
  const registry = await loadRegistry();
  const integration = registry.integrations.find((entry) => entry.id === integrationId);
  if (!integration) {
    throw new Error(`Unknown integration "${integrationId}".`);
  }

  const platform = detectPlatform();
  if (!isPlanPlatform(platform)) {
    throw new Error(`Unsupported platform "${platform.os}".`);
  }

  const paths = getPowerhousePaths(platform);
  const [state, ledger] = await Promise.all([loadState(paths), loadLedger(paths)]);

  const results = await installIntegrations([integration], platform, {
    dryRun: options.dryRun,
    scope: options.scope ?? 'auto',
    onLog: undefined
  });
  const bundledMcpServers = integration.bundledMcpIds.map((serverId) => {
    const server = registry.mcpServers.find((entry) => entry.id === serverId);
    if (!server) {
      throw new Error(`Integration "${integration.id}" references missing MCP server "${serverId}".`);
    }
    return server;
  });
  const bundledMcpResults =
    bundledMcpServers.length > 0
      ? await installMcpServers(bundledMcpServers, platform, {
          dryRun: options.dryRun,
          scope: options.scope ?? 'auto',
          onLog: undefined
        })
      : [];

  if (!options.dryRun && state) {
    const updatedAt = new Date().toISOString();
    await saveState(paths, {
      ...state,
      schemaVersion: 2,
      updatedAt,
      installedIntegrations: [...state.installedIntegrations, ...toInstalledCatalogState(results)],
      installedMcpServers: [...state.installedMcpServers, ...toInstalledCatalogState(bundledMcpResults)]
    });
    const nextLedger = upsertLedgerEntries(
      ledger,
      [
        ...buildCatalogLedgerEntries(
          'integration',
          results,
          {
            profileId: state.activeProfileId,
            domainId: state.activeDomainId
          },
          updatedAt
        ),
        ...buildCatalogLedgerEntries(
          'mcp',
          bundledMcpResults,
          {
            profileId: state.activeProfileId,
            domainId: state.activeDomainId
          },
          updatedAt
        )
      ],
      updatedAt
    );
    await saveLedger(paths, nextLedger);
  }

  for (const result of results) {
    printCatalogInstallResult(result);
  }
  console.log(formatCatalogExecutionSummary('Integrations', results));

  if (bundledMcpResults.length > 0) {
    console.log('');
    for (const result of bundledMcpResults) {
      printCatalogInstallResult(result);
    }
    console.log(formatCatalogExecutionSummary('Bundled MCP', bundledMcpResults));
  }
}

async function buildCatalogContext(options: IntegrationCatalogOptions): Promise<{
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
