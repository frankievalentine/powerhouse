import { describe, expect, it } from 'vitest';

import { buildStatusReport } from '../packages/core/src/index.ts';

describe('status report', () => {
  it('builds a report with paths and doctor output', async () => {
    const report = await buildStatusReport();

    expect(report.paths.stateFile.endsWith('state.json')).toBe(true);
    expect(report.registry.tools.length).toBeGreaterThan(0);
    expect(report.doctorChecks.length).toBeGreaterThan(0);
  });
});
