import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadRegistry } from '../packages/core/src/index.ts';

describe('registry loading', () => {
  it('tolerates missing integrations and mcp directories', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'powerhouse-registry-'));
    await fs.mkdir(path.join(rootDir, 'registry', 'tools'), { recursive: true });
    await fs.mkdir(path.join(rootDir, 'registry', 'profiles'), { recursive: true });
    await fs.mkdir(path.join(rootDir, 'registry', 'domains'), { recursive: true });
    await fs.mkdir(path.join(rootDir, 'packages', 'cli'), { recursive: true });
    await fs.writeFile(path.join(rootDir, 'package.json'), '{\n  "name": "fixture"\n}\n', 'utf8');
    await fs.writeFile(
      path.join(rootDir, 'registry', 'tools', 'git.json'),
      JSON.stringify(
        {
          id: 'git',
          title: 'Git',
          description: 'Git',
          kind: 'developer-tool',
          supportedPlatforms: ['darwin'],
          check: { command: 'git', args: ['--version'] },
          installs: { darwin: [{ type: 'brew', name: 'git' }], linux: [], win32: [], wsl: [] }
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    await fs.writeFile(
      path.join(rootDir, 'registry', 'profiles', 'base.json'),
      JSON.stringify(
        {
          id: 'base',
          title: 'Base',
          description: 'Base',
          supportedPlatforms: ['darwin'],
          toolIds: ['git'],
          defaultAgents: []
        },
        null,
        2
      ) + '\n',
      'utf8'
    );
    await fs.writeFile(
      path.join(rootDir, 'registry', 'domains', 'general.json'),
      JSON.stringify(
        {
          id: 'general',
          title: 'General',
          description: 'General'
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    const registry = await loadRegistry(path.join(rootDir, 'packages', 'cli'));

    expect(registry.tools).toHaveLength(1);
    expect(registry.integrations).toEqual([]);
    expect(registry.mcpServers).toEqual([]);
  });
});
