import type { SetupPlan } from '../install/resolve.ts';
import type { DriftFinding, PruneAnalysis } from '../install/reconcile.ts';
import type { DetectedPlatform } from '../platform/detect.ts';
import type { RegistryData } from '../registry/load.ts';
import type { PowerhouseLedger } from '../state/ledger.ts';
import type { ToolLedgerEntry } from '../state/ledger.ts';
import type { DomainManifest, HarnessManifest } from '../registry/schema.ts';
import type { PowerhousePaths, PowerhouseRunReport, PowerhouseState } from '../state/paths.ts';

import { runDoctor, type DoctorCheck } from '../doctor/run.ts';
import { computePruneAnalysis, detectLedgerDrift, summarizeToolOwnership } from '../install/reconcile.ts';
import { resolveSetupPlan } from '../install/resolve.ts';
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
  activeHarnesses: HarnessManifest[];
  activeDomains: DomainManifest[];
  plan: SetupPlan | null;
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

  const activeHarnesses = state ? registry.harnesses.filter((entry) => state.activeHarnessIds.includes(entry.id)) : [];
  const activeDomains = state ? registry.domains.filter((entry) => state.activeDomainIds.includes(entry.id)) : [];

  let plan: SetupPlan | null = null;
  if (state && activeHarnesses.length === state.activeHarnessIds.length && activeDomains.length === state.activeDomainIds.length && isPlanPlatform(platform)) {
    try {
      plan = resolveSetupPlan(registry, platform, state.activeHarnessIds, state.activeDomainIds, state.selectedToolIds);
    } catch {
      plan = null;
    }
  }

  const pruneAnalysis = computePruneAnalysis(ledger, plan);
  const toolOwnership = summarizeToolOwnership(ledger);
  const driftFindings = await detectLedgerDrift(ledger);
  const doctorChecks = await runDoctor(platform, registry, state, lastRun, ledger, pruneAnalysis, driftFindings, paths);

  return {
    platform,
    paths,
    registry,
    ledger,
    state,
    lastRun,
    activeHarnesses,
    activeDomains,
    plan,
    toolOwnership,
    pruneAnalysis,
    driftFindings,
    doctorChecks
  };
}
