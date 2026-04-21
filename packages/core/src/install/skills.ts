import { execa } from 'execa';

import type { DomainManifest } from '../registry/schema.ts';
import { resolveSkillsRunner } from '../system/commands.ts';

export const SKILLS_CLI_VERSION = '1.5.1';

export interface SkillsOptions {
  agents: string[];
  dryRun?: boolean;
  onLog?: (message: string) => void;
  runCommandImpl?: (command: string, args: string[]) => Promise<void>;
}

export interface ManagedSkillRecord {
  source: string;
  skillName: string | null;
  agent: string;
  scope: 'global' | 'project' | 'local';
  removable: boolean;
}

export interface ManagedSkillRemovalResult {
  key: string;
  status: 'removed' | 'planned' | 'skipped';
  detail: string;
}

export async function installDomainSkills(domain: DomainManifest, options: SkillsOptions): Promise<ManagedSkillRecord[]> {
  const plannedSkills = planManagedSkills(domain, options.agents);
  if (domain.skillPackages.length === 0 || options.agents.length === 0) {
    return plannedSkills;
  }

  const runner = await resolveSkillsRunner();
  if (!runner) {
    throw new Error('Unable to find npx or bunx for skills installation.');
  }
  const invocation = buildSkillsInvocation(runner);

  for (const pkg of domain.skillPackages) {
    const args = [...invocation.args, 'add', pkg.source, '--global', '--yes'];
    for (const agent of options.agents) {
      args.push('--agent', agent);
    }
    for (const skill of pkg.skills) {
      args.push('--skill', skill);
    }

    options.onLog?.(`skills ${pkg.source} -> ${options.agents.join(', ')}`);
    if (options.dryRun) {
      continue;
    }

    await runQuietCommand(invocation.command, args, `skills add ${pkg.source}`, options.runCommandImpl);
  }

  return plannedSkills;
}

export async function runSkillsList(options: { global?: boolean; agent?: string[] } = {}): Promise<void> {
  const runner = await resolveSkillsRunner();
  if (!runner) {
    throw new Error('Unable to find npx or bunx for skills list.');
  }
  const invocation = buildSkillsInvocation(runner);
  const args = [...invocation.args, 'list'];

  if (options.global) {
    args.push('--global');
  }
  for (const agent of options.agent ?? []) {
    args.push('--agent', agent);
  }

  await execa(invocation.command, args, {
    stdout: 'inherit',
    stderr: 'inherit'
  });
}

export async function runSkillsInstall(
  source: string,
  skills: string[],
  agents: string[],
  scope: 'global' | 'project'
): Promise<void> {
  const runner = await resolveSkillsRunner();
  if (!runner) {
    throw new Error('Unable to find npx or bunx for skills install.');
  }
  const invocation = buildSkillsInvocation(runner);
  const args = [...invocation.args, 'add', source];

  if (scope === 'global') {
    args.push('--global');
  }

  for (const agent of agents) {
    args.push('--agent', agent);
  }

  for (const skill of skills) {
    args.push('--skill', skill);
  }

  await runQuietCommand(invocation.command, args, `skills add ${source}`);
}

export async function runSkillsFind(query?: string): Promise<void> {
  const runner = await resolveSkillsRunner();
  if (!runner) {
    throw new Error('Unable to find npx or bunx for skills find.');
  }
  const invocation = buildSkillsInvocation(runner);
  const args = [...invocation.args, 'find'];

  if (query) {
    args.push(query);
  }

  await execa(invocation.command, args, {
    stdout: 'inherit',
    stderr: 'inherit'
  });
}

export interface SkillsRemoveOptions {
  agents?: string[];
  global?: boolean;
  all?: boolean;
  yes?: boolean;
}

export async function runSkillsRemove(skills: string[], options: SkillsRemoveOptions = {}): Promise<void> {
  const runner = await resolveSkillsRunner();
  if (!runner) {
    throw new Error('Unable to find npx or bunx for skills remove.');
  }
  const invocation = buildSkillsInvocation(runner);
  const args = [...invocation.args, 'remove'];

  if (options.global) {
    args.push('--global');
  }
  if (options.all) {
    args.push('--all');
  }
  if (options.yes) {
    args.push('--yes');
  }
  for (const agent of options.agents ?? []) {
    args.push('--agent', agent);
  }
  for (const skill of skills) {
    args.push(skill);
  }

  await runQuietCommand(invocation.command, args, `skills remove ${skills.join(', ') || '(interactive)'}`);
}

export async function runSkillsUpdate(scope: 'global' | 'project' = 'global'): Promise<void> {
  const runner = await resolveSkillsRunner();
  if (!runner) {
    throw new Error('Unable to find npx or bunx for skills update.');
  }
  const invocation = buildSkillsInvocation(runner);
  const args = [...invocation.args, 'update', '--yes'];
  args.push(scope === 'global' ? '--global' : '--project');

  await runQuietCommand(invocation.command, args, `skills update ${scope}`);
}

export interface SkillsInvocation {
  command: 'npx' | 'bunx';
  args: string[];
}

export function buildSkillsInvocation(runner: 'npx' | 'bunx'): SkillsInvocation {
  if (runner === 'npx') {
    return {
      command: 'npx',
      args: ['--yes', `skills@${SKILLS_CLI_VERSION}`]
    };
  }

  return {
    command: 'bunx',
    args: [`skills@${SKILLS_CLI_VERSION}`]
  };
}

export function planManagedSkills(
  domain: DomainManifest,
  agents: string[],
  scope: 'global' | 'project' | 'local' = 'global'
): ManagedSkillRecord[] {
  const records: ManagedSkillRecord[] = [];
  for (const pkg of domain.skillPackages) {
    const skillNames = pkg.skills.length > 0 ? pkg.skills : [null];
    for (const agent of agents) {
      for (const skillName of skillNames) {
        records.push({
          source: pkg.source,
          skillName,
          agent,
          scope,
          removable: skillName !== null
        });
      }
    }
  }

  return records;
}

export async function removeManagedSkills(
  records: ManagedSkillRecord[],
  options: { dryRun?: boolean; onLog?: (message: string) => void; runCommandImpl?: (command: string, args: string[]) => Promise<void> } = {}
): Promise<ManagedSkillRemovalResult[]> {
  const results: ManagedSkillRemovalResult[] = [];
  const grouped = new Map<string, { scope: 'global' | 'project' | 'local'; agent: string; skills: string[] }>();

  for (const record of records) {
    const key = `${record.agent}:${record.scope}`;
    if (!record.removable || !record.skillName) {
      results.push({
        key: `${record.source}:${record.skillName ?? '*'}:${record.agent}:${record.scope}`,
        status: 'skipped',
        detail: `Skill source "${record.source}" cannot be removed safely because no explicit skill name was tracked.`
      });
      continue;
    }

    const group = grouped.get(key) ?? { scope: record.scope, agent: record.agent, skills: [] };
    if (!group.skills.includes(record.skillName)) {
      group.skills.push(record.skillName);
    }
    grouped.set(key, group);
  }

  for (const [key, group] of grouped) {
    options.onLog?.(`skills-remove ${group.agent} -> ${group.skills.join(', ')}`);
    if (!options.dryRun) {
      const runner = await resolveSkillsRunner();
      if (!runner) {
        throw new Error('Unable to find npx or bunx for skills remove.');
      }
      const invocation = buildSkillsInvocation(runner);
      const args = [...invocation.args, 'remove', '--yes'];
      if (group.scope === 'global') {
        args.push('--global');
      }
      args.push('--agent', group.agent, ...group.skills);
      await runQuietCommand(invocation.command, args, `skills remove ${group.skills.join(', ')}`, options.runCommandImpl);
    }

    results.push({
      key,
      status: options.dryRun ? 'planned' : 'removed',
      detail: `${options.dryRun ? 'Would remove' : 'Removed'} ${group.skills.join(', ')} for ${group.agent}.`
    });
  }

  return results;
}

async function runQuietCommand(
  command: string,
  args: string[],
  label: string,
  runCommandImpl?: (command: string, args: string[]) => Promise<void>
): Promise<void> {
  if (runCommandImpl) {
    await runCommandImpl(command, args);
    return;
  }

  try {
    await execa(command, args, {
      all: true
    });
  } catch (error) {
    const reason = formatFailure(label, error);
    throw new Error(reason);
  }
}

function formatFailure(label: string, error: unknown): string {
  if (error instanceof Error && 'all' in error) {
    const combined = String((error as { all?: string }).all ?? '').trim();
    const excerpt = combined
      .split('\n')
      .slice(-20)
      .join('\n')
      .trim();

    if (excerpt.length > 0) {
      return `${label}\n${excerpt}`;
    }
  }

  return error instanceof Error ? `${label}\n${error.message}` : `${label}\n${String(error)}`;
}
