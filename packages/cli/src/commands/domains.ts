import { detectPlatform, getPowerhousePaths, loadRegistry, loadState } from '@powerhouse/core';

import { DEFAULT_PROFILE_ID, runBootstrapCommand } from './bootstrap.ts';
import { printCurrentSelection, printManifestList } from '../ui/output.ts';

export interface DomainUseCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
}

export async function runDomainListCommand(): Promise<void> {
  const registry = await loadRegistry();
  printManifestList(registry.domains);
}

export async function runDomainShowCommand(domainId: string): Promise<void> {
  const registry = await loadRegistry();
  const domain = registry.domains.find((entry) => entry.id === domainId);

  if (!domain) {
    throw new Error(`Unknown domain "${domainId}".`);
  }

  console.log(`id: ${domain.id}`);
  console.log(`title: ${domain.title}`);
  console.log(`description: ${domain.description}`);
  console.log(`extra tools: ${domain.extraToolIds.join(', ') || 'none'}`);
  console.log(
    `skill packages: ${
      domain.skillPackages.length > 0
        ? domain.skillPackages
            .map((pkg) => `${pkg.source}${pkg.skills.length > 0 ? ` (${pkg.skills.join(', ')})` : ''}`)
            .join('; ')
        : 'none'
    }`
  );
}

export async function runDomainCurrentCommand(): Promise<void> {
  const platform = detectPlatform();
  const state = await loadState(getPowerhousePaths(platform));
  if (!state) {
    throw new Error('No saved powerhouse state found. Run `powerhouse bootstrap` first.');
  }

  const registry = await loadRegistry();
  const domain = registry.domains.find((entry) => entry.id === state.activeDomainId);
  if (!domain) {
    throw new Error(`Saved domain "${state.activeDomainId}" no longer exists in the registry.`);
  }

  printCurrentSelection('domain', domain, state.updatedAt);
}

export async function runDomainUseCommand(domainId: string, options: DomainUseCommandOptions): Promise<void> {
  const platform = detectPlatform();
  const state = await loadState(getPowerhousePaths(platform));
  const profileId = state?.activeProfileId ?? DEFAULT_PROFILE_ID;

  await runBootstrapCommand({
    profile: profileId,
    domain: domainId,
    dryRun: options.dryRun,
    yes: options.yes,
    introText: `powerhouse domain use ${domainId}`,
    interactive: false
  });
}
