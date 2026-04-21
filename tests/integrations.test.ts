import { describe, expect, it } from 'vitest';

import { findIntegrations, findMcpServers, installIntegrations, installMcpServers, loadRegistry } from '../packages/core/src/index.ts';

const darwinPlatform = {
  os: 'darwin' as const,
  arch: 'arm64',
  shell: '/bin/zsh',
  homeDir: '/Users/tester',
  xdgConfigHome: '/Users/tester/.config',
  xdgDataHome: '/Users/tester/.local/share',
  xdgCacheHome: '/Users/tester/.cache',
  xdgStateHome: '/Users/tester/.local/state'
};

describe('integration and MCP catalogs', () => {
  it('filters integrations and MCP servers by agent and platform', async () => {
    const registry = await loadRegistry();

    const claudeIntegrations = findIntegrations(registry, {
      agents: ['claude-code'],
      platform: 'darwin'
    });
    const claudeMcpServers = findMcpServers(registry, {
      agents: ['claude-code'],
      platform: 'darwin'
    });

    expect(claudeIntegrations.map((entry) => entry.id)).toContain('claude-github');
    expect(claudeIntegrations.map((entry) => entry.id)).not.toContain('gemini-workspace');
    expect(claudeMcpServers.map((entry) => entry.id)).toContain('claude-context7');
    expect(claudeMcpServers.map((entry) => entry.id)).not.toContain('gemini-context7');
  });

  it('supports dry-run native CLI installs with mapped scopes', async () => {
    const registry = await loadRegistry();
    const integration = registry.integrations.find((entry) => entry.id === 'claude-github');

    expect(integration).toBeDefined();

    const [result] = await installIntegrations([integration!], darwinPlatform, {
      dryRun: true,
      scope: 'global'
    });

    expect(result.status).toBe('planned');
    expect(result.scope).toBe('global');
    expect(result.nativeScope).toBe('user');
    expect(result.detail).toContain('claude plugin install');
  });

  it('marks unsupported scopes without attempting an install', async () => {
    const registry = await loadRegistry();
    const integration = registry.integrations.find((entry) => entry.id === 'gemini-workspace');

    expect(integration).toBeDefined();

    const [result] = await installIntegrations([integration!], darwinPlatform, {
      dryRun: true,
      scope: 'project'
    });

    expect(result.status).toBe('unsupported_scope');
  });

  it('supports dry-run config-backed MCP installs', async () => {
    const registry = await loadRegistry();
    const server = registry.mcpServers.find((entry) => entry.id === 'codex-context7');

    expect(server).toBeDefined();

    const [result] = await installMcpServers([server!], darwinPlatform, {
      dryRun: true,
      scope: 'project',
      projectDir: '/tmp/powerhouse-project'
    });

    expect(result.status).toBe('planned');
    expect(result.detail).toContain('/tmp/powerhouse-project/.codex/config.toml');
  });
});
