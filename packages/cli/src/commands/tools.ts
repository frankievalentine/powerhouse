import { loadRegistry } from '@powerhouse/core';

import { printManifestList } from '../ui/output.ts';

export async function runToolListCommand(): Promise<void> {
  const registry = await loadRegistry();
  printManifestList(registry.tools);
}

export async function runToolShowCommand(toolId: string): Promise<void> {
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
  console.log(`check: ${tool.checkCommand}`);
  console.log(`doctor hint: ${tool.doctorHint ?? 'none'}`);
  console.log(`darwin installs: ${formatInstallSteps(tool.installs.darwin)}`);
  console.log(`linux installs: ${formatInstallSteps(tool.installs.linux)}`);
}

function formatInstallSteps(
  steps: Array<
    | { type: 'brew'; name: string; packageType: 'formula' | 'cask'; tap?: string }
    | { type: 'npm'; package: string }
    | { type: 'script'; url: string; args?: string[] }
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
      if (step.type === 'npm') {
        return `npm:${step.package}`;
      }
      return `script:${step.url}`;
    })
    .join('; ');
}

