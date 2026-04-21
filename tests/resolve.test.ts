import { describe, expect, it } from 'vitest';

import { detectPlatform, isSupportedPlatform, loadRegistry, resolveBootstrapPlan } from '../packages/core/src/index.ts';

describe('bootstrap plan resolution', () => {
  it('resolves a claude/web plan from the registry', async () => {
    const registry = await loadRegistry();
    const platform = detectPlatform();

    if (!isSupportedPlatform(platform)) {
      return;
    }

    const plan = resolveBootstrapPlan(registry, platform, 'claude-dev', 'web');

    expect(plan.profile.id).toBe('claude-dev');
    expect(plan.domain.id).toBe('web');
    expect(plan.tools.some((tool) => tool.id === 'claude-code')).toBe(true);
    expect(plan.agents).toContain('claude-code');
  });
});
