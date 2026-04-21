import { detectPlatform, getPowerhousePaths, loadLastRun, loadRegistry, loadState, runDoctor } from '@powerhouse/core';

import { printDoctorChecks } from '../ui/output.ts';

export async function runDoctorCommand(): Promise<void> {
  const platform = detectPlatform();
  const paths = getPowerhousePaths(platform);
  const registry = await loadRegistry();
  const state = await loadState(paths);
  const lastRun = await loadLastRun(paths);
  const checks = await runDoctor(platform, registry, state, lastRun);

  printDoctorChecks(checks);

  if (checks.some((check) => !check.ok)) {
    process.exitCode = 1;
  }
}
