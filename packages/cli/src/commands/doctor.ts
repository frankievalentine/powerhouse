import { detectPlatform, getPowerhousePaths, loadLastRun, loadLedger, loadRegistry, loadState, runDoctor } from '@powerhouse/core';

import { printDoctorChecks } from '../ui/output.ts';

export async function runDoctorCommand(): Promise<void> {
  const platform = detectPlatform();
  const paths = getPowerhousePaths(platform);
  const registry = await loadRegistry();
  const state = await loadState(paths);
  const lastRun = await loadLastRun(paths);
  const ledger = await loadLedger(paths);
  const checks = await runDoctor(platform, registry, state, lastRun, ledger);

  printDoctorChecks(checks);

  if (checks.some((check) => !check.ok)) {
    process.exitCode = 1;
  }
}
