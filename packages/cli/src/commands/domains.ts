import {
  detectPlatform,
  getPowerhousePaths,
  loadRegistry,
  loadState,
  reconcileSelectedOptionalToolIds,
  resolveDomainRecommendedToolIds,
  type ToolManifest
} from '@powerhouse/core';

import { runSetupCommand } from './setup.ts';
import { addSelectionIds, getActiveSelection, normalizeSelectionIds, removeSelectionIds, resolveSelectedManifests } from './selection.ts';
import { printBulletSection, printCurrentSelection, printKeyValueRows, printManifestList, summarizeDescription } from '../ui/output.ts';

export interface DomainSelectionCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
}

export async function runDomainListCommand(): Promise<void> {
  const registry = await loadRegistry();
  printManifestList(
    registry.domains.map((domain) => ({
      id: domain.id,
      title: domain.title,
      description: domain.description,
      kind: 'domain'
    }))
  );
}

export async function runDomainShowCommand(domainId: string): Promise<void> {
  const registry = await loadRegistry();
  const domain = registry.domains.find((entry) => entry.id === domainId);

  if (!domain) {
    throw new Error(`Unknown domain "${domainId}".`);
  }

  const recommendedTools = resolveSelectedManifests(registry.tools, domain.recommendedToolIds);

  console.log(domain.title);
  console.log(summarizeDescription(domain.description, 'domain'));
  console.log('');
  printKeyValueRows([
    { label: 'ID', value: domain.id },
    { label: 'Recommended tools', value: recommendedTools.map((tool) => tool.id).join(', ') || 'none' }
  ]);

  console.log('');
  printBulletSection(
    'Skill packages',
    domain.skillPackages.map((pkg) => `${pkg.source}${pkg.skills.length > 0 ? `: ${pkg.skills.join(', ')}` : ''}`),
    'No skill packages'
  );

  if (domain.notes.length > 0) {
    console.log('');
    printBulletSection('Notes', domain.notes);
  }
}

export async function runDomainCurrentCommand(): Promise<void> {
  const platform = detectPlatform();
  const state = await loadState(getPowerhousePaths(platform));
  if (!state) {
    throw new Error('No saved powerhouse state found. Run `powerhouse setup` first.');
  }

  const registry = await loadRegistry();
  const domains = resolveSelectedManifests(registry.domains, state.activeDomainIds);
  if (domains.length !== state.activeDomainIds.length) {
    const missing = state.activeDomainIds.filter((domainId) => !domains.some((domain) => domain.id === domainId));
    throw new Error(`Saved domain selection contains missing manifest(s): ${missing.join(', ')}.`);
  }

  printCurrentSelection('domain', domains, state.updatedAt);
}

export async function runDomainUseCommand(domainIds: string[], options: DomainSelectionCommandOptions): Promise<void> {
  await applyDomainSelectionChange(domainIds, 'use', options);
}

export async function runDomainAddCommand(domainIds: string[], options: DomainSelectionCommandOptions): Promise<void> {
  await applyDomainSelectionChange(domainIds, 'add', options);
}

export async function runDomainRemoveCommand(domainIds: string[], options: DomainSelectionCommandOptions): Promise<void> {
  await applyDomainSelectionChange(domainIds, 'remove', options);
}

async function applyDomainSelectionChange(
  domainIds: string[],
  mode: 'use' | 'add' | 'remove',
  options: DomainSelectionCommandOptions
): Promise<void> {
  const platform = detectPlatform();
  const paths = getPowerhousePaths(platform);
  const [registry, state] = await Promise.all([loadRegistry(), loadState(paths)]);
  const activeSelection = getActiveSelection(state);

  const nextDomainIds =
    mode === 'use'
      ? normalizeSelectionIds(registry.domains, domainIds, 'domain')
      : mode === 'add'
        ? addSelectionIds(registry.domains, activeSelection.domainIds, domainIds, 'domain')
        : buildRemovedSelection(registry.domains, activeSelection.domainIds, domainIds, 'domain');

  const previousRecommendedToolIds = resolveDomainRecommendedToolIds(
    resolveSelectedManifests(registry.domains, activeSelection.domainIds)
  );
  const nextRecommendedToolIds = resolveDomainRecommendedToolIds(
    resolveSelectedManifests(registry.domains, nextDomainIds)
  );
  const nextSelectedToolIds = reconcileSelectedOptionalToolIds(
    activeSelection.selectedToolIds,
    previousRecommendedToolIds,
    nextRecommendedToolIds
  );

  await runSetupCommand({
    harness: activeSelection.harnessIds,
    domain: nextDomainIds,
    tool: nextSelectedToolIds,
    dryRun: options.dryRun,
    yes: options.yes,
    introText: `powerhouse domain ${mode} ${domainIds.join(' ')}`,
    interactive: false,
    applyPrune: mode !== 'add'
  });
}

function buildRemovedSelection(
  entries: Array<{ id: string }>,
  currentIds: string[],
  removedIds: string[],
  kind: 'harness' | 'domain' | 'tool'
): string[] {
  normalizeSelectionIds(entries, removedIds, kind);
  return removeSelectionIds(entries, currentIds, removedIds, kind);
}
