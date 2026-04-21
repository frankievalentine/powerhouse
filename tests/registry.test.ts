import { describe, expect, it } from 'vitest';

import { loadRegistry, validateRegistry } from '../packages/core/src/index.ts';

describe('registry validation', () => {
  it('validates the bundled registry without errors', async () => {
    const registry = await loadRegistry();
    const result = validateRegistry(registry);

    expect(result.errors).toEqual([]);
  });
});

