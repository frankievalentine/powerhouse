import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import { type DetectedPlatform } from '../platform/detect.ts';

export interface PowerhousePaths {
  configDir: string;
  cacheDir: string;
  stateDir: string;
  stateFile: string;
  lastRunFile: string;
}

export interface PowerhouseState {
  schemaVersion: 1;
  activeProfileId: string;
  activeDomainId: string;
  updatedAt: string;
  installedToolIds: string[];
  installedAgents: string[];
  platformOs?: string;
  platformArch?: string;
}

export interface PowerhouseRunReport {
  schemaVersion: 1;
  command: 'bootstrap' | 'update';
  status: 'success' | 'failed';
  startedAt: string;
  finishedAt: string;
  profileId: string;
  domainId: string;
  platformOs?: string;
  platformArch?: string;
  installedToolIds: string[];
  skippedToolIds: string[];
  installedAgents: string[];
  failedToolId?: string;
  failureStage?: 'workspace-sync' | 'tool-install' | 'skills-install' | 'state-save' | 'bootstrap';
  errorMessage?: string;
}

const stateSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  activeProfileId: z.string().min(1),
  activeDomainId: z.string().min(1),
  updatedAt: z.string().min(1),
  installedToolIds: z.array(z.string()).default([]),
  installedAgents: z.array(z.string()).default([]),
  platformOs: z.string().optional(),
  platformArch: z.string().optional()
});

const runReportSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  command: z.enum(['bootstrap', 'update']),
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
  failedToolId: z.string().optional(),
  failureStage: z.enum(['workspace-sync', 'tool-install', 'skills-install', 'state-save', 'bootstrap']).optional(),
  errorMessage: z.string().optional()
});

export function getPowerhousePaths(platform: DetectedPlatform): PowerhousePaths {
  const configDir = path.join(platform.xdgConfigHome, 'powerhouse');
  const cacheDir = path.join(platform.xdgCacheHome, 'powerhouse');
  const stateDir = path.join(platform.xdgStateHome, 'powerhouse');

  return {
    configDir,
    cacheDir,
    stateDir,
    stateFile: path.join(stateDir, 'state.json'),
    lastRunFile: path.join(stateDir, 'last-run.json')
  };
}

export async function loadState(paths: PowerhousePaths): Promise<PowerhouseState | null> {
  try {
    const content = await fs.readFile(paths.stateFile, 'utf8');
    return stateSchema.parse(JSON.parse(content));
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
    installedToolIds: [...new Set(state.installedToolIds)].sort(),
    installedAgents: [...new Set(state.installedAgents)].sort()
  });
  await fs.writeFile(paths.stateFile, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
}

export async function loadLastRun(paths: PowerhousePaths): Promise<PowerhouseRunReport | null> {
  try {
    const content = await fs.readFile(paths.lastRunFile, 'utf8');
    return runReportSchema.parse(JSON.parse(content));
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
    installedToolIds: [...new Set(report.installedToolIds)].sort(),
    skippedToolIds: [...new Set(report.skippedToolIds)].sort(),
    installedAgents: [...new Set(report.installedAgents)].sort()
  });
  await fs.writeFile(paths.lastRunFile, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
}
