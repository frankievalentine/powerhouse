import type { DetectedPlatform, SupportedPlatform } from '../platform/detect.ts';
import type { RegistryData } from './load.ts';

import { resolveBootstrapPlan } from '../install/resolve.ts';

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

  const toolIds = new Set(registry.tools.map((tool) => tool.id));

  for (const tool of registry.tools) {
    for (const platform of tool.supportedPlatforms) {
      if (tool.installs[platform].length === 0) {
        errors.push(`Tool "${tool.id}" supports ${platform} but has no install steps for that platform.`);
      }
    }
  }

  for (const profile of registry.profiles) {
    for (const toolId of profile.toolIds) {
      if (!toolIds.has(toolId)) {
        errors.push(`Profile "${profile.id}" references missing tool "${toolId}".`);
      }
    }

    for (const agent of profile.defaultAgents) {
      if (!toolIds.has(agent)) {
        errors.push(`Profile "${profile.id}" references missing default agent "${agent}".`);
        continue;
      }
      if (!profile.toolIds.includes(agent)) {
        errors.push(`Profile "${profile.id}" default agent "${agent}" is not included in the profile tool set.`);
      }
    }
  }

  for (const domain of registry.domains) {
    for (const toolId of domain.extraToolIds) {
      if (!toolIds.has(toolId)) {
        errors.push(`Domain "${domain.id}" references missing extra tool "${toolId}".`);
      }
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

function syntheticPlatform(os: SupportedPlatform): DetectedPlatform & { os: SupportedPlatform } {
  return {
    os,
    arch: os === 'darwin' ? 'arm64' : 'x64',
    shell: 'unknown',
    homeDir: '',
    xdgConfigHome: '',
    xdgCacheHome: '',
    xdgStateHome: ''
  };
}

