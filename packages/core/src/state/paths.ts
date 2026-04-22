import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import type { DetectedPlatform } from '../platform/detect.ts';
import { normalizedScopeSchema } from '../registry/schema.ts';

export interface PowerhousePaths {
  configDir: string;
  dataDir: string;
  runtimeDir: string;
  cacheDir: string;
  stateDir: string;
  stateFile: string;
  lastRunFile: string;
  ledgerFile: string;
}

export interface PowerhouseState {
  schemaVersion: 4;
  activeHarnessIds: string[];
  activeDomainIds: string[];
  selectedToolIds: string[];
  updatedAt: string;
  installedToolIds: string[];
  installedAgents: string[];
  installedIntegrations: InstalledCatalogState[];
  installedMcpServers: InstalledCatalogState[];
  platformOs?: string;
  platformArch?: string;
}

export interface PowerhouseRunReport {
  schemaVersion: 4;
  command: 'setup' | 'update';
  status: 'success' | 'failed';
  startedAt: string;
  finishedAt: string;
  harnessIds: string[];
  domainIds: string[];
  platformOs?: string;
  platformArch?: string;
  installedToolIds: string[];
  skippedToolIds: string[];
  installedAgents: string[];
  integrationResults: InstalledCatalogState[];
  mcpServerResults: InstalledCatalogState[];
  failedToolId?: string;
  failureStage?: 'workspace-sync' | 'tool-install' | 'integration-install' | 'mcp-install' | 'skills-install' | 'state-save' | 'setup';
  errorMessage?: string;
}

export interface InstalledCatalogState {
  id: string;
  scope: z.infer<typeof normalizedScopeSchema>;
  status: 'configured' | 'planned' | 'restart_required' | 'manual_step_required' | 'unsupported_scope';
}

const installedCatalogStateSchema = z.object({
  id: z.string().min(1),
  scope: normalizedScopeSchema,
  status: z.enum(['configured', 'planned', 'restart_required', 'manual_step_required', 'unsupported_scope'])
});

const legacyRunCommandSchema = z.enum(['setup', 'update', 'bootstrap']).transform((value) => normalizeRunCommand(value));
const legacyFailureStageSchema = z
  .enum(['workspace-sync', 'tool-install', 'integration-install', 'mcp-install', 'skills-install', 'state-save', 'setup', 'bootstrap'])
  .transform((value) => normalizeFailureStage(value));

const stateSchema = z.object({
  schemaVersion: z.literal(4).default(4),
  activeHarnessIds: z.array(z.string().min(1)).nonempty(),
  activeDomainIds: z.array(z.string().min(1)).nonempty(),
  selectedToolIds: z.array(z.string()).default([]),
  updatedAt: z.string().min(1),
  installedToolIds: z.array(z.string()).default([]),
  installedAgents: z.array(z.string()).default([]),
  installedIntegrations: z.array(installedCatalogStateSchema).default([]),
  installedMcpServers: z.array(installedCatalogStateSchema).default([]),
  platformOs: z.string().optional(),
  platformArch: z.string().optional()
});

const legacyStateArraySchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
  activeProfileIds: z.array(z.string().min(1)).nonempty(),
  activeDomainIds: z.array(z.string().min(1)).nonempty(),
  updatedAt: z.string().min(1),
  installedToolIds: z.array(z.string()).default([]),
  installedAgents: z.array(z.string()).default([]),
  installedIntegrations: z.array(installedCatalogStateSchema).default([]),
  installedMcpServers: z.array(installedCatalogStateSchema).default([]),
  platformOs: z.string().optional(),
  platformArch: z.string().optional()
});

const legacyStateSingleSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]).default(2),
  activeProfileId: z.string().min(1),
  activeDomainId: z.string().min(1),
  updatedAt: z.string().min(1),
  installedToolIds: z.array(z.string()).default([]),
  installedAgents: z.array(z.string()).default([]),
  installedIntegrations: z.array(installedCatalogStateSchema).default([]),
  installedMcpServers: z.array(installedCatalogStateSchema).default([]),
  platformOs: z.string().optional(),
  platformArch: z.string().optional()
});

const runReportSchema = z.object({
  schemaVersion: z.literal(4).default(4),
  command: legacyRunCommandSchema,
  status: z.enum(['success', 'failed']),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  harnessIds: z.array(z.string().min(1)).nonempty(),
  domainIds: z.array(z.string().min(1)).nonempty(),
  platformOs: z.string().optional(),
  platformArch: z.string().optional(),
  installedToolIds: z.array(z.string()).default([]),
  skippedToolIds: z.array(z.string()).default([]),
  installedAgents: z.array(z.string()).default([]),
  integrationResults: z.array(installedCatalogStateSchema).default([]),
  mcpServerResults: z.array(installedCatalogStateSchema).default([]),
  failedToolId: z.string().optional(),
  failureStage: legacyFailureStageSchema.optional(),
  errorMessage: z.string().optional()
});

const legacyRunReportArraySchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(3),
  command: legacyRunCommandSchema,
  status: z.enum(['success', 'failed']),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  profileIds: z.array(z.string().min(1)).nonempty(),
  domainIds: z.array(z.string().min(1)).nonempty(),
  platformOs: z.string().optional(),
  platformArch: z.string().optional(),
  installedToolIds: z.array(z.string()).default([]),
  skippedToolIds: z.array(z.string()).default([]),
  installedAgents: z.array(z.string()).default([]),
  integrationResults: z.array(installedCatalogStateSchema).default([]),
  mcpServerResults: z.array(installedCatalogStateSchema).default([]),
  failedToolId: z.string().optional(),
  failureStage: legacyFailureStageSchema.optional(),
  errorMessage: z.string().optional()
});

const legacyRunReportSingleSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]).default(2),
  command: legacyRunCommandSchema,
  status: z.enum(['success', 'failed']),
  startedAt: z.string().min(1),
  finishedAt: z.string().min(1),
  profileId: z.string().min(1),
  domainId: z.string().min(1),
  platformOs: z.string().optional(),
  platformArch: z.string().optional(),
  installedToolIds: z.array(z.string()).default([]),
  skippedToolIds: z.array(z.string()).default([]),
  installedAgents: z.array(z.string()).default([]),
  integrationResults: z.array(installedCatalogStateSchema).default([]),
  mcpServerResults: z.array(installedCatalogStateSchema).default([]),
  failedToolId: z.string().optional(),
  failureStage: legacyFailureStageSchema.optional(),
  errorMessage: z.string().optional()
});

export function getPowerhousePaths(platform: DetectedPlatform, env: NodeJS.ProcessEnv = process.env): PowerhousePaths {
  const join = platform.os === 'win32' ? path.win32.join : path.join;
  const configDir =
    platform.os === 'win32'
      ? join(env.APPDATA ?? join(platform.homeDir, 'AppData', 'Roaming'), 'powerhouse')
      : join(platform.xdgConfigHome, 'powerhouse');
  const dataDir =
    platform.os === 'win32'
      ? join(env.LOCALAPPDATA ?? join(platform.homeDir, 'AppData', 'Local'), 'powerhouse', 'data')
      : join(platform.xdgDataHome, 'powerhouse');
  const cacheDir =
    platform.os === 'win32'
      ? join(env.LOCALAPPDATA ?? join(platform.homeDir, 'AppData', 'Local'), 'powerhouse', 'cache')
      : join(platform.xdgCacheHome, 'powerhouse');
  const stateDir =
    platform.os === 'win32'
      ? join(env.LOCALAPPDATA ?? join(platform.homeDir, 'AppData', 'Local'), 'powerhouse', 'state')
      : join(platform.xdgStateHome, 'powerhouse');

  return {
    configDir,
    dataDir,
    runtimeDir: join(dataDir, 'runtime'),
    cacheDir,
    stateDir,
    stateFile: join(stateDir, 'state.json'),
    lastRunFile: join(stateDir, 'last-run.json'),
    ledgerFile: join(stateDir, 'ledger.json')
  };
}

export async function loadState(paths: PowerhousePaths): Promise<PowerhouseState | null> {
  try {
    const content = await fs.readFile(paths.stateFile, 'utf8');
    return normalizeState(JSON.parse(content));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function saveState(paths: PowerhousePaths, state: PowerhouseState): Promise<void> {
  await fs.mkdir(paths.stateDir, { recursive: true });
  const normalized = stateSchema.parse({
    ...state,
    schemaVersion: 4,
    activeHarnessIds: dedupeStringValues(state.activeHarnessIds),
    activeDomainIds: dedupeStringValues(state.activeDomainIds),
    selectedToolIds: dedupeStringValues(state.selectedToolIds),
    installedToolIds: [...new Set(state.installedToolIds)].sort(),
    installedAgents: [...new Set(state.installedAgents)].sort(),
    installedIntegrations: dedupeInstalledCatalogState(state.installedIntegrations),
    installedMcpServers: dedupeInstalledCatalogState(state.installedMcpServers)
  });
  await fs.writeFile(paths.stateFile, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
}

export async function loadLastRun(paths: PowerhousePaths): Promise<PowerhouseRunReport | null> {
  try {
    const content = await fs.readFile(paths.lastRunFile, 'utf8');
    return normalizeRunReport(JSON.parse(content));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function saveLastRun(paths: PowerhousePaths, report: PowerhouseRunReport): Promise<void> {
  await fs.mkdir(paths.stateDir, { recursive: true });
  const normalized = runReportSchema.parse({
    ...report,
    schemaVersion: 4,
    command: normalizeRunCommand(report.command),
    failureStage: report.failureStage ? normalizeFailureStage(report.failureStage) : undefined,
    harnessIds: dedupeStringValues(report.harnessIds),
    domainIds: dedupeStringValues(report.domainIds),
    installedToolIds: [...new Set(report.installedToolIds)].sort(),
    skippedToolIds: [...new Set(report.skippedToolIds)].sort(),
    installedAgents: [...new Set(report.installedAgents)].sort(),
    integrationResults: dedupeInstalledCatalogState(report.integrationResults),
    mcpServerResults: dedupeInstalledCatalogState(report.mcpServerResults)
  });
  await fs.writeFile(paths.lastRunFile, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
}

function dedupeInstalledCatalogState(values: InstalledCatalogState[]): InstalledCatalogState[] {
  const seen = new Map<string, InstalledCatalogState>();
  for (const value of values) {
    seen.set(`${value.id}:${value.scope}`, value);
  }
  return [...seen.values()].sort((left, right) => left.id.localeCompare(right.id) || left.scope.localeCompare(right.scope));
}

function normalizeState(input: unknown): PowerhouseState {
  const legacySingle = legacyStateSingleSchema.safeParse(input);
  if (legacySingle.success) {
    return stateSchema.parse({
      ...legacySingle.data,
      schemaVersion: 4,
      activeHarnessIds: [legacySingle.data.activeProfileId],
      activeDomainIds: [legacySingle.data.activeDomainId],
      selectedToolIds: legacySingle.data.installedToolIds
    });
  }

  const legacyArray = legacyStateArraySchema.safeParse(input);
  if (legacyArray.success) {
    return stateSchema.parse({
      ...legacyArray.data,
      schemaVersion: 4,
      activeHarnessIds: legacyArray.data.activeProfileIds,
      activeDomainIds: legacyArray.data.activeDomainIds,
      selectedToolIds: legacyArray.data.installedToolIds
    });
  }

  const parsed = stateSchema.parse(input);
  return {
    ...parsed,
    activeHarnessIds: dedupeStringValues(parsed.activeHarnessIds),
    activeDomainIds: dedupeStringValues(parsed.activeDomainIds),
    selectedToolIds: dedupeStringValues(parsed.selectedToolIds),
    installedToolIds: [...new Set(parsed.installedToolIds)].sort(),
    installedAgents: [...new Set(parsed.installedAgents)].sort(),
    installedIntegrations: dedupeInstalledCatalogState(parsed.installedIntegrations),
    installedMcpServers: dedupeInstalledCatalogState(parsed.installedMcpServers)
  };
}

function normalizeRunReport(input: unknown): PowerhouseRunReport {
  const legacySingle = legacyRunReportSingleSchema.safeParse(input);
  if (legacySingle.success) {
    return runReportSchema.parse({
      ...legacySingle.data,
      schemaVersion: 4,
      harnessIds: [legacySingle.data.profileId],
      domainIds: [legacySingle.data.domainId]
    });
  }

  const legacyArray = legacyRunReportArraySchema.safeParse(input);
  if (legacyArray.success) {
    return runReportSchema.parse({
      ...legacyArray.data,
      schemaVersion: 4,
      harnessIds: legacyArray.data.profileIds,
      domainIds: legacyArray.data.domainIds
    });
  }

  const parsed = runReportSchema.parse(input);
  return {
    ...parsed,
    harnessIds: dedupeStringValues(parsed.harnessIds),
    domainIds: dedupeStringValues(parsed.domainIds),
    installedToolIds: [...new Set(parsed.installedToolIds)].sort(),
    skippedToolIds: [...new Set(parsed.skippedToolIds)].sort(),
    installedAgents: [...new Set(parsed.installedAgents)].sort(),
    integrationResults: dedupeInstalledCatalogState(parsed.integrationResults),
    mcpServerResults: dedupeInstalledCatalogState(parsed.mcpServerResults)
  };
}

function normalizeRunCommand(value: 'setup' | 'update' | 'bootstrap'): 'setup' | 'update' {
  return value === 'bootstrap' ? 'setup' : value;
}

function normalizeFailureStage(
  value: 'workspace-sync' | 'tool-install' | 'integration-install' | 'mcp-install' | 'skills-install' | 'state-save' | 'setup' | 'bootstrap'
): 'workspace-sync' | 'tool-install' | 'integration-install' | 'mcp-install' | 'skills-install' | 'state-save' | 'setup' {
  return value === 'bootstrap' ? 'setup' : value;
}

function dedupeStringValues(values: string[]): string[] {
  return [...new Set(values)];
}
