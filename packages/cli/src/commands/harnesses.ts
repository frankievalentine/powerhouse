import {
  detectPlatform,
  findIntegrations,
  findMcpServers,
  getPowerhousePaths,
  loadRegistry,
  loadState,
  reconcileSelectedOptionalToolIds,
  resolveDomainRecommendedToolIds,
  resolveHarnessIntegrationIds,
  resolveHarnessMcpServerIds,
  resolveHarnessRequiredToolIds,
  type PlatformTarget
} from '@powerhouse/core';

import { runSetupCommand } from './setup.ts';
import { addSelectionIds, getActiveSelection, normalizeSelectionIds, removeSelectionIds, resolveSelectedManifests } from './selection.ts';
import {
  formatPlatform,
  formatPlatformList,
  printBulletSection,
  printCurrentSelection,
  printKeyValueRows,
  printManifestList,
  summarizeDescription
} from '../ui/output.ts';

export interface HarnessSelectionCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
}

export interface HarnessListCommandOptions {
  platform?: PlatformTarget;
}

export interface HarnessShowCommandOptions {
  platform?: PlatformTarget;
}

export async function runHarnessListCommand(options: HarnessListCommandOptions = {}): Promise<void> {
  const registry = await loadRegistry();
  const selectableHarnesses = registry.harnesses.filter(
    (harness) => harness.id !== 'base' && (!options.platform || harness.supportedPlatforms.includes(options.platform))
  );

  printManifestList(
    selectableHarnesses.map((harness) => ({
      id: harness.id,
      title: harness.title,
      description: harness.description,
      kind: 'harness',
      metadata: [`Works on: ${formatPlatformList(harness.supportedPlatforms)}`]
    }))
  );
}

export async function runHarnessShowCommand(harnessId: string, options: HarnessShowCommandOptions = {}): Promise<void> {
  const registry = await loadRegistry();
  const harness = registry.harnesses.find((entry) => entry.id === harnessId);

  if (!harness) {
    throw new Error(`Unknown harness "${harnessId}".`);
  }

  const resolvedToolIds = resolveHarnessRequiredToolIds(registry, harnessId);
  const resolvedIntegrationIds = resolveHarnessIntegrationIds(registry, harnessId);
  const resolvedMcpServerIds = resolveHarnessMcpServerIds(registry, harnessId);
  const availableIntegrations = findIntegrations(registry, {
    agents: harness.defaultAgents,
    platform: options.platform
  }).map((entry) => entry.id);
  const availableMcpServers = findMcpServers(registry, {
    agents: harness.defaultAgents,
    platform: options.platform
  }).map((entry) => entry.id);
  const extraIntegrations = availableIntegrations.filter((entry) => !resolvedIntegrationIds.includes(entry));
  const extraMcpServers = availableMcpServers.filter((entry) => !resolvedMcpServerIds.includes(entry));

  console.log(harness.title);
  console.log(summarizeDescription(harness.description, 'harness'));
  console.log('');
  printKeyValueRows([
    { label: 'ID', value: harness.id },
    { label: 'Type', value: formatHarnessKind(harness.kind) },
    { label: 'Extends', value: harness.extends },
    { label: 'Platforms', value: formatPlatformList(harness.supportedPlatforms) },
    { label: options.platform ? `Supported on ${formatPlatform(options.platform)}` : '', value: options.platform ? (harness.supportedPlatforms.includes(options.platform) ? 'yes' : 'no') : '' },
    { label: 'Default agents', value: harness.defaultAgents.join(', ') || 'none' }
  ]);
  console.log('');
  printBulletSection('Included by default', [
    `Required tools: ${resolvedToolIds.join(', ') || 'none'}`,
    `Integrations: ${resolvedIntegrationIds.join(', ') || 'none'}`,
    `MCP servers: ${resolvedMcpServerIds.join(', ') || 'none'}`
  ]);

  if (extraIntegrations.length > 0 || extraMcpServers.length > 0) {
    console.log('');
    printBulletSection('More available for this agent', [
      ...(extraIntegrations.length > 0 ? [`Integrations: ${extraIntegrations.join(', ')}`] : []),
      ...(extraMcpServers.length > 0 ? [`MCP servers: ${extraMcpServers.join(', ')}`] : [])
    ]);
  }

  if (harness.notes.length > 0) {
    console.log('');
    printBulletSection('Notes', harness.notes);
  }
}

export async function runHarnessCurrentCommand(): Promise<void> {
  const platform = detectPlatform();
  const state = await loadState(getPowerhousePaths(platform));
  if (!state) {
    throw new Error('No saved powerhouse state found. Run `powerhouse setup` first.');
  }

  const registry = await loadRegistry();
  const harnesses = resolveSelectedManifests(registry.harnesses, state.activeHarnessIds);
  if (harnesses.length !== state.activeHarnessIds.length) {
    const missing = state.activeHarnessIds.filter((harnessId) => !harnesses.some((harness) => harness.id === harnessId));
    throw new Error(`Saved harness selection contains missing manifest(s): ${missing.join(', ')}.`);
  }

  printCurrentSelection('harness', harnesses, state.updatedAt);
}

export async function runHarnessUseCommand(harnessIds: string[], options: HarnessSelectionCommandOptions): Promise<void> {
  await applyHarnessSelectionChange(harnessIds, 'use', options);
}

export async function runHarnessAddCommand(harnessIds: string[], options: HarnessSelectionCommandOptions): Promise<void> {
  await applyHarnessSelectionChange(harnessIds, 'add', options);
}

export async function runHarnessRemoveCommand(harnessIds: string[], options: HarnessSelectionCommandOptions): Promise<void> {
  await applyHarnessSelectionChange(harnessIds, 'remove', options);
}

async function applyHarnessSelectionChange(
  harnessIds: string[],
  mode: 'use' | 'add' | 'remove',
  options: HarnessSelectionCommandOptions
): Promise<void> {
  const platform = detectPlatform();
  const paths = getPowerhousePaths(platform);
  const [registry, state] = await Promise.all([loadRegistry(), loadState(paths)]);
  const selectableHarnesses = registry.harnesses.filter((harness) => harness.id !== 'base');
  const activeSelection = getActiveSelection(state);

  const nextHarnessIds =
    mode === 'use'
      ? normalizeSelectionIds(selectableHarnesses, harnessIds, 'harness')
      : mode === 'add'
        ? addSelectionIds(selectableHarnesses, activeSelection.harnessIds, harnessIds, 'harness')
        : buildRemovedSelection(selectableHarnesses, activeSelection.harnessIds, harnessIds, 'harness');

  const previousRecommendedToolIds = resolveDomainRecommendedToolIds(
    resolveSelectedManifests(registry.domains, activeSelection.domainIds)
  );
  const nextRecommendedToolIds = resolveDomainRecommendedToolIds(
    resolveSelectedManifests(registry.domains, activeSelection.domainIds)
  );
  const nextSelectedToolIds = reconcileSelectedOptionalToolIds(
    activeSelection.selectedToolIds,
    previousRecommendedToolIds,
    nextRecommendedToolIds
  );

  await runSetupCommand({
    harness: nextHarnessIds,
    domain: activeSelection.domainIds,
    tool: nextSelectedToolIds,
    dryRun: options.dryRun,
    yes: options.yes,
    introText: `powerhouse harness ${mode} ${harnessIds.join(' ')}`,
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

function formatHarnessKind(kind: string | undefined): string {
  if (!kind) {
    return 'Harness';
  }

  switch (kind) {
    case 'terminal-agent':
      return 'Terminal agent';
    case 'editor-integrated':
      return 'Editor with built-in agent';
    case 'ecosystem':
      return 'Agent ecosystem';
    case 'local-first':
      return 'Local-first agent';
    default:
      return kind.replace(/-/g, ' ');
  }
}
