import { type ChatResponseResult, type StepContext, Think, type TurnConfig } from "@cloudflare/think";
import { type ApprovalRecord, DEFAULT_MODEL, estimateCostUsd, type JobInput, type JobSettings, modelInfo, type RoleConfig } from "../shared";
import { type Connection, type ConnectionContext, callable } from "agents";
import { Browser, browserRun, DurableBrowserSessionStore } from "agents/browser";
import type { ToolSet, UIMessage } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { gatewayModel, modelSetupFailure, providerOptionsFor } from "./models";
import { MEMBER_EMAIL_HEADER } from "./auth";
import { withDeploymentConfig } from "./deployment";
import { capabilitiesFor } from "./capabilities";
import { CONNECTION_GUIDANCE, connectionTools } from "./connections";
import { Org } from "./org";
import { skillsForTurn } from "./skills";
import { BROWSER_GUIDANCE, toolsFor } from "./tools";
import { TRACE_NAMES } from "./tracing";
import { safeError } from "./log";

/**
 * Idle lifetime Browser Run gives the job's browser. Browsers are closed at
 * the end of every turn, so this only matters while the operator is taking
 * over between turns, or if a turn dies before it can close the browser.
 */
const BROWSER_KEEP_ALIVE_MS = 5 * 60_000;

/** Messages anyone allowed to see a job may send: they only resume its stream. */
const WATCH_ONLY_MESSAGES: ReadonlySet<string> = new Set(["cf_agent_stream_resume_request", "cf_agent_stream_resume_ack"]);

/** Methods anyone who can see a job may call: they only read. */
const WATCH_ONLY_METHODS: ReadonlySet<string> = new Set(["approvals"]);

const NOT_ALLOWED = "Only the person who started this job or an admin can do that.";

/** What a job keeps on each client connection. */
interface JobConnectionState {
  email: string;
  allowed: boolean;
}

function parseMessage(
  raw: string,
): { type: string; id?: unknown; approved?: unknown; method?: unknown; toolCallId?: unknown } | null {
  try {
    const data = JSON.parse(raw) as { type?: unknown };
    return typeof data?.type === "string" ? (data as { type: string }) : null;
  } catch {
    return null;
  }
}

export interface LiveViewTab {
  liveViewUrl: string;
  pageUrl: string | null;
  title: string | null;
}

/**
 * One instance per run, spawned by Org through runAgentTool; the facet name is
 * the run id. The role is snapshotted at dispatch, so editing a role later
 * never changes a job that is already running.
 */
export class JobAgent extends Think<Env> {
  #browser: Browser | null = null;
  /** This turn's connection tool names; their calls report their own activity. */
  #connectionToolNames = new Set<string>();

  /** Jobs only get their role's tools, never Think's workspace file tools. */
  workspaceBash = false as const;

  /** Message and tool payloads can contain personal data; traced only with TRACE_PAYLOADS=on. */
  storeMessages = this.env.TRACE_PAYLOADS === "on";
  storeTools = this.env.TRACE_PAYLOADS === "on";

  /**
   * Only the person who started a job, and admins, may act on it: follow up,
   * approve or decline, stop, clear, or call its methods (Live View links).
   * Other members can watch: the only messages they may send resume the
   * stream. Think handles its protocol messages in a wrapper it installs
   * during startup, just before calling this onStart, so the check is
   * installed here to wrap that one (a constructor would be too early: Think
   * would handle chat, approvals and clears before the check saw them).
   */
  async onStart() {
    // Settings saved by Finish setup (AI Gateway), for browser-set-up deployments.
    this.env = await withDeploymentConfig(this.env);
    if (this.accessCheckInstalled) {
      return;
    }
    this.accessCheckInstalled = true;
    const handle = this.onMessage.bind(this);
    this.onMessage = async (connection: Connection, message: string | ArrayBuffer | ArrayBufferView) => {
      const parsed = typeof message === "string" ? parseMessage(message) : null;
      if (
        parsed &&
        (WATCH_ONLY_MESSAGES.has(parsed.type) || (parsed.type === "rpc" && WATCH_ONLY_METHODS.has(String(parsed.method))))
      ) {
        return handle(connection, message);
      }
      const state = (connection as Connection<JobConnectionState>).state;
      if (!state?.allowed) {
        if (parsed?.type === "rpc" && typeof parsed.id === "string") {
          connection.send(JSON.stringify({ error: NOT_ALLOWED, id: parsed.id, success: false, type: "rpc" }));
        }
        return;
      }
      if (parsed?.type === "cf_agent_tool_approval" && typeof parsed.toolCallId === "string") {
        await this.recordApproval(parsed.toolCallId, state.email, parsed.approved === true);
      }
      return handle(connection, message);
    };
  }

  private accessCheckInstalled = false;

  /** Asks Org, once per connection, whether this member may act on the job. */
  async onConnect(connection: Connection<JobConnectionState>, ctx: ConnectionContext) {
    const email = ctx.request.headers.get(MEMBER_EMAIL_HEADER)?.toLowerCase() ?? "";
    let allowed = false;
    if (email) {
      try {
        allowed = await (await this.parentAgent(Org)).jobAccess(this.name, email);
      } catch (error) {
        console.warn(`[job ${this.name}] could not check access`, safeError(error));
      }
    }
    connection.setState({ allowed, email });
  }

  /** Who approved or declined each tool call, kept with the job and shown on it. */
  private async recordApproval(toolCallId: string, email: string, approved: boolean) {
    const log = this.approvalLog();
    log[toolCallId] ??= { approved, at: Date.now(), by: email };
    this.sql`CREATE TABLE IF NOT EXISTS job (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    this.sql`INSERT OR REPLACE INTO job (key, value) VALUES ('approvals', ${JSON.stringify(log)})`;
    await this.report({ activity: `${approved ? "Approved" : "Declined"} by ${email}` });
  }

  private approvalLog(): Record<string, ApprovalRecord> {
    const raw = this.jobValue("approvals");
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    // Records from before tool call ids were kept were a list; they map to no call.
    return parsed && !Array.isArray(parsed) ? (parsed as Record<string, ApprovalRecord>) : {};
  }

  /** Who approved or declined each tool call, by tool call id. Anyone who can see the job may read it. */
  @callable()
  approvals(): Record<string, ApprovalRecord> {
    return this.approvalLog();
  }

  /** Clients reach jobs over the sub-agent route; they may chat, never write agent state. */
  validateStateChange(_next: unknown, source: Connection | "server") {
    if (source !== "server") {
      throw new Error("Job state can only be changed by the server.");
    }
  }

  protected formatAgentToolInput(input: unknown): UIMessage {
    const { prompt, role, settings } = input as JobInput;
    // Persisted because turns after the first (e.g. resuming after an
    // approval) do not receive the agent-tool input.
    this.sql`CREATE TABLE IF NOT EXISTS job (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    this.sql`INSERT OR REPLACE INTO job (key, value) VALUES ('role', ${JSON.stringify(role)})`;
    this.sql`INSERT OR REPLACE INTO job (key, value) VALUES ('settings', ${JSON.stringify(settings)})`;
    return {
      id: `input-${this.name}`,
      parts: [{ text: prompt, type: "text" }],
      role: "user",
    };
  }

  /** Vendor models go through the AI Gateway; open models run on Workers AI directly. */
  getModel() {
    const model = this.jobSettings().model;
    if (modelInfo(model)?.provider !== "workers-ai") {
      return gatewayModel(this.env, model);
    }
    const workersai = createWorkersAI({ binding: this.env.AI });
    return workersai(model, { sessionAffinity: this.sessionAffinity });
  }

  getSystemPrompt() {
    const role = this.role();
    const parts = [role.systemPrompt];
    if ("browser" in this.roleTools(role)) {
      parts.push(BROWSER_GUIDANCE);
    }
    const profile = this.jobSettings().companyProfile?.trim();
    if (profile) {
      parts.push(`Company profile, written by the organization you work for:\n${profile}`);
    }
    return parts.join("\n\n");
  }

  getTools(): ToolSet {
    return this.roleTools(this.role());
  }

  /**
   * Fires on every turn, including the one that resumes after an approval,
   * whose first step executes the approved tool without a new tool call.
   */
  async beforeTurn(): Promise<TurnConfig> {
    // The phase chip already says "Working"; the first turn says something else.
    const firstTurn = !this.messages.some((m) => m.role === "assistant");
    await this.report({ activity: firstTurn ? "Getting started" : "Working", phase: "running" });
    // A new turn means any takeover is over: the operator replied.
    this.sql`DELETE FROM job WHERE key = 'takeover'`;
    const role = this.role();
    // Skills are loaded here rather than through Think's getSkills(): Think
    // reads that once when the agent starts, before a new job has its role,
    // and switches the system prompt to context blocks, dropping the role's.
    const skills = await skillsForTurn(role.skills);
    const connections = await this.connectionTurn(role, [
      ...Object.keys(this.roleTools(role)),
      ...Object.keys(skills?.tools ?? {}),
    ]);
    const extra = [skills?.prompt, connections.prompt].filter(Boolean);
    return {
      // Think merges its workspace file tools into every turn; limit the model
      // to the role's own tools, its skill tools and its connection tools.
      activeTools: [
        ...Object.keys(this.roleTools(role)),
        ...Object.keys(skills?.tools ?? {}),
        ...Object.keys(connections.tools),
      ],
      tools: { ...skills?.tools, ...connections.tools },
      ...(extra.length > 0 ? { instructions: [this.getSystemPrompt(), ...extra].join("\n\n") } : {}),
      maxSteps: this.jobSettings().maxSteps,
      providerOptions: providerOptionsFor(this.jobSettings().model),
      // One agent name for all jobs. Think sets the trace identity itself:
      // the run id as the agent and the facet's Durable Object id as the
      // conversation, where AIChatAgent jobs used the role and the run.
      telemetry: {
        functionId: TRACE_NAMES.job,
        includeRuntimeContext: { agentId: true, conversationId: true },
      },
    };
  }

  /**
   * Activity goes through report() rather than reportProgress(): the turn that
   * resumes after an approval is no longer part of the agent-tool run, so
   * reportProgress() would be dropped there.
   */
  async onStepFinish(step: StepContext) {
    // A running total, kept with the job and reported with each step.
    const cost = Number(this.jobValue("cost_usd") ?? 0) + estimateCostUsd(this.jobSettings().model, step.usage ?? {});
    this.sql`INSERT OR REPLACE INTO job (key, value) VALUES ('cost_usd', ${String(cost)})`;
    const last = step.toolCalls.at(-1);
    const activity = last && !this.#connectionToolNames.has(last.toolName) ? { activity: `Called ${last.toolName}` } : {};
    await this.report({ ...activity, costUsd: cost, phase: "running" });
  }

  /**
   * The parent's run registry marks a run completed as soon as the headless
   * turn ends, including when it ends parked on an approval, and never hears
   * about the turn that resumes after one. So the child reports its own
   * lifecycle at every turn boundary.
   */
  async onChatResponse(result: ChatResponseResult) {
    const takeover = this.jobValue("takeover");
    // The browser is closed after every turn so it never idles on Browser Run
    // time, except while a person is needed to continue in it: a takeover, or
    // a browser action waiting for approval (closing would lose its page).
    if (!(takeover || this.hasPendingApproval("tool-browser"))) {
      await this.closeBrowser();
    }
    if (result.status !== "completed") {
      await this.report({
        activity: null,
        completedAt: Date.now(),
        error: result.error ?? `Turn ${result.status}`,
        phase: result.status === "aborted" ? "aborted" : "error",
      });
      return;
    }
    // The model answered, so any earlier gateway problem for its vendor is fixed.
    const vendor = this.vendor();
    if (vendor) {
      await (await this.parentAgent(Org)).reportModelHealth(vendor, null);
    }
    if (takeover) {
      await this.report({ activity: `Take over the browser: ${takeover}`, phase: "awaiting_approval" });
      return;
    }
    if (this.hasPendingApproval()) {
      await this.report({ activity: "Needs your approval", phase: "awaiting_approval" });
      return;
    }
    await this.report({
      activity: null,
      completedAt: Date.now(),
      phase: "completed",
      summary: finalStepText(this.messages),
    });
  }

  /**
   * Tool errors are written to be read (a blocked host, a search billing
   * problem); log them for the operator. A gateway problem someone can fix
   * (no credits, a rejected key) also reaches Settings through Org.
   */
  onChatError(error: unknown) {
    console.error(`[job ${this.name}]`, safeError(error));
    const vendor = this.vendor();
    const failure = vendor ? modelSetupFailure(error, vendor) : null;
    if (vendor && failure) {
      void this.parentAgent(Org).then((org) => org.reportModelHealth(vendor, failure));
    }
    return error;
  }

  /** The gateway vendor this job's model comes from, or null for Workers AI. */
  private vendor() {
    const provider = modelInfo(this.jobSettings().model)?.provider;
    return provider === "anthropic" || provider === "openai" ? provider : null;
  }

  /**
   * Live View links for the job's browser tabs, for the operator taking over.
   * They are bearer credentials: only returned to authenticated org members
   * over the job's own connection, never stored, never given to the model.
   */
  @callable()
  async liveView(): Promise<LiveViewTab[]> {
    if (!this.env.BROWSER) {
      return [];
    }
    const view = await this.browserFor(this.role()).liveView({ mode: "tab" });
    return (view?.targets ?? [])
      .filter((tab) => tab.pageUrl?.startsWith("http"))
      .map((tab) => ({ liveViewUrl: tab.url, pageUrl: tab.pageUrl ?? null, title: tab.title ?? null }));
  }

  /**
   * Think calls getTools() and getSystemPrompt() separately each turn; both
   * need the same set, built once per turn from the snapshotted role.
   */
  private roleTools(role: RoleConfig): ToolSet {
    return toolsFor(role, {
      capabilities: capabilitiesFor(this.env),
      env: this.env,
      afterTakeover: this.jobValue("taken_over") !== null,
      getBrowser: () => this.browserFor(role),
      onTakeover: async (reason) => {
        this.sql`INSERT OR REPLACE INTO job (key, value) VALUES ('takeover', ${reason})`;
        // Kept for the rest of the run (unlike 'takeover', cleared each turn).
        this.sql`INSERT OR REPLACE INTO job (key, value) VALUES ('taken_over', '1')`;
      },
      scope: this.name,
      settings: this.jobSettings(),
      onFeatureResult: async (id, failure) => {
        const org = await this.parentAgent(Org);
        await org.reportFeatureHealth(id, failure);
      },
      sendEmail: ({ to, subject, text }) =>
        this.sendEmail({ binding: this.env.EMAIL as SendEmail, from: this.env.EMAIL_FROM as string, subject, text, to }),
    });
  }

  /**
   * The role's connection tools for this turn, from Org, which owns the
   * connections and their tokens. A role listing none costs no RPC. If Org
   * cannot be reached the turn goes ahead without them and says so.
   */
  private async connectionTurn(role: RoleConfig, reserved: readonly string[]): Promise<{ prompt: string | null; tools: ToolSet }> {
    this.#connectionToolNames = new Set();
    if (role.connections.length === 0) {
      return { prompt: null, tools: {} };
    }
    const org = await this.parentAgent(Org);
    let listed: Awaited<ReturnType<Org["connectionTools"]>>;
    try {
      listed = await org.connectionTools(role.connections);
    } catch (error) {
      console.warn(`[job ${this.name}] could not list connection tools`, safeError(error));
      return { prompt: "Your connected accounts could not be reached for this turn; say so if the job needs them.", tools: {} };
    }
    const { bindings, tools } = connectionTools(listed.tools, {
      bindings: JSON.parse(this.jobValue("tool_bindings") ?? "{}") as Record<string, string>,
      call: async ({ args, connectionId, name }) => (await this.parentAgent(Org)).callConnectionTool(connectionId, name, args),
      onFinished: (activity) => this.report({ activity, phase: "running" }),
      reserved: new Set(reserved),
    });
    this.sql`INSERT OR REPLACE INTO job (key, value) VALUES ('tool_bindings', ${JSON.stringify(bindings)})`;
    this.#connectionToolNames = new Set(Object.keys(tools));
    const unavailable =
      listed.unavailable.length > 0
        ? `\nNot available right now (they need attention in Settings): ${listed.unavailable.join(", ")}.`
        : "";
    return { prompt: `${CONNECTION_GUIDANCE}${unavailable}`, tools };
  }

  /**
   * One browser per job, created lazily because its guardrails come from the
   * role, which the job only learns on its first turn. The explicit store keeps
   * the session record in this facet's storage, so a later turn (or another
   * isolate) can reattach to it or close it.
   */
  private browserFor(role: RoleConfig): Browser {
    if (!this.env.BROWSER) {
      throw new Error("The browser is not configured for this deployment.");
    }
    this.#browser ??= new Browser({
      provider: browserRun(this.env.BROWSER, {
        guardrails: role.allowedHosts.length > 0 ? { allowedDomains: role.allowedHosts } : undefined,
        keepAliveMs: BROWSER_KEEP_ALIVE_MS,
      }),
      store: new DurableBrowserSessionStore(this.ctx.storage),
    });
    return this.#browser;
  }

  /** No-op when this job never opened a browser. */
  private async closeBrowser() {
    if (!this.env.BROWSER) {
      return;
    }
    try {
      await this.browserFor(this.role()).close();
    } catch (error) {
      console.warn("Closing the job browser failed; Browser Run reclaims it after keep-alive", safeError(error));
    }
  }

  private jobValue(key: string) {
    const [row] = this.sql<{ value: string }>`SELECT value FROM job WHERE key = ${key}`;
    return row?.value ?? null;
  }

  private role(): RoleConfig {
    const [row] = this.sql<{ value: string }>`SELECT value FROM job WHERE key = 'role'`;
    if (!row) {
      throw new Error("Job has no role; it was not started through Org.dispatch");
    }
    return JSON.parse(row.value) as RoleConfig;
  }

  private async report(patch: Parameters<Org["reportJob"]>[1]) {
    const org = await this.parentAgent(Org);
    await org.reportJob(this.name, patch);
  }

  /** Optionally only approvals for one tool part type, e.g. "tool-browser". */
  private hasPendingApproval(partType?: string) {
    return this.messages.some((m) =>
      m.parts.some(
        (part) => "state" in part && part.state === "approval-requested" && (!partType || part.type === partType),
      ),
    );
  }

  /** Jobs dispatched before settings existed have none stored; use the defaults they ran with. */
  private jobSettings(): JobSettings {
    const stored = this.jobValue("settings");
    return stored
      ? (JSON.parse(stored) as JobSettings)
      : { approveBrowserActions: false, blockedHosts: [], maxSteps: 8, model: DEFAULT_MODEL };
  }
}

/**
 * Text of the last step of the last assistant message. A multi-step turn puts
 * every step in one message separated by `step-start` parts, so joining all
 * text parts would prepend narration like "I'll look that up." to the answer.
 */
function finalStepText(messages: readonly UIMessage[]) {
  const message = messages.findLast((m) => m.role === "assistant");
  if (!message) {
    return null;
  }
  const lastStep = message.parts.findLastIndex((part) => part.type === "step-start");
  const text = message.parts
    .slice(lastStep + 1)
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim();
  return text || null;
}
