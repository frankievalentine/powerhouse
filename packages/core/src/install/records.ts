import type { CatalogInstallResult } from './integrations.ts';
import type { ManagedSkillRecord } from './skills.ts';
import type { ToolExecutionResult } from './execute.ts';
import { POWERHOUSE_SHELL_END_MARKER, POWERHOUSE_SHELL_START_MARKER, getShellTargetFile, getWrapperPath } from '../runtime/layout.ts';
import type {
  IntegrationLedgerEntry,
  LedgerEntry,
  McpLedgerEntry,
  PowerhouseLedger,
  SkillLedgerEntry,
  ToolLedgerEntry
} from '../state/ledger.ts';
import { ledgerEntryKey, replaceLedgerEntries } from '../state/ledger.ts';
import type { PowerhousePaths } from '../state/paths.ts';
import type { DetectedPlatform } from '../platform/detect.ts';

export interface OwnerSelection {
  harnessIds: string[];
  domainIds: string[];
}

export function mergeSetupLedger(
  ledger: PowerhouseLedger,
  paths: PowerhousePaths,
  platform: DetectedPlatform,
  toolResults: ToolExecutionResult[],
  skillRecords: ManagedSkillRecord[],
  integrationResults: CatalogInstallResult[],
  mcpServerResults: CatalogInstallResult[],
  updatedAt = new Date().toISOString()
): PowerhouseLedger {
  const systemEntries = buildSystemLedgerEntries(paths, platform, updatedAt);
  const toolEntries = buildToolLedgerEntries(toolResults, updatedAt);
  const skillEntries = buildSkillLedgerEntries(skillRecords, updatedAt);
  const integrationEntries = buildCatalogLedgerEntries('integration', integrationResults, updatedAt);
  const mcpEntries = buildCatalogLedgerEntries('mcp', mcpServerResults, updatedAt);
  const nextEntries = [...systemEntries, ...toolEntries, ...skillEntries, ...integrationEntries, ...mcpEntries];
  const replaceKeys = new Set(nextEntries.map((entry) => ledgerEntryKey(entry)));
  return replaceLedgerEntries(ledger, (entry) => replaceKeys.has(ledgerEntryKey(entry)), nextEntries, updatedAt);
}

export const mergeBootstrapLedger = mergeSetupLedger;

export function buildSystemLedgerEntries(paths: PowerhousePaths, platform: DetectedPlatform, updatedAt: string): LedgerEntry[] {
  return [
    {
      kind: 'runtime',
      path: paths.runtimeDir,
      addedAt: updatedAt,
      updatedAt
    },
    {
      kind: 'wrapper',
      path: getWrapperPath(platform),
      runtimeDir: paths.runtimeDir,
      addedAt: updatedAt,
      updatedAt
    },
    {
      kind: 'shell-block',
      path: getShellTargetFile(platform),
      startMarker: POWERHOUSE_SHELL_START_MARKER,
      endMarker: POWERHOUSE_SHELL_END_MARKER,
      addedAt: updatedAt,
      updatedAt
    }
  ];
}

export function buildToolLedgerEntries(results: ToolExecutionResult[], updatedAt: string): ToolLedgerEntry[] {
  return results.map((result) => ({
    kind: 'tool',
    toolId: result.toolId,
    ownership: result.ownership,
    removable: result.ownership === 'installed' && result.removable,
    installMethods: result.installMethods,
    addedAt: updatedAt,
    updatedAt
  }));
}

export function buildSkillLedgerEntries(records: ManagedSkillRecord[], updatedAt: string): SkillLedgerEntry[] {
  return records.map((record) => ({
    kind: 'skill',
    source: record.source,
    skillName: record.skillName,
    agent: record.agent,
    scope: record.scope,
    removable: record.removable,
    addedAt: updatedAt,
    updatedAt
  }));
}

export function buildCatalogLedgerEntries(
  kind: 'integration' | 'mcp',
  results: CatalogInstallResult[],
  updatedAt: string
): Array<IntegrationLedgerEntry | McpLedgerEntry> {
  return results.map((result) => ({
    kind,
    id: result.id,
    scope: result.scope,
    status: result.status,
    installKind: result.installKind,
    removable: result.removable,
    restartRequired: result.restartRequired,
    fileChanges: result.fileChanges,
    addedAt: updatedAt,
    updatedAt
  }));
}
