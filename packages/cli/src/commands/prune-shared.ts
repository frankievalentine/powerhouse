import {
  ledgerEntryKey,
  removeInstalledTool,
  removeManagedSkills,
  removeTrackedCatalogEntry,
  type DetectedPlatform,
  type PlatformTarget,
  type PruneAnalysis,
  type RegistryData
} from '@powerhouse/core';

import { printInstallerLog } from '../ui/output.ts';

export interface ApplyPruneOptions {
  keepTools?: boolean;
  keepConfigs?: boolean;
  forceDrift?: boolean;
}

export interface ApplyPruneResult {
  removedKeys: Set<string>;
  warnings: string[];
}

export async function applyPruneAnalysis(
  analysis: PruneAnalysis,
  registry: RegistryData,
  platform: DetectedPlatform & { os: PlatformTarget },
  options: ApplyPruneOptions = {}
): Promise<ApplyPruneResult> {
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
        onLog: printInstallerLog,
        forceDrift: options.forceDrift
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

  return {
    removedKeys,
    warnings
  };
}
