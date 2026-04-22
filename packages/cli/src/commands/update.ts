import {
  computePruneAnalysis,
  detectPlatform,
  executeToolPlan,
  getPowerhousePaths,
  installDomainSkills,
  installIntegrations,
  installMcpServers,
  isSetupPlatform,
  isToolPlanUpToDate,
  loadLedger,
  loadRegistry,
  saveLastRun,
  loadState,
  mergeSetupLedger,
  resolveSetupPlan,
  runSkillsUpdate,
  saveLedger,
  saveState
} from '@powerhouse/core';
import { syncWorkspaceDependencies, syncWorkspaceWithGit } from '@powerhouse/core';
import { ToolInstallError } from '@powerhouse/core';

import { formatCatalogExecutionSummary, formatExecutionSummary, printInstallerLog, printToolFailures } from '../ui/output.ts';

export async function runUpdateCommand(): Promise<void> {
  const platform = detectPlatform();
  if (!isSetupPlatform(platform)) {
    throw new Error(`Unsupported platform "${platform.os}".`);
  }

  const registry = await loadRegistry();
  const paths = getPowerhousePaths(platform);
  const startedAt = new Date().toISOString();
  const state = await loadState(paths);
  const existingLedger = await loadLedger(paths);
  if (!state) {
    throw new Error('No saved powerhouse state found. Run `powerhouse setup` first.');
  }

  const plan = resolveSetupPlan(registry, platform, state.activeHarnessIds, state.activeDomainIds, state.selectedToolIds);
  let results = [] as Awaited<ReturnType<typeof executeToolPlan>>;
  let integrationResults = [] as Awaited<ReturnType<typeof installIntegrations>>;
  let mcpServerResults = [] as Awaited<ReturnType<typeof installMcpServers>>;
  let skillRecords = [] as Awaited<ReturnType<typeof installDomainSkills>>;
  let failureStage: 'workspace-sync' | 'tool-install' | 'integration-install' | 'mcp-install' | 'skills-install' | 'state-save' = 'workspace-sync';

  try {
    const workspaceSync = await syncWorkspaceWithGit(registry.rootDir);
    console.log(`[update] ${workspaceSync.detail}`);
    if (workspaceSync.status === 'updated') {
      console.log('[update] Refreshing workspace dependencies.');
      await syncWorkspaceDependencies(registry.rootDir);
    }

    // Fast-path: workspace is current and all tools are already satisfied — skip install pipeline
    if (workspaceSync.status === 'skipped') {
      const alreadyUpToDate = await isToolPlanUpToDate(plan);
      if (alreadyUpToDate) {
        console.log('Everything is up to date.');
        return;
      }
    }

    failureStage = 'tool-install';
    results = await executeToolPlan(plan, platform.os, {
      continueOnError: true,
      onLog: printInstallerLog,
      knownManagedToolIds: existingLedger.entries.flatMap((entry) =>
        entry.kind === 'tool' && entry.ownership === 'installed' ? [entry.toolId] : []
      )
    });
    failureStage = 'integration-install';
    integrationResults = await installIntegrations(plan.integrations, platform, {
      onLog: printInstallerLog
    });
    failureStage = 'mcp-install';
    mcpServerResults = await installMcpServers(plan.mcpServers, platform, {
      onLog: printInstallerLog
    });
    failureStage = 'skills-install';
    skillRecords = await installDomainSkills(plan.domains, {
      agents: plan.agents,
      onLog: printInstallerLog
    });
    await runSkillsUpdate('global');

    failureStage = 'state-save';
    const updatedAt = new Date().toISOString();
    await saveState(paths, {
      ...state,
      schemaVersion: 4,
      updatedAt,
      installedToolIds: results.map((result) => result.toolId),
      installedAgents: plan.agents,
      installedIntegrations: integrationResults,
      installedMcpServers: mcpServerResults,
      platformOs: platform.os,
      platformArch: platform.arch
    });
    const nextLedger = mergeSetupLedger(
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
      command: 'update',
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
    if (pruneCount > 0 || pruneAnalysis.blocked.length > 0) {
      console.log(
        `Prune candidates: ${pruneCount} removable, ${pruneAnalysis.blocked.length} blocked. Run \`powerhouse prune\` to clean out-of-plan managed assets.`
      );
    }

    console.log(formatExecutionSummary(results));
    if (integrationResults.length > 0) {
      console.log(formatCatalogExecutionSummary('Integrations', integrationResults));
    }
    if (mcpServerResults.length > 0) {
      console.log(formatCatalogExecutionSummary('MCP', mcpServerResults));
    }
    printToolFailures(results);
    console.log('Update complete.');
  } catch (error) {
    const partialResults = error instanceof ToolInstallError ? error.results : results;
    const failedToolId = error instanceof ToolInstallError ? error.toolId : undefined;
    const message = error instanceof Error ? error.message : String(error);

    try {
      await saveLastRun(paths, {
        schemaVersion: 4,
        command: 'update',
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
      console.error(`Unable to save failed update report: ${reportError instanceof Error ? reportError.message : String(reportError)}`);
    }

    throw error;
  }
}
