import { execa } from 'execa';

import type { InstallStep, ToolManifest } from '../registry/schema.ts';
import type { BootstrapPlan } from './resolve.ts';
import type { SupportedPlatform } from '../platform/detect.ts';
import { commandExists, shellCommandSucceeds } from '../system/commands.ts';

export interface ExecutionOptions {
  dryRun?: boolean;
  onLog?: (message: string) => void;
}

export interface ToolExecutionResult {
  toolId: string;
  status: 'installed' | 'skipped' | 'planned';
  stepsRun: number;
}

export class ToolInstallError extends Error {
  readonly toolId: string;
  readonly results: ToolExecutionResult[];

  constructor(toolId: string, results: ToolExecutionResult[], message: string) {
    super(message);
    this.name = 'ToolInstallError';
    this.toolId = toolId;
    this.results = results;
  }
}

export async function executeToolPlan(
  plan: BootstrapPlan,
  platform: SupportedPlatform,
  options: ExecutionOptions = {}
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];

  for (const tool of plan.tools) {
    const satisfied = await shellCommandSucceeds(tool.checkCommand);
    if (satisfied) {
      options.onLog?.(`skip ${tool.id} already available`);
      results.push({ toolId: tool.id, status: 'skipped', stepsRun: 0 });
      continue;
    }

    const steps = tool.installs[platform];
    if (steps.length === 0) {
      throw new Error(`Tool "${tool.id}" has no install steps for ${platform}.`);
    }

    options.onLog?.(`install ${tool.id}`);
    try {
      for (const step of steps) {
        await executeStep(step, options);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new ToolInstallError(tool.id, results, `Failed to install "${tool.id}": ${reason}`);
    }

    results.push({ toolId: tool.id, status: options.dryRun ? 'planned' : 'installed', stepsRun: steps.length });
  }

  return results;
}

export async function isToolSatisfied(tool: ToolManifest): Promise<boolean> {
  return shellCommandSucceeds(tool.checkCommand);
}

async function executeStep(step: InstallStep, options: ExecutionOptions): Promise<void> {
  if (step.type === 'brew') {
    if (step.tap) {
      await runCommand('brew', ['tap', step.tap], options);
    }

    const args = ['install'];
    if (step.packageType === 'cask') {
      args.push('--cask');
    }
    args.push(step.name);

    await runCommand('brew', args, options);
    return;
  }

  if (step.type === 'npm') {
    const packageManager = await resolvePackageManager();
    if (packageManager === 'npm') {
      await runCommand('npm', ['install', '--global', step.package], options);
    } else {
      await runCommand('bun', ['install', '--global', step.package], options);
    }
    return;
  }

  const shellCommand = `curl -fsSL ${shellEscape(step.url)} | bash${step.args.length > 0 ? ` -s -- ${step.args.map(shellEscape).join(' ')}` : ''}`;
  await runCommand('bash', ['-lc', shellCommand], options);
}

async function resolvePackageManager(): Promise<'npm' | 'bun'> {
  if (await commandExists('npm')) {
    return 'npm';
  }
  if (await commandExists('bun')) {
    return 'bun';
  }
  throw new Error('Neither npm nor bun is available for npm-based installations.');
}

async function runCommand(command: string, args: string[], options: ExecutionOptions): Promise<void> {
  if (options.dryRun) {
    return;
  }

  try {
    await execa(command, args, {
      all: true
    });
  } catch (error) {
    const reason = formatCommandFailure(command, args, error);
    throw new Error(reason);
  }
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function formatCommandFailure(command: string, args: string[], error: unknown): string {
  const commandString = `${command} ${args.join(' ')}`.trim();

  if (error instanceof Error && 'all' in error) {
    const combined = String((error as { all?: string }).all ?? '').trim();
    const excerpt = combined
      .split('\n')
      .slice(-20)
      .join('\n')
      .trim();

    if (excerpt.length > 0) {
      return `${commandString}\n${excerpt}`;
    }
  }

  return error instanceof Error ? `${commandString}\n${error.message}` : `${commandString}\n${String(error)}`;
}
