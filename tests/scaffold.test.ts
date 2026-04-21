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
      supportedPlatforms: ['darwin', 'linux'],
      toolIds: [],
      defaultAgents: [],
      notes: []
    });
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
  await fs.mkdir(startDir, { recursive: true });
  await fs.writeFile(path.join(rootDir, 'package.json'), '{\n  "name": "powerhouse-fixture"\n}\n', 'utf8');

  return { rootDir, startDir };
}
