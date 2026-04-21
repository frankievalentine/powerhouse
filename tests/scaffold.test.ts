import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { scaffoldRegistryManifest } from '../packages/core/src/index.ts';

describe('registry scaffolding', () => {
  it('renders a dry-run domain scaffold without writing a file', async () => {
    const workspace = await makeWorkspace();

    const result = await scaffoldRegistryManifest('domain', 'content', { dryRun: true }, workspace.startDir);

    expect(result.written).toBe(false);
    expect(result.path).toBe(path.join(workspace.rootDir, 'registry', 'domains', 'content.json'));
    await expect(fs.access(result.path)).rejects.toMatchObject({ code: 'ENOENT' });

    const manifest = JSON.parse(result.content);
    expect(manifest).toMatchObject({
      id: 'content',
      title: 'Content',
      skillPackages: [],
      extraToolIds: [],
      notes: []
    });
  });

  it('writes a profile scaffold into the workspace registry', async () => {
    const workspace = await makeWorkspace();

    const result = await scaffoldRegistryManifest('profile', 'product-management', {}, workspace.startDir);

    expect(result.written).toBe(true);
    expect(result.path).toBe(path.join(workspace.rootDir, 'registry', 'profiles', 'product-management.json'));

    const written = await fs.readFile(result.path, 'utf8');
    const manifest = JSON.parse(written);

    expect(manifest).toMatchObject({
      id: 'product-management',
      title: 'Product Management',
      supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
      toolIds: [],
      defaultAgents: [],
      notes: []
    });
  });

  it('renders a tool scaffold with typed checks and four-platform installs', async () => {
    const workspace = await makeWorkspace();

    const result = await scaffoldRegistryManifest('tool', 'ripgrep', { dryRun: true }, workspace.startDir);
    const manifest = JSON.parse(result.content);

    expect(manifest).toMatchObject({
      id: 'ripgrep',
      supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
      check: {
        command: 'ripgrep',
        args: ['--version']
      },
      installs: {
        darwin: [],
        linux: [],
        win32: [],
        wsl: []
      }
    });
  });

  it('renders an integration scaffold with first-class catalog fields', async () => {
    const workspace = await makeWorkspace();

    const result = await scaffoldRegistryManifest('integration', 'claude-github', { dryRun: true }, workspace.startDir);
    const manifest = JSON.parse(result.content);

    expect(manifest).toMatchObject({
      id: 'claude-github',
      title: 'Claude Github',
      targetAgent: 'claude-code',
      supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
      supportedScopes: ['global'],
      installKind: 'manual',
      source: 'replace-me',
      bundledMcpIds: [],
      install: {
        kind: 'manual'
      }
    });
    expect(result.path).toBe(path.join(workspace.rootDir, 'registry', 'integrations', 'claude-github.json'));
  });

  it('renders an MCP scaffold into the dedicated registry directory', async () => {
    const workspace = await makeWorkspace();

    const result = await scaffoldRegistryManifest('mcp', 'context7', { dryRun: true }, workspace.startDir);
    const manifest = JSON.parse(result.content);

    expect(manifest).toMatchObject({
      id: 'context7',
      serverName: 'context7',
      targetAgents: ['claude-code'],
      supportedPlatforms: ['darwin', 'linux', 'win32', 'wsl'],
      supportedScopes: ['global'],
      serverKind: 'stdio',
      source: 'replace-me',
      install: {
        kind: 'manual'
      }
    });
    expect(result.path).toBe(path.join(workspace.rootDir, 'registry', 'mcp', 'context7.json'));
  });

  it('rejects invalid manifest ids before touching the registry', async () => {
    const workspace = await makeWorkspace();

    await expect(scaffoldRegistryManifest('tool', 'Design System', {}, workspace.startDir)).rejects.toThrow(
      'Invalid manifest id'
    );
  });
});

async function makeWorkspace(): Promise<{ rootDir: string; startDir: string }> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'powerhouse-scaffold-'));
  const startDir = path.join(rootDir, 'packages', 'cli');

  await fs.mkdir(path.join(rootDir, 'registry', 'tools'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'registry', 'profiles'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'registry', 'domains'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'registry', 'integrations'), { recursive: true });
  await fs.mkdir(path.join(rootDir, 'registry', 'mcp'), { recursive: true });
  await fs.mkdir(startDir, { recursive: true });
  await fs.writeFile(path.join(rootDir, 'package.json'), '{\n  "name": "powerhouse-fixture"\n}\n', 'utf8');

  return { rootDir, startDir };
}
