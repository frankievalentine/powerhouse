import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadLastRun, loadState, saveLastRun, saveState, type PowerhousePaths } from '../packages/core/src/index.ts';

describe('state persistence', () => {
  it('normalizes and reloads persisted state', async () => {
    const paths = await makePaths();

    await saveState(paths, {
      schemaVersion: 4,
      activeHarnessIds: ['claude', 'claude'],
      activeDomainIds: ['general', 'general'],
      selectedToolIds: ['bun', 'bun'],
      updatedAt: '2026-04-20T00:00:00.000Z',
      installedToolIds: ['git', 'bun', 'git'],
      installedAgents: ['claude-code', 'claude-code'],
      installedIntegrations: [],
      installedMcpServers: [],
      platformOs: 'darwin',
      platformArch: 'arm64'
    });

    const state = await loadState(paths);

    expect(state).not.toBeNull();
    expect(state?.schemaVersion).toBe(4);
    expect(state?.activeHarnessIds).toEqual(['claude']);
    expect(state?.activeDomainIds).toEqual(['general']);
    expect(state?.selectedToolIds).toEqual(['bun']);
    expect(state?.installedToolIds).toEqual(['bun', 'git']);
    expect(state?.installedAgents).toEqual(['claude-code']);
  });

  it('normalizes and reloads the last run report', async () => {
    const paths = await makePaths();

    await saveLastRun(paths, {
      schemaVersion: 4,
      command: 'setup',
      status: 'failed',
      startedAt: '2026-04-20T00:00:00.000Z',
      finishedAt: '2026-04-20T00:05:00.000Z',
      harnessIds: ['claude', 'claude'],
      domainIds: ['general', 'general'],
      platformOs: 'darwin',
      platformArch: 'arm64',
      installedToolIds: ['git', 'bun', 'git'],
      skippedToolIds: ['curl', 'curl'],
      installedAgents: ['claude-code', 'claude-code'],
      integrationResults: [],
      mcpServerResults: [],
      failedToolId: 'claude-code',
      failureStage: 'tool-install',
      errorMessage: 'Failed to install "claude-code"'
    });

    const report = await loadLastRun(paths);

    expect(report).not.toBeNull();
    expect(report?.schemaVersion).toBe(4);
    expect(report?.command).toBe('setup');
    expect(report?.harnessIds).toEqual(['claude']);
    expect(report?.domainIds).toEqual(['general']);
    expect(report?.installedToolIds).toEqual(['bun', 'git']);
    expect(report?.skippedToolIds).toEqual(['curl']);
    expect(report?.installedAgents).toEqual(['claude-code']);
    expect(report?.failedToolId).toBe('claude-code');
  });

  it('migrates legacy single-selection state into harness selections', async () => {
    const paths = await makePaths();

    await fs.mkdir(path.dirname(paths.stateFile), { recursive: true });
    await fs.writeFile(
      paths.stateFile,
      JSON.stringify({
        schemaVersion: 2,
        activeProfileId: 'claude',
        activeDomainId: 'general',
        updatedAt: '2026-04-20T00:00:00.000Z',
        installedToolIds: ['git'],
        installedAgents: ['claude-code'],
        installedIntegrations: [],
        installedMcpServers: []
      }),
      'utf8'
    );

    const state = await loadState(paths);

    expect(state?.schemaVersion).toBe(4);
    expect(state?.activeHarnessIds).toEqual(['claude']);
    expect(state?.activeDomainIds).toEqual(['general']);
    expect(state?.selectedToolIds).toEqual(['git']);
  });

  it('migrates legacy single-selection last-run data into array selections', async () => {
    const paths = await makePaths();

    await fs.mkdir(path.dirname(paths.lastRunFile), { recursive: true });
    await fs.writeFile(
      paths.lastRunFile,
      JSON.stringify({
        schemaVersion: 2,
        command: 'update',
        status: 'success',
        startedAt: '2026-04-20T00:00:00.000Z',
        finishedAt: '2026-04-20T00:05:00.000Z',
        profileId: 'claude',
        domainId: 'general',
        installedToolIds: ['git'],
        skippedToolIds: [],
        installedAgents: ['claude-code'],
        integrationResults: [],
        mcpServerResults: []
      }),
      'utf8'
    );

    const report = await loadLastRun(paths);

    expect(report?.schemaVersion).toBe(4);
    expect(report?.harnessIds).toEqual(['claude']);
    expect(report?.domainIds).toEqual(['general']);
  });

  it('normalizes legacy bootstrap run reports to setup', async () => {
    const paths = await makePaths();

    await fs.mkdir(path.dirname(paths.lastRunFile), { recursive: true });
    await fs.writeFile(
      paths.lastRunFile,
      JSON.stringify({
        schemaVersion: 4,
        command: 'bootstrap',
        status: 'success',
        startedAt: '2026-04-20T00:00:00.000Z',
        finishedAt: '2026-04-20T00:05:00.000Z',
        harnessIds: ['claude'],
        domainIds: ['general'],
        installedToolIds: ['git'],
        skippedToolIds: [],
        installedAgents: ['claude-code'],
        integrationResults: [],
        mcpServerResults: []
      }),
      'utf8'
    );

    const report = await loadLastRun(paths);

    expect(report?.command).toBe('setup');
  });
});

async function makePaths(): Promise<PowerhousePaths> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'powerhouse-state-'));
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
