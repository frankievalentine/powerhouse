import * as ai from "ai";
import { wrapAISDK } from "agents/observability/ai";

/**
 * AI SDK calls wrapped for Workers tracing (the dashboard's Agents view).
 * Spans are only recorded when the operator enables
 * `observability.traces` in wrangler.local.jsonc. Message and tool payloads
 * can contain personal data, so they are stored only with TRACE_PAYLOADS=on.
 */
const withoutPayloads = wrapAISDK(ai);
const withPayloads = wrapAISDK(ai, { storeMessages: true, storeTools: true });

export function tracedAI(env: Env) {
  return env.TRACE_PAYLOADS === "on" ? withPayloads : withoutPayloads;
}

/** Shared agent names keep the dashboard to one row per kind of work. */
export const TRACE_NAMES = { job: "powerhouse-job", router: "powerhouse-router" } as const;
