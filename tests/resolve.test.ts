import { describe, expect, it } from 'vitest';

import { detectPlatform, isPlanPlatform, loadRegistry, resolveSetupPlan, type RegistryData } from '../packages/core/src/index.ts';
import { DEFAULT_DOMAIN_ID, DEFAULT_HARNESS_ID } from '../packages/cli/src/commands/selection.ts';

describe('setup plan resolution', () => {
  it('resolves a claude/web plan from the registry', async () => {
    const registry = await loadRegistry();
    const platform = detectPlatform();

    if (!isPlanPlatform(platform)) {
      return;
    }

    const plan = resolveSetupPlan(registry, platform, ['claude'], ['web']);

    expect(plan.harnesses.map((harness) => harness.id)).toEqual(['claude']);
    expect(plan.domains.map((domain) => domain.id)).toEqual(['web']);
    expect(DEFAULT_HARNESS_ID).toBe('claude');
    expect(DEFAULT_DOMAIN_ID).toBe('general');
  });

  it('includes wired integrations and MCP servers for the claude harness', async () => {
    const registry = await loadRegistry();
    const platform = { ...detectPlatform(), os: 'darwin' as const };

    const plan = resolveSetupPlan(registry, platform, ['claude'], ['general']);

    const integrationIds = plan.integrations.map((integration) => integration.id);
    const mcpIds = plan.mcpServers.map((server) => server.id);

    expect(integrationIds).toContain('claude-github');
    expect(mcpIds).toContain('claude-context7');
    expect(mcpIds).toContain('claude-sequential-thinking');
  });

  it('merges multiple harnesses and domains with dedupe and combined agent filtering', () => {
    const plan = resolveSetupPlan(
      makeSyntheticRegistry(),
      {
        ...detectPlatform(),
        os: 'darwin'
      },
      ['harness-one', 'harness-two'],
      ['domain-web', 'domain-data']
    );

    expect(plan.harnesses.map((harness) => harness.id)).toEqual(['harness-one', 'harness-two']);
    expect(plan.domains.map((domain) => domain.id)).toEqual(['domain-data', 'domain-web']);
    expect(plan.agents).toEqual(['agent-one', 'agent-two']);
    expect(plan.requiredTools.map((tool) => tool.id)).toEqual(['shared-tool']);
    expect(plan.tools.map((tool) => tool.id)).toEqual(['shared-tool', 'data-tool', 'web-tool']);
    expect(plan.integrations.map((integration) => integration.id)).toEqual(['integration-one', 'integration-two']);
    expect(plan.mcpServers.map((server) => server.id)).toEqual(['bundled-shared', 'mcp-one', 'mcp-two']);
    expect(plan.notes).toEqual(['harness one note', 'harness two note', 'domain data note', 'domain web note']);
  });

  it('respects explicit optional tool selection while keeping required harness tools', () => {
    const plan = resolveSetupPlan(
      makeSyntheticRegistry(),
      {
        ...detectPlatform(),
        os: 'darwin'
      },
      ['harness-one'],
      ['domain-web'],
      ['web-tool']
    );

    expect(plan.requiredTools.map((tool) => tool.id)).toEqual(['shared-tool']);
    expect(plan.selectedOptionalTools.map((tool) => tool.id)).toEqual(['web-tool']);
    expect(plan.tools.map((tool) => tool.id)).toEqual(['shared-tool', 'web-tool']);
  });

  it('filters domain integrations and MCP servers against the combined agent set', () => {
    const plan = resolveSetupPlan(
      makeSyntheticRegistry(),
      {
        ...detectPlatform(),
        os: 'darwin'
      },
      ['harness-one'],
      ['domain-web', 'domain-data']
    );

    expect(plan.agents).toEqual(['agent-one']);
    expect(plan.integrations.map((integration) => integration.id)).toEqual(['integration-one']);
    expect(plan.mcpServers.map((server) => server.id)).toEqual(['bundled-shared', 'mcp-one']);
  });

  it('allows a win32 gemini plan', async () => {
    const registry = await loadRegistry();
    const platform = {
      ...detectPlatform(),
      os: 'win32' as const
    };

    const plan = resolveSetupPlan(registry, platform, ['gemini'], ['general']);

    expect(plan.harnesses.map((harness) => harness.id)).toEqual(['gemini']);
  });

  it('rejects an unsupported harness/platform combination and preserves the wsl case', async () => {
    const registry = await loadRegistry();
    const detected = detectPlatform();

    expect(() =>
      resolveSetupPlan(
        registry,
        {
          ...detected,
          os: 'win32'
        },
        ['codex'],
        ['general']
      )
    ).toThrow('Harness "codex" does not support win32.');

    const wslPlan = resolveSetupPlan(
      registry,
      {
        ...detected,
        os: 'wsl'
      },
      ['codex'],
      ['general']
    );

    expect(wslPlan.harnesses.map((harness) => harness.id)).toEqual(['codex']);
  });

  it('rejects unknown selected ids', () => {
    expect(() =>
      resolveSetupPlan(
        makeSyntheticRegistry(),
        {
          ...detectPlatform(),
          os: 'darwin'
        },
        ['missing-harness'],
        ['domain-web']
      )
    ).toThrow('Unknown harness "missing-harness".');

    expect(() =>
      resolveSetupPlan(
        makeSyntheticRegistry(),
        {
          ...detectPlatform(),
          os: 'darwin'
        },
        ['harness-one'],
        ['missing-domain']
      )
    ).toThrow('Unknown domain "missing-domain".');
  });

  it('pulls bundled MCP servers into the resolved plan', () => {
    const registry: RegistryData = {
      rootDir: '/tmp/powerhouse-fixture',
      tools: [
        {
          id: 'claude-code',
          title: 'Claude Code',
          description: 'Claude CLI',
          kind: 'ai-cli',
          priority: 10,
          supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
          check: {
            command: 'claude',
            args: ['--version']
          },
          installs: {
            darwin: [],
            linux: [],
            win32: [],
            wsl: []
          }
        }
      ],
      harnesses: [
        {
          id: 'claude',
          title: 'Claude',
          description: 'Claude harness',
          supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
          requiredToolIds: ['claude-code'],
          integrationIds: ['claude-github'],
          mcpServerIds: [],
          defaultAgents: ['claude-code'],
          notes: []
        }
      ],
      domains: [
        {
          id: 'general',
          title: 'General',
          description: 'General domain',
          recommendedToolIds: [],
          integrationIds: [],
          mcpServerIds: ['claude-context7'],
          skillPackages: [],
          notes: []
        }
      ],
      integrations: [
        {
          id: 'claude-github',
          title: 'Claude GitHub',
          description: 'GitHub plugin',
          targetAgent: 'claude-code',
          supportedPlatforms: ['darwin', 'linux', 'wsl'],
          supportedScopes: ['global', 'project', 'local'],
          installKind: 'native-cli',
          source: 'github@claude-plugins-official',
          tags: ['github'],
          bundledMcpIds: ['claude-context7'],
          install: {
            kind: 'native-cli',
            command: 'claude',
            args: ['plugin', 'install', '{{source}}'],
            cwd: 'project',
            env: {},
            scopeMap: {
              global: 'user'
            },
            restartRequired: false
          }
        }
      ],
      mcpServers: [
        {
          id: 'claude-context7',
          title: 'Claude Context7',
          description: 'Context7 MCP',
          serverName: 'context7',
          targetAgents: ['claude-code'],
          supportedPlatforms: ['darwin', 'linux', 'wsl'],
          supportedScopes: ['global', 'project', 'local'],
          serverKind: 'stdio',
          source: '@upstash/context7-mcp',
          tags: ['context7'],
          install: {
            kind: 'native-cli',
            command: 'claude',
            args: ['mcp', 'add', '{{serverName}}'],
            cwd: 'project',
            env: {},
            scopeMap: {
              global: 'user'
            },
            restartRequired: false
          }
        }
      ]
    };

    const plan = resolveSetupPlan(
      registry,
      {
        ...detectPlatform(),
        os: 'darwin'
      },
      ['claude'],
      ['general']
    );

    expect(plan.integrations.map((integration) => integration.id)).toEqual(['claude-github']);
    expect(plan.mcpServers.map((server) => server.id)).toEqual(['claude-context7']);
  });
});

function makeSyntheticRegistry(): RegistryData {
  return {
    rootDir: '/tmp/powerhouse-fixture',
    tools: [
      makeTool('shared-tool', 10),
      makeTool('data-tool', 20),
      makeTool('web-tool', 30)
    ],
    harnesses: [
      {
        id: 'harness-one',
        title: 'Harness One',
        description: 'Harness one',
        supportedPlatforms: ['darwin'],
        requiredToolIds: ['shared-tool'],
        integrationIds: ['integration-one'],
        mcpServerIds: ['mcp-one'],
        defaultAgents: ['agent-one'],
        notes: ['harness one note']
      },
      {
        id: 'harness-two',
        title: 'Harness Two',
        description: 'Harness two',
        supportedPlatforms: ['darwin'],
        requiredToolIds: ['shared-tool'],
        integrationIds: ['integration-two'],
        mcpServerIds: ['mcp-two'],
        defaultAgents: ['agent-two'],
        notes: ['harness two note']
      }
    ],
    domains: [
      {
        id: 'domain-data',
        title: 'Domain Data',
        description: 'Domain data',
        recommendedToolIds: ['data-tool'],
        integrationIds: ['integration-two', 'integration-unmatched'],
        mcpServerIds: ['mcp-two', 'mcp-unmatched'],
        skillPackages: [],
        notes: ['domain data note']
      },
      {
        id: 'domain-web',
        title: 'Domain Web',
        description: 'Domain web',
        recommendedToolIds: ['shared-tool', 'web-tool'],
        integrationIds: ['integration-one'],
        mcpServerIds: ['mcp-one'],
        skillPackages: [],
        notes: ['domain web note']
      }
    ],
    integrations: [
      makeIntegration('integration-one', 'agent-one', ['bundled-shared']),
      makeIntegration('integration-two', 'agent-two'),
      makeIntegration('integration-unmatched', 'agent-three')
    ],
    mcpServers: [
      makeMcpServer('bundled-shared', ['agent-one', 'agent-two']),
      makeMcpServer('mcp-one', ['agent-one']),
      makeMcpServer('mcp-two', ['agent-two']),
      makeMcpServer('mcp-unmatched', ['agent-three'])
    ]
  };
}

function makeTool(id: string, priority: number) {
  return {
    id,
    title: id,
    description: id,
    kind: 'utility' as const,
    priority,
    supportedPlatforms: ['darwin' as const],
    check: {
      command: id,
      args: ['--version']
    },
    installs: {
      darwin: [],
      linux: [],
      win32: [],
      wsl: []
    }
  };
}

function makeIntegration(id: string, targetAgent: string, bundledMcpIds: string[] = []) {
  return {
    id,
    title: id,
    description: id,
    targetAgent,
    supportedPlatforms: ['darwin' as const],
    supportedScopes: ['global' as const],
    installKind: 'manual' as const,
    source: id,
    tags: [],
    bundledMcpIds,
    install: {
      kind: 'manual' as const,
      instructions: [],
      restartRequired: false
    }
  };
}

function makeMcpServer(id: string, targetAgents: string[]) {
  return {
    id,
    title: id,
    description: id,
    serverName: id,
    targetAgents,
    supportedPlatforms: ['darwin' as const],
    supportedScopes: ['global' as const],
    serverKind: 'stdio' as const,
    source: id,
    tags: [],
    install: {
      kind: 'manual' as const,
      instructions: [],
      restartRequired: false
    }
  };
}
