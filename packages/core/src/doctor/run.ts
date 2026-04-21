import type { DetectedPlatform } from '../platform/detect.ts';
import type { RegistryData } from '../registry/load.ts';
import type { PowerhouseRunReport, PowerhouseState } from '../state/paths.ts';
import { isSupportedPlatform } from '../platform/detect.ts';
import { resolveBootstrapPlan } from '../install/resolve.ts';
import { isToolSatisfied } from '../install/execute.ts';
import { commandExists, resolveCommandPath, resolveSkillsRunner } from '../system/commands.ts';

export interface DoctorCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export async function runDoctor(
  platform: DetectedPlatform,
  registry: RegistryData,
  state: PowerhouseState | null,
  lastRun: PowerhouseRunReport | null = null
): Promise<DoctorCheck[]> {
  const brewPath = await resolveCommandPath('brew');
  const bunPath = await resolveCommandPath('bun');
  const nodePath = await resolveCommandPath('node');
  const skillsRunner = await resolveSkillsRunner();

  const checks: DoctorCheck[] = [
    {
      label: 'platform',
      ok: isSupportedPlatform(platform),
      detail: `${platform.os}/${platform.arch}`
    },
    {
      label: 'shell',
      ok: platform.shell !== 'unknown',
      detail: platform.shell
    },
    {
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
    }
  ];

  if (!state) {
    checks.push({
      label: 'state',
      ok: false,
      detail: 'No active powerhouse bootstrap state found yet.'
    });
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

  if (!isSupportedPlatform(platform)) {
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

  const plan = resolveBootstrapPlan(registry, platform, state.activeProfileId, state.activeDomainId);
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

  return checks;
}
