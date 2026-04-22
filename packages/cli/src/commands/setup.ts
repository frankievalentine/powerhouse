import { cancel, confirm, intro, isCancel, multiselect, outro } from '@clack/prompts';
import {
  computePruneAnalysis,
  detectPlatform,
  executeToolPlan,
  getPowerhousePaths,
  installDomainSkills,
  installIntegrations,
  installMcpServers,
  isSetupPlatform,
  ledgerEntryKey,
  loadLedger,
  loadRegistry,
  mergeSetupLedger,
  normalizeSelectedOptionalToolIds,
  removeLedgerEntries,
  resolveSetupPlan,
  resolveDomainRecommendedToolIds,
  resolveHarnessRequiredToolIds,
  saveLedger,
  saveLastRun,
  saveState,
  ToolInstallError,
  type DomainManifest,
  type HarnessManifest,
  type RegistryData
} from '@powerhouse/core';

import {
  formatCatalogExecutionSummary,
  formatExecutionSummary,
  formatPlatformList,
  formatPlan,
  formatPlanOverview,
  printCatalogInstallResult,
  printInstallerLog,
  printToolFailures,
  summarizeDescription
} from '../ui/output.ts';
import { applyPruneAnalysis } from './prune-shared.ts';
import { DEFAULT_DOMAIN_ID, DEFAULT_HARNESS_ID, normalizeOptionalToolSelectionIds, normalizeSelectionIds, resolveSelectedManifests } from './selection.ts';

export interface SetupCommandOptions {
  harness?: string[];
  domain?: string[];
  tool?: string[];
  yes?: boolean;
  dryRun?: boolean;
  integrationScope?: 'auto' | 'global' | 'project' | 'local';
  mcpScope?: 'auto' | 'global' | 'project' | 'local';
  introText?: string;
  interactive?: boolean;
  applyPrune?: boolean;
}

export async function runSetupCommand(options: SetupCommandOptions): Promise<void> {
  intro(options.introText ?? 'powerhouse setup');

  const platform = detectPlatform();
  if (!isSetupPlatform(platform)) {
    cancel(`Unsupported platform: ${platform.os}.`);
    process.exitCode = 1;
    return;
  }

  const registry = await loadRegistry();
  const interactive = options.interactive ?? true;
  const harnesses = await resolveHarnessSelection(registry.harnesses, platform.os, options.harness, options.yes, interactive);
  const domains = await resolveDomainSelection(registry.domains, options.domain, options.yes, interactive);
  const selectedToolIds = await resolveToolSelection(
    registry,
    platform.os,
    harnesses,
    domains,
    options.tool && options.tool.length > 0 ? options.tool : undefined,
    options.yes,
    interactive
  );
  const plan = resolveSetupPlan(
    registry,
    platform,
    harnesses.map((harness) => harness.id),
    domains.map((domain) => domain.id),
    selectedToolIds
  );

  const startedAt = new Date().toISOString();
  const paths = getPowerhousePaths(platform);
  const existingLedger = await loadLedger(paths);

  console.log(options.dryRun ? formatPlan(plan) : formatPlanOverview(plan));
  if (options.dryRun && options.applyPrune) {
    const pruneAnalysis = computePruneAnalysis(existingLedger, plan);
    const pruneCount =
      pruneAnalysis.tools.length + pruneAnalysis.skills.length + pruneAnalysis.integrations.length + pruneAnalysis.mcpServers.length;
    if (pruneCount > 0 || pruneAnalysis.blocked.length > 0) {
      console.log(`Selection cleanup: ${pruneCount} removable, ${pruneAnalysis.blocked.length} blocked.`);
    }
  }

  if (!options.dryRun && !options.yes) {
    const proceed = await confirm({
      message: 'Apply this setup now?'
    });
    if (isCancel(proceed) || !proceed) {
      cancel('Setup cancelled.');
      return;
    }
  }

  const executionOptions = {
    dryRun: options.dryRun,
    continueOnError: true,
    onLog: printInstallerLog,
    knownManagedToolIds: existingLedger.entries.flatMap((entry) =>
      entry.kind === 'tool' && entry.ownership === 'installed' ? [entry.toolId] : []
    )
  };

  let results = [] as Awaited<ReturnType<typeof executeToolPlan>>;
  let integrationResults = [] as Awaited<ReturnType<typeof installIntegrations>>;
  let mcpServerResults = [] as Awaited<ReturnType<typeof installMcpServers>>;
  let skillRecords = [] as Awaited<ReturnType<typeof installDomainSkills>>;
  let failureStage: 'tool-install' | 'integration-install' | 'mcp-install' | 'skills-install' | 'state-save' = 'tool-install';

  try {
    results = await executeToolPlan(plan, platform.os, executionOptions);
    failureStage = 'integration-install';
    integrationResults = await installIntegrations(plan.integrations, platform, {
      dryRun: options.dryRun,
      scope: options.integrationScope ?? 'auto',
      onLog: executionOptions.onLog
    });
    failureStage = 'mcp-install';
    mcpServerResults = await installMcpServers(plan.mcpServers, platform, {
      dryRun: options.dryRun,
      scope: options.mcpScope ?? 'auto',
      onLog: executionOptions.onLog
    });
    failureStage = 'skills-install';
    skillRecords = await installDomainSkills(plan.domains, {
      agents: plan.agents,
      dryRun: options.dryRun,
      onLog: executionOptions.onLog
    });

    if (!options.dryRun) {
      failureStage = 'state-save';
      const updatedAt = new Date().toISOString();
      await saveState(paths, {
        schemaVersion: 4,
        activeHarnessIds: plan.harnesses.map((harness) => harness.id),
        activeDomainIds: plan.domains.map((domain) => domain.id),
        selectedToolIds,
        updatedAt,
        installedToolIds: results.map((result) => result.toolId),
        installedAgents: plan.agents,
        installedIntegrations: integrationResults,
        installedMcpServers: mcpServerResults,
        platformOs: platform.os,
        platformArch: platform.arch
      });
      let nextLedger = mergeSetupLedger(
        existingLedger,
        paths,
        platform,
        results,
        skillRecords,
        integrationResults,
        mcpServerResults,
        updatedAt
      );
      await saveLedger(paths, nextLedger);
      await saveLastRun(paths, {
        schemaVersion: 4,
        command: 'setup',
        status: 'success',
        startedAt,
        finishedAt: new Date().toISOString(),
        harnessIds: plan.harnesses.map((harness) => harness.id),
        domainIds: plan.domains.map((domain) => domain.id),
        platformOs: platform.os,
        platformArch: platform.arch,
        installedToolIds: results.filter((result) => result.status === 'installed').map((result) => result.toolId),
        skippedToolIds: results.filter((result) => result.status === 'skipped').map((result) => result.toolId),
        installedAgents: plan.agents,
        integrationResults,
        mcpServerResults
      });

      const pruneAnalysis = computePruneAnalysis(nextLedger, plan);
      const pruneCount =
        pruneAnalysis.tools.length + pruneAnalysis.skills.length + pruneAnalysis.integrations.length + pruneAnalysis.mcpServers.length;
      if (options.applyPrune && (pruneCount > 0 || pruneAnalysis.blocked.length > 0)) {
        const pruneResult = await applyPruneAnalysis(pruneAnalysis, registry, platform);
        if (pruneResult.removedKeys.size > 0) {
          nextLedger = removeLedgerEntries(nextLedger, (entry) => pruneResult.removedKeys.has(ledgerEntryKey(entry)), updatedAt);
          await saveLedger(paths, nextLedger);
          console.log(`Selection cleanup: removed ${pruneResult.removedKeys.size} out-of-plan managed asset${pruneResult.removedKeys.size === 1 ? '' : 's'}.`);
        }
        for (const warning of pruneResult.warnings) {
          console.log(`warning: ${warning}`);
        }
      } else if (pruneCount > 0 || pruneAnalysis.blocked.length > 0) {
        console.log(
          `Prune candidates: ${pruneCount} removable, ${pruneAnalysis.blocked.length} blocked. Run \`powerhouse prune\` to clean out-of-plan managed assets.`
        );
      }
    }

    console.log(formatExecutionSummary(results));
    if (integrationResults.length > 0) {
      const detailedIntegrationStatuses = integrationResults.filter((result) => result.status !== 'configured');
      if (detailedIntegrationStatuses.length > 0) {
        console.log('');
        for (const result of detailedIntegrationStatuses) {
          printCatalogInstallResult(result);
        }
      }
      console.log(formatCatalogExecutionSummary('Integrations', integrationResults));
    }
    if (mcpServerResults.length > 0) {
      if (options.dryRun) {
        console.log('');
        for (const result of mcpServerResults) {
          printCatalogInstallResult(result);
        }
      }
      console.log(formatCatalogExecutionSummary('MCP servers', mcpServerResults));
    }
    printToolFailures(results);
    outro(options.dryRun ? 'Dry run complete.' : 'Setup complete.');
  } catch (error) {
    if (!options.dryRun) {
      const partialResults = error instanceof ToolInstallError ? error.results : results;
      const failedToolId = error instanceof ToolInstallError ? error.toolId : undefined;
      const message = error instanceof Error ? error.message : String(error);

      try {
        await saveLastRun(paths, {
          schemaVersion: 4,
          command: 'setup',
          status: 'failed',
          startedAt,
          finishedAt: new Date().toISOString(),
          harnessIds: plan.harnesses.map((harness) => harness.id),
          domainIds: plan.domains.map((domain) => domain.id),
          platformOs: platform.os,
          platformArch: platform.arch,
          installedToolIds: partialResults.filter((result) => result.status === 'installed').map((result) => result.toolId),
          skippedToolIds: partialResults.filter((result) => result.status === 'skipped').map((result) => result.toolId),
          installedAgents: plan.agents,
          integrationResults,
          mcpServerResults,
          failedToolId,
          failureStage,
          errorMessage: message
        });
      } catch (reportError) {
        console.error(`Unable to save failed setup report: ${reportError instanceof Error ? reportError.message : String(reportError)}`);
      }
    }

    throw error;
  }
}

async function resolveHarnessSelection(
  harnesses: HarnessManifest[],
  platform: HarnessManifest['supportedPlatforms'][number],
  requestedHarnessIds: string[] | undefined,
  nonInteractive: boolean | undefined,
  interactive: boolean
): Promise<HarnessManifest[]> {
  const selectableHarnesses = harnesses.filter((harness) => harness.id !== 'base' && harness.supportedPlatforms.includes(platform));

  if (requestedHarnessIds && requestedHarnessIds.length > 0) {
    return resolveSelectedManifests(selectableHarnesses, normalizeSelectionIds(selectableHarnesses, requestedHarnessIds, 'harness'));
  }

  if (!interactive || nonInteractive || !process.stdout.isTTY) {
    return [findDefault(selectableHarnesses, DEFAULT_HARNESS_ID)];
  }

  const selection = await multiselect({
    message: 'Pick your harness (choose one or more)',
    options: selectableHarnesses.map((harness) => ({
      label: `${harness.title} (${harness.id})`,
      value: harness.id,
      hint: `${summarizeDescription(harness.description, 'harness')} • ${formatPlatformList(harness.supportedPlatforms)}`
    })),
    required: true,
    initialValues: [findDefault(selectableHarnesses, DEFAULT_HARNESS_ID).id]
  });

  if (isCancel(selection)) {
    cancel('Setup cancelled.');
    process.exit(1);
  }

  return resolveSelectedManifests(selectableHarnesses, normalizeSelectionIds(selectableHarnesses, selection, 'harness'));
}

async function resolveDomainSelection(
  domains: DomainManifest[],
  requestedDomainIds: string[] | undefined,
  nonInteractive: boolean | undefined,
  interactive: boolean
): Promise<DomainManifest[]> {
  if (requestedDomainIds && requestedDomainIds.length > 0) {
    return resolveSelectedManifests(domains, normalizeSelectionIds(domains, requestedDomainIds, 'domain'));
  }

  if (!interactive || nonInteractive || !process.stdout.isTTY) {
    return [findDefault(domains, DEFAULT_DOMAIN_ID)];
  }

  const selection = await multiselect({
    message: 'Pick your domain (choose one or more)',
    options: domains.map((domain) => ({
      label: `${domain.title} (${domain.id})`,
      value: domain.id,
      hint: summarizeDescription(domain.description, 'domain')
    })),
    required: true,
    initialValues: [findDefault(domains, DEFAULT_DOMAIN_ID).id]
  });

  if (isCancel(selection)) {
    cancel('Setup cancelled.');
    process.exit(1);
  }

  return resolveSelectedManifests(domains, normalizeSelectionIds(domains, selection, 'domain'));
}

async function resolveToolSelection(
  registry: RegistryData,
  platform: HarnessManifest['supportedPlatforms'][number],
  harnesses: HarnessManifest[],
  domains: DomainManifest[],
  requestedToolIds: string[] | undefined,
  nonInteractive: boolean | undefined,
  interactive: boolean
): Promise<string[]> {
  const recommendedToolIds = resolveDomainRecommendedToolIds(domains);
  const availableOptionalTools = registry.tools
    .filter((tool) => recommendedToolIds.includes(tool.id) && tool.supportedPlatforms.includes(platform))
    .sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));

  if (requestedToolIds !== undefined) {
    return normalizeOptionalToolSelectionIds(availableOptionalTools, requestedToolIds);
  }

  if (!interactive || nonInteractive || !process.stdout.isTTY || availableOptionalTools.length === 0) {
    return availableOptionalTools.map((tool) => tool.id);
  }

  const requiredToolIds = [...new Set(harnesses.flatMap((harness) => resolveHarnessRequiredToolIds(registry, harness.id)))];
  if (requiredToolIds.length > 0) {
    console.log(`Required harness tools: ${requiredToolIds.join(', ')}`);
  }

  const selection = await multiselect({
    message: 'Pick your tools (optional domain tools)',
    options: availableOptionalTools.map((tool) => ({
      label: `${tool.title} (${tool.id})`,
      value: tool.id,
      hint: summarizeDescription(tool.description, 'tool')
    })),
    required: false,
    initialValues: availableOptionalTools.map((tool) => tool.id)
  });

  if (isCancel(selection)) {
    cancel('Setup cancelled.');
    process.exit(1);
  }

  return normalizeSelectedOptionalToolIds(availableOptionalTools.map((tool) => tool.id), selection);
}

function findDefault<T extends { id: string }>(entries: T[], preferredId: string): T {
  return entries.find((entry) => entry.id === preferredId) ?? entries[0];
}
