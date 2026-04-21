import {
  detectPlatform,
  findIntegrations,
  findMcpServers,
  getPowerhousePaths,
  loadRegistry,
  loadState,
  resolveProfileIntegrationIds,
  resolveProfileMcpServerIds,
  resolveProfileToolIds,
  type PlatformTarget
} from '@powerhouse/core';

import { DEFAULT_DOMAIN_ID, runBootstrapCommand } from './bootstrap.ts';
import { printCurrentSelection } from '../ui/output.ts';

export interface ProfileUseCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
}

export interface ProfileListCommandOptions {
  platform?: PlatformTarget;
}

export interface ProfileShowCommandOptions {
  platform?: PlatformTarget;
}

export async function runProfileListCommand(options: ProfileListCommandOptions = {}): Promise<void> {
  const registry = await loadRegistry();
  const selectableProfiles = registry.profiles.filter(
    (profile) => profile.id !== 'base' && (!options.platform || profile.supportedPlatforms.includes(options.platform))
  );

  for (const profile of selectableProfiles) {
    console.log(`${profile.id.padEnd(14)} ${profile.title}`);
    console.log(`  ${profile.description}`);
    console.log(`  platforms: ${profile.supportedPlatforms.join(', ')}`);
  }
}

export async function runProfileShowCommand(profileId: string, options: ProfileShowCommandOptions = {}): Promise<void> {
  const registry = await loadRegistry();
  const profile = registry.profiles.find((entry) => entry.id === profileId);

  if (!profile) {
    throw new Error(`Unknown profile "${profileId}".`);
  }

  const resolvedToolIds = resolveProfileToolIds(registry, profileId);
  const resolvedIntegrationIds = resolveProfileIntegrationIds(registry, profileId);
  const resolvedMcpServerIds = resolveProfileMcpServerIds(registry, profileId);
  const availableIntegrations = findIntegrations(registry, {
    agents: profile.defaultAgents,
    platform: options.platform
  }).map((entry) => entry.id);
  const availableMcpServers = findMcpServers(registry, {
    agents: profile.defaultAgents,
    platform: options.platform
  }).map((entry) => entry.id);

  console.log(`id: ${profile.id}`);
  console.log(`title: ${profile.title}`);
  console.log(`description: ${profile.description}`);
  if (profile.kind) {
    console.log(`kind: ${profile.kind}`);
  }
  if (profile.extends) {
    console.log(`extends: ${profile.extends}`);
  }
  console.log(`platforms: ${profile.supportedPlatforms.join(', ')}`);
  if (options.platform) {
    console.log(`supported on ${options.platform}: ${profile.supportedPlatforms.includes(options.platform) ? 'yes' : 'no'}`);
  }
  console.log(`tools: ${resolvedToolIds.join(', ')}`);
  console.log(`agents: ${profile.defaultAgents.join(', ') || 'none'}`);
  console.log(`integrations in plan: ${resolvedIntegrationIds.join(', ') || 'none'}`);
  console.log(`mcp servers in plan: ${resolvedMcpServerIds.join(', ') || 'none'}`);
  console.log(`available integrations: ${availableIntegrations.join(', ') || 'none'}`);
  console.log(`available mcp servers: ${availableMcpServers.join(', ') || 'none'}`);
}

export async function runProfileCurrentCommand(): Promise<void> {
  const platform = detectPlatform();
  const state = await loadState(getPowerhousePaths(platform));
  if (!state) {
    throw new Error('No saved powerhouse state found. Run `powerhouse bootstrap` first.');
  }

  const registry = await loadRegistry();
  const profile = registry.profiles.find((entry) => entry.id === state.activeProfileId);
  if (!profile) {
    throw new Error(`Saved profile "${state.activeProfileId}" no longer exists in the registry.`);
  }

  printCurrentSelection('profile', profile, state.updatedAt);
}

export async function runProfileUseCommand(profileId: string, options: ProfileUseCommandOptions): Promise<void> {
  const platform = detectPlatform();
  const state = await loadState(getPowerhousePaths(platform));
  const domainId = state?.activeDomainId ?? DEFAULT_DOMAIN_ID;

  await runBootstrapCommand({
    profile: profileId,
    domain: domainId,
    dryRun: options.dryRun,
    yes: options.yes,
    introText: `powerhouse profile use ${profileId}`,
    interactive: false
  });
}
