import {
  detectPlatform,
  executeToolPlan,
  getPowerhousePaths,
  installDomainSkills,
  isSupportedPlatform,
  loadRegistry,
  saveLastRun,
  loadState,
  resolveBootstrapPlan,
  runSkillsUpdate,
  saveState
} from '@powerhouse/core';
import { syncWorkspaceDependencies, syncWorkspaceWithGit } from '@powerhouse/core';
import { ToolInstallError } from '@powerhouse/core';

import { formatExecutionSummary, printInstallerLog } from '../ui/output.ts';

export async function runUpdateCommand(): Promise<void> {
  const platform = detectPlatform();
  if (!isSupportedPlatform(platform)) {
    throw new Error(`Unsupported platform "${platform.os}".`);
  }

  const registry = await loadRegistry();
  const paths = getPowerhousePaths(platform);
  const startedAt = new Date().toISOString();
  const state = await loadState(paths);
  if (!state) {
    throw new Error('No saved powerhouse state found. Run `powerhouse bootstrap` first.');
  }

  const plan = resolveBootstrapPlan(registry, platform, state.activeProfileId, state.activeDomainId);
  let results = [] as Awaited<ReturnType<typeof executeToolPlan>>;
  let failureStage: 'workspace-sync' | 'tool-install' | 'skills-install' | 'state-save' = 'workspace-sync';

  try {
    const workspaceSync = await syncWorkspaceWithGit(registry.rootDir);
    console.log(`[update] ${workspaceSync.detail}`);
    if (workspaceSync.status === 'updated') {
      console.log('[update] Refreshing workspace dependencies.');
      await syncWorkspaceDependencies(registry.rootDir);
    }

    failureStage = 'tool-install';
    results = await executeToolPlan(plan, platform.os, {
      onLog: printInstallerLog
    });
    failureStage = 'skills-install';
    await installDomainSkills(plan.domain, {
      agents: plan.agents,
      onLog: printInstallerLog
    });
    await runSkillsUpdate('global');

    failureStage = 'state-save';
    await saveState(paths, {
      ...state,
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      installedToolIds: results.map((result) => result.toolId),
      installedAgents: plan.agents,
      platformOs: platform.os,
      platformArch: platform.arch
    });
    await saveLastRun(paths, {
      schemaVersion: 1,
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
      installedAgents: plan.agents
    });

    console.log(formatExecutionSummary(results));
    console.log('Update complete.');
  } catch (error) {
    const partialResults = error instanceof ToolInstallError ? error.results : results;
    const failedToolId = error instanceof ToolInstallError ? error.toolId : undefined;
    const message = error instanceof Error ? error.message : String(error);

    try {
      await saveLastRun(paths, {
        schemaVersion: 1,
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
