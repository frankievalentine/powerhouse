import { detectPlatform, getPowerhousePaths, loadRegistry, loadState } from '@powerhouse/core';

import { DEFAULT_DOMAIN_ID, runBootstrapCommand } from './bootstrap.ts';
import { printCurrentSelection, printManifestList } from '../ui/output.ts';

export interface ProfileUseCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
}

export async function runProfileListCommand(): Promise<void> {
  const registry = await loadRegistry();
  printManifestList(registry.profiles);
}

export async function runProfileShowCommand(profileId: string): Promise<void> {
  const registry = await loadRegistry();
  const profile = registry.profiles.find((entry) => entry.id === profileId);

  if (!profile) {
    throw new Error(`Unknown profile "${profileId}".`);
  }

  console.log(`id: ${profile.id}`);
  console.log(`title: ${profile.title}`);
  console.log(`description: ${profile.description}`);
  console.log(`platforms: ${profile.supportedPlatforms.join(', ')}`);
  console.log(`tools: ${profile.toolIds.join(', ')}`);
  console.log(`agents: ${profile.defaultAgents.join(', ') || 'none'}`);
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
