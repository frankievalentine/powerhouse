import { loadRegistry, type PlatformTarget } from '@powerhouse/core';

export interface ToolListCommandOptions {
  platform?: PlatformTarget;
}

export interface ToolShowCommandOptions {
  platform?: PlatformTarget;
}

export async function runToolListCommand(options: ToolListCommandOptions = {}): Promise<void> {
  const registry = await loadRegistry();
  const tools = options.platform ? registry.tools.filter((tool) => tool.supportedPlatforms.includes(options.platform!)) : registry.tools;

  for (const tool of tools) {
    console.log(`${tool.id.padEnd(14)} ${tool.title}`);
    console.log(`  ${tool.description}`);
    console.log(`  platforms: ${tool.supportedPlatforms.join(', ')}`);
  }
}

export async function runToolShowCommand(toolId: string, options: ToolShowCommandOptions = {}): Promise<void> {
  const registry = await loadRegistry();
  const tool = registry.tools.find((entry) => entry.id === toolId);

  if (!tool) {
    throw new Error(`Unknown tool "${toolId}".`);
  }

  console.log(`id: ${tool.id}`);
  console.log(`title: ${tool.title}`);
  console.log(`description: ${tool.description}`);
  console.log(`kind: ${tool.kind}`);
  console.log(`priority: ${tool.priority}`);
  console.log(`platforms: ${tool.supportedPlatforms.join(', ')}`);
  if (options.platform) {
    console.log(`supported on ${options.platform}: ${tool.supportedPlatforms.includes(options.platform) ? 'yes' : 'no'}`);
  }
  console.log(`check: ${tool.check.command}${tool.check.args.length > 0 ? ` ${tool.check.args.join(' ')}` : ''}`);
  console.log(`doctor hint: ${tool.doctorHint ?? 'none'}`);
  console.log(`darwin installs: ${formatInstallSteps(tool.installs.darwin)}`);
  console.log(`linux installs: ${formatInstallSteps(tool.installs.linux)}`);
  console.log(`win32 installs: ${formatInstallSteps(tool.installs.win32)}`);
  console.log(`wsl installs: ${formatInstallSteps(tool.installs.wsl)}`);
}

function formatInstallSteps(
  steps: Array<
    | { type: 'brew'; name: string; packageType: 'formula' | 'cask'; tap?: string }
    | { type: 'winget'; id: string; exact?: boolean }
    | { type: 'scoop'; name: string; bucket?: string }
    | { type: 'npm'; package: string }
    | { type: 'script'; url: string; args?: string[] }
    | { type: 'powershell-script'; url: string; args?: string[] }
  >
): string {
  if (steps.length === 0) {
    return 'none';
  }

  return steps
    .map((step) => {
      if (step.type === 'brew') {
        const tap = step.tap ? `${step.tap}/` : '';
        const packageType = step.packageType === 'cask' ? 'cask' : 'brew';
        return `${packageType}:${tap}${step.name}`;
      }
      if (step.type === 'winget') {
        return `winget:${step.id}`;
      }
      if (step.type === 'scoop') {
        const bucket = step.bucket ? `${step.bucket}/` : '';
        return `scoop:${bucket}${step.name}`;
      }
      if (step.type === 'npm') {
        return `npm:${step.package}`;
      }
      if (step.type === 'powershell-script') {
        return `powershell:${step.url}`;
      }
      return `script:${step.url}`;
    })
    .join('; ');
}
