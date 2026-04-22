import { describe, expect, it } from 'vitest';

import { executeToolPlan, type SetupPlan, type ToolManifest } from '../packages/core/src/index.ts';

describe('tool ownership tracking', () => {
  const tool: ToolManifest = {
    id: 'demo',
    title: 'Demo',
    description: 'Demo tool',
    kind: 'developer-tool',
    priority: 10,
    supportedPlatforms: ['darwin'],
    check: {
      command: 'demo',
      args: ['--version']
    },
    installs: {
      darwin: [{ type: 'brew', name: 'demo', packageType: 'formula' }],
      linux: [],
      win32: [],
      wsl: []
    }
  };

  const plan: SetupPlan = {
    harnesses: [
      {
        id: 'codex',
        title: 'Codex',
        description: 'Codex',
        supportedPlatforms: ['darwin'],
        requiredToolIds: ['demo'],
        defaultAgents: ['codex'],
        integrationIds: [],
        mcpServerIds: [],
        notes: []
      }
    ],
    domains: [
      {
        id: 'general',
        title: 'General',
        description: 'General',
        recommendedToolIds: [],
        integrationIds: [],
        mcpServerIds: [],
        skillPackages: [],
        notes: []
      }
    ],
    requiredTools: [tool],
    recommendedTools: [],
    selectedOptionalTools: [],
    tools: [tool],
    integrations: [],
    mcpServers: [],
    agents: ['codex'],
    notes: []
  };

  it('marks satisfied tools as preexisting unless they are already managed', async () => {
    const [preexisting] = await executeToolPlan(plan, 'darwin', {
      checkSatisfiedImpl: async () => true
    });
    const [managed] = await executeToolPlan(plan, 'darwin', {
      checkSatisfiedImpl: async () => true,
      knownManagedToolIds: ['demo']
    });

    expect(preexisting.ownership).toBe('preexisting');
    expect(preexisting.status).toBe('skipped');
    expect(managed.ownership).toBe('installed');
    expect(managed.status).toBe('skipped');
  });

  it('marks newly installed tools as managed and removable when their install steps are reversible', async () => {
    const commands: string[] = [];

    const [result] = await executeToolPlan(plan, 'darwin', {
      checkSatisfiedImpl: async () => false,
      runCommandImpl: async (command, args) => {
        commands.push(`${command} ${args.join(' ')}`);
      }
    });

    expect(result.status).toBe('installed');
    expect(result.ownership).toBe('installed');
    expect(result.removable).toBe(true);
    expect(commands).toEqual(['brew install demo']);
  });
});
