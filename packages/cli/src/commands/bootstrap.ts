import { cancel, confirm, intro, isCancel, outro, select } from '@clack/prompts';
import {
  detectPlatform,
  executeToolPlan,
  getPowerhousePaths,
  installDomainSkills,
  isSupportedPlatform,
  loadRegistry,
  resolveBootstrapPlan,
  saveLastRun,
  saveState,
  ToolInstallError,
  type DomainManifest,
  type ProfileManifest
} from '@powerhouse/core';

import { formatExecutionSummary, formatPlan, formatPlanOverview, printInstallerLog } from '../ui/output.ts';

export const DEFAULT_PROFILE_ID = 'claude-dev';
export const DEFAULT_DOMAIN_ID = 'general';

export interface BootstrapCommandOptions {
  profile?: string;
  domain?: string;
  yes?: boolean;
  dryRun?: boolean;
  introText?: string;
  interactive?: boolean;
}

export async function runBootstrapCommand(options: BootstrapCommandOptions): Promise<void> {
  intro(options.introText ?? 'powerhouse bootstrap');

  const platform = detectPlatform();
  if (!isSupportedPlatform(platform)) {
    cancel(`Unsupported platform: ${platform.os}. Use macOS or Linux for v1.`);
    process.exitCode = 1;
    return;
  }

  const registry = await loadRegistry();
  const interactive = options.interactive ?? true;
  const profile = await resolveProfileSelection(registry.profiles, options.profile, options.yes, interactive);
  const domain = await resolveDomainSelection(registry.domains, options.domain, options.yes, interactive);
  const plan = resolveBootstrapPlan(registry, platform, profile.id, domain.id);
  const startedAt = new Date().toISOString();
  const paths = getPowerhousePaths(platform);

  console.log(options.dryRun ? formatPlan(plan) : formatPlanOverview(plan));

  if (!options.dryRun && !options.yes) {
    const proceed = await confirm({
      message: 'Apply this bootstrap plan now?'
    });
    if (isCancel(proceed) || !proceed) {
      cancel('Bootstrap cancelled.');
      return;
    }
  }

  const executionOptions = {
    dryRun: options.dryRun,
    onLog: printInstallerLog
  };

  let results = [] as Awaited<ReturnType<typeof executeToolPlan>>;
  let failureStage: 'tool-install' | 'skills-install' | 'state-save' = 'tool-install';

  try {
    results = await executeToolPlan(plan, platform.os, executionOptions);
    failureStage = 'skills-install';
    await installDomainSkills(plan.domain, {
      agents: plan.agents,
      dryRun: options.dryRun,
      onLog: executionOptions.onLog
    });

    if (!options.dryRun) {
      failureStage = 'state-save';
      await saveState(paths, {
        schemaVersion: 1,
        activeProfileId: profile.id,
        activeDomainId: domain.id,
        updatedAt: new Date().toISOString(),
        installedToolIds: results.map((result) => result.toolId),
        installedAgents: plan.agents,
        platformOs: platform.os,
        platformArch: platform.arch
      });
      await saveLastRun(paths, {
        schemaVersion: 1,
        command: 'bootstrap',
        status: 'success',
        startedAt,
        finishedAt: new Date().toISOString(),
        profileId: profile.id,
        domainId: domain.id,
        platformOs: platform.os,
        platformArch: platform.arch,
        installedToolIds: results.filter((result) => result.status === 'installed').map((result) => result.toolId),
        skippedToolIds: results.filter((result) => result.status === 'skipped').map((result) => result.toolId),
        installedAgents: plan.agents
      });
    }

    console.log(formatExecutionSummary(results));
    outro(options.dryRun ? 'Dry run complete.' : 'Bootstrap complete.');
  } catch (error) {
    if (!options.dryRun) {
      const partialResults = error instanceof ToolInstallError ? error.results : results;
      const failedToolId = error instanceof ToolInstallError ? error.toolId : undefined;
      const message = error instanceof Error ? error.message : String(error);

      try {
        await saveLastRun(paths, {
          schemaVersion: 1,
          command: 'bootstrap',
          status: 'failed',
          startedAt,
          finishedAt: new Date().toISOString(),
          profileId: profile.id,
          domainId: domain.id,
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
        console.error(`Unable to save failed bootstrap report: ${reportError instanceof Error ? reportError.message : String(reportError)}`);
      }
    }

    throw error;
  }
}

async function resolveProfileSelection(
  profiles: ProfileManifest[],
  requestedProfileId: string | undefined,
  nonInteractive: boolean | undefined,
  interactive: boolean
): Promise<ProfileManifest> {
  if (requestedProfileId) {
    const profile = profiles.find((entry) => entry.id === requestedProfileId);
    if (!profile) {
      throw new Error(`Unknown profile "${requestedProfileId}".`);
    }
    return profile;
  }

  if (!interactive || nonInteractive || !process.stdout.isTTY) {
    return findDefault(profiles, DEFAULT_PROFILE_ID);
  }

  const selection = await select({
    message: 'Choose a profile',
    options: profiles.map((profile) => ({
      label: profile.title,
      value: profile.id,
      hint: profile.description
    }))
  });

  if (isCancel(selection)) {
    cancel('Bootstrap cancelled.');
    process.exit(1);
  }

  return findDefault(profiles, selection);
}

async function resolveDomainSelection(
  domains: DomainManifest[],
  requestedDomainId: string | undefined,
  nonInteractive: boolean | undefined,
  interactive: boolean
): Promise<DomainManifest> {
  if (requestedDomainId) {
    const domain = domains.find((entry) => entry.id === requestedDomainId);
    if (!domain) {
      throw new Error(`Unknown domain "${requestedDomainId}".`);
    }
    return domain;
  }

  if (!interactive || nonInteractive || !process.stdout.isTTY) {
    return findDefault(domains, DEFAULT_DOMAIN_ID);
  }

  const selection = await select({
    message: 'Choose a domain',
    options: domains.map((domain) => ({
      label: domain.title,
      value: domain.id,
      hint: domain.description
    }))
  });

  if (isCancel(selection)) {
    cancel('Bootstrap cancelled.');
    process.exit(1);
  }

  return findDefault(domains, selection);
}

function findDefault<T extends { id: string }>(entries: T[], preferredId: string): T {
  return entries.find((entry) => entry.id === preferredId) ?? entries[0];
}
