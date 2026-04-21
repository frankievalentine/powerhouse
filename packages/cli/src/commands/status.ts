import { buildStatusReport, isBootstrapPlatform } from '@powerhouse/core';

import { printDoctorChecks } from '../ui/output.ts';

export async function runStatusCommand(): Promise<void> {
  const report = await buildStatusReport();

  console.log(`platform: ${report.platform.os}/${report.platform.arch}`);
  console.log(`shell: ${report.platform.shell}`);
  console.log(`bootstrap: ${isBootstrapPlatform(report.platform) ? 'enabled' : report.platform.os === 'win32' ? 'planning only' : 'unsupported'}`);
  console.log(`config dir: ${report.paths.configDir}`);
  console.log(`data dir: ${report.paths.dataDir}`);
  console.log(`runtime dir: ${report.paths.runtimeDir}`);
  console.log(`cache dir: ${report.paths.cacheDir}`);
  console.log(`state dir: ${report.paths.stateDir}`);
  console.log(`ledger file: ${report.paths.ledgerFile}`);

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
  console.log(`tracked assets: ${report.ledger.entries.length}`);
  console.log(`managed tools: ${report.toolOwnership.managed.map((entry) => entry.toolId).join(', ') || 'none'}`);
  console.log(`preexisting tools: ${report.toolOwnership.preexisting.map((entry) => entry.toolId).join(', ') || 'none'}`);
  console.log(`integrations: ${report.state.installedIntegrations.map((item) => `${item.id}(${item.status})`).join(', ') || 'none'}`);
  console.log(`mcp servers: ${report.state.installedMcpServers.map((item) => `${item.id}(${item.status})`).join(', ') || 'none'}`);
  const pruneCount =
    report.pruneAnalysis.tools.length +
    report.pruneAnalysis.skills.length +
    report.pruneAnalysis.integrations.length +
    report.pruneAnalysis.mcpServers.length;
  console.log(`prune candidates: ${pruneCount} removable, ${report.pruneAnalysis.blocked.length} blocked`);
  console.log(
    `config drift: ${
      report.driftFindings.length > 0
        ? report.driftFindings.map((finding) => `${finding.kind}:${finding.id}`).join(', ')
        : 'none'
    }`
  );
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
    console.log(`planned integrations: ${report.plan.integrations.length}`);
    console.log(`planned mcp servers: ${report.plan.mcpServers.length}`);
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
