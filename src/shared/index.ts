/** Lifecycle of a job as the pulse surface shows it. */
export type RunPhase =
  | "routing"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "error"
  | "aborted"
  | "interrupted";

/**
 * Agent loops a job can run on, mapped to the job agent's route name (its
 * class name in kebab case), which the job window connects to. Only Think
 * today; see src/server/harnesses.ts.
 */
export const JOB_HARNESSES = { think: "job-agent" } as const;
export type JobHarness = keyof typeof JOB_HARNESSES;

export interface RunSummary {
  activity: string | null;
  /** Set once the run has a role; absent for runs from before harnesses were recorded, which ran on Think. */
  harness?: JobHarness;
  completedAt: number | null;
  error: string | null;
  phase: RunPhase;
  prompt: string;
  /** Null while the run is routing and no role has been picked yet. */
  roleId: string | null;
  runId: string;
  /** Set when a schedule started the run. */
  scheduleId?: string;
  /** The app a member started the run from over MCP ("Claude"), as the app named itself. */
  via?: string;
  /** Names of the files attached when the job was sent. */
  files?: string[];
  /** Estimated model cost so far, in USD (see estimateCostUsd). */
  costUsd?: number;
  /** The router was not sure which role fits, so the fallback role took the job. */
  routedUnsure?: boolean;
  /**
   * Who started it: the member who sent it, or the schedule's creator.
   * Absent on runs from before this was recorded.
   */
  startedBy?: string;
  /**
   * False until the job agent exists; a run canceled, interrupted or failed
   * while routing never gets one. Absent on runs from before async dispatch,
   * which all started.
   */
  started?: boolean;
  startedAt: number;
  summary: string | null;
}

/** Ids of the server-side tools a role can be granted. */
export const TOOL_IDS = ["webSearch", "webFetch", "browser", "sendEmail"] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export interface ToolInfo {
  label: string;
  description: string;
  /** What using it costs, in plain words. */
  cost: string;
  /** Only runs on the Workers Paid plan. */
  needsWorkersPaid?: boolean;
  /** How to turn it on, for operators; absent for tools that are always on. */
  setup?: string;
  /** Where to finish a step setup.mjs cannot do. */
  link?: { href: string; label: string };
}

export const TOOL_INFO: Record<ToolId, ToolInfo> = {
  browser: {
    cost: "Browser Run time and Dynamic Workers",
    description: "A real browser for JavaScript sites, clicks, logins and screenshots; you can take over.",
    label: "Web browser",
    needsWorkersPaid: true,
    setup: "Run node setup.mjs --features and choose Web browser.",
  },
  sendEmail: {
    cost: "Email Service",
    description: "Sends email, always after your approval.",
    label: "Send email",
    link: { href: "https://developers.cloudflare.com/email-service/", label: "Set up a sending domain" },
    setup: "Add a domain to Cloudflare Email Service, then run node setup.mjs --features and choose Send email.",
  },
  webFetch: {
    cost: "included",
    description: "Reads web pages and documents as text.",
    label: "Read web pages",
  },
  webSearch: {
    cost: "per search, from AI Gateway credits or a search key",
    description: "Finds pages when a job has no URL.",
    label: "Search the web",
    link: { href: "https://dash.cloudflare.com/?to=/:account/ai/ai-gateway", label: "Open AI Gateway" },
    setup: "Run node setup.mjs --features and choose Search the web; it also needs AI Gateway credits or a search key.",
  },
};

/**
 * The last failure of an optional tool that points at its setup (missing
 * search credits, an email domain not onboarded), shown in the Settings
 * checklist until a later call succeeds.
 */
export interface FeatureFailure {
  at: number;
  message: string;
}

/** Which tools this deployment has configured; tools that are not available are never given to a job. */
export type Capabilities = Record<ToolId, boolean>;

/** What clients see of a role; the system prompt stays on the server. */
export interface RoleSummary {
  /** OKLCH hue in degrees, used for the role's accent color. */
  hue: number;
  id: string;
  name: string;
  purpose: string;
  suggestions: string[];
}

export interface RoleConfig extends RoleSummary {
  /**
   * Hosts webFetch and the browser may reach; `*.example.com` matches
   * subdomains only. Empty means any public host.
   */
  allowedHosts: string[];
  /**
   * Ids of the org's connections whose tools this role's jobs get. Empty by
   * default, so adding a connection never gives existing roles new tools.
   */
  connections: string[];
  /** Workers AI model for this role's jobs; null uses the org's job model. */
  model: string | null;
  /** Bundled Agent Skills this role's jobs may load, by name. */
  skills: string[];
  systemPrompt: string;
  tools: ToolId[];
}

/** A ready-made role an org can copy into its own roles. */
export interface RoleTemplate {
  id: string;
  name: string;
  purpose: string;
  skills: string[];
  tools: ToolId[];
}

/** A bundled Agent Skill, as the role editor and Settings list it. */
export interface SkillInfo {
  name: string;
  description: string;
  /** SPDX license id from skills.lock.json. */
  license: string | null;
  /** Upstream GitHub owner/repo. */
  source: string | null;
  /** The upstream commit it is pinned to, and its folder at that commit. */
  commit: string | null;
  path: string | null;
  /** Names of the org's roles that list it. */
  usedBy: string[];
}

/** Who serves a model: a vendor through the deployment's AI Gateway, or Workers AI directly. */
export type ModelProvider = "anthropic" | "openai" | "workers-ai";

/**
 * Models offered in settings. Vendor models go through the deployment's AI
 * Gateway and are offered only when that vendor is set up there (see
 * `providers` in OrgState). Workers AI models are open-weight models with
 * tool calling, from the catalog (checked 2026-10-21); `workersPaid` ones
 * fail on the Workers Free plan. Only `tested` ones have been run against
 * powerhouse's tools and approvals.
 */
export const MODELS = [
  { id: "anthropic/claude-opus-5-5", label: "Claude Opus 5.5", provider: "anthropic", tested: true, workersPaid: false, price: { input: 4, output: 20 }, contextWindow: 1_000_000 },
  { id: "anthropic/claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "anthropic", tested: false, workersPaid: false, price: { input: 2, output: 10 }, contextWindow: 1_000_000 },
  { id: "anthropic/claude-haiku-5-5", label: "Claude Haiku 5.5", provider: "anthropic", tested: false, workersPaid: false, price: { input: 0.1, output: 0.5 }, contextWindow: 1_000_000 },
  { id: "openai/gpt-6-sol", label: "GPT-6 Sol", provider: "openai", tested: false, workersPaid: false, price: { input: 2, output: 10 }, contextWindow: 1_050_000 },
  { id: "openai/gpt-6-luna", label: "GPT-6 Luna", provider: "openai", tested: false, workersPaid: false, price: { input: 0.1, output: 0.5 }, contextWindow: 1_050_000 },
  { id: "@cf/moonshotai/kimi-k2.7-code", label: "Kimi K2.7 Code", provider: "workers-ai", tested: true, workersPaid: true, price: { input: 0.95, output: 4 }, contextWindow: 262_144 },
  { id: "@cf/moonshotai/kimi-k2.6", label: "Kimi K2.6", provider: "workers-ai", tested: false, workersPaid: true, price: { input: 0.95, output: 4 }, contextWindow: 262_144 },
  { id: "@cf/zai-org/glm-5.3", label: "GLM 5.3", provider: "workers-ai", tested: false, workersPaid: true, price: { input: 1.4, output: 4.4 }, contextWindow: 1_048_576 },
  { id: "@cf/zai-org/glm-5.3-flash", label: "GLM 5.3 Flash", provider: "workers-ai", tested: false, workersPaid: true, price: { input: 0.15, output: 0.5 }, contextWindow: 1_048_576 },
  {
    id: "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
    label: "DeepSeek V4.1 Flash",
    provider: "workers-ai",
    tested: false,
    workersPaid: true, price: { input: 0.3, output: 1.2 }, contextWindow: 1_048_576 },
  { id: "@cf/qwen/qwen3.8-27b", label: "Qwen 3.8 27B", provider: "workers-ai", tested: false, workersPaid: false, price: { input: 0.45, output: 3.2 }, contextWindow: 262_144 },
] as const satisfies readonly {
  id: string;
  label: string;
  provider: ModelProvider;
  tested: boolean;
  workersPaid: boolean;
  /** List price in USD per million input and output tokens, checked 2026-10-21. */
  price: { input: number; output: number };
  /** Input tokens the model accepts, from the vendor's or Workers AI's model page, checked 2026-10-22. */
  contextWindow: number;
}[];

export type ModelId = (typeof MODELS)[number]["id"];
/** The open-weight model used when no vendor is set up, and for the backup router. */
export const DEFAULT_MODEL: ModelId = "@cf/moonshotai/kimi-k2.7-code";
/** The job model setting that picks the best model the deployment can reach. */
export const AUTO_MODEL = "auto";
export type JobModelSetting = ModelId | typeof AUTO_MODEL;

/** Preferred jobs model per vendor, in the order "auto" tries them. */
const AUTO_ORDER: readonly ModelId[] = ["anthropic/claude-opus-5-5", "openai/gpt-6-sol"];

export function modelInfo(id: string) {
  return MODELS.find((m) => m.id === id);
}

/** The vendor's cheapest model, which summarizes a job's older steps; open models summarize themselves. */
const SUMMARY_MODELS: Partial<Record<ModelProvider, ModelId>> = {
  anthropic: "anthropic/claude-haiku-5-5",
  openai: "openai/gpt-6-luna",
};

export function summaryModelFor(id: string): string {
  const provider = modelInfo(id)?.provider;
  return (provider && SUMMARY_MODELS[provider]) ?? id;
}

/**
 * Estimated USD cost of some token usage at the model's list price. Cached
 * input is counted at the full input price, so this errs high. It leaves out
 * what is not billed per token (Browser Run time, web searches).
 */
export function estimateCostUsd(modelId: string, usage: { inputTokens?: number; outputTokens?: number }) {
  const price = modelInfo(modelId)?.price;
  if (!price) {
    return 0;
  }
  return ((usage.inputTokens ?? 0) * price.input + (usage.outputTokens ?? 0) * price.output) / 1_000_000;
}

/**
 * The model a job runs on. A vendor model whose vendor is not set up (keys
 * removed, gateway gone) is treated like "auto", so a job never fails on a
 * stale setting.
 */
export function resolveModel(setting: string | null | undefined, providers: readonly ModelProvider[]): ModelId {
  const chosen = setting ? modelInfo(setting) : undefined;
  if (chosen && (chosen.provider === "workers-ai" || providers.includes(chosen.provider))) {
    return chosen.id;
  }
  return AUTO_ORDER.find((id) => providers.includes(modelInfo(id)?.provider as ModelProvider)) ?? DEFAULT_MODEL;
}

/** Org-wide settings, edited in the Settings sheet and synced to every client. */
export interface OrgSettings {
  /** Ask before every browser action, in addition to email approvals. */
  approveBrowserActions: boolean;
  /** Route prompts with a model; when off, unrouted prompts go to fallbackRoleId. */
  autoRoute: boolean;
  /** Hosts no role may read with webFetch, on top of each role's allowed sites. */
  blockedHosts: string[];
  /** What the organization does, for whom and how it talks; added to every job's instructions. */
  companyProfile: string;
  /** Short answers that lead with the result, added to every job's instructions. */
  conciseAnswers: boolean;
  /** Members may start and read their jobs from MCP clients (Claude, ChatGPT, Cursor) at /mcp. Off by default. */
  mcpServer: boolean;
  /**
   * Dictation in the composer and answers read aloud, on Workers AI (billed
   * per use). Off by default: on Workers Free, its usage shares the daily
   * free allocation with routing.
   */
  voice: boolean;
  /** Role that unrouted prompts go to, and the router's fallback. */
  fallbackRoleId: string;
  /** Finished runs kept in history; live runs are always kept. */
  historyLimit: number;
  /** "auto" runs the best model the deployment can reach: Claude, then GPT, then an open model. */
  jobModel: JobModelSetting;
  maxConcurrentJobs: number;
  /** Model calls per turn before a job must stop and answer. */
  maxSteps: number;
  /** Shown in the header instead of the Access team id. */
  orgName: string;
  routerModel: ModelId;
  /** IANA time zone schedules run in; empty until someone sets it (schedules then use UTC). */
  timeZone: string;
  /** The organization's website (https), for jobs and for suggestions that use {website}. Empty when not set. */
  website: string;
  /**
   * The GitHub repository a Deploy to Cloudflare copy lives in ("owner/name"),
   * for update links. Empty when not set or for setup.mjs deployments.
   */
  repository: string;
  /**
   * A backstop under the AI Gateway's own spend limits: once the day's
   * estimated spend reaches it, scheduled runs are skipped. 0 turns it off.
   */
  dailyBudgetUsd: number;
}

export const SETTINGS_LIMITS = {
  dailyBudgetUsd: { max: 100_000, min: 0 },
  blockedHosts: 100,
  companyProfile: 4000,
  website: 200,
  historyLimit: { max: 200, min: 10 },
  maxConcurrentJobs: { max: 10, min: 1 },
  maxSteps: { max: 20, min: 2 },
  orgName: 60,
} as const;

/** Settings a job snapshots at dispatch, so later edits never change a running job. */
export interface JobSettings {
  approveBrowserActions: boolean;
  blockedHosts: string[];
  /** Absent for jobs dispatched before the company profile existed. */
  companyProfile?: string;
  /** Absent for jobs dispatched before concise answers existed, which ran without them. */
  conciseAnswers?: boolean;
  /**
   * Who started the job (lowercase email), sent to the AI Gateway as the
   * `member` metadata key so spend limits can be split per member. Absent for
   * older jobs and for scheduled runs from before it existed.
   */
  member?: string;
  /** Absent when the organization has not set one. */
  website?: string;
  maxSteps: number;
  model: string;
}

export const ROLE_LIMITS = {
  allowedHosts: 50,
  connections: 10,
  name: 60,
  purpose: 200,
  skills: 10,
  suggestion: 200,
  suggestions: 5,
  systemPrompt: 8000,
} as const;

/** State the Org agent syncs to every connected pulse client. */
export interface OrgState {
  /**
   * How this deployment was set up: "cli" with setup.mjs (settings in
   * wrangler.local.jsonc), or "browser" with Finish setup after Deploy to
   * Cloudflare (tools needing bindings are added to the repo's wrangler.jsonc).
   */
  setupKind: "cli" | "browser";
  /**
   * Who may change settings, roles and connections, and act on anyone's jobs
   * and schedules (lowercase emails). Everyone else is a member.
   */
  admins: string[];
  capabilities: Capabilities;
  /** Org-owned MCP connections, newest first. */
  connections: ConnectionInfo[];
  /** Vendors this deployment's AI Gateway can reach, besides Workers AI, which is always there. */
  providers: ModelProvider[];
  /** How the gateway is paid for, from setup: the person's own keys, or Cloudflare credits. */
  aiBilling: "keys" | "credits" | null;
  /** Estimated model spend on one day (in the org's time zone), in USD. */
  spend: { date: string; usd: number };
  /**
   * Whether the AI Gateway had spend limits when setup last looked; null
   * when setup has not checked. Budgets belong on the gateway.
   */
  spendLimits: boolean | null;
  /** The latest setup problem per vendor, from a failed job or a Settings test; cleared by a success. */
  modelHealth: Partial<Record<ModelProvider, FeatureFailure>>;
  /** Web Push keys are configured, so members can turn on notifications. */
  push: boolean;
  /** Recurring jobs, oldest first. */
  schedules: ScheduleInfo[];
  featureHealth: Partial<Record<ToolId, FeatureFailure>>;
  /** A new org has not picked its roles yet; clients show the team picker. */
  teamPending: boolean;
  roles: RoleSummary[];
  runs: RunSummary[];
  settings: OrgSettings;
  /** Team memory notes jobs proposed that wait for an admin. */
  memoryProposals: number;
  /** The Access bypass MCP clients need exists (setup or Settings added it); see Settings > Use from other apps. */
  mcpAccessReady: boolean;
}

/**
 * A team memory note: something the team wants every job to know. Jobs
 * propose notes; only approved ones reach jobs, and only admins approve.
 */
export interface MemoryInfo {
  id: string;
  title: string;
  content: string;
  status: "proposed" | "approved";
  /** Who proposed it: the member whose job proposed it, or the admin who wrote it. */
  proposedBy: string;
  /** The job that proposed it; null when an admin wrote it in Settings. */
  runId: string | null;
  approvedBy: string | null;
  createdAt: number;
  updatedAt: number;
}

export const MEMORY_LIMITS = { approved: 500, content: 1000, proposed: 100, title: 80 } as const;

/**
 * Files attached to a job: converted to Markdown when uploaded (Workers AI
 * Markdown Conversion, as the SDK's web_fetch does), kept as text only.
 * `bytes` matches web_fetch's default cap; `chars` bounds the stored text.
 */
export const UPLOAD_LIMITS = { bytes: 5_000_000, chars: 2_000_000, files: 5, name: 120 } as const;

/** An uploaded file, before and after it is attached to a job. */
export interface AttachmentInfo {
  id: string;
  name: string;
  /** Length of its text, in characters. */
  chars: number;
}

/** Read-aloud stops here (Aura 1 bills per character: about $0.06 at most). */
export const VOICE_SPEAK_CHARS = 4000;

/**
 * An answer as it should sound: Markdown's marks, code and links left out,
 * so the voice reads words, not symbols.
 */
export function speakableText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " (code left out) ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.|>)\s+/gm, "")
    .replace(/[*_~|]+/g, "")
    .replace(/\n{2,}/g, ".\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export interface JobInput {
  prompt: string;
  role: RoleConfig;
  settings: JobSettings;
  /** For a scheduled run: what the schedule's last completed run reported. */
  previousReport?: PreviousReport;
  /** Files the member attached; the job reads them with read_attachment. */
  attachments?: AttachmentInfo[];
}

export interface PreviousReport {
  /** When that run started, written out in the org's time zone. */
  when: string;
  summary: string;
}

/** The roles a new org starts with: default roles to keep and library templates to add. */
export interface TeamChoice {
  keep: string[];
  add: string[];
}

/**
 * Returned as soon as the run is listed: routing and starting the job happen
 * afterwards, and the run's row in Org state shows how they went.
 */
export interface DispatchResult {
  runId: string;
}

export const LIVE_PHASES: ReadonlySet<RunPhase> = new Set([
  "routing",
  "running",
  "awaiting_approval",
]);

/**
 * Remote MCP servers offered in Settings. Each signs in with OAuth dynamic
 * client registration (or needs no sign-in), checked 2026-10-21, except
 * GitHub, whose sign-in has no registration endpoint (checked 2026-10-22):
 * it uses a GitHub App the org creates (`setup`).
 */
export interface CatalogConnection {
  id: string;
  name: string;
  description: string;
  url: string;
  /** False for servers that need no sign-in, so no sign-in window opens. */
  signIn: boolean;
  /**
   * "github-app": the server has no dynamic registration, so Settings first
   * creates a GitHub App for the org through GitHub's manifest flow.
   */
  setup?: "github-app";
}

export const CONNECTION_CATALOG: readonly CatalogConnection[] = [
  { description: "Issues, projects and cycles.", id: "linear", name: "Linear", signIn: true, url: "https://mcp.linear.app/mcp" },
  { description: "Pages and databases in your workspace.", id: "notion", name: "Notion", signIn: true, url: "https://mcp.notion.com/mcp" },
  {
    description: "Jira issues and Confluence pages.",
    id: "atlassian",
    name: "Atlassian",
    signIn: true,
    url: "https://mcp.atlassian.com/v1/mcp",
  },
  { description: "Errors and performance issues.", id: "sentry", name: "Sentry", signIn: true, url: "https://mcp.sentry.dev/mcp" },
  {
    description: "Repositories, issues and pull requests, through a GitHub App you create in one click.",
    id: "github",
    name: "GitHub",
    setup: "github-app",
    signIn: true,
    url: "https://api.githubcopilot.com/mcp/",
  },
  {
    description: "Search Cloudflare's developer documentation. No sign-in.",
    id: "cloudflare-docs",
    name: "Cloudflare docs",
    signIn: false,
    url: "https://docs.mcp.cloudflare.com/mcp",
  },
];

/** Who added a connection and when; its live state comes from the MCP state broadcast. */
export interface ConnectionInfo {
  /** The MCP server id. */
  id: string;
  name: string;
  url: string;
  /** Null for a custom URL. */
  catalogId: string | null;
  addedBy: string;
  addedAt: number;
  /** Signs in with the org's own OAuth app (a GitHub App, or one entered by hand) instead of registering one. */
  ownApp: boolean;
  /** For a GitHub App: where to choose which repositories it reaches. */
  installUrl: string | null;
}

/** A connection tool as Org hands it to a job, which builds an AI SDK tool from it. */
export interface ConnectionToolInfo {
  connectionId: string;
  connectionName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  name: string;
  /** The server declares it read-only (`readOnlyHint`); every other tool needs approval. */
  readOnly: boolean;
}

/**
 * When a schedule repeats, in the org's time zone. Times are "HH:MM", 24-hour.
 * Days are 0 (Sunday) to 6 (Saturday).
 */
export type ScheduleRule =
  | { kind: "daily"; time: string }
  | { kind: "weekdays"; time: string }
  | { kind: "weekly"; days: number[]; time: string }
  | { kind: "hourly"; every: number };

export const SCHEDULE_LIMITS = {
  /** Shortest "every N hours", so a forgotten schedule cannot run up costs quickly. */
  minHours: 1,
  maxHours: 168,
  prompt: 4000,
  schedules: 20,
} as const;

/** What a schedule's last run did; a skipped run never started a job. */
export interface ScheduleOutcome {
  at: number;
  /** The run, when a job was started. */
  runId: string | null;
  /** Why no job was started. */
  skipped: string | null;
}

/** A recurring job, as clients list and edit it. */
export interface ScheduleInfo {
  id: string;
  prompt: string;
  roleId: string;
  rule: ScheduleRule;
  enabled: boolean;
  /** Next run, or null while paused. */
  nextRunAt: number | null;
  last: ScheduleOutcome | null;
  createdBy: string;
  createdAt: number;
}

/** What a push notification carries; the service worker shows it and opens the run on click. */
export interface PushPayload {
  title: string;
  body: string;
  runId: string;
}

/** Someone who has signed in, as admins see them in Settings > Members. */
export interface MemberInfo {
  email: string;
  admin: boolean;
  /** Named in setup's ADMIN_EMAILS: always an admin, changed only by setup. */
  fromSetup: boolean;
  firstSeen: number;
  lastSeen: number;
}

/** Who approved or declined a tool call in a job. */
export interface ApprovalRecord {
  approved: boolean;
  at: number;
  /** The member's email. */
  by: string;
}

/**
 * Role suggestions are plain lines a role keeps (one per line in the role
 * editor). A line may start with tags naming tools it needs, such as
 * "[web search]", and may use {website} and {me}; it shows only when those
 * are available, so a role offers a first run that works on this deployment.
 */
const SUGGESTION_TAGS: Record<string, ToolId> = {
  browser: "browser",
  email: "sendEmail",
  "web search": "webSearch",
};

export interface SuggestionContext {
  capabilities: Capabilities;
  /** The signed-in member's email, for {me}. */
  me: string;
  /** The org's website, for {website}; empty when not set. */
  website: string;
}

/** A suggestion line as it reads on screen, or null when it cannot run here. */
export function resolveSuggestion(line: string, ctx: SuggestionContext): string | null {
  let text = line.trim();
  for (let tag = /^\[([a-z ]+)\]\s*/i.exec(text); tag; tag = /^\[([a-z ]+)\]\s*/i.exec(text)) {
    const tool = SUGGESTION_TAGS[(tag[1] ?? "").toLowerCase()];
    if (!tool || !ctx.capabilities[tool]) {
      return null;
    }
    text = text.slice(tag[0].length);
  }
  if (text.includes("{website}") && !ctx.website) {
    return null;
  }
  text = text.replaceAll("{website}", ctx.website).replaceAll("{me}", ctx.me);
  return text || null;
}

/** The lines of a role that can run here, ready to show. */
export function runnableSuggestions(lines: string[], ctx: SuggestionContext): string[] {
  return lines.map((line) => resolveSuggestion(line, ctx)).filter((s): s is string => s !== null);
}

/** Where powerhouse releases come from (GitHub owner/repo). */
export const POWERHOUSE_REPO = "frankievalentine/powerhouse";

/** Whether version b (semver, an optional leading "v") is newer than a. */
export function isNewerVersion(a: string, b: string) {
  const parts = (v: string) => v.replace(/^v/, "").split(/[.-]/).slice(0, 3).map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) {
    if ((y[i] ?? 0) !== (x[i] ?? 0)) {
      return (y[i] ?? 0) > (x[i] ?? 0);
    }
  }
  return false;
}

/** The running version and the latest powerhouse release, for Settings > Status. */
export interface UpdateStatus {
  current: string;
  /** Null when GitHub could not be reached or there are no releases yet. */
  latest: { version: string; url: string } | null;
  updateAvailable: boolean;
}

export * from "./update-workflow";
