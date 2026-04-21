import type { DetectedPlatform, SupportedPlatform } from '../platform/detect.ts';
import type { DomainManifest, ProfileManifest, ToolManifest } from '../registry/schema.ts';
import type { RegistryData } from '../registry/load.ts';

export interface BootstrapPlan {
  profile: ProfileManifest;
  domain: DomainManifest;
  tools: ToolManifest[];
  agents: string[];
  notes: string[];
}

export function resolveBootstrapPlan(
  registry: RegistryData,
  platform: DetectedPlatform & { os: SupportedPlatform },
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

  const toolIds = unique([...profile.toolIds, ...domain.extraToolIds]);
  const tools = toolIds.map((toolId) => {
    const tool = registry.tools.find((entry) => entry.id === toolId);
    if (!tool) {
      throw new Error(`Manifest references missing tool "${toolId}".`);
    }
    if (!tool.supportedPlatforms.includes(platform.os)) {
      throw new Error(`Tool "${tool.id}" does not support ${platform.os}.`);
    }
    return tool;
  });

  tools.sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));

  return {
    profile,
    domain,
    tools,
    agents: unique(profile.defaultAgents),
    notes: [...profile.notes, ...domain.notes]
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

