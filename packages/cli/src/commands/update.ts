import {
  computePruneAnalysis,
  detectPlatform,
  executeToolPlan,
  getPowerhousePaths,
  installDomainSkills,
  installIntegrations,
  installMcpServers,
  isBootstrapPlatform,
  loadLedger,
  loadRegistry,
  saveLastRun,
  loadState,
  mergeBootstrapLedger,
  resolveBootstrapPlan,
  runSkillsUpdate,
  saveLedger,
  saveState
} from '@powerhouse/core';
import { syncWorkspaceDependencies, syncWorkspaceWithGit } from '@powerhouse/core';
import { ToolInstallError } from '@powerhouse/core';

import { formatCatalogExecutionSummary, formatExecutionSummary, printInstallerLog } from '../ui/output.ts';

export async function runUpdateCommand(): Promise<void> {
  const platform = detectPlatform();
  if (!isBootstrapPlatform(platform)) {
    if (platform.os === 'win32') {
      throw new Error('Native Windows planning is available, but update is not enabled yet. Run powerhouse under WSL for installs.');
    }
    throw new Error(`Unsupported platform "${platform.os}".`);
  }

  const registry = await loadRegistry();
  const paths = getPowerhousePaths(platform);
  const startedAt = new Date().toISOString();
  const state = await loadState(paths);
  const existingLedger = await loadLedger(paths);
  if (!state) {
    throw new Error('No saved powerhouse state found. Run `powerhouse bootstrap` first.');
  }

  const plan = resolveBootstrapPlan(registry, platform, state.activeProfileId, state.activeDomainId);
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

    failureStage = 'tool-install';
    results = await executeToolPlan(plan, platform.os, {
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
    skillRecords = await installDomainSkills(plan.domain, {
      agents: plan.agents,
      onLog: printInstallerLog
    });
    await runSkillsUpdate('global');

    failureStage = 'state-save';
    const updatedAt = new Date().toISOString();
    await saveState(paths, {
      ...state,
      schemaVersion: 2,
      updatedAt,
      installedToolIds: results.map((result) => result.toolId),
      installedAgents: plan.agents,
      installedIntegrations: integrationResults,
      installedMcpServers: mcpServerResults,
      platformOs: platform.os,
      platformArch: platform.arch
    });
    const nextLedger = mergeBootstrapLedger(
      existingLedger,
      paths,
      platform,
      {
        profileId: plan.profile.id,
        domainId: plan.domain.id
      },
      results,
      skillRecords,
      integrationResults,
      mcpServerResults,
      updatedAt
    );
    await saveLedger(paths, nextLedger);
    await saveLastRun(paths, {
      schemaVersion: 2,
      command: 'update',
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      profileId: plan.profile.id,
      domainId: plan.domain.id,
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
    console.log('Update complete.');
  } catch (error) {
    const partialResults = error instanceof ToolInstallError ? error.results : results;
    const failedToolId = error instanceof ToolInstallError ? error.toolId : undefined;
    const message = error instanceof Error ? error.message : String(error);

    try {
      await saveLastRun(paths, {
        schemaVersion: 2,
        command: 'update',
        status: 'failed',
        startedAt,
        finishedAt: new Date().toISOString(),
        profileId: plan.profile.id,
        domainId: plan.domain.id,
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
