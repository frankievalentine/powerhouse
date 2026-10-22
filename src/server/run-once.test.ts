import { describe, expect, test } from "bun:test";
import { type Tool, tool } from "ai";
import { z } from "zod";
import { type EffectLedger, INTERRUPTED_EFFECT, runApprovedOnce, runOnce } from "./run-once";

function memoryLedger(): EffectLedger & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  return {
    delete: (id) => void rows.delete(id),
    get: (id) => rows.get(id) ?? null,
    rows,
    set: (id, record) => void rows.set(id, record),
  };
}

function counting(result: unknown = { sent: true }) {
  let calls = 0;
  const t = tool({
    execute: async () => {
      calls++;
      return result;
    },
    inputSchema: z.object({}),
    needsApproval: true,
  });
  return { calls: () => calls, t };
}

const run = (t: Tool, toolCallId: string) =>
  (t.execute as (input: unknown, options: { toolCallId: string }) => Promise<unknown>)({}, { toolCallId });

describe("runOnce", () => {
  test("a replayed call returns the recorded result without running again", async () => {
    const ledger = memoryLedger();
    const { calls, t } = counting({ messageId: "m1" });
    const once = runOnce(t, ledger);
    expect(await run(once, "call-1")).toEqual({ messageId: "m1" });
    expect(await run(once, "call-1")).toEqual({ messageId: "m1" });
    expect(calls()).toBe(1);
  });

  test("a call cut off mid-run is reported as unknown, not repeated", async () => {
    const ledger = memoryLedger();
    ledger.set("call-1", JSON.stringify({ state: "started" }));
    const { calls, t } = counting();
    expect(await run(runOnce(t, ledger), "call-1")).toEqual(INTERRUPTED_EFFECT);
    expect(calls()).toBe(0);
  });

  test("a failed call leaves no record, so it can run again", async () => {
    const ledger = memoryLedger();
    const failing = tool({
      execute: async () => {
        throw new Error("down");
      },
      inputSchema: z.object({}),
      needsApproval: true,
    });
    await expect(run(runOnce(failing, ledger), "call-1")).rejects.toThrow("down");
    expect(ledger.rows.size).toBe(0);
  });

  test("different calls each run", async () => {
    const { calls, t } = counting();
    const once = runOnce(t, memoryLedger());
    await run(once, "call-1");
    await run(once, "call-2");
    expect(calls()).toBe(2);
  });

  test("an oversized result is not kept, and a replay gets a note", async () => {
    const ledger = memoryLedger();
    const { calls, t } = counting({ data: "x".repeat(200_000) });
    const once = runOnce(t, ledger);
    await run(once, "call-1");
    expect(await run(once, "call-1")).toMatchObject({ status: "done" });
    expect(calls()).toBe(1);
  });
});

describe("runApprovedOnce", () => {
  test("wraps only tools that always wait for approval", async () => {
    const ledger = memoryLedger();
    const approved = counting();
    let readCalls = 0;
    const read = tool({
      execute: async () => {
        readCalls++;
        return "page";
      },
      inputSchema: z.object({}),
      needsApproval: () => false,
    });
    const tools = runApprovedOnce({ read, send: approved.t }, ledger);
    await run(tools.send as Tool, "a");
    await run(tools.send as Tool, "a");
    await run(tools.read as Tool, "b");
    await run(tools.read as Tool, "b");
    expect(approved.calls()).toBe(1);
    expect(readCalls).toBe(2);
  });
});
