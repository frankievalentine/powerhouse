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
  profileId: string;
  domainId: string;
}

export function mergeBootstrapLedger(
  ledger: PowerhouseLedger,
  paths: PowerhousePaths,
  platform: DetectedPlatform,
  ownerSelection: OwnerSelection,
  toolResults: ToolExecutionResult[],
  skillRecords: ManagedSkillRecord[],
  integrationResults: CatalogInstallResult[],
  mcpServerResults: CatalogInstallResult[],
  updatedAt = new Date().toISOString()
): PowerhouseLedger {
  const systemEntries = buildSystemLedgerEntries(paths, platform, updatedAt);
  const toolEntries = buildToolLedgerEntries(toolResults, ownerSelection, updatedAt);
  const skillEntries = buildSkillLedgerEntries(skillRecords, ownerSelection, updatedAt);
  const integrationEntries = buildCatalogLedgerEntries('integration', integrationResults, ownerSelection, updatedAt);
  const mcpEntries = buildCatalogLedgerEntries('mcp', mcpServerResults, ownerSelection, updatedAt);
  const nextEntries = [...systemEntries, ...toolEntries, ...skillEntries, ...integrationEntries, ...mcpEntries];
  const replaceKeys = new Set(nextEntries.map((entry) => ledgerEntryKey(entry)));
  return replaceLedgerEntries(ledger, (entry) => replaceKeys.has(ledgerEntryKey(entry)), nextEntries, updatedAt);
}

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

export function buildToolLedgerEntries(results: ToolExecutionResult[], ownerSelection: OwnerSelection, updatedAt: string): ToolLedgerEntry[] {
  return results.map((result) => ({
    kind: 'tool',
    toolId: result.toolId,
    ownership: result.ownership,
    removable: result.ownership === 'installed' && result.removable,
    installMethods: result.installMethods,
    ownerSelection,
    addedAt: updatedAt,
    updatedAt
  }));
}

export function buildSkillLedgerEntries(records: ManagedSkillRecord[], ownerSelection: OwnerSelection, updatedAt: string): SkillLedgerEntry[] {
  return records.map((record) => ({
    kind: 'skill',
    source: record.source,
    skillName: record.skillName,
    agent: record.agent,
    scope: record.scope,
    removable: record.removable,
    ownerSelection,
    addedAt: updatedAt,
    updatedAt
  }));
}

export function buildCatalogLedgerEntries(
  kind: 'integration' | 'mcp',
  results: CatalogInstallResult[],
  ownerSelection: OwnerSelection,
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
    ownerSelection,
    addedAt: updatedAt,
    updatedAt
  }));
}
