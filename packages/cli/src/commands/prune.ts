import { cancel, confirm, intro, isCancel, outro } from '@clack/prompts';
import {
  computePruneAnalysis,
  detectPlatform,
  getPowerhousePaths,
  isSetupPlatform,
  ledgerEntryKey,
  loadLedger,
  loadRegistry,
  loadState,
  removeLedgerEntries,
  resolveSetupPlan,
  saveLedger,
  saveState
} from '@powerhouse/core';

import { applyPruneAnalysis } from './prune-shared.ts';

export interface PruneCommandOptions {
  yes?: boolean;
  keepTools?: boolean;
  keepConfigs?: boolean;
}

export async function runPruneCommand(options: PruneCommandOptions = {}): Promise<void> {
  intro('powerhouse prune');

  const platform = detectPlatform();
  if (!isSetupPlatform(platform)) {
    cancel(`Unsupported platform: ${platform.os}.`);
    process.exitCode = 1;
    return;
  }

  const paths = getPowerhousePaths(platform);
  const state = await loadState(paths);
  if (!state) {
    throw new Error('No saved powerhouse state found. Run `powerhouse setup` first.');
  }

  const [registry, ledger] = await Promise.all([loadRegistry(), loadLedger(paths)]);
  const plan = resolveSetupPlan(registry, platform, state.activeHarnessIds, state.activeDomainIds, state.selectedToolIds);
  const analysis = computePruneAnalysis(ledger, plan);
  const removableCount =
    analysis.tools.length + analysis.skills.length + analysis.integrations.length + analysis.mcpServers.length;

  if (removableCount === 0 && analysis.blocked.length === 0) {
    outro('No prune candidates.');
    return;
  }

  if (!options.yes) {
    const proceed = await confirm({
      message: `Remove ${removableCount} out-of-plan managed asset${removableCount === 1 ? '' : 's'} now?`
    });
    if (isCancel(proceed) || !proceed) {
      cancel('Prune cancelled.');
      return;
    }
  }

  const { removedKeys, warnings } = await applyPruneAnalysis(analysis, registry, platform, options);

  const updatedAt = new Date().toISOString();
  const nextLedger = removeLedgerEntries(ledger, (entry) => removedKeys.has(ledgerEntryKey(entry)), updatedAt);
  await saveLedger(paths, nextLedger);
  await saveState(paths, {
    ...state,
    schemaVersion: 4,
    updatedAt
  });

  console.log(`Pruned ${removedKeys.size} asset${removedKeys.size === 1 ? '' : 's'}.`);
  for (const warning of warnings) {
    console.log(`warning: ${warning}`);
  }
  outro('Prune complete.');
}
