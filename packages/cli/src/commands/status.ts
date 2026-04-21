import { buildStatusReport } from '@powerhouse/core';

import { printDoctorChecks } from '../ui/output.ts';

export async function runStatusCommand(): Promise<void> {
  const report = await buildStatusReport();

  console.log(`platform: ${report.platform.os}/${report.platform.arch}`);
  console.log(`shell: ${report.platform.shell}`);
  console.log(`config dir: ${report.paths.configDir}`);
  console.log(`cache dir: ${report.paths.cacheDir}`);
  console.log(`state dir: ${report.paths.stateDir}`);

  if (!report.state) {
    console.log('state: not initialized');
    if (report.lastRun) {
      console.log(`last run: ${report.lastRun.command} ${report.lastRun.status} at ${report.lastRun.finishedAt}`);
      if (report.lastRun.errorMessage) {
        console.log(`last error: ${report.lastRun.errorMessage}`);
      }
    }
    console.log('');
    console.log('doctor:');
    printDoctorChecks(report.doctorChecks);
    process.exitCode = 1;
    return;
  }

  console.log(`state: initialized`);
  console.log(`updated: ${report.state.updatedAt}`);
  console.log(`active profile: ${report.activeProfile?.id ?? report.state.activeProfileId}`);
  console.log(`active domain: ${report.activeDomain?.id ?? report.state.activeDomainId}`);
  console.log(`agents: ${report.state.installedAgents.join(', ') || 'none'}`);
  if (report.lastRun) {
    console.log(`last run: ${report.lastRun.command} ${report.lastRun.status} at ${report.lastRun.finishedAt}`);
    if (report.lastRun.failedToolId) {
      console.log(`last failed tool: ${report.lastRun.failedToolId}`);
    }
    if (report.lastRun.errorMessage) {
      console.log(`last error: ${report.lastRun.errorMessage}`);
    }
  }

  if (report.plan) {
    const toolCount = report.plan.tools.length;
    const okTools = report.doctorChecks.filter((check) => report.plan?.tools.some((tool) => tool.id === check.label) && check.ok).length;
    console.log(`tools healthy: ${okTools}/${toolCount}`);
  } else {
    console.log('tools healthy: unknown');
  }

  console.log('');
  console.log('doctor:');
  printDoctorChecks(report.doctorChecks);

  if (report.doctorChecks.some((check) => !check.ok)) {
    process.exitCode = 1;
  }
}
