import { cancel, confirm, intro, isCancel, outro, select } from '@clack/prompts';
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
  mergeBootstrapLedger,
  resolveBootstrapPlan,
  saveLedger,
  saveLastRun,
  saveState,
  ToolInstallError,
  type BootstrapPlan,
  type DomainManifest,
  type ProfileManifest,
  type RegistryData
} from '@powerhouse/core';

import { formatCatalogExecutionSummary, formatExecutionSummary, formatPlan, formatPlanOverview, printInstallerLog } from '../ui/output.ts';

export const DEFAULT_PROFILE_ID = 'claude';
export const DEFAULT_DOMAIN_ID = 'general';

export interface BootstrapCommandOptions {
  profile?: string;
  domain?: string;
  yes?: boolean;
  dryRun?: boolean;
  integrationScope?: 'auto' | 'global' | 'project' | 'local';
  mcpScope?: 'auto' | 'global' | 'project' | 'local';
  introText?: string;
  interactive?: boolean;
}

export async function runBootstrapCommand(options: BootstrapCommandOptions): Promise<void> {
  intro(options.introText ?? 'powerhouse bootstrap');

  const platform = detectPlatform();
  if (!isBootstrapPlatform(platform)) {
    cancel(
      platform.os === 'win32'
        ? 'Native Windows planning is available, but bootstrap is not enabled yet. Use `powerhouse plan --platform win32` for planning or run powerhouse under WSL for installs.'
        : `Unsupported platform: ${platform.os}.`
    );
    process.exitCode = 1;
    return;
  }

  const registry = await loadRegistry();
  const interactive = options.interactive ?? true;
  const profile = await resolveProfileSelection(registry.profiles, platform.os, options.profile, options.yes, interactive);
  const domain = await resolveDomainSelection(registry.domains, options.domain, options.yes, interactive);
  let plan = resolveBootstrapPlan(registry, platform, profile.id, domain.id);

  if (profile.id === 'opencode') {
    plan = await promptOptionalOllama(registry, plan, interactive, options.yes);
  }

  const startedAt = new Date().toISOString();
  const paths = getPowerhousePaths(platform);
  const existingLedger = await loadLedger(paths);

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
    skillRecords = await installDomainSkills(plan.domain, {
      agents: plan.agents,
      dryRun: options.dryRun,
      onLog: executionOptions.onLog
    });

    if (!options.dryRun) {
      failureStage = 'state-save';
      const updatedAt = new Date().toISOString();
      await saveState(paths, {
        schemaVersion: 2,
        activeProfileId: profile.id,
        activeDomainId: domain.id,
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
          profileId: profile.id,
          domainId: domain.id
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
    }

    console.log(formatExecutionSummary(results));
    if (integrationResults.length > 0) {
      console.log(formatCatalogExecutionSummary('Integrations', integrationResults));
    }
    if (mcpServerResults.length > 0) {
      console.log(formatCatalogExecutionSummary('MCP', mcpServerResults));
    }
    outro(options.dryRun ? 'Dry run complete.' : 'Bootstrap complete.');
  } catch (error) {
    if (!options.dryRun) {
      const partialResults = error instanceof ToolInstallError ? error.results : results;
      const failedToolId = error instanceof ToolInstallError ? error.toolId : undefined;
      const message = error instanceof Error ? error.message : String(error);

      try {
        await saveLastRun(paths, {
          schemaVersion: 2,
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
          integrationResults,
          mcpServerResults,
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
  platform: ProfileManifest['supportedPlatforms'][number],
  requestedProfileId: string | undefined,
  nonInteractive: boolean | undefined,
  interactive: boolean
): Promise<ProfileManifest> {
  const selectableProfiles = profiles.filter((profile) => profile.id !== 'base' && profile.supportedPlatforms.includes(platform));

  if (requestedProfileId) {
    const profile = profiles.find((entry) => entry.id === requestedProfileId);
    if (!profile) {
      throw new Error(`Unknown profile "${requestedProfileId}".`);
    }
    if (!profile.supportedPlatforms.includes(platform)) {
      throw new Error(`Profile "${requestedProfileId}" does not support ${platform}.`);
    }
    return profile;
  }

  if (!interactive || nonInteractive || !process.stdout.isTTY) {
    return findDefault(selectableProfiles, DEFAULT_PROFILE_ID);
  }

  const selection = await select({
    message: 'Choose a profile',
    options: selectableProfiles.map((profile) => ({
      label: profile.title,
      value: profile.id,
      hint: profile.description
    }))
  });

  if (isCancel(selection)) {
    cancel('Bootstrap cancelled.');
    process.exit(1);
  }

  return findDefault(selectableProfiles, selection);
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

async function promptOptionalOllama(
  registry: RegistryData,
  plan: BootstrapPlan,
  interactive: boolean,
  nonInteractive: boolean | undefined
): Promise<BootstrapPlan> {
  if (!interactive || nonInteractive || !process.stdout.isTTY) {
    return plan;
  }

  const installOllama = await confirm({
    message: 'Install Ollama for local LLM support with OpenCode?'
  });

  if (isCancel(installOllama) || !installOllama) {
    return plan;
  }

  const ollamaTool = registry.tools.find((tool) => tool.id === 'ollama');
  if (!ollamaTool) {
    console.warn('Ollama tool manifest not found in registry. Skipping.');
    return plan;
  }

  const alreadyInPlan = plan.tools.some((tool) => tool.id === 'ollama');
  if (alreadyInPlan) {
    return plan;
  }

  const updatedTools = [...plan.tools, ollamaTool];
  updatedTools.sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title));

  return {
    ...plan,
    tools: updatedTools
  };
}
