import type { JobHarness, RoleConfig } from "../shared";
import { JobAgent } from "./job-agent";

/**
 * The agent class that runs each harness's jobs. Adding a harness (Pi
 * Durable, once it has tool approvals) means its class here, its exported
 * name in JOB_CLASS_NAMES, its route name in JOB_HARNESSES (src/shared), and
 * its export from the Worker; dispatch, the job window's access check and
 * history cleanup go through these. A function, not a constant: job-agent.ts
 * imports org.ts, which imports this file, so the class is only defined once
 * every module has loaded.
 */
export function jobClassFor(harness: JobHarness | undefined) {
  const classes = { think: JobAgent } satisfies Record<JobHarness, unknown>;
  // Runs from before harnesses were recorded ran on Think.
  return classes[harness ?? "think"];
}

/**
 * Each class's exported name, as the SDK reports it for a sub-agent request.
 * Spelled out because a minifier may rename the class itself.
 */
export const JOB_CLASS_NAMES = { think: "JobAgent" } satisfies Record<JobHarness, string>;

/** The one place a role's harness is chosen. Every role runs on Think until another harness has tool approvals. */
export function harnessFor(_role: RoleConfig): JobHarness {
  return "think";
}
