import { execa } from 'execa';

import type { InstallStep, ToolManifest } from '../registry/schema.ts';
import type { SetupPlan } from './resolve.ts';
import type { PlatformTarget } from '../platform/detect.ts';
import { commandCheckSucceeds, commandExists } from '../system/commands.ts';

export interface ExecutionOptions {
  dryRun?: boolean;
  continueOnError?: boolean;
  onLog?: (message: string) => void;
  knownManagedToolIds?: string[];
  checkSatisfiedImpl?: (tool: ToolManifest, platform: PlatformTarget) => Promise<boolean>;
  runCommandImpl?: (command: string, args: string[], platform: PlatformTarget) => Promise<void>;
}

export interface ToolExecutionResult {
  toolId: string;
  status: 'installed' | 'skipped' | 'planned' | 'failed';
  stepsRun: number;
  ownership: 'installed' | 'preexisting';
  removable: boolean;
  installMethods: InstallStep['type'][];
  errorMessage?: string;
}

export interface ToolRemovalResult {
  toolId: string;
  status: 'removed' | 'planned' | 'skipped';
  detail: string;
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
  plan: SetupPlan,
  platform: PlatformTarget,
  options: ExecutionOptions = {}
): Promise<ToolExecutionResult[]> {
  const results: ToolExecutionResult[] = [];
  const managedToolIds = new Set(options.knownManagedToolIds ?? []);

  for (const tool of plan.tools) {
    const steps = resolveInstallSteps(tool, platform);
    const installMethods = [...new Set(steps.map((step) => step.type))];
    const removable = steps.length > 0 && steps.every(isInstallStepRemovable);
    const satisfied = await resolveToolSatisfied(tool, platform, options);
    if (satisfied) {
      options.onLog?.(`skip ${tool.id} already available`);
      results.push({
        toolId: tool.id,
        status: 'skipped',
        stepsRun: 0,
        ownership: managedToolIds.has(tool.id) ? 'installed' : 'preexisting',
        removable,
        installMethods
      });
      continue;
    }

    if (steps.length === 0) {
      throw new Error(`Tool "${tool.id}" has no install steps for ${platform}.`);
    }

    options.onLog?.(`install ${tool.id}`);
    try {
      for (const step of steps) {
        await executeStep(step, options, platform);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const message = `Failed to install "${tool.id}": ${reason}`;
      if (options.continueOnError) {
        options.onLog?.(`install-failed ${tool.id} ${reason}`);
        results.push({
          toolId: tool.id,
          status: 'failed',
          stepsRun: 0,
          ownership: 'installed',
          removable,
          installMethods,
          errorMessage: message
        });
        continue;
      }
      throw new ToolInstallError(tool.id, results, message);
    }

    results.push({
      toolId: tool.id,
      status: options.dryRun ? 'planned' : 'installed',
      stepsRun: steps.length,
      ownership: 'installed',
      removable,
      installMethods
    });
  }

  return results;
}

export async function isToolSatisfied(tool: ToolManifest): Promise<boolean> {
  return commandCheckSucceeds(tool.check);
}

export async function isToolPlanUpToDate(plan: SetupPlan): Promise<boolean> {
  const results = await Promise.all(plan.tools.map((tool) => isToolSatisfied(tool)));
  return results.every(Boolean);
}

export function resolveInstallSteps(tool: ToolManifest, platform: PlatformTarget): InstallStep[] {
  if (platform === 'wsl' && tool.installs.wsl.length === 0) {
    return tool.installs.linux;
  }

  return tool.installs[platform];
}

export async function removeInstalledTool(
  tool: ToolManifest,
  platform: PlatformTarget,
  options: ExecutionOptions = {}
): Promise<ToolRemovalResult> {
  const steps = resolveInstallSteps(tool, platform);
  if (steps.length === 0) {
    return {
      toolId: tool.id,
      status: 'skipped',
      detail: `No uninstall steps are available for ${platform}.`
    };
  }

  for (const step of steps) {
    if (!isInstallStepRemovable(step)) {
      return {
        toolId: tool.id,
        status: 'skipped',
        detail: `Tool "${tool.id}" uses ${step.type} install steps that cannot be safely removed automatically.`
      };
    }
  }

  if (options.dryRun) {
    return {
      toolId: tool.id,
      status: 'planned',
      detail: `Would uninstall "${tool.id}".`
    };
  }

  for (const step of [...steps].reverse()) {
    await uninstallStep(step, options, platform);
  }

  return {
    toolId: tool.id,
    status: 'removed',
    detail: `Removed "${tool.id}".`
  };
}

function isInstallStepRemovable(step: InstallStep): boolean {
  return step.type !== 'script' && step.type !== 'powershell-script';
}

async function executeStep(step: InstallStep, options: ExecutionOptions, platform: PlatformTarget): Promise<void> {
  if (step.type === 'brew') {
    if (step.tap) {
      await runCommand('brew', ['tap', step.tap], options, platform);
    }

    const args = ['install'];
    if (step.packageType === 'cask') {
      args.push('--cask');
    }
    args.push(step.name);

    await runCommand('brew', args, options, platform);
    return;
  }

  if (step.type === 'winget') {
    const args = ['install', '--id', step.id, '--accept-source-agreements', '--accept-package-agreements'];
    if (step.exact) {
      args.push('--exact');
    }
    await runCommand('winget', args, options, platform);
    return;
  }

  if (step.type === 'scoop') {
    if (step.bucket) {
      await runCommand('scoop', ['bucket', 'add', step.bucket], options, platform);
    }

    await runCommand('scoop', ['install', step.name], options, platform);
    return;
  }

  if (step.type === 'npm') {
    const packageManager = await resolvePackageManager();
    if (packageManager === 'npm') {
      await runCommand('npm', ['install', '--global', step.package], options, platform);
    } else {
      await runCommand('bun', ['install', '--global', step.package], options, platform);
    }
    return;
  }

  if (step.type === 'script') {
    if (platform === 'win32') {
      throw new Error('Unix shell script installers are not supported on native Windows.');
    }

    const shellCommand = `curl -fsSL ${shellEscape(step.url)} | bash${step.args.length > 0 ? ` -s -- ${step.args.map(shellEscape).join(' ')}` : ''}`;
    await runCommand('bash', ['-lc', shellCommand], options, platform);
    return;
  }

  if (step.type === 'powershell-script') {
    const command = [
      "$ProgressPreference = 'SilentlyContinue'",
      `$script = (Invoke-WebRequest -UseBasicParsing '${powershellEscape(step.url)}').Content`,
      `& ([ScriptBlock]::Create($script))${step.args.length > 0 ? ` ${step.args.map(powershellQuote).join(' ')}` : ''}`
    ].join('; ');
    await runCommand('powershell', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], options, platform);
    return;
  }

  throw new Error(`Unsupported install step type: ${(step as InstallStep).type}`);
}

async function uninstallStep(step: InstallStep, options: ExecutionOptions, platform: PlatformTarget): Promise<void> {
  if (step.type === 'brew') {
    const args = ['uninstall'];
    if (step.packageType === 'cask') {
      args.push('--cask');
    }
    args.push(step.name);
    await runCommand('brew', args, options, platform);
    return;
  }

  if (step.type === 'winget') {
    const args = ['uninstall', '--id', step.id];
    if (step.exact) {
      args.push('--exact');
    }
    await runCommand('winget', args, options, platform);
    return;
  }

  if (step.type === 'scoop') {
    await runCommand('scoop', ['uninstall', step.name], options, platform);
    return;
  }

  if (step.type === 'npm') {
    const packageManager = await resolvePackageManager();
    if (packageManager === 'npm') {
      await runCommand('npm', ['uninstall', '--global', step.package], options, platform);
    } else {
      await runCommand('bun', ['remove', '--global', step.package], options, platform);
    }
    return;
  }

  throw new Error(`Install step "${step.type}" cannot be safely removed.`);
}

async function resolveToolSatisfied(tool: ToolManifest, platform: PlatformTarget, options: ExecutionOptions): Promise<boolean> {
  if (options.checkSatisfiedImpl) {
    return options.checkSatisfiedImpl(tool, platform);
  }

  return commandCheckSucceeds(tool.check, platform);
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

async function runCommand(command: string, args: string[], options: ExecutionOptions, platform: PlatformTarget = 'linux'): Promise<void> {
  if (options.dryRun) {
    return;
  }

  if (options.runCommandImpl) {
    await options.runCommandImpl(command, args, platform);
    return;
  }

  try {
    await execa(command, args, {
      all: true,
      windowsHide: platform === 'win32'
    });
  } catch (error) {
    const reason = formatCommandFailure(command, args, error);
    throw new Error(reason);
  }
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function powershellEscape(value: string): string {
  return value.replace(/'/g, "''");
}

function powershellQuote(value: string): string {
  return `'${powershellEscape(value)}'`;
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
