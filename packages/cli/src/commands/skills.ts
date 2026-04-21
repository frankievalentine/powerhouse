import { runSkillsFind, runSkillsInstall, runSkillsList, runSkillsRemove } from '@powerhouse/core';

export interface SkillsInstallCommandOptions {
  agent?: string[];
  project?: boolean;
  skill?: string[];
}

export interface SkillsListCommandOptions {
  agent?: string[];
  global?: boolean;
}

export interface SkillsRemoveCommandOptions {
  agent?: string[];
  all?: boolean;
  global?: boolean;
  yes?: boolean;
}

export async function runSkillsListCommand(options: SkillsListCommandOptions): Promise<void> {
  await runSkillsList({
    agent: options.agent ?? [],
    global: options.global ?? false
  });
}

export async function runSkillsInstallCommand(source: string, options: SkillsInstallCommandOptions): Promise<void> {
  await runSkillsInstall(source, options.skill ?? [], options.agent ?? [], options.project ? 'project' : 'global');
}

export async function runSkillsFindCommand(query?: string): Promise<void> {
  await runSkillsFind(query);
}

export async function runSkillsRemoveCommand(skills: string[], options: SkillsRemoveCommandOptions): Promise<void> {
  await runSkillsRemove(skills, {
    agents: options.agent ?? [],
    all: options.all ?? false,
    global: options.global ?? false,
    yes: options.yes ?? false
  });
}
