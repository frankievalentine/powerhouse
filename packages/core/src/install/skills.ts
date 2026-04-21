import { execa } from 'execa';

import type { DomainManifest } from '../registry/schema.ts';
import { resolveSkillsRunner } from '../system/commands.ts';

export const SKILLS_CLI_VERSION = '1.5.1';

export interface SkillsOptions {
  agents: string[];
  dryRun?: boolean;
  onLog?: (message: string) => void;
}

export async function installDomainSkills(domain: DomainManifest, options: SkillsOptions): Promise<void> {
  if (domain.skillPackages.length === 0 || options.agents.length === 0) {
    return;
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

    await runQuietCommand(invocation.command, args, `skills add ${pkg.source}`);
  }
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

async function runQuietCommand(command: string, args: string[], label: string): Promise<void> {
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
