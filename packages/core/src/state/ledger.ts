import fs from 'node:fs/promises';
import { z } from 'zod';

import { normalizedScopeSchema } from '../registry/schema.ts';
import type { PowerhousePaths } from './paths.ts';

const ownerSelectionSchema = z.object({
  profileId: z.string().min(1),
  domainId: z.string().min(1)
});

export const configFileSnapshotSchema = z.object({
  filePath: z.string().min(1),
  existedBefore: z.boolean(),
  beforeContent: z.string().nullable(),
  afterFingerprint: z.string().nullable(),
  contentChanged: z.boolean()
});

const ledgerEntryBaseSchema = z.object({
  addedAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

const runtimeLedgerEntrySchema = ledgerEntryBaseSchema.extend({
  kind: z.literal('runtime'),
  path: z.string().min(1)
});

const wrapperLedgerEntrySchema = ledgerEntryBaseSchema.extend({
  kind: z.literal('wrapper'),
  path: z.string().min(1),
  runtimeDir: z.string().min(1)
});

const shellBlockLedgerEntrySchema = ledgerEntryBaseSchema.extend({
  kind: z.literal('shell-block'),
  path: z.string().min(1),
  startMarker: z.string().min(1),
  endMarker: z.string().min(1)
});

const toolLedgerEntrySchema = ledgerEntryBaseSchema.extend({
  kind: z.literal('tool'),
  toolId: z.string().min(1),
  ownership: z.enum(['installed', 'preexisting']),
  removable: z.boolean(),
  installMethods: z.array(z.string()).default([]),
  ownerSelection: ownerSelectionSchema.optional()
});

const skillLedgerEntrySchema = ledgerEntryBaseSchema.extend({
  kind: z.literal('skill'),
  source: z.string().min(1),
  skillName: z.string().min(1).nullable(),
  agent: z.string().min(1),
  scope: normalizedScopeSchema,
  removable: z.boolean(),
  ownerSelection: ownerSelectionSchema.optional()
});

const catalogLedgerEntrySchema = ledgerEntryBaseSchema.extend({
  id: z.string().min(1),
  scope: normalizedScopeSchema,
  status: z.enum(['configured', 'planned', 'restart_required', 'manual_step_required', 'unsupported_scope']),
  installKind: z.enum(['native-cli', 'json-config', 'toml-config', 'manual']),
  removable: z.boolean(),
  restartRequired: z.boolean().default(false),
  fileChanges: z.array(configFileSnapshotSchema).default([]),
  ownerSelection: ownerSelectionSchema.optional()
});

const integrationLedgerEntrySchema = catalogLedgerEntrySchema.extend({
  kind: z.literal('integration')
});

const mcpLedgerEntrySchema = catalogLedgerEntrySchema.extend({
  kind: z.literal('mcp')
});

export const ledgerEntrySchema = z.discriminatedUnion('kind', [
  runtimeLedgerEntrySchema,
  wrapperLedgerEntrySchema,
  shellBlockLedgerEntrySchema,
  toolLedgerEntrySchema,
  skillLedgerEntrySchema,
  integrationLedgerEntrySchema,
  mcpLedgerEntrySchema
]);

const ledgerSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  updatedAt: z.string().min(1),
  entries: z.array(ledgerEntrySchema).default([])
});

export type ConfigFileSnapshot = z.infer<typeof configFileSnapshotSchema>;
export type RuntimeLedgerEntry = z.infer<typeof runtimeLedgerEntrySchema>;
export type WrapperLedgerEntry = z.infer<typeof wrapperLedgerEntrySchema>;
export type ShellBlockLedgerEntry = z.infer<typeof shellBlockLedgerEntrySchema>;
export type ToolLedgerEntry = z.infer<typeof toolLedgerEntrySchema>;
export type SkillLedgerEntry = z.infer<typeof skillLedgerEntrySchema>;
export type IntegrationLedgerEntry = z.infer<typeof integrationLedgerEntrySchema>;
export type McpLedgerEntry = z.infer<typeof mcpLedgerEntrySchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type PowerhouseLedger = z.infer<typeof ledgerSchema>;

export function emptyLedger(now = new Date().toISOString()): PowerhouseLedger {
  return {
    schemaVersion: 1,
    updatedAt: now,
    entries: []
  };
}

export async function loadLedger(paths: PowerhousePaths): Promise<PowerhouseLedger> {
  try {
    const content = await fs.readFile(paths.ledgerFile, 'utf8');
    return ledgerSchema.parse(JSON.parse(content));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyLedger();
    }
    throw error;
  }
}

export async function saveLedger(paths: PowerhousePaths, ledger: PowerhouseLedger): Promise<void> {
  await fs.mkdir(paths.stateDir, { recursive: true });
  const normalized = ledgerSchema.parse({
    ...ledger,
    schemaVersion: 1,
    entries: dedupeLedgerEntries(ledger.entries)
  });
  await fs.writeFile(paths.ledgerFile, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
}

export function upsertLedgerEntries(ledger: PowerhouseLedger, entries: LedgerEntry[], updatedAt = new Date().toISOString()): PowerhouseLedger {
  return {
    schemaVersion: 1,
    updatedAt,
    entries: dedupeLedgerEntries([...ledger.entries, ...entries])
  };
}

export function replaceLedgerEntries(
  ledger: PowerhouseLedger,
  predicate: (entry: LedgerEntry) => boolean,
  entries: LedgerEntry[],
  updatedAt = new Date().toISOString()
): PowerhouseLedger {
  return {
    schemaVersion: 1,
    updatedAt,
    entries: dedupeLedgerEntries([...ledger.entries.filter((entry) => !predicate(entry)), ...entries])
  };
}

export function removeLedgerEntries(
  ledger: PowerhouseLedger,
  predicate: (entry: LedgerEntry) => boolean,
  updatedAt = new Date().toISOString()
): PowerhouseLedger {
  return {
    schemaVersion: 1,
    updatedAt,
    entries: dedupeLedgerEntries(ledger.entries.filter((entry) => !predicate(entry)))
  };
}

export function ledgerEntryKey(entry: LedgerEntry): string {
  switch (entry.kind) {
    case 'runtime':
      return `runtime:${entry.path}`;
    case 'wrapper':
      return `wrapper:${entry.path}`;
    case 'shell-block':
      return `shell-block:${entry.path}`;
    case 'tool':
      return `tool:${entry.toolId}`;
    case 'skill':
      return `skill:${entry.source}:${entry.skillName ?? '*'}:${entry.agent}:${entry.scope}`;
    case 'integration':
      return `integration:${entry.id}:${entry.scope}`;
    case 'mcp':
      return `mcp:${entry.id}:${entry.scope}`;
  }
}

function dedupeLedgerEntries(entries: LedgerEntry[]): LedgerEntry[] {
  const seen = new Map<string, LedgerEntry>();
  for (const entry of entries) {
    seen.set(ledgerEntryKey(entry), entry);
  }

  return [...seen.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([, entry]) => entry);
}
