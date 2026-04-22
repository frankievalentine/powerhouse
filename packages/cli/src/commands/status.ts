import { buildStatusReport, isSetupPlatform } from '@powerhouse/core';

import { formatPlatform, printDoctorChecks, printKeyValueRows, printSection } from '../ui/output.ts';

export async function runStatusCommand(): Promise<void> {
  const report = await buildStatusReport();
  const setupSupport = isSetupPlatform(report.platform) ? 'enabled' : 'unsupported';

  printSection('Environment');
  printKeyValueRows([
    { label: 'Platform', value: `${formatPlatform(report.platform.os)} / ${report.platform.arch}` },
    { label: 'Shell', value: report.platform.shell },
    { label: 'Setup', value: setupSupport }
  ]);
  console.log('');
  printSection('Paths');
  printKeyValueRows([
    { label: 'Config', value: report.paths.configDir },
    { label: 'Runtime', value: report.paths.runtimeDir },
    { label: 'State', value: report.paths.stateDir },
    { label: 'Ledger', value: report.paths.ledgerFile }
  ]);

  if (!report.state) {
    console.log('');
    printSection('State');
    printKeyValueRows([{ label: 'Setup state', value: 'Not initialized' }]);
    if (report.lastRun) {
      console.log('');
      printSection('Last run');
      printKeyValueRows([
        { label: 'Result', value: `${report.lastRun.command} ${report.lastRun.status}` },
        { label: 'Finished', value: report.lastRun.finishedAt },
        { label: 'Error', value: report.lastRun.errorMessage }
      ]);
    }
    console.log('');
    printSection('Doctor');
    printDoctorChecks(report.doctorChecks);
    process.exitCode = 1;
    return;
  }

  console.log('');
  printSection('Selection');
  printKeyValueRows([
    { label: 'Harnesses', value: report.activeHarnesses.map((harness) => harness.id).join(', ') || report.state.activeHarnessIds.join(', ') },
    { label: 'Domains', value: report.activeDomains.map((domain) => domain.id).join(', ') || report.state.activeDomainIds.join(', ') },
    { label: 'Optional tools', value: report.state.selectedToolIds.join(', ') || 'none' },
    { label: 'Agents', value: report.state.installedAgents.join(', ') || 'none' },
    { label: 'Updated', value: report.state.updatedAt }
  ]);

  console.log('');
  printSection('Managed assets');
  const pruneCount =
    report.pruneAnalysis.tools.length +
    report.pruneAnalysis.skills.length +
    report.pruneAnalysis.integrations.length +
    report.pruneAnalysis.mcpServers.length;
  printKeyValueRows([
    { label: 'Tracked assets', value: String(report.ledger.entries.length) },
    { label: 'Managed tools', value: report.toolOwnership.managed.map((entry) => entry.toolId).join(', ') || 'none' },
    { label: 'Preexisting tools', value: report.toolOwnership.preexisting.map((entry) => entry.toolId).join(', ') || 'none' },
    { label: 'Integrations', value: formatCatalogStateList(report.state.installedIntegrations) },
    { label: 'MCP servers', value: formatCatalogStateList(report.state.installedMcpServers) },
    { label: 'Prune candidates', value: `${pruneCount} removable, ${report.pruneAnalysis.blocked.length} blocked` },
    { label: 'Config drift', value: report.driftFindings.length > 0 ? report.driftFindings.map((finding) => `${finding.kind}:${finding.id}`).join(', ') : 'none' }
  ]);

  if (report.lastRun) {
    console.log('');
    printSection('Last run');
    printKeyValueRows([
      { label: 'Result', value: `${report.lastRun.command} ${report.lastRun.status}` },
      { label: 'Finished', value: report.lastRun.finishedAt },
      { label: 'Failed tool', value: report.lastRun.failedToolId },
      { label: 'Error', value: report.lastRun.errorMessage }
    ]);
  }

  console.log('');
  printSection('Health');
  if (report.plan) {
    const toolCount = report.plan.tools.length;
    const okTools = report.doctorChecks.filter((check) => report.plan?.tools.some((tool) => tool.id === check.label) && check.ok).length;
    printKeyValueRows([
      { label: 'Tools healthy', value: `${okTools}/${toolCount}` },
      { label: 'Planned integrations', value: String(report.plan.integrations.length) },
      { label: 'Planned MCP servers', value: String(report.plan.mcpServers.length) }
    ]);
  } else {
    printKeyValueRows([{ label: 'Tools healthy', value: 'unknown' }]);
  }

  console.log('');
  printSection('Doctor');
  printDoctorChecks(report.doctorChecks);

  if (report.doctorChecks.some((check) => !check.ok)) {
    process.exitCode = 1;
  }
}

function formatCatalogStateList(items: Array<{ id: string; status: string }>): string {
  if (items.length === 0) {
    return 'none';
  }

  return items.map((item) => `${item.id} (${item.status})`).join(', ');
}
