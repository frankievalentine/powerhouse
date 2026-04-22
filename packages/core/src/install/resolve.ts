import type { DetectedPlatform, PlatformTarget } from '../platform/detect.ts';
import type { DomainManifest, HarnessManifest, IntegrationManifest, McpManifest, ToolManifest } from '../registry/schema.ts';
import type { RegistryData } from '../registry/load.ts';

export interface SetupPlan {
  harnesses: HarnessManifest[];
  domains: DomainManifest[];
  requiredTools: ToolManifest[];
  recommendedTools: ToolManifest[];
  selectedOptionalTools: ToolManifest[];
  tools: ToolManifest[];
  integrations: IntegrationManifest[];
  mcpServers: McpManifest[];
  agents: string[];
  notes: string[];
}

export type BootstrapPlan = SetupPlan;

export function resolveSetupPlan(
  registry: RegistryData,
  platform: DetectedPlatform & { os: PlatformTarget },
  harnessIds: string[],
  domainIds: string[],
  selectedToolIds?: string[]
): SetupPlan {
  const harnesses = selectRegistryEntries(registry.harnesses, harnessIds, 'harness');
  const domains = selectRegistryEntries(registry.domains, domainIds, 'domain');

  for (const harness of harnesses) {
    if (!harness.supportedPlatforms.includes(platform.os)) {
      throw new Error(`Harness "${harness.id}" does not support ${platform.os}.`);
    }
  }

  const agents = unique(harnesses.flatMap((harness) => harness.defaultAgents));
  const requiredToolIds = unique(harnesses.flatMap((harness) => resolveHarnessRequiredToolIds(registry, harness.id)));
  const recommendedToolIds = resolveDomainRecommendedToolIds(domains);
  const normalizedSelectedToolIds =
    selectedToolIds === undefined ? recommendedToolIds : normalizeSelectedOptionalToolIds(recommendedToolIds, selectedToolIds);
  const integrationIds = unique([
    ...harnesses.flatMap((harness) => resolveHarnessIntegrationIds(registry, harness.id)),
    ...domains.flatMap((domain) => domain.integrationIds)
  ]);

  const requiredTools = resolveToolManifests(registry, requiredToolIds, platform.os);
  const recommendedTools = resolveToolManifests(registry, recommendedToolIds, platform.os);
  const selectedOptionalTools = resolveToolManifests(registry, normalizedSelectedToolIds, platform.os);
  const tools = sortTools(uniqueById([...requiredTools, ...selectedOptionalTools]));
  const integrations = integrationIds
    .map((integrationId) => {
      const integration = registry.integrations.find((entry) => entry.id === integrationId);
      if (!integration) {
        throw new Error(`Manifest references missing integration "${integrationId}".`);
      }
      return integration;
    })
    .filter(
      (integration) =>
        integration.supportedPlatforms.includes(platform.os) && agents.includes(integration.targetAgent)
    )
    .sort((left, right) => left.title.localeCompare(right.title));
  const mcpServerIds = unique([
    ...harnesses.flatMap((harness) => resolveHarnessMcpServerIds(registry, harness.id)),
    ...domains.flatMap((domain) => domain.mcpServerIds),
    ...integrations.flatMap((integration) => integration.bundledMcpIds)
  ]);
  const mcpServers = mcpServerIds
    .map((mcpServerId) => {
      const mcpServer = registry.mcpServers.find((entry) => entry.id === mcpServerId);
      if (!mcpServer) {
        throw new Error(`Manifest references missing MCP server "${mcpServerId}".`);
      }
      return mcpServer;
    })
    .filter(
      (mcpServer) =>
        mcpServer.supportedPlatforms.includes(platform.os) && mcpServer.targetAgents.some((agent) => agents.includes(agent))
    )
    .sort((left, right) => left.title.localeCompare(right.title));

  return {
    harnesses,
    domains,
    requiredTools,
    recommendedTools,
    selectedOptionalTools,
    tools,
    integrations,
    mcpServers,
    agents,
    notes: unique([...harnesses.flatMap((harness) => harness.notes), ...domains.flatMap((domain) => domain.notes)])
  };
}

export const resolveBootstrapPlan = resolveSetupPlan;

export function resolveHarnessRequiredToolIds(registry: RegistryData, harnessId: string): string[] {
  return resolveHarnessChainValues(registry, harnessId, (harness) => harness.requiredToolIds);
}

export function resolveHarnessIntegrationIds(registry: RegistryData, harnessId: string): string[] {
  return resolveHarnessChainValues(registry, harnessId, (harness) => harness.integrationIds);
}

export function resolveHarnessMcpServerIds(registry: RegistryData, harnessId: string): string[] {
  return resolveHarnessChainValues(registry, harnessId, (harness) => harness.mcpServerIds);
}

export function resolveDomainRecommendedToolIds(domains: DomainManifest[]): string[] {
  return unique(domains.flatMap((domain) => domain.recommendedToolIds));
}

export function normalizeSelectedOptionalToolIds(availableToolIds: string[], selectedToolIds: string[]): string[] {
  const available = new Set(availableToolIds);
  const normalized = unique(selectedToolIds);

  for (const toolId of normalized) {
    if (!available.has(toolId)) {
      throw new Error(`Tool "${toolId}" is not available for the active domain selection.`);
    }
  }

  return normalized;
}

export function sanitizeSelectedOptionalToolIds(availableToolIds: string[], selectedToolIds: string[]): string[] {
  const available = new Set(availableToolIds);
  return unique(selectedToolIds.filter((toolId) => available.has(toolId)));
}

export function reconcileSelectedOptionalToolIds(
  currentSelectedToolIds: string[],
  previousRecommendedToolIds: string[],
  nextRecommendedToolIds: string[]
): string[] {
  const previousRecommended = new Set(previousRecommendedToolIds);
  const nextRecommended = new Set(nextRecommendedToolIds);
  const preserved = currentSelectedToolIds.filter((toolId) => nextRecommended.has(toolId));
  const newlyRecommended = nextRecommendedToolIds.filter((toolId) => !previousRecommended.has(toolId));
  return unique([...preserved, ...newlyRecommended]);
}

function resolveHarnessChainValues(
  registry: RegistryData,
  harnessId: string,
  pick: (harness: HarnessManifest) => string[]
): string[] {
  const visited = new Set<string>();
  const values: string[] = [];

  let currentId: string | undefined = harnessId;
  while (currentId) {
    if (visited.has(currentId)) {
      throw new Error(`Circular harness inheritance detected involving "${currentId}".`);
    }
    visited.add(currentId);

    const harness = registry.harnesses.find((entry) => entry.id === currentId);
    if (!harness) {
      throw new Error(`Harness "${currentId}" references unknown parent harness.`);
    }

    values.unshift(...pick(harness));
    currentId = harness.extends;
  }

  return unique(values);
}

function resolveToolManifests(registry: RegistryData, toolIds: string[], platform: PlatformTarget): ToolManifest[] {
  const tools = toolIds.map((toolId) => {
    const tool = registry.tools.find((entry) => entry.id === toolId);
    if (!tool) {
      throw new Error(`Manifest references missing tool "${toolId}".`);
    }
    return tool;
  });

  return sortTools(tools.filter((tool) => tool.supportedPlatforms.includes(platform)));
}

function sortTools(tools: ToolManifest[]): ToolManifest[] {
  return [...tools].sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));
}

function uniqueById<T extends { id: string }>(values: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    if (seen.has(value.id)) {
      continue;
    }
    seen.add(value.id);
    result.push(value);
  }
  return result;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function selectRegistryEntries<T extends { id: string }>(entries: T[], requestedIds: string[], kind: string): T[] {
  const uniqueIds = unique(requestedIds);
  if (uniqueIds.length === 0) {
    throw new Error(`At least one ${kind} must be selected.`);
  }

  const knownIds = new Set(entries.map((entry) => entry.id));
  for (const id of uniqueIds) {
    if (!knownIds.has(id)) {
      throw new Error(`Unknown ${kind} "${id}".`);
    }
  }

  return entries.filter((entry) => uniqueIds.includes(entry.id));
}
