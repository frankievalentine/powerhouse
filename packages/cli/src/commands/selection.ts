import type { DomainManifest, HarnessManifest, PowerhouseState, ToolManifest } from '@powerhouse/core';

export const DEFAULT_HARNESS_ID = 'claude';
export const DEFAULT_DOMAIN_ID = 'general';

type ManifestEntry = Pick<HarnessManifest | DomainManifest | ToolManifest, 'id'>;
type SelectionKind = 'harness' | 'domain' | 'tool';

export interface ActiveSelection {
  harnessIds: string[];
  domainIds: string[];
  selectedToolIds: string[];
}

export function appendStringOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function getActiveSelection(state: PowerhouseState | null): ActiveSelection {
  return {
    harnessIds: state?.activeHarnessIds ?? [DEFAULT_HARNESS_ID],
    domainIds: state?.activeDomainIds ?? [DEFAULT_DOMAIN_ID],
    selectedToolIds: state?.selectedToolIds ?? []
  };
}

export function addSelectionIds<T extends ManifestEntry>(entries: T[], currentIds: string[], nextIds: string[], kind: SelectionKind): string[] {
  return normalizeSelectionIds(entries, [...currentIds, ...nextIds], kind);
}

export function removeSelectionIds<T extends ManifestEntry>(
  entries: T[],
  currentIds: string[],
  removedIds: string[],
  kind: SelectionKind
): string[] {
  const removed = new Set(removedIds);
  return normalizeSelectionIds(
    entries,
    currentIds.filter((id) => !removed.has(id)),
    kind
  );
}

export function normalizeSelectionIds<T extends ManifestEntry>(entries: T[], selectedIds: string[], kind: SelectionKind): string[] {
  const uniqueIds = [...new Set(selectedIds)];
  if (uniqueIds.length === 0) {
    throw new Error(`At least one ${kind} must be selected.`);
  }

  const knownIds = new Set(entries.map((entry) => entry.id));
  for (const id of uniqueIds) {
    if (!knownIds.has(id)) {
      throw new Error(`Unknown ${kind} "${id}".`);
    }
  }

  return entries.filter((entry) => uniqueIds.includes(entry.id)).map((entry) => entry.id);
}

export function normalizeOptionalToolSelectionIds<T extends ManifestEntry>(entries: T[], selectedIds: string[]): string[] {
  const uniqueIds = [...new Set(selectedIds)];
  const knownIds = new Set(entries.map((entry) => entry.id));
  for (const id of uniqueIds) {
    if (!knownIds.has(id)) {
      throw new Error(`Unknown tool "${id}".`);
    }
  }
  return entries.filter((entry) => uniqueIds.includes(entry.id)).map((entry) => entry.id);
}

export function resolveSelectedManifests<T extends ManifestEntry>(entries: T[], selectedIds: string[]): T[] {
  const selected = new Set(selectedIds);
  return entries.filter((entry) => selected.has(entry.id));
}
