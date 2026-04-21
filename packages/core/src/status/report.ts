import type { BootstrapPlan } from '../install/resolve.ts';
import type { DetectedPlatform } from '../platform/detect.ts';
import type { RegistryData } from '../registry/load.ts';
import type { DomainManifest, ProfileManifest } from '../registry/schema.ts';
import type { PowerhousePaths, PowerhouseRunReport, PowerhouseState } from '../state/paths.ts';

import { runDoctor, type DoctorCheck } from '../doctor/run.ts';
import { resolveBootstrapPlan } from '../install/resolve.ts';
import { detectPlatform, isSupportedPlatform } from '../platform/detect.ts';
import { loadRegistry } from '../registry/load.ts';
import { getPowerhousePaths, loadLastRun, loadState } from '../state/paths.ts';

export interface StatusReport {
  platform: DetectedPlatform;
  paths: PowerhousePaths;
  registry: RegistryData;
  state: PowerhouseState | null;
  lastRun: PowerhouseRunReport | null;
  activeProfile: ProfileManifest | null;
  activeDomain: DomainManifest | null;
  plan: BootstrapPlan | null;
  doctorChecks: DoctorCheck[];
}

export async function buildStatusReport(startDir = process.cwd()): Promise<StatusReport> {
  const platform = detectPlatform();
  const paths = getPowerhousePaths(platform);
  const registry = await loadRegistry(startDir);
  const state = await loadState(paths);
  const lastRun = await loadLastRun(paths);

  const activeProfile = state ? registry.profiles.find((entry) => entry.id === state.activeProfileId) ?? null : null;
  const activeDomain = state ? registry.domains.find((entry) => entry.id === state.activeDomainId) ?? null : null;

  let plan: BootstrapPlan | null = null;
  if (state && activeProfile && activeDomain && isSupportedPlatform(platform)) {
    plan = resolveBootstrapPlan(registry, platform, activeProfile.id, activeDomain.id);
  }

  const doctorChecks = await runDoctor(platform, registry, state, lastRun);

  return {
    platform,
    paths,
    registry,
    state,
    lastRun,
    activeProfile,
    activeDomain,
    plan,
    doctorChecks
  };
}
