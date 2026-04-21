import { describe, expect, it } from 'vitest';

import { detectPlatform, isPlanPlatform, loadRegistry, resolveBootstrapPlan, type RegistryData } from '../packages/core/src/index.ts';
import { DEFAULT_DOMAIN_ID, DEFAULT_PROFILE_ID } from '../packages/cli/src/commands/bootstrap.ts';

describe('bootstrap plan resolution', () => {
  it('resolves a claude/web plan from the registry', async () => {
    const registry = await loadRegistry();
    const platform = detectPlatform();

    if (!isPlanPlatform(platform)) {
      return;
    }

    const plan = resolveBootstrapPlan(registry, platform, 'claude', 'web');

    expect(plan.profile.id).toBe('claude');

    expect(DEFAULT_PROFILE_ID).toBe('claude');
    expect(DEFAULT_DOMAIN_ID).toBe('general');
  });

  it('allows a win32 gemini plan', async () => {
    const registry = await loadRegistry();
    const platform = {
      ...detectPlatform(),
      os: 'win32' as const
    };

    const plan = resolveBootstrapPlan(registry, platform, 'gemini', 'general');

    expect(plan.profile.id).toBe('gemini');
  });

  it('rejects a win32 codex plan and allows the same profile on wsl', async () => {
    const registry = await loadRegistry();
    const detected = detectPlatform();

    expect(() =>
      resolveBootstrapPlan(
        registry,
        {
          ...detected,
          os: 'win32'
        },
        'codex',
        'general'
      )
    ).toThrow('Profile "codex" does not support win32.');

    const wslPlan = resolveBootstrapPlan(
      registry,
      {
        ...detected,
        os: 'wsl'
      },
      'codex',
      'general'
    );

    expect(wslPlan.profile.id).toBe('codex');
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
      profiles: [
        {
          id: 'claude',
          title: 'Claude',
          description: 'Claude profile',
          supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
          toolIds: ['claude-code'],
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
          extraToolIds: [],
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

    const plan = resolveBootstrapPlan(
      registry,
      {
        ...detectPlatform(),
        os: 'darwin'
      },
      'claude',
      'general'
    );

    expect(plan.integrations.map((integration) => integration.id)).toEqual(['claude-github']);
    expect(plan.mcpServers.map((server) => server.id)).toEqual(['claude-context7']);
  });
});
