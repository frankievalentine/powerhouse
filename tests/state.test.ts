import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadLastRun, loadState, saveLastRun, saveState, type PowerhousePaths } from '../packages/core/src/index.ts';

describe('state persistence', () => {
  it('normalizes and reloads persisted state', async () => {
    const paths = await makePaths();

    await saveState(paths, {
      schemaVersion: 1,
      activeProfileId: 'claude',
      activeDomainId: 'general',
      updatedAt: '2026-04-20T00:00:00.000Z',
      installedToolIds: ['git', 'bun', 'git'],
      installedAgents: ['claude-code', 'claude-code'],
      platformOs: 'darwin',
      platformArch: 'arm64'
    });

    const state = await loadState(paths);

    expect(state).not.toBeNull();
    expect(state?.schemaVersion).toBe(1);
    expect(state?.installedToolIds).toEqual(['bun', 'git']);
    expect(state?.installedAgents).toEqual(['claude-code']);
  });

  it('normalizes and reloads the last run report', async () => {
    const paths = await makePaths();

    await saveLastRun(paths, {
      schemaVersion: 1,
      command: 'bootstrap',
      status: 'failed',
      startedAt: '2026-04-20T00:00:00.000Z',
      finishedAt: '2026-04-20T00:05:00.000Z',
      profileId: 'claude',
      domainId: 'general',
      platformOs: 'darwin',
      platformArch: 'arm64',
      installedToolIds: ['git', 'bun', 'git'],
      skippedToolIds: ['curl', 'curl'],
      installedAgents: ['claude-code', 'claude-code'],
      failedToolId: 'claude-code',
      failureStage: 'tool-install',
      errorMessage: 'Failed to install "claude-code"'
    });

    const report = await loadLastRun(paths);

    expect(report).not.toBeNull();
    expect(report?.schemaVersion).toBe(1);
    expect(report?.installedToolIds).toEqual(['bun', 'git']);
    expect(report?.skippedToolIds).toEqual(['curl']);
    expect(report?.installedAgents).toEqual(['claude-code']);
    expect(report?.failedToolId).toBe('claude-code');
  });
});

async function makePaths(): Promise<PowerhousePaths> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'powerhouse-state-'));
  return {
    configDir: path.join(tempDir, 'config'),
    cacheDir: path.join(tempDir, 'cache'),
    stateDir: path.join(tempDir, 'state'),
    stateFile: path.join(tempDir, 'state', 'state.json'),
    lastRunFile: path.join(tempDir, 'state', 'last-run.json')
  };
}
