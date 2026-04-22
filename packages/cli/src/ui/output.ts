import path from 'node:path';

import type { CatalogInstallResult, DoctorCheck, SetupPlan, ToolExecutionResult } from '@powerhouse/core';

const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

const platformLabels: Record<string, string> = {
  darwin: 'macOS',
  linux: 'Linux',
  win32: 'Windows',
  wsl: 'WSL'
};

const doctorLabelMap: Record<string, string> = {
  platform: 'Platform',
  shell: 'Shell',
  setup: 'Setup',
  brew: 'Homebrew',
  winget: 'winget',
  bun: 'Bun',
  node: 'Node.js',
  'skills-runner': 'Skills runner',
  wrapper: 'Wrapper',
  'runtime-dir': 'Runtime directory',
  state: 'State',
  ledger: 'Ledger',
  'last-run': 'Last run',
  harnesses: 'Harnesses',
  domains: 'Domains',
  'state-platform': 'Saved platform',
  agents: 'Agents',
  'tool-state': 'Tool state',
  integrations: 'Integrations',
  mcp: 'MCP servers',
  prune: 'Prune',
  drift: 'Config drift'
};

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

function red(value: string): string {
  return color(31, value);
}

export function formatPlatform(platform: string): string {
  return platformLabels[platform] ?? platform;
}

export function formatPlatformList(platforms: string[]): string {
  return platforms.map(formatPlatform).join(', ');
}

export function summarizeDescription(
  description: string,
  kind: 'harness' | 'domain' | 'tool' | 'integration' | 'mcp' = 'tool'
): string {
  let summary = description.replace(/\s+/g, ' ').trim();

  if (kind === 'harness') {
    summary = summary.replace(/ CLI agent and desktop app \(macOS\)\.$/, ' CLI and desktop app on macOS.');
    summary = summary.replace(/ CLI agent\.$/, ' CLI.');
  }

  if (kind === 'domain') {
    summary = summary.replace(/^Curated skills and defaults for /i, '');
    summary = summary.replace(/^Curated skills for /i, '');
    summary = summary.replace(/^A small default skill bundle for /i, '');
    summary = summary.replace(/ workflows?\.$/i, '.');
    summary = summary.charAt(0).toUpperCase() + summary.slice(1);
  }

  return summary;
}

export function shortenPathForDisplay(filePath: string, cwd = process.cwd(), homeDir = process.env.HOME): string {
  const normalized = path.normalize(filePath);
  const normalizedCwd = path.normalize(cwd);
  const normalizedHome = homeDir ? path.normalize(homeDir) : null;

  if (normalized === normalizedCwd) {
    return '.';
  }

  if (normalized.startsWith(`${normalizedCwd}${path.sep}`)) {
    const relative = path.relative(normalizedCwd, normalized);
    return relative === '' ? '.' : `.${path.sep}${relative}`;
  }

  if (normalizedHome && normalized.startsWith(`${normalizedHome}${path.sep}`)) {
    const relative = path.relative(normalizedHome, normalized);
    return relative === '' ? '~' : `~${path.sep}${relative}`;
  }

  return normalized;
}

export function formatPlan(plan: SetupPlan): string {
  const skillPackages = collectUniqueSkillPackageDescriptors(plan);

  return [
    bold('Requested setup'),
    ...renderRows([
      { label: 'Harnesses', value: formatInlineList(plan.harnesses.map((harness) => harness.id)) },
      { label: 'Domains', value: formatInlineList(plan.domains.map((domain) => domain.id)) },
      { label: 'Optional tools', value: formatInlineList(plan.selectedOptionalTools.map((tool) => tool.id)) },
      { label: 'Agents', value: formatInlineList(plan.agents) }
    ]),
    '',
    bold('Included'),
    ...renderBulletLines([
      formatCountedList('Required tools', plan.requiredTools.map((tool) => tool.id)),
      formatCountedList('Selected optional tools', plan.selectedOptionalTools.map((tool) => tool.id)),
      formatCountedList('Final tools', plan.tools.map((tool) => tool.id)),
      formatCountedList('Integrations', plan.integrations.map((item) => item.id)),
      formatCountedList('MCP servers', plan.mcpServers.map((item) => item.id)),
      `Skill packages (${skillPackages.length}): ${skillPackages.length > 0 ? skillPackages.map(formatSkillPackageDescriptor).join('; ') : 'none'}`
    ]),
    ...(plan.notes.length > 0 ? ['', bold('Notes'), ...renderBulletLines(plan.notes)] : [])
  ].join('\n');
}

export function formatPlanOverview(plan: SetupPlan): string {
  const skillPackageCount = collectUniqueSkillPackageDescriptors(plan).length;
  const selection = `${formatInlineList(plan.harnesses.map((harness) => harness.id))} / ${formatInlineList(plan.domains.map((domain) => domain.id))}`;
  const agents = plan.agents.length > 0 ? ` • agents ${plan.agents.join(', ')}` : '';
  const optionalTools = plan.selectedOptionalTools.length > 0 ? ` • optional ${plan.selectedOptionalTools.map((tool) => tool.id).join(', ')}` : '';

  return [
    `${bold('Setup')} ${cyan(selection)}${agents}${optionalTools}`,
    dim(
      `${plan.tools.length} tool${plan.tools.length === 1 ? '' : 's'} • ${plan.integrations.length} integration${plan.integrations.length === 1 ? '' : 's'} • ${plan.mcpServers.length} MCP server${plan.mcpServers.length === 1 ? '' : 's'} • ${skillPackageCount} skill package${skillPackageCount === 1 ? '' : 's'}`
    )
  ].join('\n');
}

export function printDoctorChecks(checks: DoctorCheck[]): void {
  const width = Math.max(...checks.map((check) => formatDoctorLabel(check.label).length), 10);

  for (const check of checks) {
    const status = check.ok ? green('OK') : red('FAIL');
    const label = formatDoctorLabel(check.label).padEnd(width);
    const detail = formatDoctorDetail(check.label, check.detail);
    console.log(`${status}  ${label}  ${detail}`);
  }
}

export function printManifestList(
  items: Array<{
    id: string;
    title: string;
    description: string;
    kind?: 'harness' | 'domain' | 'tool' | 'integration' | 'mcp';
    metadata?: string[];
  }>
): void {
  const width = Math.max(...items.map((item) => item.id.length), 12);

  items.forEach((item, index) => {
    console.log(`${cyan(item.id.padEnd(width))} ${bold(item.title)}`);
    console.log(`  ${summarizeDescription(item.description, item.kind ?? 'tool')}`);
    for (const line of item.metadata ?? []) {
      console.log(`  ${dim(line)}`);
    }
    if (index < items.length - 1) {
      console.log('');
    }
  });
}

export function printCatalogList(
  items: Array<{
    id: string;
    title: string;
    description: string;
    target: string;
    scopes: string[];
    source: string;
    kind?: 'integration' | 'mcp';
  }>
): void {
  const width = Math.max(...items.map((item) => item.id.length), 14);

  items.forEach((item, index) => {
    console.log(`${cyan(item.id.padEnd(width))} ${bold(item.title)}`);
    console.log(`  ${summarizeDescription(item.description, item.kind ?? 'integration')}`);
    console.log(`  ${dim(`Target: ${item.target} • Scopes: ${item.scopes.join(', ')} • Source: ${item.source}`)}`);
    if (index < items.length - 1) {
      console.log('');
    }
  });
}

export function formatExecutionSummary(results: ToolExecutionResult[]): string {
  const installed = results.filter((result) => result.status === 'installed').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;
  const failed = results.filter((result) => result.status === 'failed').length;
  const planned = results.filter((result) => result.status === 'planned').length;

  if (planned > 0) {
    return `Tools: ${planned} to install, ${skipped} already available.`;
  }

  if (installed === 0 && failed === 0) {
    return `Tools: no changes, ${skipped} already available.`;
  }

  const parts = [`Tools: ${installed} installed`, `${skipped} already available`];
  if (failed > 0) {
    parts.push(`${failed} failed`);
  }
  return `${parts.join(', ')}.`;
}

export function printToolFailures(results: ToolExecutionResult[]): void {
  const failed = results.filter((result) => result.status === 'failed');
  if (failed.length === 0) return;

  console.log(`\n${yellow('⚠')} ${failed.length} tool${failed.length === 1 ? '' : 's'} failed:`);
  for (const result of failed) {
    console.log(`  ${yellow('✗')} ${result.toolId}${result.errorMessage ? ` — ${result.errorMessage}` : ''}`);
  }
  console.log(`  Retry with ${cyan('powerhouse update')} after fixing the issue.`);
}

export function formatCatalogExecutionSummary(label: string, results: CatalogInstallResult[]): string {
  const counts = [
    countStatus(results, 'configured', 'configured'),
    countStatus(results, 'planned', 'planned'),
    countStatus(results, 'restart_required', 'restart required'),
    countStatus(results, 'manual_step_required', 'manual'),
    countStatus(results, 'unsupported_scope', 'unsupported')
  ].filter(Boolean);

  return `${label}: ${counts.length > 0 ? counts.join(', ') : 'none'}.`;
}

export function printCatalogInstallResult(result: CatalogInstallResult): void {
  const scope = result.nativeScope && result.nativeScope !== result.scope ? `${result.scope} -> ${result.nativeScope}` : result.scope;
  const status = formatCatalogStatus(result.status).padEnd(11);
  console.log(`${formatCatalogStatusLabel(result.status, status)} ${result.id} [${scope}]`);
  console.log(`  ${formatCatalogDetail(result.detail)}`);
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

  if (message.startsWith('install-failed ')) {
    const rest = message.slice(15);
    const spaceIdx = rest.indexOf(' ');
    const toolId = spaceIdx >= 0 ? rest.slice(0, spaceIdx) : rest;
    console.log(`${yellow('✗')} ${toolId} failed — continuing`);
    return;
  }

  if (message.startsWith('skills ')) {
    console.log(`${green('✓')} ${message}`);
    return;
  }

  if (message.startsWith('skills-remove ')) {
    console.log(`${yellow('•')} ${message.slice(14)}`);
    return;
  }

  if (message.startsWith('catalog ')) {
    console.log(`${green('✓')} ${message.slice(8)}`);
    return;
  }

  if (message.startsWith('catalog-remove ')) {
    console.log(`${yellow('•')} ${message.slice(15)}`);
    return;
  }

  if (message.startsWith('manual ')) {
    console.log(`${yellow('!')} ${message.slice(7)} requires a manual step`);
    return;
  }

  if (message.startsWith('plan ')) {
    console.log(`${blue('•')} plan ${message.slice(5)}`);
    return;
  }

  console.log(`${yellow('›')} ${message}`);
}

export function printCurrentSelection(
  kind: 'harness' | 'domain',
  selected: Array<{ id: string; title: string; description: string }>,
  updatedAt: string
): void {
  const label = kind === 'harness' ? 'Active harnesses' : 'Active domains';
  console.log(`${bold(label)} ${selected.map((entry) => entry.id).join(', ')}`);
  console.log(dim(`Updated ${updatedAt}`));
  console.log('');

  printManifestList(
    selected.map((entry) => ({
      ...entry,
      kind
    }))
  );
}

export function printSection(title: string): void {
  console.log(bold(title));
}

export function printKeyValueRows(rows: Array<{ label: string; value: string | null | undefined }>): void {
  for (const line of renderRows(rows)) {
    console.log(line);
  }
}

export function printBulletSection(title: string, items: string[], empty = 'None'): void {
  printSection(title);
  if (items.length === 0) {
    console.log(`  ${dim(empty)}`);
    return;
  }

  for (const line of renderBulletLines(items)) {
    console.log(line);
  }
}

function renderRows(rows: Array<{ label: string; value: string | null | undefined }>): string[] {
  const visible = rows.filter((row) => row.value && row.value.trim().length > 0);
  if (visible.length === 0) {
    return [];
  }

  const width = Math.max(...visible.map((row) => row.label.length));
  return visible.map((row) => `${dim(`${row.label}:`.padEnd(width + 1))} ${row.value}`);
}

function renderBulletLines(items: string[]): string[] {
  return items.map((item) => `  - ${item}`);
}

function formatInlineList(items: string[], empty = 'none'): string {
  return items.length > 0 ? items.join(', ') : empty;
}

function formatCountedList(label: string, items: string[]): string {
  return `${label} (${items.length}): ${formatInlineList(items)}`;
}

function formatSkillPackageDescriptor(pkg: { source: string; skills: string[] }): string {
  return pkg.skills.length > 0 ? `${pkg.source} [${pkg.skills.join(', ')}]` : pkg.source;
}

function formatDoctorLabel(label: string): string {
  return doctorLabelMap[label] ?? label;
}

function formatDoctorDetail(label: string, detail: string): string {
  if (label === 'platform') {
    return detail.replace(/^darwin\//, 'macOS / ').replace(/^linux\//, 'Linux / ').replace(/^win32\//, 'Windows / ').replace(/^wsl\//, 'WSL / ');
  }

  if (label === 'runtime-dir') {
    return detail.replace(/^(.+?) \(missing — run the installer again\)$/, (_, filePath: string) => {
      return `${shortenPathForDisplay(filePath)} missing — run the installer again`;
    });
  }

  return detail;
}

function countStatus(results: CatalogInstallResult[], status: CatalogInstallResult['status'], label: string): string | null {
  const count = results.filter((result) => result.status === status).length;
  if (count === 0) {
    return null;
  }

  return `${count} ${label}`;
}

function formatCatalogStatus(status: CatalogInstallResult['status']): string {
  switch (status) {
    case 'configured':
      return 'configured';
    case 'planned':
      return 'planned';
    case 'restart_required':
      return 'restart';
    case 'manual_step_required':
      return 'manual';
    case 'unsupported_scope':
      return 'unsupported';
  }
}

function formatCatalogStatusLabel(status: CatalogInstallResult['status'], value: string): string {
  switch (status) {
    case 'configured':
      return green(value);
    case 'planned':
      return blue(value);
    case 'restart_required':
      return yellow(value);
    case 'manual_step_required':
      return yellow(value);
    case 'unsupported_scope':
      return red(value);
  }
}

function formatCatalogDetail(detail: string): string {
  if (detail.startsWith('Would update ')) {
    return `Would update ${shortenPathForDisplay(detail.slice('Would update '.length))}`;
  }

  if (detail.startsWith('Drift detected in ')) {
    const [prefix, suffix] = detail.split('. Re-run with', 2);
    const files = prefix
      .slice('Drift detected in '.length)
      .split(', ')
      .map((filePath) => shortenPathForDisplay(filePath))
      .join(', ');
    return suffix ? `Drift detected in ${files}. Re-run with${suffix}` : `Drift detected in ${files}.`;
  }

  return detail;
}

function collectUniqueSkillPackageDescriptors(plan: SetupPlan): Array<{ source: string; skills: string[] }> {
  const packages = new Map<string, { source: string; skills: string[] }>();

  for (const domain of plan.domains) {
    for (const pkg of domain.skillPackages) {
      const existing = packages.get(pkg.source);
      if (!existing) {
        packages.set(pkg.source, {
          source: pkg.source,
          skills: [...pkg.skills]
        });
        continue;
      }

      if (existing.skills.length === 0 || pkg.skills.length === 0) {
        existing.skills = [];
        continue;
      }

      for (const skill of pkg.skills) {
        if (!existing.skills.includes(skill)) {
          existing.skills.push(skill);
        }
      }
    }
  }

  return [...packages.values()];
}
