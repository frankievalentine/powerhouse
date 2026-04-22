import { describe, expect, it } from 'vitest';

import {
  formatExecutionSummary,
  formatPlatformList,
  shortenPathForDisplay,
  summarizeDescription
} from '../packages/cli/src/ui/output.ts';

describe('cli output helpers', () => {
  it('humanizes platform lists', () => {
    expect(formatPlatformList(['darwin', 'linux', 'wsl'])).toBe('macOS, Linux, WSL');
  });

  it('compacts repetitive domain copy', () => {
    expect(summarizeDescription('Curated skills for UI, frontend implementation, design, and modern web development.', 'domain')).toBe(
      'UI, frontend implementation, design, and modern web development.'
    );
  });

  it('cleans up harness CLI wording', () => {
    expect(summarizeDescription("OpenAI's Codex CLI agent and desktop app (macOS).", 'harness')).toBe(
      "OpenAI's Codex CLI and desktop app on macOS."
    );
  });

  it('shortens project-relative config paths', () => {
    expect(shortenPathForDisplay('/Users/tester/project/.codex/config.toml', '/Users/tester/project', '/Users/tester')).toBe(
      './.codex/config.toml'
    );
  });

  it('uses a neutral summary when a dry run makes no tool changes', () => {
    expect(
      formatExecutionSummary([
        { toolId: 'bun', status: 'skipped', stepsRun: 0, ownership: 'preexisting', removable: false, installMethods: [] },
        { toolId: 'node', status: 'skipped', stepsRun: 0, ownership: 'preexisting', removable: false, installMethods: [] }
      ])
    ).toBe('Tools: no changes, 2 already available.');
  });
});
