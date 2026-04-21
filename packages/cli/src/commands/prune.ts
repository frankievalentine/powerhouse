import { cancel, confirm, intro, isCancel, outro } from '@clack/prompts';
import {
  computePruneAnalysis,
  detectPlatform,
  getPowerhousePaths,
  isBootstrapPlatform,
  ledgerEntryKey,
  loadLedger,
  loadRegistry,
  loadState,
  removeInstalledTool,
  removeLedgerEntries,
  removeManagedSkills,
  removeTrackedCatalogEntry,
  resolveBootstrapPlan,
  saveLedger,
  saveState
} from '@powerhouse/core';

import { printInstallerLog } from '../ui/output.ts';

export interface PruneCommandOptions {
  yes?: boolean;
  keepTools?: boolean;
  keepConfigs?: boolean;
}

export async function runPruneCommand(options: PruneCommandOptions = {}): Promise<void> {
  intro('powerhouse prune');

  const platform = detectPlatform();
  if (!isBootstrapPlatform(platform)) {
    cancel(platform.os === 'win32' ? 'Run powerhouse under WSL for install lifecycle commands.' : `Unsupported platform: ${platform.os}.`);
    process.exitCode = 1;
    return;
  }

  const paths = getPowerhousePaths(platform);
  const state = await loadState(paths);
  if (!state) {
    throw new Error('No saved powerhouse state found. Run `powerhouse bootstrap` first.');
  }

  const [registry, ledger] = await Promise.all([loadRegistry(), loadLedger(paths)]);
  const plan = resolveBootstrapPlan(registry, platform, state.activeProfileId, state.activeDomainId);
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

  const removedKeys = new Set<string>();
  const warnings: string[] = [];

  if (!options.keepTools) {
    for (const entry of analysis.tools) {
      const tool = registry.tools.find((candidate) => candidate.id === entry.toolId);
      if (!tool) {
        warnings.push(`Cannot prune "${entry.toolId}" because its manifest is no longer present.`);
        continue;
      }

      const result = await removeInstalledTool(tool, platform.os, {
        onLog: printInstallerLog
      });
      if (result.status === 'removed') {
        removedKeys.add(ledgerEntryKey(entry));
      } else {
        warnings.push(result.detail);
      }
    }
  } else if (analysis.tools.length > 0) {
    warnings.push('Skipped tracked tool cleanup due to --keep-tools.');
  }

  const skillResults = await removeManagedSkills(
    analysis.skills.map((entry) => ({
      source: entry.source,
      skillName: entry.skillName,
      agent: entry.agent,
      scope: entry.scope,
      removable: entry.removable
    })),
    {
      onLog: printInstallerLog
    }
  );
  const removedSkillGroups = new Set(skillResults.filter((result) => result.status === 'removed').map((result) => result.key));
  for (const entry of analysis.skills) {
    if (removedSkillGroups.has(`${entry.agent}:${entry.scope}`)) {
      removedKeys.add(ledgerEntryKey(entry));
    }
  }
  warnings.push(...skillResults.filter((result) => result.status === 'skipped').map((result) => result.detail));

  if (!options.keepConfigs) {
    for (const entry of [...analysis.integrations, ...analysis.mcpServers]) {
      const result = await removeTrackedCatalogEntry(entry, {
        onLog: printInstallerLog
      });
      if (result.status === 'removed') {
        removedKeys.add(ledgerEntryKey(entry));
      } else {
        warnings.push(result.detail);
      }
    }
  } else if (analysis.integrations.length > 0 || analysis.mcpServers.length > 0) {
    warnings.push('Skipped tracked integration and MCP config cleanup due to --keep-configs.');
  }

  if (analysis.blocked.length > 0) {
    warnings.push(
      ...analysis.blocked.map((entry) =>
        entry.kind === 'tool'
          ? `Tracked tool "${entry.toolId}" is out of plan but cannot be safely removed automatically.`
          : entry.kind === 'skill'
            ? `Tracked skill "${entry.source}" is out of plan but lacks a removable skill identifier.`
            : `Tracked ${entry.kind} "${entry.id}" is out of plan but has no reversible change record.`
      )
    );
  }

  const updatedAt = new Date().toISOString();
  const nextLedger = removeLedgerEntries(ledger, (entry) => removedKeys.has(ledgerEntryKey(entry)), updatedAt);
  await saveLedger(paths, nextLedger);
  await saveState(paths, {
    ...state,
    schemaVersion: 2,
    updatedAt
  });

  console.log(`Pruned ${removedKeys.size} asset${removedKeys.size === 1 ? '' : 's'}.`);
  for (const warning of warnings) {
    console.log(`warning: ${warning}`);
  }
  outro('Prune complete.');
}
