import type { DriftFinding, PruneAnalysis } from '../install/reconcile.ts';
import type { DetectedPlatform } from '../platform/detect.ts';
import type { RegistryData } from '../registry/load.ts';
import type { PowerhouseLedger } from '../state/ledger.ts';
import type { PowerhouseRunReport, PowerhouseState } from '../state/paths.ts';
import { isBootstrapPlatform, isNativeWindowsPlatform, isPlanPlatform } from '../platform/detect.ts';
import { resolveBootstrapPlan } from '../install/resolve.ts';
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
  driftFindings: DriftFinding[] = []
): Promise<DoctorCheck[]> {
  const planSupported = isPlanPlatform(platform);
  const bootstrapSupported = isBootstrapPlatform(platform);
  const nativeWindows = isNativeWindowsPlatform(platform);
  const brewPath = bootstrapSupported ? await resolveCommandPath('brew', platform.os) : null;
  const wingetPath = nativeWindows ? await resolveCommandPath('winget', platform.os) : null;
  const bunPath = planSupported ? await resolveCommandPath('bun', platform.os) : null;
  const nodePath = planSupported ? await resolveCommandPath('node', platform.os) : null;
  const skillsRunner = planSupported ? await resolveSkillsRunner(platform.os) : null;

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
          label: 'bootstrap',
          ok: false,
          detail: 'Native Windows planning is available, but bootstrap/update are not enabled yet. Use WSL for installs.'
        }
      : {
          label: 'brew',
          ok: brewPath !== null,
          detail: brewPath ?? 'missing'
        },
    nativeWindows
      ? {
          label: 'winget',
          ok: wingetPath !== null,
          detail: wingetPath ?? 'missing'
        }
      : null,
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
    }
  ].filter((check): check is DoctorCheck => check !== null);

  if (!state) {
    checks.push({
      label: 'state',
      ok: false,
      detail: 'No active powerhouse bootstrap state found yet.'
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
    detail: `profile=${state.activeProfileId} domain=${state.activeDomainId} updated=${state.updatedAt}`
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

  const profile = registry.profiles.find((entry) => entry.id === state.activeProfileId);
  checks.push({
    label: 'profile',
    ok: Boolean(profile),
    detail: profile ? profile.title : `missing manifest "${state.activeProfileId}"`
  });

  const domain = registry.domains.find((entry) => entry.id === state.activeDomainId);
  checks.push({
    label: 'domain',
    ok: Boolean(domain),
    detail: domain ? domain.title : `missing manifest "${state.activeDomainId}"`
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

  if (!profile || !domain) {
    return checks;
  }

  let plan;
  try {
    plan = resolveBootstrapPlan(registry, platform, state.activeProfileId, state.activeDomainId);
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
    detail: allInstalledToolIdsPresent ? `${state.installedToolIds.length} tracked` : 'saved installedToolIds do not match the resolved plan'
  });

  const savedIntegrationIds = new Set(state.installedIntegrations.map((integration) => integration.id));
  const plannedIntegrationIds = new Set(plan.integrations.map((integration) => integration.id));
  const integrationsMatch =
    savedIntegrationIds.size === plannedIntegrationIds.size &&
    [...savedIntegrationIds].every((integrationId) => plannedIntegrationIds.has(integrationId));
  checks.push({
    label: 'integrations',
    ok: integrationsMatch,
    detail: integrationsMatch ? `${plan.integrations.length} tracked` : 'saved integrations do not match the resolved plan'
  });

  const savedMcpIds = new Set(state.installedMcpServers.map((server) => server.id));
  const plannedMcpIds = new Set(plan.mcpServers.map((server) => server.id));
  const mcpMatches =
    savedMcpIds.size === plannedMcpIds.size && [...savedMcpIds].every((serverId) => plannedMcpIds.has(serverId));
  checks.push({
    label: 'mcp',
    ok: mcpMatches,
    detail: mcpMatches ? `${plan.mcpServers.length} tracked` : 'saved MCP servers do not match the resolved plan'
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
  if (platform.os === 'win32') {
    return `${platform.os}/${platform.arch} (planning supported; native bootstrap pending)`;
  }

  return `${platform.os}/${platform.arch}`;
}
