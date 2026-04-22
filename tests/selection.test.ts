import { describe, expect, it } from 'vitest';

import {
  addSelectionIds,
  DEFAULT_DOMAIN_ID,
  DEFAULT_HARNESS_ID,
  getActiveSelection,
  normalizeSelectionIds,
  removeSelectionIds
} from '../packages/cli/src/commands/selection.ts';

describe('selection helpers', () => {
  const harnesses = [{ id: 'claude' }, { id: 'codex' }, { id: 'windsurf' }];
  const domains = [{ id: 'general' }, { id: 'web' }, { id: 'data' }];

  it('defaults to the single default harness/domain when no state exists', () => {
    expect(getActiveSelection(null)).toEqual({
      harnessIds: [DEFAULT_HARNESS_ID],
      domainIds: [DEFAULT_DOMAIN_ID],
      selectedToolIds: []
    });
  });

  it('normalizes replace selections into deduped registry order', () => {
    expect(normalizeSelectionIds(harnesses, ['windsurf', 'claude', 'windsurf'], 'harness')).toEqual(['claude', 'windsurf']);
  });

  it('adds selections without duplicating existing ids', () => {
    expect(addSelectionIds(domains, ['general'], ['web', 'general'], 'domain')).toEqual(['general', 'web']);
  });

  it('removes selections and rejects empty results', () => {
    expect(removeSelectionIds(harnesses, ['claude', 'codex'], ['codex'], 'harness')).toEqual(['claude']);
    expect(() => removeSelectionIds(domains, ['general'], ['general'], 'domain')).toThrow('At least one domain must be selected.');
  });
});
