import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildCatalogLedgerEntries,
  installIntegrations,
  installMcpServers,
  removeTrackedCatalogEntry,
  type IntegrationManifest,
  type McpManifest
} from '../packages/core/src/index.ts';

const platform = {
  os: 'darwin' as const,
  arch: 'arm64',
  shell: '/bin/zsh',
  homeDir: '/Users/tester',
  xdgConfigHome: '/Users/tester/.config',
  xdgDataHome: '/Users/tester/.local/share',
  xdgCacheHome: '/Users/tester/.cache',
  xdgStateHome: '/Users/tester/.local/state'
};

describe('catalog lifecycle', () => {
  it('restores tracked json config changes and respects drift warnings', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'powerhouse-json-'));
    const integration: IntegrationManifest = {
      id: 'codex-context7',
      title: 'Context7',
      description: 'Context7',
      targetAgent: 'codex',
      supportedPlatforms: ['darwin'],
      supportedScopes: ['project'],
      installKind: 'json-config',
      source: 'test',
      tags: [],
      bundledMcpIds: [],
      install: {
        kind: 'json-config',
        scopePaths: {
          project: './config.json'
        },
        operations: [
          {
            op: 'ensure-array-contains',
            path: ['mcpServers'],
            value: 'context7'
          }
        ],
        restartRequired: false
      }
    };

    const [result] = await installIntegrations([integration], platform, {
      projectDir
    });
    const [entry] = buildCatalogLedgerEntries('integration', [result], '2026-04-20T00:00:00.000Z');
    const filePath = path.join(projectDir, 'config.json');

    expect(result.removable).toBe(true);
    expect(await fs.readFile(filePath, 'utf8')).toContain('context7');

    await fs.writeFile(filePath, '{\n  "mcpServers": ["context7"],\n  "custom": true\n}\n', 'utf8');
    const skipped = await removeTrackedCatalogEntry(entry);
    expect(skipped.status).toBe('skipped');

    const removed = await removeTrackedCatalogEntry(entry, {
      forceDrift: true
    });
    expect(removed.status).toBe('removed');
    await expect(fs.access(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('treats no-op toml config installs as non-removable', async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'powerhouse-toml-'));
    const filePath = path.join(projectDir, '.codex', 'config.toml');
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, '[mcp]\nenabled = true\n', 'utf8');

    const server: McpManifest = {
      id: 'codex-context7',
      title: 'Context7',
      description: 'Context7',
      serverName: 'context7',
      targetAgents: ['codex'],
      supportedPlatforms: ['darwin'],
      supportedScopes: ['project'],
      serverKind: 'stdio',
      source: 'test',
      tags: [],
      install: {
        kind: 'toml-config',
        scopePaths: {
          project: './.codex/config.toml'
        },
        operations: [
          {
            op: 'ensure-bool',
            section: 'mcp',
            key: 'enabled',
            value: true
          }
        ],
        restartRequired: false
      }
    };

    const [result] = await installMcpServers([server], platform, {
      projectDir
    });
    const [entry] = buildCatalogLedgerEntries('mcp', [result], '2026-04-20T00:00:00.000Z');

    expect(result.removable).toBe(false);
    const removal = await removeTrackedCatalogEntry(entry);
    expect(removal.status).toBe('skipped');
    expect(await fs.readFile(filePath, 'utf8')).toContain('enabled = true');
  });
});
