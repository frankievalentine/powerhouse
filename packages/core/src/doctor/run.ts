import fs from 'node:fs/promises';
import path from 'node:path';

import type { DriftFinding, PruneAnalysis } from '../install/reconcile.ts';
import type { DetectedPlatform } from '../platform/detect.ts';
import type { RegistryData } from '../registry/load.ts';
import type { PowerhouseLedger } from '../state/ledger.ts';
import type { PowerhousePaths, PowerhouseRunReport, PowerhouseState } from '../state/paths.ts';
import { isSetupPlatform, isNativeWindowsPlatform, isPlanPlatform } from '../platform/detect.ts';
import { resolveSetupPlan } from '../install/resolve.ts';
import { isToolSatisfied } from '../install/execute.ts';
import { resolveCommandPath, resolveSkillsRunner } from '../system/commands.ts';

export interface DoctorCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export async function runDoctor(
  platform: DetectedPlatform,
  registry: RegistryData,
  state: PowerhouseState | null,
  lastRun: PowerhouseRunReport | null = null,
  ledger: PowerhouseLedger | null = null,
  pruneAnalysis: PruneAnalysis | null = null,
  driftFindings: DriftFinding[] = [],
  paths: PowerhousePaths | null = null
): Promise<DoctorCheck[]> {
  const planSupported = isPlanPlatform(platform);
  const setupSupported = isSetupPlatform(platform);
  const nativeWindows = isNativeWindowsPlatform(platform);
  const brewPath = setupSupported ? await resolveCommandPath('brew', platform.os) : null;
  const wingetPath = nativeWindows ? await resolveCommandPath('winget', platform.os) : null;
  const bunPath = planSupported ? await resolveCommandPath('bun', platform.os) : null;
  const nodePath = planSupported ? await resolveCommandPath('node', platform.os) : null;
  const skillsRunner = planSupported ? await resolveSkillsRunner(platform.os) : null;
  const powerhousePath = planSupported ? await resolveCommandPath('powerhouse', platform.os) : null;

  // Managed runtime integrity
  let runtimeDirExists = false;
  let runtimeDirValid = false;
  let runtimeDirDetail = 'unchecked';
  if (paths && setupSupported) {
    try {
      await fs.access(paths.runtimeDir);
      runtimeDirExists = true;
      // Verify this looks like a powerhouse install by checking for the CLI entrypoint
      const cliEntry = path.join(paths.runtimeDir, 'packages', 'cli', 'src', 'index.ts');
      try {
        await fs.access(cliEntry);
        runtimeDirValid = true;
        runtimeDirDetail = paths.runtimeDir;
      } catch {
        runtimeDirDetail = `${paths.runtimeDir} (exists but missing expected files — run powerhouse update)`;
      }
    } catch {
      runtimeDirDetail = `${paths.runtimeDir} (missing — run the installer again)`;
    }
  }

  const checks: DoctorCheck[] = [
    {
      label: 'platform',
      ok: planSupported,
      detail: describePlatform(platform)
    },
    {
      label: 'shell',
      ok: platform.shell !== 'unknown',
      detail: platform.shell
    },
    nativeWindows
      ? {
          label: 'winget',
          ok: wingetPath !== null,
          detail: wingetPath ?? 'missing'
        }
      : {
          label: 'brew',
          ok: brewPath !== null,
          detail: brewPath ?? 'missing'
        },
    {
      label: 'bun',
      ok: bunPath !== null,
      detail: bunPath ?? 'missing'
    },
    {
      label: 'node',
      ok: nodePath !== null,
      detail: nodePath ?? 'missing'
    },
    {
      label: 'skills-runner',
      ok: skillsRunner !== null,
      detail: skillsRunner ?? 'missing'
    },
    setupSupported
      ? {
          label: 'wrapper',
          ok: powerhousePath !== null,
          detail: powerhousePath ?? 'Not on PATH — open a new shell or run the installer again'
        }
      : null,
    paths && setupSupported
      ? {
          label: 'runtime-dir',
          ok: runtimeDirExists && runtimeDirValid,
          detail: runtimeDirDetail
        }
      : null
  ].filter((check): check is DoctorCheck => check !== null);

  if (!state) {
    checks.push({
      label: 'state',
      ok: false,
      detail: 'No setup state found yet. Run `powerhouse setup`.'
    });
    if (ledger && ledger.entries.length > 0) {
      checks.push({
        label: 'ledger',
        ok: true,
        detail: `${ledger.entries.length} tracked asset${ledger.entries.length === 1 ? '' : 's'}`
      });
    }
    if (lastRun) {
      checks.push({
        label: 'last-run',
        ok: lastRun.status === 'success',
        detail:
          lastRun.status === 'success'
            ? `${lastRun.command} succeeded at ${lastRun.finishedAt}`
            : `${lastRun.command} failed at ${lastRun.finishedAt}${lastRun.failedToolId ? ` (tool=${lastRun.failedToolId})` : ''}`
      });
    }
    return checks;
  }

  checks.push({
    label: 'state',
    ok: true,
    detail: `harnesses=${state.activeHarnessIds.join(',')} domains=${state.activeDomainIds.join(',')} tools=${state.selectedToolIds.join(',') || 'none'} updated=${state.updatedAt}`
  });
  if (ledger) {
    checks.push({
      label: 'ledger',
      ok: true,
      detail: `${ledger.entries.length} tracked asset${ledger.entries.length === 1 ? '' : 's'}`
    });
  }
  if (lastRun) {
    checks.push({
      label: 'last-run',
      ok: lastRun.status === 'success',
      detail:
        lastRun.status === 'success'
          ? `${lastRun.command} succeeded at ${lastRun.finishedAt}`
          : `${lastRun.command} failed at ${lastRun.finishedAt}${lastRun.failedToolId ? ` (tool=${lastRun.failedToolId})` : ''}`
    });
  }

  if (!planSupported) {
    return checks;
  }

  const harnesses = registry.harnesses.filter((entry) => state.activeHarnessIds.includes(entry.id));
  checks.push({
    label: 'harnesses',
    ok: harnesses.length === state.activeHarnessIds.length,
    detail:
      harnesses.length === state.activeHarnessIds.length
        ? harnesses.map((harness) => harness.title).join(', ')
        : `missing manifest(s): ${state.activeHarnessIds.filter((harnessId) => !harnesses.some((harness) => harness.id === harnessId)).join(', ')}`
  });

  const domains = registry.domains.filter((entry) => state.activeDomainIds.includes(entry.id));
  checks.push({
    label: 'domains',
    ok: domains.length === state.activeDomainIds.length,
    detail:
      domains.length === state.activeDomainIds.length
        ? domains.map((domain) => domain.title).join(', ')
        : `missing manifest(s): ${state.activeDomainIds.filter((domainId) => !domains.some((domain) => domain.id === domainId)).join(', ')}`
  });

  if (state.platformOs || state.platformArch) {
    const samePlatform = state.platformOs === platform.os && state.platformArch === platform.arch;
    checks.push({
      label: 'state-platform',
      ok: samePlatform,
      detail: samePlatform
        ? `${state.platformOs}/${state.platformArch}`
        : `saved=${state.platformOs ?? 'unknown'}/${state.platformArch ?? 'unknown'} current=${platform.os}/${platform.arch}`
    });
  }

  if (harnesses.length !== state.activeHarnessIds.length || domains.length !== state.activeDomainIds.length) {
    return checks;
  }

  let plan;
  try {
    plan = resolveSetupPlan(registry, platform, state.activeHarnessIds, state.activeDomainIds, state.selectedToolIds);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({
      label: 'plan',
      ok: false,
      detail: message
    });
    return checks;
  }
  const savedAgentsMatch =
    state.installedAgents.length === plan.agents.length && state.installedAgents.every((agent) => plan.agents.includes(agent));
  checks.push({
    label: 'agents',
    ok: savedAgentsMatch,
    detail: savedAgentsMatch ? (plan.agents.join(', ') || 'none') : `saved=${state.installedAgents.join(', ') || 'none'} planned=${plan.agents.join(', ') || 'none'}`
  });

  for (const tool of plan.tools) {
    const installed = await isToolSatisfied(tool);
    checks.push({
      label: tool.id,
      ok: installed,
      detail: installed ? 'available' : tool.doctorHint ?? 'missing'
    });
  }

  const allInstalledToolIdsPresent = state.installedToolIds.every((toolId) => plan.tools.some((tool) => tool.id === toolId));
  checks.push({
      label: 'tool-state',
      ok: allInstalledToolIdsPresent,
      detail: allInstalledToolIdsPresent ? `${state.installedToolIds.length} tracked` : 'Saved tool state does not match the resolved plan.'
    });

  const savedIntegrationIds = new Set(state.installedIntegrations.map((integration) => integration.id));
  const plannedIntegrationIds = new Set(plan.integrations.map((integration) => integration.id));
  const integrationsMatch =
    savedIntegrationIds.size === plannedIntegrationIds.size &&
    [...savedIntegrationIds].every((integrationId) => plannedIntegrationIds.has(integrationId));
  checks.push({
      label: 'integrations',
      ok: integrationsMatch,
      detail: integrationsMatch ? `${plan.integrations.length} tracked` : 'Saved integrations do not match the resolved plan.'
    });

  const savedMcpIds = new Set(state.installedMcpServers.map((server) => server.id));
  const plannedMcpIds = new Set(plan.mcpServers.map((server) => server.id));
  const mcpMatches =
    savedMcpIds.size === plannedMcpIds.size && [...savedMcpIds].every((serverId) => plannedMcpIds.has(serverId));
  checks.push({
      label: 'mcp',
      ok: mcpMatches,
      detail: mcpMatches ? `${plan.mcpServers.length} tracked` : 'Saved MCP servers do not match the resolved plan.'
    });

  if (pruneAnalysis) {
    const pruneCount =
      pruneAnalysis.tools.length + pruneAnalysis.skills.length + pruneAnalysis.integrations.length + pruneAnalysis.mcpServers.length;
    const blockedCount = pruneAnalysis.blocked.length;
    checks.push({
      label: 'prune',
      ok: pruneCount === 0 && blockedCount === 0,
      detail:
        pruneCount === 0 && blockedCount === 0
          ? 'No out-of-plan managed assets.'
          : `${pruneCount} removable and ${blockedCount} blocked out-of-plan asset${pruneCount + blockedCount === 1 ? '' : 's'}`
    });
  }

  if (driftFindings.length > 0) {
    checks.push({
      label: 'drift',
      ok: false,
      detail: `${driftFindings.length} tracked config file set${driftFindings.length === 1 ? '' : 's'} has drifted`
    });
  }

  return checks;
}

function describePlatform(platform: DetectedPlatform): string {
  return `${platform.os}/${platform.arch}`;
}
