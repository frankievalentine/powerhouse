import {
  detectPlatform,
  getPowerhousePaths,
  loadRegistry,
  loadState,
  resolveDomainRecommendedToolIds,
  resolveHarnessRequiredToolIds,
  type PlatformTarget
} from '@powerhouse/core';

import { runSetupCommand } from './setup.ts';
import { getActiveSelection, normalizeOptionalToolSelectionIds, resolveSelectedManifests } from './selection.ts';
import {
  formatPlatform,
  formatPlatformList,
  printBulletSection,
  printKeyValueRows,
  printManifestList,
  printSection,
  summarizeDescription
} from '../ui/output.ts';

export interface ToolListCommandOptions {
  platform?: PlatformTarget;
}

export interface ToolShowCommandOptions {
  platform?: PlatformTarget;
}

export interface ToolSelectionCommandOptions {
  dryRun?: boolean;
  yes?: boolean;
}

export async function runToolListCommand(options: ToolListCommandOptions = {}): Promise<void> {
  const registry = await loadRegistry();
  const tools = options.platform ? registry.tools.filter((tool) => tool.supportedPlatforms.includes(options.platform!)) : registry.tools;

  printManifestList(
    tools.map((tool) => ({
      id: tool.id,
      title: tool.title,
      description: tool.description,
      kind: 'tool',
      metadata: [`Works on: ${formatPlatformList(tool.supportedPlatforms)}`]
    }))
  );
}

export async function runToolShowCommand(toolId: string, options: ToolShowCommandOptions = {}): Promise<void> {
  const registry = await loadRegistry();
  const tool = registry.tools.find((entry) => entry.id === toolId);

  if (!tool) {
    throw new Error(`Unknown tool "${toolId}".`);
  }

  const managedInstallLines = ([
    ['darwin', tool.installs.darwin],
    ['linux', tool.installs.linux],
    ['win32', tool.installs.win32],
    ['wsl', tool.installs.wsl]
  ] as const)
    .filter(([, steps]) => steps.length > 0)
    .map(([platform, steps]) => `${formatPlatform(platform)}: ${formatInstallSteps(steps)}`);

  console.log(tool.title);
  console.log(summarizeDescription(tool.description, 'tool'));
  console.log('');
  printKeyValueRows([
    { label: 'ID', value: tool.id },
    { label: 'Kind', value: formatKind(tool.kind) },
    { label: 'Priority', value: String(tool.priority) },
    { label: 'Platforms', value: formatPlatformList(tool.supportedPlatforms) },
    { label: options.platform ? `Supported on ${formatPlatform(options.platform)}` : '', value: options.platform ? (tool.supportedPlatforms.includes(options.platform) ? 'yes' : 'no') : '' },
    { label: 'Check', value: `${tool.check.command}${tool.check.args.length > 0 ? ` ${tool.check.args.join(' ')}` : ''}` },
    { label: 'Doctor hint', value: tool.doctorHint ?? 'none' }
  ]);

  if (managedInstallLines.length > 0) {
    console.log('');
    printBulletSection('Managed install methods', managedInstallLines);
  }
}

export async function runToolCurrentCommand(): Promise<void> {
  const platform = detectPlatform();
  const paths = getPowerhousePaths(platform);
  const [registry, state] = await Promise.all([loadRegistry(), loadState(paths)]);
  if (!state) {
    throw new Error('No saved powerhouse state found. Run `powerhouse setup` first.');
  }

  const activeHarnesses = resolveSelectedManifests(registry.harnesses, state.activeHarnessIds);
  const activeDomains = resolveSelectedManifests(registry.domains, state.activeDomainIds);
  const requiredToolIds = [...new Set(activeHarnesses.flatMap((harness) => resolveHarnessRequiredToolIds(registry, harness.id)))];
  const optionalToolIds = resolveDomainRecommendedToolIds(activeDomains);

  printSection('Selected tools');
  printKeyValueRows([
    { label: 'Required by harnesses', value: requiredToolIds.join(', ') || 'none' },
    { label: 'Selected optional tools', value: state.selectedToolIds.join(', ') || 'none' },
    { label: 'Available optional tools', value: optionalToolIds.join(', ') || 'none' },
    { label: 'Updated', value: state.updatedAt }
  ]);
}

export async function runToolUseCommand(toolIds: string[], options: ToolSelectionCommandOptions): Promise<void> {
  await applyToolSelectionChange(toolIds, 'use', options);
}

export async function runToolAddCommand(toolIds: string[], options: ToolSelectionCommandOptions): Promise<void> {
  await applyToolSelectionChange(toolIds, 'add', options);
}

export async function runToolRemoveCommand(toolIds: string[], options: ToolSelectionCommandOptions): Promise<void> {
  await applyToolSelectionChange(toolIds, 'remove', options);
}

async function applyToolSelectionChange(
  toolIds: string[],
  mode: 'use' | 'add' | 'remove',
  options: ToolSelectionCommandOptions
): Promise<void> {
  const platform = detectPlatform();
  const paths = getPowerhousePaths(platform);
  const [registry, state] = await Promise.all([loadRegistry(), loadState(paths)]);
  const activeSelection = getActiveSelection(state);
  const availableOptionalTools = resolveSelectedManifests(
    registry.tools,
    resolveDomainRecommendedToolIds(resolveSelectedManifests(registry.domains, activeSelection.domainIds))
  );
  const requiredToolIds = [
    ...new Set(
      resolveSelectedManifests(registry.harnesses, activeSelection.harnessIds).flatMap((harness) =>
        resolveHarnessRequiredToolIds(registry, harness.id)
      )
    )
  ];

  assertNoRequiredToolIds(toolIds, requiredToolIds);

  const nextSelectedToolIds =
    mode === 'use'
      ? normalizeOptionalToolSelectionIds(availableOptionalTools, toolIds)
      : mode === 'add'
        ? normalizeOptionalToolSelectionIds(availableOptionalTools, [...activeSelection.selectedToolIds, ...toolIds])
        : normalizeOptionalToolSelectionIds(
            availableOptionalTools,
            activeSelection.selectedToolIds.filter((toolId) => !new Set(toolIds).has(toolId))
          );

  await runSetupCommand({
    harness: activeSelection.harnessIds,
    domain: activeSelection.domainIds,
    tool: nextSelectedToolIds,
    dryRun: options.dryRun,
    yes: options.yes,
    introText: `powerhouse tool ${mode} ${toolIds.join(' ')}`,
    interactive: false,
    applyPrune: mode !== 'add'
  });
}

function assertNoRequiredToolIds(requestedToolIds: string[], requiredToolIds: string[]): void {
  const required = new Set(requiredToolIds);
  for (const toolId of requestedToolIds) {
    if (required.has(toolId)) {
      throw new Error(`Tool "${toolId}" is required by the active harness selection and cannot be changed here.`);
    }
  }
}

function formatInstallSteps(
  steps: Array<
    | { type: 'brew'; name: string; packageType: 'formula' | 'cask'; tap?: string }
    | { type: 'winget'; id: string; exact?: boolean }
    | { type: 'scoop'; name: string; bucket?: string }
    | { type: 'npm'; package: string }
    | { type: 'script'; url: string; args?: string[] }
    | { type: 'powershell-script'; url: string; args?: string[] }
  >
): string {
  if (steps.length === 0) {
    return 'none';
  }

  return steps
    .map((step) => {
      if (step.type === 'brew') {
        const tap = step.tap ? `${step.tap}/` : '';
        return step.packageType === 'cask' ? `brew install --cask ${tap}${step.name}` : `brew install ${tap}${step.name}`;
      }
      if (step.type === 'winget') {
        return step.exact === false ? `winget install ${step.id}` : `winget install --exact ${step.id}`;
      }
      if (step.type === 'scoop') {
        const bucket = step.bucket ? `${step.bucket}/` : '';
        return `scoop install ${bucket}${step.name}`;
      }
      if (step.type === 'npm') {
        return `npm install -g ${step.package}`;
      }
      if (step.type === 'powershell-script') {
        return `PowerShell script ${step.url}`;
      }
      return `Script ${step.url}`;
    })
    .join(' • ');
}

function formatKind(kind: string): string {
  return kind
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
