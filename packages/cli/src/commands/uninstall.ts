import { cancel, confirm, intro, isCancel, outro } from '@clack/prompts';
import {
  detectPlatform,
  getPowerhousePaths,
  isSetupPlatform,
  loadLedger,
  loadRegistry,
  loadState,
  removeInstalledTool,
  removeManagedPath,
  removeManagedShellBlock,
  removeManagedSkills,
  removeTrackedCatalogEntry
} from '@powerhouse/core';

import { printInstallerLog } from '../ui/output.ts';

export interface UninstallCommandOptions {
  yes?: boolean;
  keepTools?: boolean;
  keepConfigs?: boolean;
  purgeCache?: boolean;
  forceDrift?: boolean;
}

export async function runUninstallCommand(options: UninstallCommandOptions = {}): Promise<void> {
  intro('powerhouse uninstall');

  const platform = detectPlatform();
  if (!isSetupPlatform(platform)) {
    cancel(`Unsupported platform: ${platform.os}.`);
    process.exitCode = 1;
    return;
  }

  const paths = getPowerhousePaths(platform);
  const [ledger, state] = await Promise.all([loadLedger(paths), loadState(paths)]);
  const registry = await loadRegistry().catch(() => null);

  const trackedTools = ledger.entries.flatMap((entry) => (entry.kind === 'tool' && entry.ownership === 'installed' ? [entry] : []));
  const trackedSkills = ledger.entries.flatMap((entry) => (entry.kind === 'skill' ? [entry] : []));
  const trackedIntegrations = ledger.entries.flatMap((entry) => (entry.kind === 'integration' ? [entry] : []));
  const trackedMcpServers = ledger.entries.flatMap((entry) => (entry.kind === 'mcp' ? [entry] : []));

  const trackedCount =
    trackedTools.length + trackedSkills.length + trackedIntegrations.length + trackedMcpServers.length + 3;

  if (!options.yes) {
    const proceed = await confirm({
      message: `Remove powerhouse and ${trackedCount} tracked asset${trackedCount === 1 ? '' : 's'} now?`
    });
    if (isCancel(proceed) || !proceed) {
      cancel('Uninstall cancelled.');
      return;
    }
  }

  const warnings: string[] = [];

  if (!options.keepTools) {
    if (!registry) {
      warnings.push('Registry could not be loaded, so tracked tools were left installed.');
    } else {
      for (const entry of trackedTools) {
        const tool = registry.tools.find((candidate) => candidate.id === entry.toolId);
        if (!tool) {
          warnings.push(`Cannot remove "${entry.toolId}" because its manifest is no longer present.`);
          continue;
        }

        const result = await removeInstalledTool(tool, platform.os, {
          onLog: printInstallerLog
        });
        if (result.status !== 'removed') {
          warnings.push(result.detail);
        }
      }
    }
  } else if (trackedTools.length > 0) {
    warnings.push('Skipped tracked tool cleanup due to --keep-tools.');
  }

  const skillResults = await removeManagedSkills(
    trackedSkills.map((entry) => ({
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
  warnings.push(...skillResults.filter((result) => result.status === 'skipped').map((result) => result.detail));

  if (!options.keepConfigs) {
    for (const entry of [...trackedIntegrations, ...trackedMcpServers]) {
      const result = await removeTrackedCatalogEntry(entry, {
        onLog: printInstallerLog,
        forceDrift: options.forceDrift
      });
      if (result.status !== 'removed') {
        warnings.push(result.detail);
      }
    }
  } else if (trackedIntegrations.length > 0 || trackedMcpServers.length > 0) {
    warnings.push('Skipped tracked integration and MCP config cleanup due to --keep-configs.');
  }

  const shellEntries = ledger.entries.flatMap((entry) => (entry.kind === 'shell-block' ? [entry] : []));
  for (const entry of shellEntries) {
    await removeManagedShellBlock(entry.path);
  }

  const wrapperEntries = ledger.entries.flatMap((entry) => (entry.kind === 'wrapper' ? [entry] : []));
  for (const entry of wrapperEntries) {
    await removeManagedPath(entry.path);
  }

  const runtimeEntries = ledger.entries.flatMap((entry) => (entry.kind === 'runtime' ? [entry] : []));
  for (const entry of runtimeEntries) {
    await removeManagedPath(entry.path, true);
  }

  await removeManagedPath(paths.stateDir, true);
  if (options.purgeCache) {
    await removeManagedPath(paths.cacheDir, true);
  }

  if (state) {
    console.log(`Removed powerhouse for harnesses [${state.activeHarnessIds.join(', ')}] and domains [${state.activeDomainIds.join(', ')}].`);
  } else {
    console.log('Removed powerhouse runtime and tracked state.');
  }
  for (const warning of warnings) {
    console.log(`warning: ${warning}`);
  }
  outro('Uninstall complete.');
}
