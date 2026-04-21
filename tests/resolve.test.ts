import { describe, expect, it } from 'vitest';

import { detectPlatform, isSupportedPlatform, loadRegistry, resolveBootstrapPlan } from '../packages/core/src/index.ts';
import { DEFAULT_DOMAIN_ID, DEFAULT_PROFILE_ID } from '../packages/cli/src/commands/bootstrap.ts';

describe('bootstrap plan resolution', () => {
  it('resolves a claude/web plan from the registry', async () => {
    const registry = await loadRegistry();
    const platform = detectPlatform();

    if (!isSupportedPlatform(platform)) {
      return;
    }

    const plan = resolveBootstrapPlan(registry, platform, 'claude', 'web');

    expect(plan.profile.id).toBe('claude');

    expect(DEFAULT_PROFILE_ID).toBe('claude');
    expect(DEFAULT_DOMAIN_ID).toBe('general');
  });
});
