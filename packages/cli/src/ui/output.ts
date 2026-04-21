import type { BootstrapPlan, DoctorCheck, ToolExecutionResult } from '@powerhouse/core';

const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

function color(code: number, value: string): string {
  return useColor ? `\u001B[${code}m${value}\u001B[0m` : value;
}

function bold(value: string): string {
  return useColor ? `\u001B[1m${value}\u001B[0m` : value;
}

function dim(value: string): string {
  return useColor ? `\u001B[2m${value}\u001B[0m` : value;
}

function cyan(value: string): string {
  return color(36, value);
}

function green(value: string): string {
  return color(32, value);
}

function yellow(value: string): string {
  return color(33, value);
}

function blue(value: string): string {
  return color(34, value);
}

export function formatPlan(plan: BootstrapPlan): string {
  const tools = plan.tools.map((tool) => `- ${tool.id}: ${tool.title}`).join('\n');
  const skillPackages =
    plan.domain.skillPackages.length > 0
      ? plan.domain.skillPackages
          .map((pkg) => `- ${pkg.source}${pkg.skills.length > 0 ? ` (${pkg.skills.join(', ')})` : ''}`)
          .join('\n')
      : '- none';
  const notes = plan.notes.length > 0 ? plan.notes.map((note) => `- ${note}`).join('\n') : '- none';

  return [
    `Profile: ${plan.profile.id}`,
    `Domain: ${plan.domain.id}`,
    `Agents: ${plan.agents.length > 0 ? plan.agents.join(', ') : 'none'}`,
    '',
    'Tools:',
    tools,
    '',
    'Skill packages:',
    skillPackages,
    '',
    'Notes:',
    notes
  ].join('\n');
}

export function formatPlanOverview(plan: BootstrapPlan): string {
  return [
    `${bold('Profile')} ${cyan(plan.profile.id)}   ${bold('Domain')} ${cyan(plan.domain.id)}   ${bold('Agents')} ${plan.agents.join(', ') || 'none'}`,
    dim(
      `${plan.tools.length} tool${plan.tools.length === 1 ? '' : 's'} • ${plan.domain.skillPackages.length} skill package${plan.domain.skillPackages.length === 1 ? '' : 's'}`
    )
  ].join('\n');
}

export function printDoctorChecks(checks: DoctorCheck[]): void {
  for (const check of checks) {
    const status = check.ok ? 'OK' : 'FAIL';
    console.log(`${status.padEnd(4)} ${check.label.padEnd(16)} ${check.detail}`);
  }
}

export function printManifestList(items: Array<{ id: string; title: string; description: string }>): void {
  for (const item of items) {
    console.log(`${item.id.padEnd(14)} ${item.title}`);
    console.log(`  ${item.description}`);
  }
}

export function formatExecutionSummary(results: ToolExecutionResult[]): string {
  const installed = results.filter((result) => result.status === 'installed').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;
  const planned = results.filter((result) => result.status === 'planned').length;
  const stepsRun = results.reduce((total, result) => total + result.stepsRun, 0);

  if (planned > 0) {
    return `Summary: ${planned} would install, ${skipped} skipped, ${stepsRun} install step${stepsRun === 1 ? '' : 's'} planned.`;
  }

  return `Summary: ${installed} installed, ${skipped} skipped, ${stepsRun} install step${stepsRun === 1 ? '' : 's'} run.`;
}

export function printInstallerLog(message: string): void {
  if (message.startsWith('skip ')) {
    console.log(`${dim('↷')} ${dim(message.slice(5))}`);
    return;
  }

  if (message.startsWith('install ')) {
    console.log(`${blue('•')} ${message.slice(8)}`);
    return;
  }

  if (message.startsWith('skills ')) {
    console.log(`${green('✓')} ${message}`);
    return;
  }

  console.log(`${yellow('›')} ${message}`);
}

export function printCurrentSelection(
  kind: 'profile' | 'domain',
  selected: { id: string; title: string; description: string },
  updatedAt: string
): void {
  console.log(`active ${kind}: ${selected.id}`);
  console.log(`title: ${selected.title}`);
  console.log(`description: ${selected.description}`);
  console.log(`last updated: ${updatedAt}`);
}
