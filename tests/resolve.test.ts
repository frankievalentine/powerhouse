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

    const plan = resolveBootstrapPlan(registry, platform, 'claude-dev', 'web');

    expect(plan.profile.id).toBe('claude-dev');
    expect(plan.domain.id).toBe('web');
    expect(plan.tools.some((tool) => tool.id === 'claude-code')).toBe(true);
    expect(plan.agents).toContain('claude-code');
  });

  it('keeps stable default ids for non-interactive profile/domain use flows', () => {
    expect(DEFAULT_PROFILE_ID).toBe('claude-dev');
    expect(DEFAULT_DOMAIN_ID).toBe('general');
  });
});
