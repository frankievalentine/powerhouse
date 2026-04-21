import type { BootstrapPlan } from '../install/resolve.ts';
import type { DriftFinding, PruneAnalysis } from '../install/reconcile.ts';
import type { DetectedPlatform } from '../platform/detect.ts';
import type { RegistryData } from '../registry/load.ts';
import type { PowerhouseLedger } from '../state/ledger.ts';
import type { ToolLedgerEntry } from '../state/ledger.ts';
import type { DomainManifest, ProfileManifest } from '../registry/schema.ts';
import type { PowerhousePaths, PowerhouseRunReport, PowerhouseState } from '../state/paths.ts';

import { runDoctor, type DoctorCheck } from '../doctor/run.ts';
import { computePruneAnalysis, detectLedgerDrift, summarizeToolOwnership } from '../install/reconcile.ts';
import { resolveBootstrapPlan } from '../install/resolve.ts';
import { detectPlatform, isPlanPlatform } from '../platform/detect.ts';
import { loadRegistry } from '../registry/load.ts';
import { loadLedger } from '../state/ledger.ts';
import { getPowerhousePaths, loadLastRun, loadState } from '../state/paths.ts';

export interface StatusReport {
  platform: DetectedPlatform;
  paths: PowerhousePaths;
  registry: RegistryData;
  ledger: PowerhouseLedger;
  state: PowerhouseState | null;
  lastRun: PowerhouseRunReport | null;
  activeProfile: ProfileManifest | null;
  activeDomain: DomainManifest | null;
  plan: BootstrapPlan | null;
  toolOwnership: {
    managed: ToolLedgerEntry[];
    preexisting: ToolLedgerEntry[];
  };
  pruneAnalysis: PruneAnalysis;
  driftFindings: DriftFinding[];
  doctorChecks: DoctorCheck[];
}

export async function buildStatusReport(startDir = process.cwd()): Promise<StatusReport> {
  const platform = detectPlatform();
  const paths = getPowerhousePaths(platform);
  const registry = await loadRegistry(startDir);
  const state = await loadState(paths);
  const lastRun = await loadLastRun(paths);
  const ledger = await loadLedger(paths);

  const activeProfile = state ? registry.profiles.find((entry) => entry.id === state.activeProfileId) ?? null : null;
  const activeDomain = state ? registry.domains.find((entry) => entry.id === state.activeDomainId) ?? null : null;

  let plan: BootstrapPlan | null = null;
  if (state && activeProfile && activeDomain && isPlanPlatform(platform)) {
    try {
      plan = resolveBootstrapPlan(registry, platform, activeProfile.id, activeDomain.id);
    } catch {
      plan = null;
    }
  }

  const pruneAnalysis = computePruneAnalysis(ledger, plan);
  const toolOwnership = summarizeToolOwnership(ledger);
  const driftFindings = await detectLedgerDrift(ledger);
  const doctorChecks = await runDoctor(platform, registry, state, lastRun, ledger, pruneAnalysis, driftFindings);

  return {
    platform,
    paths,
    registry,
    ledger,
    state,
    lastRun,
    activeProfile,
    activeDomain,
    plan,
    toolOwnership,
    pruneAnalysis,
    driftFindings,
    doctorChecks
  };
}
