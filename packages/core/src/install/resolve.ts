import type { DetectedPlatform, PlatformTarget } from '../platform/detect.ts';
import type { DomainManifest, IntegrationManifest, McpManifest, ProfileManifest, ToolManifest } from '../registry/schema.ts';
import type { RegistryData } from '../registry/load.ts';

export interface BootstrapPlan {
  profile: ProfileManifest;
  domain: DomainManifest;
  tools: ToolManifest[];
  integrations: IntegrationManifest[];
  mcpServers: McpManifest[];
  agents: string[];
  notes: string[];
}

export function resolveBootstrapPlan(
  registry: RegistryData,
  platform: DetectedPlatform & { os: PlatformTarget },
  profileId: string,
  domainId: string
): BootstrapPlan {
  const profile = registry.profiles.find((entry) => entry.id === profileId);
  if (!profile) {
    throw new Error(`Unknown profile "${profileId}".`);
  }

  const domain = registry.domains.find((entry) => entry.id === domainId);
  if (!domain) {
    throw new Error(`Unknown domain "${domainId}".`);
  }

  if (!profile.supportedPlatforms.includes(platform.os)) {
    throw new Error(`Profile "${profile.id}" does not support ${platform.os}.`);
  }

  const profileToolIds = resolveProfileToolIds(registry, profileId);
  const profileIntegrationIds = resolveProfileIntegrationIds(registry, profileId);
  const profileMcpServerIds = resolveProfileMcpServerIds(registry, profileId);
  const toolIds = unique([...profileToolIds, ...domain.extraToolIds]);
  const integrationIds = unique([...profileIntegrationIds, ...domain.integrationIds]);
  const tools = toolIds
    .map((toolId) => {
      const tool = registry.tools.find((entry) => entry.id === toolId);
      if (!tool) {
        throw new Error(`Manifest references missing tool "${toolId}".`);
      }
      return tool;
    })
    .filter((tool) => tool.supportedPlatforms.includes(platform.os));
  const integrations = integrationIds
    .map((integrationId) => {
      const integration = registry.integrations.find((entry) => entry.id === integrationId);
      if (!integration) {
        throw new Error(`Manifest references missing integration "${integrationId}".`);
      }
      return integration;
    })
    .filter((integration) => integration.supportedPlatforms.includes(platform.os));
  const mcpServerIds = unique([
    ...profileMcpServerIds,
    ...domain.mcpServerIds,
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
    .filter((mcpServer) => mcpServer.supportedPlatforms.includes(platform.os));

  tools.sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));
  integrations.sort((left, right) => left.title.localeCompare(right.title));
  mcpServers.sort((left, right) => left.title.localeCompare(right.title));

  return {
    profile,
    domain,
    tools,
    integrations,
    mcpServers,
    agents: unique(profile.defaultAgents),
    notes: [...profile.notes, ...domain.notes]
  };
}

export function resolveProfileToolIds(registry: RegistryData, profileId: string): string[] {
  return resolveProfileChainValues(registry, profileId, (profile) => profile.toolIds);
}

export function resolveProfileIntegrationIds(registry: RegistryData, profileId: string): string[] {
  return resolveProfileChainValues(registry, profileId, (profile) => profile.integrationIds);
}

export function resolveProfileMcpServerIds(registry: RegistryData, profileId: string): string[] {
  return resolveProfileChainValues(registry, profileId, (profile) => profile.mcpServerIds);
}

function resolveProfileChainValues(
  registry: RegistryData,
  profileId: string,
  pick: (profile: ProfileManifest) => string[]
): string[] {
  const visited = new Set<string>();
  const values: string[] = [];

  let currentId: string | undefined = profileId;
  while (currentId) {
    if (visited.has(currentId)) {
      throw new Error(`Circular profile inheritance detected involving "${currentId}".`);
    }
    visited.add(currentId);

    const profile = registry.profiles.find((entry) => entry.id === currentId);
    if (!profile) {
      throw new Error(`Profile "${currentId}" references unknown parent profile.`);
    }

    values.unshift(...pick(profile));
    currentId = profile.extends;
  }

  return unique(values);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
