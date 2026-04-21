import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadLedger, saveLedger, type PowerhousePaths } from '../packages/core/src/index.ts';

describe('ledger persistence', () => {
  it('normalizes and reloads persisted ledger entries', async () => {
    const paths = await makePaths();

    await saveLedger(paths, {
      schemaVersion: 1,
      updatedAt: '2026-04-20T00:00:00.000Z',
      entries: [
        {
          kind: 'tool',
          toolId: 'codex',
          ownership: 'installed',
          removable: true,
          installMethods: ['npm'],
          addedAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z'
        },
        {
          kind: 'tool',
          toolId: 'codex',
          ownership: 'installed',
          removable: true,
          installMethods: ['npm'],
          addedAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z'
        }
      ]
    });

    const ledger = await loadLedger(paths);

    expect(ledger.schemaVersion).toBe(1);
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({
      kind: 'tool',
      toolId: 'codex',
      ownership: 'installed'
    });
  });
});

async function makePaths(): Promise<PowerhousePaths> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'powerhouse-ledger-'));
  return {
    configDir: path.join(tempDir, 'config'),
    dataDir: path.join(tempDir, 'data'),
    runtimeDir: path.join(tempDir, 'data', 'runtime'),
    cacheDir: path.join(tempDir, 'cache'),
    stateDir: path.join(tempDir, 'state'),
    stateFile: path.join(tempDir, 'state', 'state.json'),
    lastRunFile: path.join(tempDir, 'state', 'last-run.json'),
    ledgerFile: path.join(tempDir, 'state', 'ledger.json')
  };
}
