import type { Tool, ToolSet } from "ai";

/** Where a job records the side effects its tool calls started and finished. */
export interface EffectLedger {
  get(toolCallId: string): string | null;
  set(toolCallId: string, record: string): void;
  delete(toolCallId: string): void;
}

type EffectRecord = { state: "started" } | { state: "done"; result?: unknown };

/** Results larger than this are not kept; a replay then gets a note instead. */
const MAX_KEPT_RESULT_CHARS = 100_000;

export const INTERRUPTED_EFFECT = {
  status: "unknown",
  note: "This action was cut off by a restart while it ran, so it may already have happened. Do not repeat it; tell the reader to check whether it went through.",
};

const DONE_WITHOUT_RESULT = { status: "done", note: "This action already ran before a restart; its result was not kept." };

/**
 * Wraps a tool that changes something outside powerhouse (an email, a
 * connection write) so a turn replayed after a restart never repeats it: a
 * finished call returns its recorded result, and a call cut off mid-run
 * returns INTERRUPTED_EFFECT instead of running again. A failed call leaves
 * no record, so it can be retried. Re-issuing the action as a new call means
 * a new approval, which a person sees.
 */
export function runOnce<T extends Tool>(original: T, ledger: EffectLedger): T {
  const execute = original.execute;
  if (!execute) {
    return original;
  }
  return {
    ...original,
    execute: async (input: unknown, options: { toolCallId?: string }) => {
      const id = options?.toolCallId;
      const run = () => (execute as (input: unknown, options: unknown) => Promise<unknown>)(input, options);
      if (!id) {
        return run();
      }
      const stored = ledger.get(id);
      if (stored) {
        const record = JSON.parse(stored) as EffectRecord;
        return record.state === "started" ? INTERRUPTED_EFFECT : (record.result ?? DONE_WITHOUT_RESULT);
      }
      ledger.set(id, JSON.stringify({ state: "started" } satisfies EffectRecord));
      let result: unknown;
      try {
        result = await run();
      } catch (error) {
        ledger.delete(id);
        throw error;
      }
      const kept = JSON.stringify({ state: "done", result } satisfies EffectRecord);
      ledger.set(id, kept.length <= MAX_KEPT_RESULT_CHARS ? kept : JSON.stringify({ state: "done" } satisfies EffectRecord));
      return result;
    },
  } as T;
}

/**
 * runOnce for every tool in the set that always waits for approval: email,
 * connection writes, and browser actions when they ask. Those are the ones
 * that change something outside powerhouse.
 */
export function runApprovedOnce(tools: ToolSet, ledger: EffectLedger): ToolSet {
  return Object.fromEntries(Object.entries(tools).map(([name, t]) => [name, t.needsApproval === true ? runOnce(t, ledger) : t]));
}
