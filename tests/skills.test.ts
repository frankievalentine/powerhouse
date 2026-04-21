import { describe, expect, it } from 'vitest';

import { buildSkillsInvocation, SKILLS_CLI_VERSION } from '../packages/core/src/index.ts';

describe('skills invocation', () => {
  it('pins the npx invocation to the configured skills CLI version', () => {
    expect(buildSkillsInvocation('npx')).toEqual({
      command: 'npx',
      args: ['--yes', `skills@${SKILLS_CLI_VERSION}`]
    });
  });

  it('pins the bunx invocation to the configured skills CLI version', () => {
    expect(buildSkillsInvocation('bunx')).toEqual({
      command: 'bunx',
      args: [`skills@${SKILLS_CLI_VERSION}`]
    });
  });
});
