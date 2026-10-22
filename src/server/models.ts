import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { modelInfo } from "../shared";
import { createAI } from "agents/models/ai-sdk";

/**
 * A vendor model (Claude, GPT) routed through the deployment's AI Gateway
 * over the AI binding. Requests keep the vendor's native format, so
 * streaming, tool calls, approvals and thinking go through the vendor's own
 * AI SDK provider. No key is held here: the gateway uses the key stored on
 * it for that vendor, or Unified Billing credits ("cloudflare" is a
 * placeholder the gateway strips).
 */
export function gatewayModel(env: Env, id: string) {
  const info = modelInfo(id);
  if (!(info && info.provider !== "workers-ai" && env.AI_GATEWAY_ID)) {
    throw new Error(`${id} needs the AI Gateway, which this deployment has not set up. Rerun setup.`);
  }
  const ai = createAI({ binding: env.AI, id: env.AI_GATEWAY_ID });
  const vendorId = id.slice(id.indexOf("/") + 1);
  return info.provider === "anthropic"
    ? ai(createAnthropic({ apiKey: "cloudflare" })(vendorId))
    : ai(createOpenAI({ apiKey: "cloudflare" })(vendorId));
}

/**
 * Per-turn provider options for a model. Claude Opus 5.5 defaults to
 * medium effort; multi-step tool work does better at high.
 */
export function providerOptionsFor(id: string): Record<string, Record<string, string>> | undefined {
  return modelInfo(id)?.provider === "anthropic" ? { anthropic: { effort: "high" } } : undefined;
}

/** The cheapest model per vendor, for Settings' connection test. */
export const TEST_MODELS = { anthropic: "anthropic/claude-haiku-5-5", openai: "openai/gpt-6-luna" } as const;

/**
 * A failure someone can fix in setup or the dashboard, in plain words, or
 * null for other errors (a bad request, an outage), which are not about
 * setup. Gateway errors carry `status` and `code`; errors the vendor itself
 * returned come through its AI SDK provider with `statusCode`.
 */
export function modelSetupFailure(error: unknown, vendor: string): string | null {
  const e = error as { status?: number; statusCode?: number; code?: string; message?: string; responseBody?: string };
  const status = e?.status ?? e?.statusCode;
  const text = `${e?.message ?? ""} ${e?.responseBody ?? ""}`;
  if (status === 402 || /insufficient (balance|credit)|out of credits/i.test(text)) {
    return "Out of AI Gateway credits. Top them up in the Cloudflare dashboard under AI > AI Gateway > Credits.";
  }
  if (/\b2049\b/.test(text)) {
    return "The AI Gateway needs authentication turned on to use credits. Rerun setup to fix it.";
  }
  if (status === 401 || status === 403 || e?.code === "auth") {
    return `The ${vendor} key stored on the AI Gateway was rejected. Rerun setup with a new key in POWERHOUSE_${vendor.toUpperCase()}_KEY.`;
  }
  // The gateway's own spend limits answer 429 as well; budgets are set there.
  if ((status === 429 || e?.code === "rate-limit") && /spend|budget/i.test(text)) {
    return "The AI Gateway's spend limit was reached. Jobs on this model resume when its window resets, or raise the limit in the Cloudflare dashboard under AI > AI Gateway > Settings > Spend limits.";
  }
  if (status === 429 || e?.code === "rate-limit") {
    return `Rate limited by ${vendor} or the AI Gateway. Jobs retry on their own; if this keeps happening, check your plan's limits.`;
  }
  return null;
}
