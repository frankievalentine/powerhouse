import type { DetectedPlatform, PlatformTarget } from '../platform/detect.ts';
import type { RegistryData } from './load.ts';

import { resolveBootstrapPlan, resolveProfileToolIds } from '../install/resolve.ts';

export interface RegistryValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateRegistry(registry: RegistryData): RegistryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  assertUniqueIds('tool', registry.tools.map((tool) => tool.id), errors);
  assertUniqueIds('profile', registry.profiles.map((profile) => profile.id), errors);
  assertUniqueIds('domain', registry.domains.map((domain) => domain.id), errors);
  assertUniqueIds('integration', registry.integrations.map((integration) => integration.id), errors);
  assertUniqueIds('mcp', registry.mcpServers.map((server) => server.id), errors);

  const toolIds = new Set(registry.tools.map((tool) => tool.id));
  const integrationIds = new Set(registry.integrations.map((integration) => integration.id));
  const mcpServerIds = new Set(registry.mcpServers.map((server) => server.id));

  for (const tool of registry.tools) {
    for (const platform of tool.supportedPlatforms) {
      if (platform === 'win32' && tool.installs.win32.length === 0) {
        warnings.push(`Tool "${tool.id}" supports win32 for planning, but native install steps are not defined yet.`);
        continue;
      }

      if (platform === 'wsl' && tool.installs.wsl.length === 0 && tool.installs.linux.length > 0) {
        continue;
      }

      if (tool.installs[platform].length === 0) {
        errors.push(`Tool "${tool.id}" supports ${platform} but has no install steps for that platform.`);
      }
    }
  }

  for (const profile of registry.profiles) {
    const resolvedToolIds = resolveProfileToolIds(registry, profile.id);

    for (const toolId of profile.toolIds) {
      if (!toolIds.has(toolId)) {
        errors.push(`Profile "${profile.id}" references missing tool "${toolId}".`);
      }
    }

    for (const agent of profile.defaultAgents) {
      if (toolIds.has(agent) && !resolvedToolIds.includes(agent)) {
        errors.push(`Profile "${profile.id}" default agent "${agent}" is not included in the profile tool set.`);
      }
    }

    for (const integrationId of profile.integrationIds) {
      if (!integrationIds.has(integrationId)) {
        errors.push(`Profile "${profile.id}" references missing integration "${integrationId}".`);
      }
    }

    for (const mcpServerId of profile.mcpServerIds) {
      if (!mcpServerIds.has(mcpServerId)) {
        errors.push(`Profile "${profile.id}" references missing MCP server "${mcpServerId}".`);
      }
    }
  }

  const profileIds = new Set(registry.profiles.map((profile) => profile.id));

  for (const profile of registry.profiles) {
    if (profile.extends) {
      if (!profileIds.has(profile.extends)) {
        errors.push(`Profile "${profile.id}" extends unknown profile "${profile.extends}".`);
      }
    }
  }

  for (const profile of registry.profiles) {
    const chain = new Set<string>();
    let currentId: string | undefined = profile.id;
    while (currentId) {
      if (chain.has(currentId)) {
        errors.push(`Circular profile inheritance detected involving "${currentId}".`);
        break;
      }
      chain.add(currentId);
      const currentProfile = registry.profiles.find((p) => p.id === currentId);
      currentId = currentProfile?.extends;
    }
  }

  for (const domain of registry.domains) {
    for (const toolId of domain.extraToolIds) {
      if (!toolIds.has(toolId)) {
        errors.push(`Domain "${domain.id}" references missing extra tool "${toolId}".`);
      }
    }

    for (const integrationId of domain.integrationIds) {
      if (!integrationIds.has(integrationId)) {
        errors.push(`Domain "${domain.id}" references missing integration "${integrationId}".`);
      }
    }

    for (const mcpServerId of domain.mcpServerIds) {
      if (!mcpServerIds.has(mcpServerId)) {
        errors.push(`Domain "${domain.id}" references missing MCP server "${mcpServerId}".`);
      }
    }
  }

  for (const integration of registry.integrations) {
    if (integration.install.kind !== integration.installKind) {
      errors.push(`Integration "${integration.id}" installKind does not match install.kind.`);
    }

    for (const bundledMcpId of integration.bundledMcpIds) {
      if (!mcpServerIds.has(bundledMcpId)) {
        errors.push(`Integration "${integration.id}" references missing bundled MCP server "${bundledMcpId}".`);
      }
    }
  }

  for (const server of registry.mcpServers) {
    if (server.install.kind !== 'native-cli' && server.install.kind !== 'json-config' && server.install.kind !== 'toml-config' && server.install.kind !== 'manual') {
      errors.push(`MCP server "${server.id}" has an unsupported install kind.`);
    }
  }

  for (const profile of registry.profiles) {
    for (const domain of registry.domains) {
      for (const platform of profile.supportedPlatforms) {
        try {
          resolveBootstrapPlan(registry, syntheticPlatform(platform), profile.id, domain.id);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`Plan "${profile.id}" + "${domain.id}" on ${platform} is invalid: ${message}`);
        }
      }
    }
  }

  if (registry.tools.length === 0) {
    warnings.push('Registry does not contain any tools.');
  }

  if (registry.integrations.length === 0) {
    warnings.push('Registry does not contain any integrations.');
  }

  if (registry.mcpServers.length === 0) {
    warnings.push('Registry does not contain any MCP servers.');
  }

  return { errors, warnings };
}

function assertUniqueIds(kind: string, ids: string[], errors: string[]): void {
  const counts = new Map<string, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of counts) {
    if (count > 1) {
      errors.push(`Duplicate ${kind} id "${id}" found ${count} times.`);
    }
  }
}

function syntheticPlatform(os: PlatformTarget): DetectedPlatform & { os: PlatformTarget } {
  return {
    os,
    arch: os === 'darwin' ? 'arm64' : 'x64',
    shell: 'unknown',
    homeDir: '',
    xdgConfigHome: '',
    xdgDataHome: '',
    xdgCacheHome: '',
    xdgStateHome: ''
  };
}
