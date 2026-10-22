import { type Capabilities, type JobSettings, type RoleConfig, TOOL_IDS, type ToolId } from "../shared";
import { type Tool, type ToolSet, tool } from "ai";
import type { Browser } from "agents/browser";
import { browserTool } from "agents/browser/ai-sdk";
import { webFetchTool } from "agents/webfetch/ai-sdk";
import { type WebSearchProvider, webSearchTool } from "agents/websearch/ai-sdk";
import { z } from "zod";
import { safeError } from "./log";

/** Characters of fetched content per page window; keeps Workers AI context in budget. */
const PAGE_CHARS = 12_000;

/** Added to the system prompt when a job has the browser. */
export const BROWSER_GUIDANCE = [
  // The SDK keeps screenshot data for the UI only when it is a browser call's
  // whole result; nested inside other data it is redacted as a large payload.
  "To show a screenshot, make it the entire return value of its own browser call: return { type: 'browser_screenshot', mediaType, data } and nothing else. Read text or other details in a separate call.",
  "When a page needs a login, MFA, a CAPTCHA or other human input, call requestTakeover with the reason, then end your turn. The operator will finish that step in the same browser and reply, and you continue from there.",
].join(" ");

export interface ToolContext {
  capabilities: Capabilities;
  env: Env;
  /** The job's browser, created on first use with the role's hostname guardrails. */
  getBrowser: () => Browser;
  /** Marks the turn as handing the browser to the operator. */
  onTakeover: (reason: string) => Promise<void>;
  /** Scope for the browser's active tab; the job's run id. */
  scope: string;
  /** Org settings the job snapshotted at dispatch. */
  settings: JobSettings;
  sendEmail: (options: { to: string; subject: string; text: string }) => Promise<{ messageId: string }>;
  /** Records a tool's setup health for the Settings checklist: a failure message, or null after a success. */
  onFeatureResult: (id: ToolId, failure: string | null) => Promise<void>;
  /** The operator has taken over this job's browser, so it may hold their signed-in sessions. */
  afterTakeover: boolean;
}

/** Same rule as webFetch's allowedHosts: exact hosts, and `*.example.com` for subdomains only. */
function hostAllowed(url: string, allowedHosts: readonly string[]) {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowedHosts.some((pattern) => {
    const p = pattern.toLowerCase();
    return p.startsWith("*.") ? host.endsWith(p.slice(1)) : host === p;
  });
}

/**
 * Web search failures that mean the deployment's setup is incomplete, in the
 * operator's terms. Timeouts, rate limits and bad queries are not setup
 * problems and leave the checklist alone.
 */
const SEARCH_SETUP_FAILURES: Record<string, string> = {
  web_search_byok_not_configured: "The search provider key is missing from AI Gateway.",
  web_search_gateway_not_configured: "The AI Gateway used for search does not exist.",
  web_search_payment_required: "No AI Gateway credits or search provider key.",
  web_search_unauthorized: "This account may not use web search; check that AI Gateway is on.",
};

const KNOWN: ReadonlySet<string> = new Set(TOOL_IDS);

/** Drops ids that are no longer tools (e.g. from roles saved before a tool was removed). */
export function knownTools(ids: readonly string[]): ToolId[] {
  return ids.filter((id): id is ToolId => KNOWN.has(id));
}

/**
 * Builds the AI SDK tools a role is granted, skipping any this deployment has
 * not configured. Pass the same set to convertToModelMessages so earlier tool
 * results are rendered the way the tools intend (web_fetch wraps content as
 * untrusted; the browser sends the model a summary instead of screenshots).
 */
export function toolsFor(role: RoleConfig, ctx: ToolContext): ToolSet {
  const tools: ToolSet = {};
  for (const id of knownTools(role.tools)) {
    if (!ctx.capabilities[id]) {
      continue;
    }
    if (id === "webSearch") {
      const search = webSearchTool({
        binding: ctx.env.AI,
        limit: 5,
        ...(ctx.env.WEB_SEARCH_GATEWAY ? { gateway: ctx.env.WEB_SEARCH_GATEWAY } : {}),
        ...(ctx.env.WEB_SEARCH_PROVIDER ? { provider: ctx.env.WEB_SEARCH_PROVIDER as WebSearchProvider } : {}),
      });
      tools.webSearch = reportingHealth("webSearch", search, ctx, (error) => {
        const code = (error as { code?: unknown } | null)?.code;
        return typeof code === "string" ? (SEARCH_SETUP_FAILURES[code] ?? null) : null;
      });
    } else if (id === "webFetch") {
      const fetchTool = webFetchTool({
        binding: ctx.env.AI,
        pageChars: PAGE_CHARS,
        ...(role.allowedHosts.length > 0 ? { allowedHosts: role.allowedHosts } : {}),
        // Org-wide blocks are checked before the role's allowed sites.
        ...(ctx.settings.blockedHosts.length > 0 ? { blockedHosts: ctx.settings.blockedHosts } : {}),
      });
      // A role with connections can read private data, and a fetch is a way
      // to send it out (in the URL). So, for those roles, reading a site
      // outside the role's allowed sites waits for approval, with the full
      // URL shown.
      tools.webFetch =
        role.connections.length > 0
          ? {
              ...fetchTool,
              needsApproval: (input: { url?: unknown }) =>
                !hostAllowed(typeof input?.url === "string" ? input.url : "", role.allowedHosts),
            }
          : fetchTool;
    } else if (id === "browser" && ctx.env.LOADER) {
      const browser = browserTool({ browser: ctx.getBrowser(), loader: ctx.env.LOADER, scope: ctx.scope });
      // Every browser run waits for approval, showing the code it will run,
      // when the org asks for it; when the role has connections (the browser
      // could send their data anywhere); and after a takeover (the browser
      // may now be signed in as the operator). Browser guardrails only take
      // an allow-list, so org-wide blocked sites cannot be enforced here.
      const approve = ctx.settings.approveBrowserActions || role.connections.length > 0 || ctx.afterTakeover;
      tools.browser = approve ? { ...browser, needsApproval: true } : browser;
      tools.requestTakeover = takeoverTool(ctx);
    } else if (id === "sendEmail") {
      // The recipient is validated before sending, so a failed send is almost
      // always the sender or its domain.
      tools.sendEmail = reportingHealth(
        "sendEmail",
        sendEmailTool(ctx),
        ctx,
        (error) =>
          `Sending failed (${error instanceof Error ? error.message : String(error)}). Check that the sender's domain is set up in Email Service.`,
      );
    }
  }
  return tools;
}

/**
 * Wraps a tool so its outcome reaches the Settings checklist. `setupFailure`
 * turns an error into an operator-facing message, or null when the error is
 * not about setup. The error still reaches the model unchanged, and a failed
 * health report never fails the tool.
 */
function reportingHealth<T extends Tool>(
  id: ToolId,
  original: T,
  ctx: ToolContext,
  setupFailure: (error: unknown) => string | null,
): T {
  const execute = original.execute;
  if (!execute) {
    return original;
  }
  const report = (failure: string | null) =>
    ctx.onFeatureResult(id, failure).catch((error) => console.warn(`Reporting ${id} health failed`, safeError(error)));
  return {
    ...original,
    execute: async (input: unknown, options: unknown) => {
      try {
        const result = await (execute as (input: unknown, options: unknown) => Promise<unknown>)(input, options);
        await report(null);
        return result;
      } catch (error) {
        const failure = setupFailure(error);
        if (failure) {
          await report(failure);
        }
        throw error;
      }
    },
  } as T;
}

function takeoverTool(ctx: ToolContext) {
  return tool({
    description:
      "Ask the operator to take over the browser for a step you cannot do yourself: a login, MFA, a CAPTCHA or sensitive input. After calling it, end your turn.",
    execute: async ({ reason }) => {
      await ctx.onTakeover(reason);
      return {
        requested: true,
        next: "The operator has been asked to take over. End your turn now and continue when they reply.",
      };
    },
    inputSchema: z.object({ reason: z.string().min(1).max(300).describe("What the operator needs to do") }),
  });
}

function sendEmailTool(ctx: ToolContext) {
  return tool({
    description: `Send a plain-text email from ${ctx.env.EMAIL_FROM}. The operator approves every message before it is sent.`,
    execute: async ({ to, subject, text }) => {
      const { messageId } = await ctx.sendEmail({ subject, text, to });
      return { messageId, sent: true, to };
    },
    inputSchema: z.object({
      subject: z.string().min(1).max(200),
      text: z.string().min(1).max(20_000).describe("Plain-text body"),
      to: z.email(),
    }),
    needsApproval: true,
  });
}
