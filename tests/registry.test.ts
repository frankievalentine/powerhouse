import { describe, expect, it } from 'vitest';

import { loadRegistry, validateRegistry, type RegistryData } from '../packages/core/src/index.ts';

describe('registry validation', () => {
  it('validates the bundled registry without errors', async () => {
    const registry = await loadRegistry();
    const result = validateRegistry(registry);

    expect(result.errors).toEqual([]);
  });

  it('rejects integrations that reference missing bundled MCP servers', () => {
    const registry: RegistryData = {
      rootDir: '/tmp/powerhouse-fixture',
      tools: [
        {
          id: 'claude-code',
          title: 'Claude Code',
          description: 'Claude CLI',
          kind: 'ai-cli',
          priority: 10,
          supportedPlatforms: ['darwin'],
          check: {
            command: 'claude',
            args: ['--version']
          },
          installs: {
            darwin: [{ type: 'brew', name: 'claude-code', packageType: 'formula' }],
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
          supportedPlatforms: ['darwin'],
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
          mcpServerIds: [],
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
          supportedPlatforms: ['darwin'],
          supportedScopes: ['global'],
          installKind: 'manual',
          source: 'github@claude-plugins-official',
          tags: [],
          bundledMcpIds: ['missing-context7'],
          install: {
            kind: 'manual',
            instructions: ['Open the plugin browser and install it.'],
            restartRequired: false
          }
        }
      ],
      mcpServers: []
    };

    const result = validateRegistry(registry);

    expect(result.errors).toContain('Integration "claude-github" references missing bundled MCP server "missing-context7".');
  });
});
