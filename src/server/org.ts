import {
  AUTO_MODEL,
  CONNECTION_CATALOG,
  type ConnectionInfo,
  type ConnectionToolInfo,
  DEFAULT_MODEL,
  type DispatchResult,
  isNewerVersion,
  type JobInput,
  type MemberInfo,
  POWERHOUSE_REPO,
  type UpdateStatus,
  type ModelProvider,
  type AttachmentInfo,
  LIVE_PHASES,
  MEMORY_LIMITS,
  type MemoryInfo,
  MODELS,
  type OrgSettings,
  type OrgState,
  type PushPayload,
  type RoleConfig,
  type RoleSummary,
  type RoleTemplate,
  type RunPhase,
  resolveModel,
  type RunSummary,
  SCHEDULE_LIMITS,
  type ScheduleInfo,
  type SkillInfo,
  type TeamChoice,
  TOOL_IDS,
  type ToolId,
  UPLOAD_LIMITS,
} from "../shared";
import {
  Agent,
  type AgentToolLifecycleResult,
  type AgentToolRunInfo,
  type Connection,
  type ConnectionContext,
  callable,
  getCurrentAgent,
} from "agents";
import { generateText } from "ai";
import { withVoiceInput, WorkersAINova3STT } from "agents/voice";
import { createWorkersAI } from "workers-ai-provider";
import { MEMBER_EMAIL_HEADER } from "./auth";
import { applyDeploymentConfig, deployment } from "./deployment";
import { devEmail } from "./dev";
import { capabilitiesFor, providersFor, vapidFor } from "./capabilities";
import { gatewayModel, modelSetupFailure, TEST_MODELS } from "./models";
import { harnessFor, JOB_CLASS_NAMES, jobClassFor } from "./harnesses";
import { ftsQuery, validMemory } from "./memory";
import {
  convertGitHubManifest,
  GITHUB_MCP_URL,
  githubAppManifest,
  githubManifestTarget,
  type OAuthClient,
  PreregisteredOAuthProvider,
} from "./oauth-clients";
import {
  DEFAULT_ROLE_ID,
  DEFAULT_ROLES,
  libraryTemplates,
  ROLE_LIBRARY,
  type RoleInput,
  roleIdFor,
  RETIRED_SUGGESTIONS,
  roleInput,
} from "./roles";
import { clefRoute, ROUTE_CONFIDENCE, routeRequest } from "./router";
import { isTimeZone, nextRunAt } from "./schedule-rules";
import { MISSED_RUN_GRACE_MS, SCHEDULE_LABELS, type ScheduleInput, type StoredSchedule, scheduleInput } from "./schedules";
import { defaultSettings, SETTINGS_LABELS, type SettingsInput, settingsInput } from "./settings";
import { type PushOptions, type PushSubscriptionJSON, pushEndpoint, sendPush, validKey } from "./web-push";
import { suggestSkills } from "./clef";
import { skillCatalog } from "./skills";
import { knownTools } from "./tools";
import { TRACE_NAMES, tracedAI } from "./tracing";
import { safeError } from "./log";

/** Role fields as the roles editor labels them, for validation messages. */
const ROLE_LABELS: Record<string, string> = {
  allowedHosts: "Allowed sites",
  hue: "Color",
  model: "Model",
  name: "Name",
  purpose: "Purpose",
  suggestions: "Suggestions",
  systemPrompt: "Instructions",
  tools: "Tools",
};

const KNOWN_MODELS: ReadonlySet<string> = new Set(MODELS.map((m) => m.id));

interface RoleRow {
  config: string;
  id: string;
  position: number;
}

/** The same shape as the SDK's generated run ids: 12 URL-safe characters. */
function newRunId() {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => alphabet[byte % alphabet.length]).join("");
}

/** How long a job's connection call waits for Org to restore its connections after a wake. */
const CONNECTION_WAIT_MS = 10_000;

const DAY_SECONDS = 86_400;

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/** Shortest time between two model tests from Settings. */
const MODEL_TEST_COOLDOWN_MS = 30_000;

/** Roles are broadcast to every member and offered to the router, so their number is bounded. */
const MAX_ROLES = 50;

/** Longest text a run row keeps, since rows are broadcast to every member. */
const RUN_TEXT_LIMITS = { activity: 300, error: 2000, prompt: 4000, summary: 4000 } as const;

/** A run routing for longer than this when the Org starts is given up rather than routed again. */
const ROUTING_RESUME_MS = 10 * 60_000;

/** Push devices kept per member, and how long one lasts after its member was last here. */
const PUSH_DEVICES_PER_MEMBER = 5;
const PUSH_DEVICE_TTL_MS = 30 * DAY_SECONDS * 1000;
/** Most notifications one event sends, inside a Worker's subrequest limit. */
const PUSH_FANOUT = 40;



interface PushRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Notification text is short and single-line. */
function clip(text: string, max: number) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Setup failure messages as earlier versions saved them, and how they read now (see tools.ts). */
const SHORTENED_FAILURES: Record<string, string> = {
  "AI Gateway has no credits and no search provider key, so searches fail. Add AI Gateway credits or store a provider key on the gateway.":
    "No AI Gateway credits or search provider key.",
  "The AI Gateway used for search does not exist. Create it in AI Gateway.": "The AI Gateway used for search does not exist.",
  "The search provider key is missing from AI Gateway. Store it on the gateway.": "The search provider key is missing from AI Gateway.",
  "This account is not allowed to use web search. Check that AI Gateway is enabled.":
    "This account may not use web search; check that AI Gateway is on.",
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The latest powerhouse release on GitHub, or null (none yet, or unreachable). */
async function fetchLatestRelease(): Promise<UpdateStatus["latest"]> {
  try {
    const response = await fetch(`https://api.github.com/repos/${POWERHOUSE_REPO}/releases/latest`, {
      headers: { accept: "application/vnd.github+json", "user-agent": "powerhouse" },
    });
    if (!response.ok) {
      return null;
    }
    const release = (await response.json()) as { tag_name?: unknown; html_url?: unknown };
    return typeof release.tag_name === "string" && typeof release.html_url === "string"
      ? { url: release.html_url, version: release.tag_name.replace(/^v/, "") }
      : null;
  } catch {
    return null;
  }
}

/** A stored schedule without its alarm bookkeeping. */
/** "Mon, Oct 19, 9:00 AM" in the org's time zone (UTC until one is set). */
function formatReportTime(at: number, timeZone: string) {
  const when = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: timeZone || "UTC",
    weekday: "short",
  }).format(at);
  return timeZone ? when : `${when} UTC`;
}

interface MemoryRow {
  id: string;
  title: string;
  content: string;
  status: "proposed" | "approved";
  proposed_by: string;
  run_id: string | null;
  approved_by: string | null;
  created_at: number;
  updated_at: number;
}

function memoryInfo(row: MemoryRow): MemoryInfo {
  return {
    approvedBy: row.approved_by,
    content: row.content,
    createdAt: row.created_at,
    id: row.id,
    proposedBy: row.proposed_by,
    runId: row.run_id,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

/** Files uploaded but never sent with a job are deleted after this long. */
const UPLOAD_UNSENT_MS = 24 * 60 * 60_000;
/** Files one member may have waiting to be sent. */
const UPLOAD_PENDING_PER_MEMBER = 20;

/** How long a started GitHub App flow stays valid, like the code GitHub returns. */
const GITHUB_APP_STATE_MS = 60 * 60_000;

function githubInstallUrl(slug: string) {
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`;
}

/** Client credentials entered with a custom server: both or neither. */
function ownClient(clientId: unknown, clientSecret: unknown): OAuthClient | null {
  const id = typeof clientId === "string" ? clientId.trim() : "";
  const secret = typeof clientSecret === "string" ? clientSecret.trim() : "";
  if (!(id || secret)) {
    return null;
  }
  if (!(id && secret)) {
    throw new Error("Enter both the client ID and the client secret of the server's OAuth app, or neither.");
  }
  if (id.length > 200 || secret.length > 500) {
    throw new Error("That client ID or secret is too long.");
  }
  return { clientId: id, clientSecret: secret };
}

function publicSchedule({ alarmId: _alarmId, anchorAt: _anchorAt, lastReport: _lastReport, ...info }: StoredSchedule): ScheduleInfo {
  return info;
}

interface MemberRow {
  email: string;
  admin: number;
  first_seen: number;
  last_seen: number;
}

/** What Org keeps on each client connection. */
interface MemberConnectionState {
  email: string;
}

/**
 * The OAuth callback page, shown in the popup Settings opened. Settings
 * updates through the MCP state broadcast, so the page only reports the
 * result and closes itself on success.
 */
function oauthResultPage(result: { authSuccess: boolean; authError?: string }) {
  // authError can carry text from the provider.
  const escape = (text: string) =>
    text.replace(/[&<>"']/g, (c) => ({ '"': "&quot;", "&": "&amp;", "'": "&#39;", "<": "&lt;", ">": "&gt;" })[c] as string);
  const body = result.authSuccess
    ? "<p>Connected. You can close this window.</p><script>window.close()</script>"
    : `<p>Connecting failed: ${escape(result.authError ?? "unknown error")}</p><p>Close this window and try again from Settings.</p>`;
  return new Response(`<!doctype html><meta charset="utf-8"><title>powerhouse</title>${body}`, {
    headers: { "content-type": "text/html; charset=utf-8" },
    status: result.authSuccess ? 200 : 400,
  });
}

function firstIssue(error: { issues: { path: PropertyKey[]; message: string }[] }, labels: Record<string, string>) {
  const issue = error.issues[0];
  const field = issue ? (labels[String(issue.path[0])] ?? "Value") : "Value";
  return new Error(issue ? `${field}: ${issue.message}` : "Invalid value");
}

/**
 * One instance per org (one org per Access team): the fleet registry and
 * coordinator. Jobs run as JobAgent sub-agents dispatched through
 * runAgentTool, and their lifecycle is projected into state, which syncs to
 * every connected pulse client.
 */
/**
 * Org with the Agents SDK's voice input: the composer's microphone streams
 * to this agent, which transcribes with Workers AI (Deepgram Nova 3) and
 * sends the text back for the member to edit before sending.
 */
const VoiceInputAgent = withVoiceInput(Agent);

export class Org extends VoiceInputAgent<Env, OrgState> {
  /** Dictation (Settings > Jobs > Voice): Workers AI Nova 3, billed per minute, over this agent's socket. */
  transcriber = new WorkersAINova3STT(this.env.AI);

  /** A call starts only while voice is on, and only for a signed-in member. */
  beforeCallStart(connection: Connection) {
    return this.state.settings.voice && Boolean((connection as Connection<MemberConnectionState>).state?.email);
  }

  /** The client keeps the transcript and puts it in the composer; nothing is stored here. */
  onTranscript() {}

  initialState: OrgState = {
    admins: [],
    setupKind: "cli",
    capabilities: { browser: false, sendEmail: false, webFetch: true, webSearch: false },
    connections: [],
    aiBilling: null,
    featureHealth: {},
    modelHealth: {},
    providers: [],
    push: false,
    roles: [],
    runs: [],
    schedules: [],
    spend: { date: "", usd: 0 },
    spendLimits: null,
    settings: defaultSettings("org"),
    teamPending: false,
    memoryProposals: 0,
    mcpAccessReady: false,
  };

  /**
   * Cap on non-terminal agent-tool runs, kept in step with the
   * maxConcurrentJobs setting; over-cap dispatches are rejected, not queued. A
   * run parked on an approval is already terminal in the registry, so it does
   * not hold a slot, and neither does the turn that resumes after it.
   */
  maxConcurrentAgentTools = 10;

  /** When Settings last tested the models; in memory, which is enough for a cooldown. */
  #lastModelTest = 0;

  /**
   * Fleet state is server-owned. Clients may read it, but a client-sent state
   * update (useAgent's setState, or a raw cf_agent_state frame) could wipe or
   * forge every member's run history, roles and settings, so all of them are
   * rejected.
   */
  validateStateChange(_next: OrgState, source: Connection | "server") {
    if (source !== "server") {
      throw new Error("Org state can only be changed by the server.");
    }
  }

  /**
   * Roles and settings live in SQL. State carries the role summaries and the
   * settings every client needs; full role configs (prompts, tools, hosts) are
   * fetched on demand by the roles editor through listRoles.
   */
  async onStart() {
    // Settings saved by Finish setup, for deployments set up in the browser.
    const saved = await deployment(this.env).config();
    this.env = applyDeploymentConfig(this.env, saved);
    // The SDK keeps this in memory only, and an OAuth callback can arrive
    // after a restart (seen on the deploy), so it is set on every start.
    this.mcp.configureOAuthCallback({ customHandler: oauthResultPage });
    this.sql`CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY, catalog_id TEXT, added_by TEXT NOT NULL, added_at INTEGER NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, position INTEGER NOT NULL, config TEXT NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS schedules (id TEXT PRIMARY KEY, config TEXT NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS spend (date TEXT PRIMARY KEY, usd REAL NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS members (email TEXT PRIMARY KEY, admin INTEGER NOT NULL, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, email TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), config TEXT NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, status TEXT NOT NULL, proposed_by TEXT NOT NULL, run_id TEXT, approved_by TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`;
    // OAuth apps of the org's own, for servers without dynamic registration.
    this.sql`CREATE TABLE IF NOT EXISTS oauth_clients (server_id TEXT PRIMARY KEY, client_id TEXT NOT NULL, client_secret TEXT NOT NULL, app_slug TEXT, created_by TEXT NOT NULL, created_at INTEGER NOT NULL)`;
    // Files attached to jobs, as converted text; run_id is null until the job is sent.
    this.sql`CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, name TEXT NOT NULL, text TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, run_id TEXT)`;
    this.sql`CREATE TABLE IF NOT EXISTS github_app_states (state TEXT PRIMARY KEY, email TEXT NOT NULL, created_at INTEGER NOT NULL)`;
    // Approved notes only, so a proposal never reaches a job.
    this.sql`CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(id UNINDEXED, title, content)`;
    const [{ count } = { count: 0 }] = this.sql<{ count: number }>`SELECT COUNT(*) AS count FROM roles`;
    if (count === 0) {
      DEFAULT_ROLES.forEach((role, position) => {
        this.sql`INSERT INTO roles (id, position, config) VALUES (${role.id}, ${position}, ${JSON.stringify(role)})`;
      });
      // Only a brand-new org picks its team; orgs created before the picker
      // existed have no marker and are never asked.
      this.sql`INSERT OR REPLACE INTO meta (key, value) VALUES ('team_pending', '1')`;
    }
    const [pending] = this.sql<{ value: string }>`SELECT value FROM meta WHERE key = 'team_pending'`;
    let settings = this.settings();
    // The website entered in Finish setup, until someone sets one in Settings.
    if ((saved?.website && !settings.website) || (saved?.repository && !settings.repository)) {
      settings = {
        ...settings,
        repository: settings.repository || saved?.repository || "",
        website: settings.website || saved?.website || "",
      };
      this.sql`INSERT OR REPLACE INTO settings (id, config) VALUES (1, ${JSON.stringify(settings)})`;
    }
    this.maxConcurrentAgentTools = settings.maxConcurrentJobs;
    const capabilities = capabilitiesFor(this.env);
    // A redeploy can turn a feature off; its old failure no longer applies.
    // State saved before feature health existed has none.
    // Failures saved before the messages were shortened read like new ones.
    const featureHealth = Object.fromEntries(
      Object.entries(this.state.featureHealth ?? {})
        .filter(([id]) => capabilities[id as ToolId])
        .map(([id, failure]) => [id, failure && { ...failure, message: SHORTENED_FAILURES[failure.message] ?? failure.message }]),
    );
    // Routing runs in memory, so a run still routing when the Org starts was
    // cut off by an eviction or deploy. It is routed again below, unless it
    // has been stuck long enough that something other than a restart is wrong.
    const runs = this.state.runs.map((run) =>
      run.phase === "routing" && Date.now() - run.startedAt > ROUTING_RESUME_MS
        ? { ...run, completedAt: Date.now(), error: "Routing was interrupted. Send the job again.", phase: "interrupted" as const }
        : run,
    );
    this.setState({
      ...this.state,
      capabilities,
      featureHealth,
      aiBilling: this.env.AI_BILLING === "credits" ? "credits" : this.env.AI_GATEWAY_ID ? "keys" : null,
      // A vendor no longer set up has nothing to fix.
      modelHealth: Object.fromEntries(
        Object.entries(this.state.modelHealth ?? {}).filter(([vendor]) => providersFor(this.env).includes(vendor as ModelProvider)),
      ),
      providers: providersFor(this.env),
      push: vapidFor(this.env) !== null,
      spend: this.todaySpend(settings.timeZone),
      spendLimits: this.env.AI_SPEND_LIMITS === "on" ? true : this.env.AI_SPEND_LIMITS === "off" ? false : null,
      runs,
      settings,
      setupKind: saved ? "browser" : "cli",
      teamPending: pending?.value === "1",
      memoryProposals: this.memoryProposalCount(),
      mcpAccessReady: this.mcpAccessReady(),
    });
    this.publishRoles();
    this.publishConnections();
    this.publishAdmins();
    await this.reconcileSchedules();
    // runAgentTool with a run id it already knows returns without starting a
    // second job, so a run whose job did start before the restart is safe here.
    for (const run of runs.filter((r) => r.phase === "routing")) {
      void this.keepAliveWhile(() => this.startJob(run.runId, run.prompt, run.roleId ?? undefined));
    }
  }

  /**
   * The Worker sets the member header from the verified Access email (see
   * forwardMember), so it is kept on the connection for callables that
   * record who did something.
   */
  onConnect(connection: Connection<MemberConnectionState>, ctx: ConnectionContext) {
    const email = ctx.request.headers.get(MEMBER_EMAIL_HEADER)?.toLowerCase();
    if (email) {
      connection.setState({ email });
      this.recordMember(email);
      // A member who opens powerhouse keeps their devices' notifications on.
      this.sql`UPDATE push_subscriptions SET created_at = ${Date.now()} WHERE email = ${email}`;
    }
  }

  // ---------------------------------------------------------------- roles

  @callable()
  listRoles(): RoleConfig[] {
    return this.roles();
  }

  /**
   * Creates a role (no id) or updates one (existing id). Jobs already running
   * keep the role they were dispatched with.
   */
  @callable()
  saveRole(input: RoleInput): RoleConfig {
    this.requireAdmin();
    const parsed = roleInput.safeParse(input);
    if (!parsed.success) {
      throw firstIssue(parsed.error, ROLE_LABELS);
    }
    const { id: requestedId, ...fields } = parsed.data;
    const roles = this.roles();

    if (requestedId) {
      if (!roles.some((r) => r.id === requestedId)) {
        throw new Error(`Unknown role "${requestedId}".`);
      }
      const role: RoleConfig = { ...fields, id: requestedId };
      this.sql`UPDATE roles SET config = ${JSON.stringify(role)} WHERE id = ${requestedId}`;
      this.publishRoles();
      return role;
    }
    return this.insertRole(fields, roles);
  }

  /** Running jobs keep their snapshot of the role; the last role cannot be deleted. */
  @callable()
  deleteRole(id: string) {
    this.requireAdmin();
    const roles = this.roles();
    if (!roles.some((r) => r.id === id)) {
      throw new Error(`Unknown role "${id}".`);
    }
    if (roles.length === 1) {
      throw new Error("An org needs at least one role.");
    }
    this.sql`DELETE FROM roles WHERE id = ${id}`;
    // Keep the fallback pointing at a role that exists.
    if (this.state.settings.fallbackRoleId === id) {
      const next = this.roles()[0];
      if (next) {
        this.writeSettings({ ...this.state.settings, fallbackRoleId: next.id });
      }
    }
    this.publishRoles();
  }

  @callable()
  listLibrary(): RoleTemplate[] {
    return libraryTemplates();
  }

  /**
   * Skills that suit a role, for the role editor's suggestions, from the
   * Clef decision model. An empty list when it cannot say (the editor then
   * shows only the role's own skills).
   */
  @callable()
  async suggestSkills(role: { name: string; purpose: string }): Promise<string[]> {
    this.requireAdmin();
    const name = typeof role?.name === "string" ? role.name.slice(0, 100) : "";
    const purpose = typeof role?.purpose === "string" ? role.purpose.slice(0, 500) : "";
    if (!purpose.trim()) {
      return [];
    }
    try {
      const catalog = await skillCatalog([]);
      const picks = await suggestSkills(this.env.AI, { name, purpose }, catalog);
      return picks.map((pick) => pick.name);
    } catch (error) {
      console.warn("Suggesting skills failed", safeError(error));
      return [];
    }
  }

  @callable()
  listSkills(): Promise<SkillInfo[]> {
    return skillCatalog(this.roles());
  }

  /** Copies a library template into the org's roles; the copy is the org's to edit. */
  @callable()
  addFromLibrary(templateId: string): RoleConfig {
    this.requireAdmin();
    const template = ROLE_LIBRARY.find((t) => t.templateId === templateId);
    if (!template) {
      throw new Error(`Unknown template "${templateId}".`);
    }
    const { templateId: _templateId, ...fields } = template;
    return this.insertRole(fields, this.roles());
  }

  /**
   * A new org's first member picks its starting roles: which default roles
   * to keep and which library templates to add. The fallback role is always
   * kept. Calls are serialized by the Durable Object, so when two members
   * pick at once the second is told the team is already chosen.
   */
  @callable()
  chooseTeam(choice: TeamChoice): RoleConfig[] {
    this.requireAdmin();
    if (!this.state.teamPending) {
      throw new Error("Your team has already been picked. Add or remove roles in the Roles sheet.");
    }
    const keep = new Set(Array.isArray(choice?.keep) ? choice.keep.filter((id) => typeof id === "string") : []);
    const add = [...new Set(Array.isArray(choice?.add) ? choice.add.filter((id) => typeof id === "string") : [])];
    const unknown = add.filter((id) => !ROLE_LIBRARY.some((t) => t.templateId === id));
    if (unknown.length > 0) {
      throw new Error(`Unknown template "${unknown[0]}".`);
    }
    keep.add(this.state.settings.fallbackRoleId);
    for (const role of this.roles()) {
      if (!keep.has(role.id)) {
        this.sql`DELETE FROM roles WHERE id = ${role.id}`;
      }
    }
    for (const templateId of add) {
      const { templateId: _templateId, ...fields } = ROLE_LIBRARY.find((t) => t.templateId === templateId) as (typeof ROLE_LIBRARY)[number];
      this.insertRole(fields, this.roles());
    }
    this.sql`DELETE FROM meta WHERE key = 'team_pending'`;
    this.setState({ ...this.state, teamPending: false });
    this.publishRoles();
    return this.roles();
  }

  // ------------------------------------------------------------- settings

  /** Saves any subset of settings; the rest keep their current values. */
  @callable()
  saveSettings(input: SettingsInput): OrgSettings {
    this.requireAdmin();
    const parsed = settingsInput.safeParse(input);
    if (!parsed.success) {
      throw firstIssue(parsed.error, SETTINGS_LABELS);
    }
    if (parsed.data.fallbackRoleId && !this.roles().some((r) => r.id === parsed.data.fallbackRoleId)) {
      throw new Error(`Fallback role: unknown role "${parsed.data.fallbackRoleId}".`);
    }
    const timeZoneChanged = parsed.data.timeZone !== undefined && parsed.data.timeZone !== this.state.settings.timeZone;
    const settings = { ...this.state.settings, ...parsed.data };
    this.writeSettings(settings);
    // A smaller history window takes effect now, not on the next run update.
    this.publishRuns(this.state.runs);
    if (timeZoneChanged) {
      // Every schedule's next run moves with the zone.
      void this.keepAliveWhile(() => this.rearmAll());
    }
    return settings;
  }

  /** Removes every finished run from history and deletes its stored conversation. */
  @callable()
  clearHistory() {
    this.requireAdmin();
    const live = this.state.runs.filter((r) => LIVE_PHASES.has(r.phase));
    this.deleteJobs(this.state.runs.filter((r) => !LIVE_PHASES.has(r.phase)));
    this.setState({ ...this.state, runs: live });
    // Scheduled runs would otherwise keep quoting the history just cleared.
    for (const { lastReport, ...schedule } of this.storedSchedules()) {
      if (lastReport) {
        this.writeSchedule(schedule);
      }
    }
  }

  // ---------------------------------------------------------- connections

  /**
   * Adds a remote MCP server from the catalog or a custom https URL. Returns
   * the sign-in URL when the server needs OAuth; the client opens it in a
   * popup, and the provider redirects back to /agents/org/{orgId}/callback.
   */
  @callable()
  async addConnection(source: { catalogId: string } | { name: string; url: string; clientId?: string; clientSecret?: string }) {
    this.requireAdmin();
    const { connection } = getCurrentAgent<Org>();
    const member = connection as Connection<MemberConnectionState> | undefined;
    if (!member?.uri) {
      throw new Error("Connections can only be added from the app.");
    }
    const entry = "catalogId" in source ? CONNECTION_CATALOG.find((c) => c.id === source.catalogId) : undefined;
    if ("catalogId" in source && !entry) {
      throw new Error(`Unknown connection "${source.catalogId}".`);
    }
    if (entry?.setup === "github-app") {
      throw new Error("GitHub connects through a GitHub App: use Create the GitHub App in Settings > Connections.");
    }
    const ownApp = "url" in source ? ownClient(source.clientId, source.clientSecret) : null;
    let url: URL;
    try {
      url = new URL(entry?.url ?? ("url" in source ? source.url.trim() : ""));
    } catch {
      throw new Error("Enter the server's full URL, starting with https://.");
    }
    if (url.protocol !== "https:") {
      throw new Error("Connections must use https.");
    }
    if (this.mcp.listServers().some((server) => server.server_url === url.toString())) {
      throw new Error("That server is already connected.");
    }
    const name = (entry?.name ?? ("name" in source ? source.name.trim() : "")) || url.hostname;
    return this.connectServer({
      catalogId: entry?.id ?? null,
      // Explicit, so the OAuth redirect always returns to the hostname the
      // member is signed in on, which Access protects.
      callbackHost: new URL(member.uri).origin,
      client: ownApp,
      email: this.callerEmail(),
      name,
      url: url.toString(),
    });
  }

  /**
   * Adds the server under an id chosen here, so its own OAuth app (if any)
   * is stored before the SDK first asks the provider for client details.
   */
  private async connectServer(options: {
    catalogId: string | null;
    callbackHost: string;
    client: (OAuthClient & { slug?: string }) | null;
    email: string;
    name: string;
    url: string;
  }) {
    // Already in the SDK's normalized form (lowercase, starting with a
    // letter), so the server keeps exactly this id and its OAuth app is found.
    const id = `c-${newRunId().toLowerCase()}`;
    if (options.client) {
      this.sql`INSERT OR REPLACE INTO oauth_clients (server_id, client_id, client_secret, app_slug, created_by, created_at)
        VALUES (${id}, ${options.client.clientId}, ${options.client.clientSecret}, ${options.client.slug ?? null}, ${options.email}, ${Date.now()})`;
    }
    let result: Awaited<ReturnType<Org["addMcpServer"]>>;
    try {
      result = await this.addMcpServer(options.name.slice(0, 60), options.url, { callbackHost: options.callbackHost, id });
    } catch (error) {
      this.sql`DELETE FROM oauth_clients WHERE server_id = ${id}`;
      throw error;
    }
    this.sql`INSERT OR REPLACE INTO connections (id, catalog_id, added_by, added_at)
      VALUES (${result.id}, ${options.catalogId}, ${options.email}, ${Date.now()})`;
    this.publishConnections();
    return { authUrl: result.state === "authenticating" ? result.authUrl : null, id: result.id };
  }

  /** Servers with the org's own OAuth app sign in with it; every other server registers as before. */
  createMcpOAuthProvider(callbackUrl: string) {
    return new PreregisteredOAuthProvider(this.ctx.storage, this.name, callbackUrl, (serverId) => {
      const [row] = this.sql<{ client_id: string; client_secret: string }>`
        SELECT client_id, client_secret FROM oauth_clients WHERE server_id = ${serverId}`;
      return row ? { clientId: row.client_id, clientSecret: row.client_secret } : null;
    });
  }

  /**
   * The first step of connecting GitHub: what the client posts to GitHub to
   * create a private GitHub App from a manifest, owned by the admin's
   * account or by the GitHub organization they name. GitHub sends the admin
   * back to /api/github-app/created, which finishes in finishGitHubApp.
   */
  @callable()
  startGitHubApp(owner?: string) {
    this.requireAdmin();
    const { connection } = getCurrentAgent<Org>();
    const member = connection as Connection<MemberConnectionState> | undefined;
    if (!member?.uri) {
      throw new Error("Connections can only be added from the app.");
    }
    if (this.state.connections.some((c) => c.catalogId === "github")) {
      throw new Error("GitHub is already connected.");
    }
    const org = owner?.trim() || null;
    if (org && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(org)) {
      throw new Error("Enter the GitHub organization's name as it appears in its URL, or leave it empty for your own account.");
    }
    const origin = new URL(member.uri).origin;
    const state = newRunId() + newRunId();
    // One pending app at a time per org; an hour, like GitHub's code.
    this.sql`DELETE FROM github_app_states WHERE created_at < ${Date.now() - GITHUB_APP_STATE_MS}`;
    this.sql`INSERT INTO github_app_states (state, email, created_at) VALUES (${state}, ${this.callerEmail()}, ${Date.now()})`;
    return {
      action: githubManifestTarget(org, state),
      manifest: JSON.stringify(
        githubAppManifest({
          callbackUrl: `${origin}/agents/org/${this.name}/callback`,
          orgName: this.state.settings.orgName,
          origin,
          suffix: newRunId().slice(0, 4).toLowerCase(),
        }),
      ),
    };
  }

  /**
   * GitHub's redirect after the app was created, from the Worker route (so
   * the admin is signed in through Access). The state must be one this org
   * issued to this admin within the hour. Keeps only the client id and
   * secret, then adds the connection, which waits for sign-in. Not @callable.
   */
  async finishGitHubApp(code: string, state: string, email: string, origin: string) {
    const caller = email.toLowerCase();
    const [issued] = this.sql<{ email: string; created_at: number }>`SELECT email, created_at FROM github_app_states WHERE state = ${state}`;
    this.sql`DELETE FROM github_app_states WHERE state = ${state}`;
    if (!issued || issued.email !== caller || Date.now() - issued.created_at > GITHUB_APP_STATE_MS) {
      throw new Error("This link has expired or was started by someone else. Start again from Settings > Connections.");
    }
    if (!this.isAdmin(caller)) {
      throw new Error("Only admins can connect GitHub.");
    }
    if (this.state.connections.some((c) => c.catalogId === "github")) {
      throw new Error("GitHub is already connected.");
    }
    const app = await convertGitHubManifest(code);
    await this.connectServer({
      callbackHost: origin,
      catalogId: "github",
      client: app,
      email: caller,
      name: "GitHub",
      url: GITHUB_MCP_URL,
    });
    return { installUrl: githubInstallUrl(app.slug), owner: app.owner, slug: app.slug };
  }

  /** Reconnects with the stored tokens, or returns a new sign-in URL when they are gone. */
  @callable()
  async retryConnection(id: string) {
    this.requireAdmin();
    this.requireConnection(id);
    const result = await this.mcp.connectToServer(id);
    if (result.state === "authenticating") {
      return { authUrl: result.authUrl };
    }
    if (result.state === "failed") {
      throw new Error(result.error);
    }
    await this.mcp.discoverIfConnected(id);
    return { authUrl: null };
  }

  /** Deletes the server and its tokens here; the grant itself is revoked at the provider. */
  @callable()
  async removeConnection(id: string) {
    this.requireAdmin();
    this.requireConnection(id);
    await this.removeMcpServer(id);
    this.sql`DELETE FROM connections WHERE id = ${id}`;
    this.sql`DELETE FROM oauth_clients WHERE server_id = ${id}`;
    this.publishConnections();
  }

  /**
   * Called by a JobAgent over RPC each turn, with its role's connection ids.
   * Restoring connections after a wake is not awaited by the SDK, so this
   * waits for it. Connections that are not ready are named in `unavailable`
   * so the job can say so. Not @callable.
   */
  async connectionTools(ids: string[]): Promise<{ tools: ConnectionToolInfo[]; unavailable: string[] }> {
    if (ids.length === 0) {
      return { tools: [], unavailable: [] };
    }
    await this.mcp.waitForConnections({ timeout: CONNECTION_WAIT_MS });
    const { servers } = this.getMcpServers();
    const wanted = ids.filter((id) => servers[id]);
    const ready = new Set(wanted.filter((id) => servers[id]?.state === "ready"));
    const catalog = this.catalogConnectionIds();
    const tools = this.mcp
      .listTools()
      .filter((tool) => ready.has(tool.serverId))
      .map((tool) => ({
        connectionId: tool.serverId,
        connectionName: servers[tool.serverId]?.name ?? tool.serverId,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema as Record<string, unknown>,
        name: tool.name,
        // A server describes its own tools, so a malicious or compromised one
        // could call a destructive tool read-only to skip approval. Only
        // catalog servers are believed, and never for a tool that also says
        // it is destructive.
        readOnly:
          catalog.has(tool.serverId) &&
          tool.annotations?.readOnlyHint === true &&
          tool.annotations?.destructiveHint !== true,
      }));
    const unavailable = wanted.filter((id) => !ready.has(id)).map((id) => servers[id]?.name ?? id);
    return { tools, unavailable };
  }

  /** Called by a JobAgent's connection tools over RPC. Not @callable. */
  async callConnectionTool(connectionId: string, name: string, args: Record<string, unknown>) {
    await this.mcp.waitForConnections({ timeout: CONNECTION_WAIT_MS });
    const result = await this.mcp.callTool({ arguments: args, name, serverId: connectionId });
    return { content: result.content as unknown[], isError: result.isError === true };
  }

  // ---------------------------------------------------------- team memory

  /** Every note, proposals first. Members may read them; only admins change them. */
  @callable()
  listMemories(): MemoryInfo[] {
    return this.sql<MemoryRow>`SELECT * FROM memories ORDER BY status = 'approved', updated_at DESC`.map(memoryInfo);
  }

  /**
   * Adds a note (no id) or edits one. Saved by an admin, so it is approved:
   * editing a proposal approves it.
   */
  @callable()
  saveMemory(input: { id?: string; title?: string; content: string }): MemoryInfo {
    this.requireAdmin();
    const { content, title } = validMemory(input?.title, input?.content);
    const caller = this.callerEmail();
    const now = Date.now();
    const existing = input.id ? this.memoryRow(input.id) : null;
    if (input.id && !existing) {
      throw new Error("That note no longer exists.");
    }
    if (existing?.status !== "approved" && this.approvedMemoryCount() >= MEMORY_LIMITS.approved) {
      throw new Error(`Team memory holds up to ${MEMORY_LIMITS.approved} notes. Delete some first.`);
    }
    const id = existing?.id ?? newRunId();
    this.sql`INSERT OR REPLACE INTO memories (id, title, content, status, proposed_by, run_id, approved_by, created_at, updated_at)
      VALUES (${id}, ${title}, ${content}, 'approved', ${existing?.proposed_by ?? caller}, ${existing?.run_id ?? null}, ${caller}, ${existing?.created_at ?? now}, ${now})`;
    this.indexMemory(id, title, content);
    this.publishMemoryProposals();
    return memoryInfo(this.memoryRow(id) as MemoryRow);
  }

  @callable()
  approveMemory(id: string) {
    this.requireAdmin();
    const row = this.memoryRow(id);
    if (!row) {
      throw new Error("That note no longer exists.");
    }
    return this.saveMemory({ content: row.content, id, title: row.title });
  }

  /** Rejects a proposal or deletes a note. */
  @callable()
  deleteMemory(id: string) {
    this.requireAdmin();
    this.sql`DELETE FROM memories WHERE id = ${id}`;
    this.sql`DELETE FROM memories_fts WHERE id = ${id}`;
    this.publishMemoryProposals();
  }

  /** Approved notes matching free text, best first. Called by jobs over RPC; not @callable. */
  searchMemories(text: string, limit: number): Pick<MemoryInfo, "title" | "content">[] {
    const query = ftsQuery(text);
    if (!query) {
      return [];
    }
    return this.sql<{ title: string; content: string }>`
      SELECT m.title, m.content FROM memories_fts f JOIN memories m ON m.id = f.id
      WHERE memories_fts MATCH ${query} AND m.status = 'approved' ORDER BY f.rank LIMIT ${limit}`;
  }

  /** Called by jobs over RPC; not @callable. */
  approvedMemoryCount() {
    const [row] = this.sql<{ n: number }>`SELECT COUNT(*) AS n FROM memories WHERE status = 'approved'`;
    return row?.n ?? 0;
  }

  /**
   * A job's set_context call: a proposal an admin reviews, never a note jobs
   * see. The same title from the same job updates its proposal. Called by
   * jobs over RPC; not @callable. Returns what the model is told.
   */
  proposeMemory(runId: string, rawTitle: string, rawContent: string): string {
    let note: { title: string; content: string };
    try {
      note = validMemory(rawTitle, rawContent);
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
    const [same] = this.sql<{ id: string }>`SELECT id FROM memories WHERE status = 'approved' AND content = ${note.content}`;
    if (same) {
      return `Team memory already has this note.`;
    }
    const [own] = this.sql<{ id: string; created_at: number }>`
      SELECT id, created_at FROM memories WHERE status = 'proposed' AND run_id = ${runId} AND title = ${note.title}`;
    if (!own && this.memoryProposalCount() >= MEMORY_LIMITS.proposed) {
      return "The review list is full, so this note was not proposed. Tell the reader to ask an admin to review Settings > Team memory.";
    }
    const now = Date.now();
    this.sql`INSERT OR REPLACE INTO memories (id, title, content, status, proposed_by, run_id, approved_by, created_at, updated_at)
      VALUES (${own?.id ?? newRunId()}, ${note.title}, ${note.content}, 'proposed', ${this.run(runId)?.startedBy ?? "a job"}, ${runId}, NULL, ${own?.created_at ?? now}, ${now})`;
    this.publishMemoryProposals();
    return `Proposed "${note.title}" for team memory. An admin reviews it in Settings before jobs use it; say so if it matters to the reader.`;
  }

  private memoryRow(id: string) {
    const [row] = this.sql<MemoryRow>`SELECT * FROM memories WHERE id = ${id}`;
    return row ?? null;
  }

  private indexMemory(id: string, title: string, content: string) {
    this.sql`DELETE FROM memories_fts WHERE id = ${id}`;
    this.sql`INSERT INTO memories_fts (id, title, content) VALUES (${id}, ${title}, ${content})`;
  }

  private memoryProposalCount() {
    const [row] = this.sql<{ n: number }>`SELECT COUNT(*) AS n FROM memories WHERE status = 'proposed'`;
    return row?.n ?? 0;
  }

  private publishMemoryProposals() {
    const memoryProposals = this.memoryProposalCount();
    if (memoryProposals !== this.state.memoryProposals) {
      this.setState({ ...this.state, memoryProposals });
    }
  }

  // ------------------------------------------------------------ schedules

  /** Creates a schedule (no id) or updates one, and arms its next run. */
  @callable()
  async saveSchedule(input: ScheduleInput): Promise<ScheduleInfo> {
    const parsed = scheduleInput.safeParse(input);
    if (!parsed.success) {
      throw firstIssue(parsed.error, SCHEDULE_LABELS);
    }
    const { id, timeZone, ...fields } = parsed.data;
    // The first schedule sets the org's time zone from the browser of whoever
    // saves it; after that only admins change it, in Settings.
    if (!this.state.settings.timeZone && timeZone && isTimeZone(timeZone)) {
      this.writeSettings({ ...this.state.settings, timeZone });
    }
    if (!this.roles().some((r) => r.id === fields.roleId)) {
      throw new Error(`Role: unknown role "${fields.roleId}".`);
    }
    const existing = id ? this.storedSchedule(id) : null;
    if (id && !existing) {
      throw new Error("That schedule no longer exists.");
    }
    if (existing) {
      this.requireOwnerOrAdmin(existing.createdBy, "schedules");
    }
    if (!existing && this.storedSchedules().length >= SCHEDULE_LIMITS.schedules) {
      throw new Error(`An organization can have up to ${SCHEDULE_LIMITS.schedules} schedules.`);
    }
    const now = Date.now();
    const schedule: StoredSchedule = existing
      ? {
          ...existing,
          ...fields,
          // A report on a different job would mislead the next run.
          ...(existing.prompt !== fields.prompt || existing.roleId !== fields.roleId ? { lastReport: undefined } : {}),
          // A new rhythm starts from now; an unchanged one keeps its anchor.
          anchorAt: JSON.stringify(existing.rule) === JSON.stringify(fields.rule) ? existing.anchorAt : now,
        }
      : {
          ...fields,
          alarmId: null,
          anchorAt: now,
          createdAt: now,
          createdBy: this.callerEmail(),
          id: newRunId(),
          last: null,
          nextRunAt: null,
        };
    await this.arm(schedule);
    return publicSchedule(this.storedSchedule(schedule.id) ?? schedule);
  }

  @callable()
  async deleteSchedule(id: string) {
    const schedule = this.storedSchedule(id);
    if (!schedule) {
      return;
    }
    this.requireOwnerOrAdmin(schedule.createdBy, "schedules");
    if (schedule.alarmId) {
      await this.cancelSchedule(schedule.alarmId);
    }
    this.sql`DELETE FROM schedules WHERE id = ${id}`;
    this.publishSchedules();
  }

  /** Starts the schedule's job now; its next run stays where it was. */
  @callable()
  runScheduleNow(id: string): DispatchResult {
    const schedule = this.storedSchedule(id);
    if (!schedule) {
      throw new Error("That schedule no longer exists.");
    }
    this.requireOwnerOrAdmin(schedule.createdBy, "schedules");
    const skipped = this.scheduleBlocker(schedule);
    if (skipped) {
      throw new Error(skipped);
    }
    const runId = this.enqueueRun(schedule.prompt, schedule.roleId, schedule.id, this.callerEmail());
    this.writeSchedule({ ...schedule, last: { at: Date.now(), runId, skipped: null } });
    return { runId };
  }

  /**
   * Alarm callback for a schedule's next run. Records what happened (a run,
   * or why it was skipped) and arms the run after it. Public because the SDK
   * calls it by name; not @callable, so clients cannot.
   */
  async runSchedule(payload: { scheduleId: string; at: number }) {
    const schedule = this.storedSchedule(payload.scheduleId);
    // Deleted, paused, or re-armed for another time since this alarm was set.
    if (!schedule?.enabled || schedule.nextRunAt !== payload.at) {
      return;
    }
    const now = Date.now();
    let outcome: StoredSchedule["last"];
    if (now - payload.at > MISSED_RUN_GRACE_MS) {
      outcome = { at: now, runId: null, skipped: "Missed while powerhouse was unavailable." };
    } else {
      // Only runs the alarm starts: Run now is someone choosing to spend.
      const blocker = this.scheduleBlocker(schedule) ?? this.budgetBlocker();
      if (blocker) {
        outcome = { at: now, runId: null, skipped: blocker };
      } else {
        try {
          outcome = { at: now, runId: this.enqueueRun(schedule.prompt, schedule.roleId, schedule.id, schedule.createdBy), skipped: null };
        } catch (error) {
          outcome = { at: now, runId: null, skipped: error instanceof Error ? error.message : String(error) };
        }
      }
    }
    await this.arm({ ...schedule, alarmId: null, last: outcome });
  }

  /** The day's estimated spend so far, keyed by the date in the org's time zone. */
  private todaySpend(timeZone: string) {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || "UTC" }).format(Date.now());
    const [row] = this.sql<{ usd: number }>`SELECT usd FROM spend WHERE date = ${date}`;
    return { date, usd: row?.usd ?? 0 };
  }

  private addSpend(usd: number) {
    const today = this.todaySpend(this.state.settings.timeZone);
    const next = today.usd + usd;
    this.sql`INSERT OR REPLACE INTO spend (date, usd) VALUES (${today.date}, ${next})`;
    // Only the last few months are worth keeping.
    this.sql`DELETE FROM spend WHERE date < ${new Date(Date.now() - 100 * 86_400_000).toISOString().slice(0, 10)}`;
    this.setState({ ...this.state, spend: { date: today.date, usd: next } });
  }

  /** Why scheduled runs are paused for today, or null. */
  private budgetBlocker() {
    const budget = this.state.settings.dailyBudgetUsd;
    const spent = this.todaySpend(this.state.settings.timeZone).usd;
    return budget > 0 && spent >= budget
      ? `Today's estimated spend ($${spent.toFixed(2)}) reached the daily budget ($${budget.toFixed(2)}).`
      : null;
  }

  /** Why a schedule cannot start a job right now, or null. */
  private scheduleBlocker(schedule: StoredSchedule) {
    if (!this.roles().some((r) => r.id === schedule.roleId)) {
      return "Its role was deleted. Pick another role for this schedule.";
    }
    if (this.state.runs.some((r) => r.scheduleId === schedule.id && LIVE_PHASES.has(r.phase))) {
      return "The previous run was still going.";
    }

    return null;
  }

  /**
   * Cancels the schedule's alarm and, when it is on, sets one for its next
   * run in the org's time zone (UTC until one is set). Saves and publishes.
   */
  private async arm(schedule: StoredSchedule) {
    if (schedule.alarmId) {
      await this.cancelSchedule(schedule.alarmId);
    }
    let next: number | null = null;
    let alarmId: string | null = null;
    if (schedule.enabled) {
      next = nextRunAt(schedule.rule, this.state.settings.timeZone || "UTC", Date.now(), schedule.anchorAt);
      const alarm = await this.schedule(new Date(next), "runSchedule", { at: next, scheduleId: schedule.id });
      alarmId = alarm.id;
    }
    this.writeSchedule({ ...schedule, alarmId, nextRunAt: next });
  }

  private async rearmAll() {
    for (const schedule of this.storedSchedules()) {
      await this.arm(schedule);
    }
  }

  /**
   * Alarms are stored by the SDK and survive restarts; this repairs a
   * schedule whose alarm is missing (for example, deleted with the SDK's
   * own bookkeeping), so an enabled schedule always has a next run.
   */
  private async reconcileSchedules() {
    const alarms = new Set((await this.listSchedules({ type: "scheduled" })).map((alarm) => alarm.id));
    for (const schedule of this.storedSchedules()) {
      if (schedule.enabled && !(schedule.alarmId && alarms.has(schedule.alarmId))) {
        await this.arm({ ...schedule, alarmId: null });
      }
    }
    this.publishSchedules();
  }

  private storedSchedules(): StoredSchedule[] {
    return this.sql<{ config: string }>`SELECT config FROM schedules`.map((row) => JSON.parse(row.config) as StoredSchedule);
  }

  private storedSchedule(id: string) {
    const [row] = this.sql<{ config: string }>`SELECT config FROM schedules WHERE id = ${id}`;
    return row ? (JSON.parse(row.config) as StoredSchedule) : null;
  }

  private writeSchedule(schedule: StoredSchedule) {
    this.sql`INSERT OR REPLACE INTO schedules (id, config) VALUES (${schedule.id}, ${JSON.stringify(schedule)})`;
    this.publishSchedules();
  }

  private publishSchedules() {
    const schedules = this.storedSchedules()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(publicSchedule);
    this.setState({ ...this.state, schedules });
  }

  /** The verified email of the member making this call (see forwardMember). */
  private callerEmail() {
    const { connection } = getCurrentAgent<Org>();
    return ((connection as Connection<MemberConnectionState> | undefined)?.state?.email ?? "unknown").toLowerCase();
  }

  /**
   * Settings > Tools on a deployment set up in the browser: web search has no
   * binding, so it is switched here (setup.mjs deployments use --enable).
   * Jobs started afterwards get it.
   */
  @callable()
  async setWebSearch(on: boolean) {
    this.requireAdmin();
    if (this.state.setupKind !== "browser") {
      throw new Error("This deployment was set up with setup.mjs; turn web search on or off with node setup.mjs --enable web-search or --disable web-search.");
    }
    const saved = await deployment(this.env).setWebSearch(on === true);
    this.env = applyDeploymentConfig({ ...this.env, WEB_SEARCH: undefined } as Env, saved);
    this.setState({ ...this.state, capabilities: capabilitiesFor(this.env) });
  }

  /**
   * Settings > Status: the running version and whether a newer powerhouse
   * release exists. GitHub is asked at most once a day per org.
   */
  @callable()
  async updateStatus(): Promise<UpdateStatus> {
    const current = __APP_VERSION__;
    const [cached] = this.sql<{ value: string }>`SELECT value FROM meta WHERE key = 'latest_release'`;
    let latest = cached ? (JSON.parse(cached.value) as { at: number; release: UpdateStatus["latest"] }) : null;
    if (!latest || Date.now() - latest.at > DAY_MS) {
      latest = { at: Date.now(), release: await fetchLatestRelease() };
      this.sql`INSERT OR REPLACE INTO meta (key, value) VALUES ('latest_release', ${JSON.stringify(latest)})`;
    }
    return {
      current,
      latest: latest.release,
      updateAvailable: latest.release !== null && isNewerVersion(current, latest.release.version),
    };
  }

  // ------------------------------------------------------------ members

  /**
   * Everyone who has signed in, for admins: Access decides who may sign in,
   * powerhouse only who may change things.
   */
  @callable()
  listMembers(): MemberInfo[] {
    this.requireAdmin();
    const fromSetup = this.setupAdmins();
    return this.sql<MemberRow>`SELECT email, admin, first_seen, last_seen FROM members ORDER BY last_seen DESC`.map((row) => ({
      admin: row.admin === 1 || fromSetup.has(row.email),
      email: row.email,
      firstSeen: row.first_seen,
      fromSetup: fromSetup.has(row.email),
      lastSeen: row.last_seen,
    }));
  }

  /** Admins named in setup (ADMIN_EMAILS) stay admins; the last admin cannot be removed. */
  @callable()
  setAdmin(email: string, admin: boolean) {
    this.requireAdmin();
    const target = String(email).toLowerCase();
    if (this.setupAdmins().has(target)) {
      throw new Error(`${target} is an admin from setup (ADMIN_EMAILS); change it by rerunning setup with --admins.`);
    }
    const [row] = this.sql<{ email: string }>`SELECT email FROM members WHERE email = ${target}`;
    if (!row) {
      throw new Error("Only people who have signed in can be made admins.");
    }
    if (!admin && this.adminEmails().size <= 1 && this.adminEmails().has(target)) {
      throw new Error("Keep at least one admin.");
    }
    this.sql`UPDATE members SET admin = ${admin ? 1 : 0} WHERE email = ${target}`;
    this.publishAdmins();
  }

  /**
   * Called by a JobAgent over RPC when a member connects to a job: may they
   * act on it (follow up, approve, stop, take over)? The person who started
   * it and admins may; everyone else can watch. Not @callable.
   */
  jobAccess(runId: string, email: string) {
    const target = email.toLowerCase();
    return this.isAdmin(target) || this.run(runId)?.startedBy?.toLowerCase() === target;
  }

  private recordMember(email: string) {
    const now = Date.now();
    this.sql`INSERT INTO members (email, admin, first_seen, last_seen) VALUES (${email}, 0, ${now}, ${now})
      ON CONFLICT(email) DO UPDATE SET last_seen = ${now}`;
    // An org with no admin at all (one set up before admins existed, without
    // ADMIN_EMAILS) makes its first member to sign in the admin.
    if (this.adminEmails().size === 0) {
      this.sql`UPDATE members SET admin = 1 WHERE email = ${email}`;
    }
    this.publishAdmins();
  }

  /**
   * Emails from setup's ADMIN_EMAILS. In local dev the dev user is an admin
   * too, unless .dev.vars sets DEV_AS_MEMBER=on to try powerhouse as a member.
   */
  private setupAdmins() {
    const listed = (this.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (import.meta.env.DEV && (this.env as Env & { DEV_AS_MEMBER?: string }).DEV_AS_MEMBER !== "on") {
      listed.push(devEmail(this.env));
    }
    return new Set(listed);
  }

  private adminEmails() {
    const fromMembers = this.sql<{ email: string }>`SELECT email FROM members WHERE admin = 1`.map((row) => row.email);
    return new Set([...this.setupAdmins(), ...fromMembers]);
  }

  private isAdmin(email: string) {
    return this.adminEmails().has(email.toLowerCase());
  }

  private requireAdmin() {
    if (!this.isAdmin(this.callerEmail())) {
      throw new Error("Only admins can change this. An admin can add you in Settings > Members.");
    }
  }

  /** For things members own (their jobs, their schedules): the owner or an admin. */
  private requireOwnerOrAdmin(owner: string | undefined, what: "jobs" | "schedules") {
    const caller = this.callerEmail();
    if (!(this.isAdmin(caller) || (owner && owner.toLowerCase() === caller))) {
      throw new Error(`Only the person who started it or an admin can change other people's ${what}.`);
    }
  }

  private publishAdmins() {
    const admins = [...this.adminEmails()].sort();
    if (JSON.stringify(admins) !== JSON.stringify(this.state.admins)) {
      this.setState({ ...this.state, admins });
    }
  }

  // ------------------------------------------------------------- models

  /**
   * Settings' Test button: one tiny call per vendor through the gateway,
   * with the cheapest model, so a missing key or empty credits show up
   * before a job runs into them.
   */
  @callable()
  async testModels(): Promise<Partial<Record<ModelProvider, string | null>>> {
    this.requireAdmin();
    // Each test is a small paid call; one round at a time is plenty.
    if (Date.now() - this.#lastModelTest < MODEL_TEST_COOLDOWN_MS) {
      throw new Error("Tested a moment ago. Try again in half a minute.");
    }
    this.#lastModelTest = Date.now();
    const results: Partial<Record<ModelProvider, string | null>> = {};
    for (const vendor of this.state.providers) {
      if (vendor === "workers-ai") {
        continue;
      }
      try {
        await generateText({
          maxOutputTokens: 16,
          model: gatewayModel(this.env, TEST_MODELS[vendor]),
          prompt: "Reply with the word OK.",
        });
        results[vendor] = null;
      } catch (error) {
        console.warn(`[models] ${vendor} test failed`, safeError(error));
        results[vendor] = modelSetupFailure(error, vendor) ?? `The test call failed: ${String((error as Error)?.message ?? error).slice(0, 200)}`;
      }
      this.reportModelHealth(vendor, results[vendor] ?? null);
    }
    return results;
  }

  /**
   * Called by a JobAgent over RPC after a turn: a setup problem for the
   * vendor it ran on, or null after a success, which clears it. Writes
   * state only when it changes. Not @callable.
   */
  reportModelHealth(vendor: ModelProvider, failure: string | null) {
    const current = this.state.modelHealth ?? {};
    if (failure === null) {
      if (current[vendor]) {
        const { [vendor]: _cleared, ...rest } = current;
        this.setState({ ...this.state, modelHealth: rest });
      }
      return;
    }
    if (current[vendor]?.message !== failure) {
      this.setState({ ...this.state, modelHealth: { ...current, [vendor]: { at: Date.now(), message: failure.slice(0, 500) } } });
    }
  }

  // ------------------------------------------------------- notifications

  /** The VAPID public key browsers subscribe with, or null when push is not set up. */
  @callable()
  pushPublicKey() {
    return vapidFor(this.env)?.publicKey ?? null;
  }

  /** Saves this browser's subscription for the calling member; resubscribing replaces it. */
  @callable()
  subscribePush(subscription: PushSubscriptionJSON) {
    const endpoint = pushEndpoint(subscription?.endpoint);
    const { auth, p256dh } = subscription?.keys ?? {};
    if (!(endpoint && validKey(p256dh, 65) && validKey(auth, 16))) {
      throw new Error("Invalid push subscription.");
    }
    const email = this.callerEmail();
    this.sql`INSERT OR REPLACE INTO push_subscriptions (endpoint, email, p256dh, auth, created_at)
      VALUES (${endpoint}, ${email}, ${p256dh}, ${auth}, ${Date.now()})`;
    // A few devices per member; the oldest go first.
    this.sql`DELETE FROM push_subscriptions WHERE email = ${email} AND endpoint NOT IN (
      SELECT endpoint FROM push_subscriptions WHERE email = ${email} ORDER BY created_at DESC LIMIT ${PUSH_DEVICES_PER_MEMBER})`;
  }

  /** Only the member's own devices. */
  @callable()
  unsubscribePush(endpoint: string) {
    const normalized = pushEndpoint(endpoint) ?? endpoint;
    this.sql`DELETE FROM push_subscriptions WHERE endpoint = ${normalized} AND email = ${this.callerEmail()}`;
  }

  /**
   * Who hears about a phase change: "needs you" goes to every subscribed
   * the person who started the run and to admins, who are the ones who can
   * approve; a failure, or a scheduled run finishing, goes to whoever
   * started the run.
   */
  private notifyPhase(run: RunSummary) {
    if (!this.state.push) {
      return;
    }
    const role = run.roleId ? this.state.roles.find((r) => r.id === run.roleId)?.name : null;
    const name = role ?? "A job";
    const brief = (text: string | null) => clip(text ?? run.prompt, 140);
    let message: { payload: PushPayload; to: string[]; options: PushOptions } | null = null;
    if (run.phase === "awaiting_approval") {
      message = {
        options: { topic: run.runId, ttl: DAY_SECONDS, urgency: "high" },
        payload: { body: brief(run.activity), runId: run.runId, title: `${name} needs you` },
        to: [...new Set([...(run.startedBy ? [run.startedBy.toLowerCase()] : []), ...this.adminEmails()])],
      };
    } else if ((run.phase === "error" || run.phase === "interrupted") && run.startedBy) {
      message = {
        options: { topic: run.runId, ttl: DAY_SECONDS, urgency: "normal" },
        payload: { body: brief(run.error), runId: run.runId, title: `${name} failed` },
        to: [run.startedBy.toLowerCase()],
      };
    } else if (run.phase === "completed" && run.scheduleId && run.startedBy) {
      message = {
        options: { topic: run.runId, ttl: DAY_SECONDS, urgency: "low" },
        payload: { body: brief(run.summary), runId: run.runId, title: `${name} finished a scheduled job` },
        to: [run.startedBy.toLowerCase()],
      };
    }
    if (message) {
      const { options, payload, to } = message;
      void this.keepAliveWhile(() => this.sendPushes(to, payload, options));
    }
  }

  /** Sends to these members' browsers; drops subscriptions the push service says are gone. */
  private async sendPushes(emails: string[], payload: PushPayload, options: PushOptions) {
    const vapid = vapidFor(this.env);
    if (!vapid) {
      return;
    }
    // Devices of members who have not opened powerhouse for a while are
    // dropped, so someone removed from Access stops getting job details.
    const cutoff = Date.now() - PUSH_DEVICE_TTL_MS;
    this.sql`DELETE FROM push_subscriptions WHERE created_at < ${cutoff}`;
    const rows = emails
      .flatMap((email) => this.sql<PushRow>`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE lower(email) = ${email}`)
      .slice(0, PUSH_FANOUT);
    const results = await Promise.allSettled(
      rows.map((row) =>
        sendPush({ endpoint: row.endpoint, keys: { auth: row.auth, p256dh: row.p256dh } }, JSON.stringify(payload), vapid, options),
      ),
    );
    results.forEach((result, i) => {
      const row = rows[i] as PushRow;
      if (result.status === "rejected") {
        console.warn(`[push] sending to ${new URL(row.endpoint).host} failed`, safeError(result.reason));
      } else if (!result.value.ok) {
        if (result.value.gone) {
          this.sql`DELETE FROM push_subscriptions WHERE endpoint = ${row.endpoint}`;
        } else {
          console.warn(`[push] ${new URL(row.endpoint).host} answered ${result.value.status}`);
        }
      }
    });
  }

  // ----------------------------------------------------------------- jobs

  /**
   * Lists a job and returns at once; routing can take tens of seconds, so it
   * and starting the job continue in the background (startJob). Without a
   * roleId the prompt is routed (or sent to the fallback role when automatic
   * routing is off); an unknown roleId is rejected rather than silently
   * rerouted.
   */
  @callable()
  async dispatch(prompt: string, roleId?: string | null, uploadIds?: string[]): Promise<DispatchResult> {
    const text = typeof prompt === "string" ? prompt.trim() : "";
    if (!text) {
      throw new Error("Describe the job first.");
    }
    if (text.length > RUN_TEXT_LIMITS.prompt) {
      throw new Error(`Keep the job under ${RUN_TEXT_LIMITS.prompt} characters.`);
    }
    if (roleId && !this.roles().some((r) => r.id === roleId)) {
      throw new Error(`Unknown role "${roleId}".`);
    }
    const files = this.claimableUploads(this.callerEmail(), uploadIds ?? []);
    return { runId: this.enqueueRun(text, roleId ?? undefined, undefined, this.callerEmail(), undefined, files) };
  }

  // -------------------------------------------------------------- uploads

  /**
   * A file a member is attaching to their next job, already converted to
   * text by the Worker (/api/uploads). Called over RPC; not @callable.
   * Files never sent are deleted after a day.
   */
  saveUpload(email: string, name: string, text: string): AttachmentInfo {
    const member = email.toLowerCase();
    this.sql`DELETE FROM uploads WHERE run_id IS NULL AND created_at < ${Date.now() - UPLOAD_UNSENT_MS}`;
    const [pending] = this.sql<{ n: number }>`SELECT COUNT(*) AS n FROM uploads WHERE run_id IS NULL AND created_by = ${member}`;
    if ((pending?.n ?? 0) >= UPLOAD_PENDING_PER_MEMBER) {
      throw new Error("Too many files are waiting to be sent. Send a job with them, or try again tomorrow.");
    }
    const id = newRunId();
    const kept = text.slice(0, UPLOAD_LIMITS.chars);
    this.sql`INSERT INTO uploads (id, name, text, created_by, created_at, run_id) VALUES (${id}, ${name}, ${kept}, ${member}, ${Date.now()}, NULL)`;
    return { chars: kept.length, id, name };
  }

  /** The caller's own files not yet sent with a job; any other id is refused. */
  private claimableUploads(email: string, ids: unknown[]): AttachmentInfo[] {
    const wanted = [...new Set(ids.filter((id): id is string => typeof id === "string"))];
    if (wanted.length > UPLOAD_LIMITS.files) {
      throw new Error(`Attach up to ${UPLOAD_LIMITS.files} files to a job.`);
    }
    return wanted.map((id) => {
      const [row] = this.sql<{ name: string; chars: number }>`
        SELECT name, length(text) AS chars FROM uploads WHERE id = ${id} AND created_by = ${email.toLowerCase()} AND run_id IS NULL`;
      if (!row) {
        throw new Error("An attached file is gone (files not sent within a day are deleted). Attach it again.");
      }
      return { chars: row.chars, id, name: row.name };
    });
  }

  private attachmentsFor(runId: string): AttachmentInfo[] {
    return this.sql<{ id: string; name: string; chars: number }>`
      SELECT id, name, length(text) AS chars FROM uploads WHERE run_id = ${runId} ORDER BY created_at`;
  }

  /** A window of an attached file's text, for its job's read_attachment tool. Not @callable. */
  readUpload(runId: string, fileId: string, offset: number, length: number) {
    const [row] = this.sql<{ name: string; text: string }>`SELECT name, text FROM uploads WHERE id = ${fileId} AND run_id = ${runId}`;
    if (!row) {
      return null;
    }
    const start = Math.max(0, Math.floor(offset));
    return { name: row.name, offset: start, text: row.text.slice(start, start + length), total: row.text.length };
  }

  // ------------------------------------------------- use from other apps (MCP)
  //
  // Called by the Worker's MCP tools over RPC with the member's email from
  // their grant, which Access verified when they approved the app. Not
  // @callable. Each refuses while an admin has the feature off, so turning it
  // off stops every app at once, whatever tokens they hold.

  private requireMcp() {
    if (!this.state.settings.mcpServer) {
      throw new Error("Using powerhouse from other apps is turned off. An admin can turn it on in Settings.");
    }
  }

  mcpEnabled() {
    return this.state.settings.mcpServer;
  }

  /** For the Worker's read-aloud route. Not @callable. */
  voiceEnabled() {
    return this.state.settings.voice;
  }

  /** A job's answer for read-aloud: anyone who can see the job may hear it, as in the app. Not @callable. */
  answerToSpeak(runId: string) {
    return this.run(runId)?.summary ?? null;
  }

  /** After Settings added the Access step: picks up the saved config so the page shows it done. Not @callable. */
  async refreshMcpAccess() {
    const saved = await deployment(this.env).config();
    this.setState({ ...this.state, mcpAccessReady: this.mcpAccessReady() || saved?.mcpAccess === true });
  }

  /**
   * setup.mjs's var, or Finish setup's config mapped onto env. Local dev has
   * no Access, so nothing stands in an app's way there.
   */
  private mcpAccessReady() {
    return import.meta.env.DEV || this.env.MCP_ACCESS === "on";
  }

  /** For the Worker's connected-apps routes, which act on other members' apps only for admins. */
  memberIsAdmin(email: string) {
    return this.isAdmin(email.toLowerCase());
  }

  /** The roles a member can send jobs to. */
  rolesForApp() {
    this.requireMcp();
    return this.roles().map(({ id, name, purpose }) => ({ id, name, purpose }));
  }

  /** dispatch, as the member, from an app: same limits and routing. */
  startJobFromApp(email: string, prompt: string, roleId: string | undefined, via: string): DispatchResult {
    this.requireMcp();
    const text = typeof prompt === "string" ? prompt.trim() : "";
    if (!text) {
      throw new Error("Describe the job first.");
    }
    if (text.length > RUN_TEXT_LIMITS.prompt) {
      throw new Error(`Keep the job under ${RUN_TEXT_LIMITS.prompt} characters.`);
    }
    if (roleId && !this.roles().some((r) => r.id === roleId)) {
      throw new Error(`Unknown role "${roleId}". list_roles gives the ids.`);
    }
    this.recordMember(email.toLowerCase());
    return { runId: this.enqueueRun(text, roleId, undefined, email.toLowerCase(), via.slice(0, 60) || "another app") };
  }

  /** The member's own recent jobs, newest first. */
  jobsForApp(email: string, limit: number): RunSummary[] {
    this.requireMcp();
    const me = email.toLowerCase();
    return this.state.runs.filter((r) => r.startedBy?.toLowerCase() === me).slice(0, Math.min(Math.max(limit, 1), 20));
  }

  /** One job, for the member who started it or an admin, as the app may see it. */
  jobForApp(email: string, runId: string): RunSummary | null {
    this.requireMcp();
    const run = this.run(runId);
    const me = email.toLowerCase();
    if (!run || !(this.isAdmin(me) || run.startedBy?.toLowerCase() === me)) {
      return null;
    }
    return run;
  }

  /**
   * Lists a run and starts it in the background; shared by dispatch and
   * schedules. Throws when the org is at its concurrency cap.
   */
  private enqueueRun(
    text: string,
    roleId: string | undefined,
    scheduleId: string | undefined,
    startedBy: string,
    via?: string,
    files: AttachmentInfo[] = [],
  ) {
    // Checked here as well as by runAgentTool, so a job over the cap is
    // refused before spending a routing call. Runs parked on an approval do
    // not hold a slot (see maxConcurrentAgentTools).
    const busy = this.state.runs.filter((r) => r.phase === "routing" || r.phase === "running").length;
    if (busy >= this.maxConcurrentAgentTools) {
      throw new Error(`${this.maxConcurrentAgentTools} jobs are already running. Try again when one finishes.`);
    }
    const runId = newRunId();
    this.upsertRun(
      runId,
      {
        phase: "routing",
        prompt: text,
        roleId: roleId ?? null,
        started: false,
        startedBy,
        ...(scheduleId ? { scheduleId } : {}),
        ...(via ? { via } : {}),
        ...(files.length > 0 ? { files: files.map((f) => f.name) } : {}),
      },
      { create: true },
    );
    for (const file of files) {
      this.sql`UPDATE uploads SET run_id = ${runId} WHERE id = ${file.id}`;
    }
    // Not awaited: the caller returns now. keepAliveWhile holds the Durable
    // Object in memory until the job has started; if it is evicted anyway,
    // onStart routes the run again.
    void this.keepAliveWhile(() => this.startJob(runId, text, roleId));
    return runId;
  }

  /** Routes (unless a role was picked) and starts the job; every outcome lands on the run's row. */
  private async startJob(runId: string, text: string, roleId?: string) {
    try {
      const roles = this.roles();
      const settings = this.state.settings;
      const routed = roleId ? { role: roles.find((r) => r.id === roleId), unsure: false } : await this.route(text, roles, settings);
      const role = routed.role;
      if (!role) {
        throw new Error(`Role "${roleId}" was deleted before the job started.`);
      }
      // Canceled while routing.
      if (this.run(runId)?.phase !== "routing") {
        return;
      }
      const harness = harnessFor(role);
      this.upsertRun(runId, { harness, roleId: role.id, ...(routed.unsure ? { routedUnsure: true } : {}) });
      const scheduleId = this.run(runId)?.scheduleId;
      const report = scheduleId ? this.storedSchedule(scheduleId)?.lastReport : undefined;
      const attachments = this.attachmentsFor(runId);
      const input: JobInput = {
        ...(attachments.length > 0 ? { attachments } : {}),
        ...(report ? { previousReport: { summary: report.summary, when: formatReportTime(report.at, settings.timeZone) } } : {}),
        prompt: text,
        role,
        settings: {
          approveBrowserActions: settings.approveBrowserActions,
          blockedHosts: settings.blockedHosts,
          companyProfile: settings.companyProfile,
          conciseAnswers: settings.conciseAnswers,
          member: this.run(runId)?.startedBy?.toLowerCase(),
          maxSteps: settings.maxSteps,
          website: settings.website || undefined,
          model: resolveModel(role.model ?? settings.jobModel, this.state.providers),
        },
      };
      const result = await this.runAgentTool(jobClassFor(harness), {
        detached: true,
        display: { name: role.name },
        input,
        inputPreview: text,
        runId,
      });
      // A rejected start (the concurrency cap) resolves rather than throws,
      // and fires neither onAgentToolStart nor onAgentToolFinish.
      if (result.status === "error") {
        throw new Error(
          result.error?.includes("maxConcurrentAgentTools")
            ? `${this.maxConcurrentAgentTools} jobs are already running. Try again when one finishes.`
            : (result.error ?? "The job could not be started."),
        );
      }
      // Only now may clients connect to the job: onAgentToolStart can fire
      // before the job has stored the prompt, and a transcript loaded then
      // shows the prompt after the answer. onAgentToolStart usually moves the
      // run to running first; this covers it if not.
      this.upsertRun(runId, this.run(runId)?.phase === "routing" ? { phase: "running", started: true } : { started: true });
    } catch (error) {
      console.error(`[dispatch ${runId}]`, safeError(error));
      this.upsertRun(runId, {
        completedAt: Date.now(),
        error: error instanceof Error ? error.message : String(error),
        phase: "error",
      });
    }
  }

  @callable()
  async cancel(runId: string) {
    this.requireOwnerOrAdmin(this.run(runId)?.startedBy, "jobs");
    // Not started yet: startJob sees the new phase and never starts it.
    if (this.run(runId)?.phase === "routing") {
      this.upsertRun(runId, { activity: null, completedAt: Date.now(), phase: "aborted" });
      return;
    }
    await this.cancelAgentTool(runId, "Canceled by operator");
  }

  /**
   * Only runs this org dispatched and still lists can be drilled into: guessed
   * ids never spawn a facet, and cleared runs are not recreated empty.
   */
  async onBeforeSubAgent(_request: Request, child: { className: string; name: string }) {
    const run = this.state.runs.find((r) => r.runId === child.name);
    const harness = run?.harness ?? "think";
    if (!(run && child.className === JOB_CLASS_NAMES[harness] && this.hasAgentToolRun(jobClassFor(harness), child.name))) {
      return new Response("Not found", { status: 404 });
    }
  }

  /**
   * A dispatched run keeps the time it was sent, so its timer includes
   * routing. A cancel that landed after startJob's last check wins here.
   */
  async onAgentToolStart(run: AgentToolRunInfo) {
    const existing = this.run(run.runId);
    if (existing?.phase === "aborted") {
      await this.cancelAgentTool(run.runId, "Canceled by operator");
      return;
    }
    this.upsertRun(run.runId, { phase: "running", ...(existing ? {} : { startedAt: run.startedAt }) }, { create: true });
  }

  /**
   * Called by a JobAgent over RPC at each step and turn boundary; the child is
   * the source of truth for activity, approvals and completion. Not @callable,
   * so clients cannot reach it.
   */
  async reportJob(runId: string, patch: Partial<Omit<RunSummary, "runId">>) {
    // Jobs report their running total; the day's spend grows by the difference.
    if (typeof patch.costUsd === "number") {
      const delta = patch.costUsd - (this.run(runId)?.costUsd ?? 0);
      if (delta > 0) {
        this.addSpend(delta);
      }
    }
    this.upsertRun(runId, patch);
    if (patch.phase === "completed") {
      this.recordScheduleReport(runId);
    }
  }

  /** A schedule's newest run finished: its answer is what the next run builds on. */
  private recordScheduleReport(runId: string) {
    const run = this.run(runId);
    const schedule = run?.scheduleId ? this.storedSchedule(run.scheduleId) : null;
    // Only the newest run counts, so a follow-up on an older run never replaces it.
    if (!(run?.summary && schedule && schedule.last?.runId === runId)) {
      return;
    }
    this.writeSchedule({ ...schedule, lastReport: { at: run.startedAt, runId, summary: run.summary } });
  }

  /**
   * Called by a JobAgent's tools over RPC: a setup failure message, or null
   * after a success, which clears the feature's failure. Writes state only
   * when the checklist would change, so successful calls cost no sync. Not
   * @callable, so clients cannot reach it.
   */
  async reportFeatureHealth(id: ToolId, failure: string | null) {
    if (!TOOL_IDS.includes(id)) {
      return;
    }
    const current = this.state.featureHealth ?? {};
    if (failure === null) {
      if (!current[id]) {
        return;
      }
      const { [id]: _cleared, ...rest } = current;
      this.setState({ ...this.state, featureHealth: rest });
      return;
    }
    const message = failure.slice(0, 500);
    if (current[id]?.message === message) {
      return;
    }
    this.setState({ ...this.state, featureHealth: { ...current, [id]: { at: Date.now(), message } } });
  }

  /**
   * The registry reports `completed` when the first headless turn ends, even if
   * the child is parked on an approval, so completion comes from reportJob.
   * Only failures the child cannot report itself are taken from here.
   */
  async onAgentToolFinish(run: AgentToolRunInfo, result: AgentToolLifecycleResult) {
    if (result.status === "completed") {
      return;
    }
    this.upsertRun(run.runId, {
      activity: null,
      completedAt: run.completedAt ?? Date.now(),
      error: result.error ?? null,
      phase: result.status as RunPhase,
      summary: result.summary ?? null,
    });
  }

  // -------------------------------------------------------------- private

  /** Normalizes rows saved by earlier versions (no allowedHosts or model, retired tool ids). */
  private roles(): RoleConfig[] {
    return this.sql<RoleRow>`SELECT id, position, config FROM roles ORDER BY position`.map((row) => {
      const stored = JSON.parse(row.config) as Partial<RoleConfig> & Pick<RoleConfig, "id" | "name">;
      return {
        allowedHosts: stored.allowedHosts ?? [],
        // Roles saved before connections existed have none.
        connections: Array.isArray(stored.connections) ? stored.connections : [],
        hue: stored.hue ?? 0,
        id: stored.id,
        model: stored.model ?? null,
        name: stored.name,
        purpose: stored.purpose ?? "",
        // Roles saved before skills existed have none.
        skills: Array.isArray(stored.skills) ? stored.skills : [],
        suggestions:
          stored.suggestions?.length === 1 ? (RETIRED_SUGGESTIONS[stored.suggestions[0] ?? ""] ?? stored.suggestions) : (stored.suggestions ?? []),
        systemPrompt: stored.systemPrompt ?? "",
        tools: knownTools(stored.tools ?? []),
      };
    });
  }

  private insertRole(fields: Omit<RoleConfig, "id">, roles: RoleConfig[]): RoleConfig {
    if (roles.length >= MAX_ROLES) {
      throw new Error(`An organization can have up to ${MAX_ROLES} roles.`);
    }
    const role: RoleConfig = { ...fields, id: roleIdFor(fields.name, new Set(roles.map((r) => r.id))) };
    const [{ next } = { next: 0 }] = this.sql<{ next: number }>`SELECT COALESCE(MAX(position) + 1, 0) AS next FROM roles`;
    this.sql`INSERT INTO roles (id, position, config) VALUES (${role.id}, ${next}, ${JSON.stringify(role)})`;
    this.publishRoles();
    return role;
  }

  /** Connections to catalog servers, whose tool hints are trusted. */
  private catalogConnectionIds() {
    return new Set(this.state.connections.filter((c) => c.catalogId !== null).map((c) => c.id));
  }

  private requireConnection(id: string) {
    if (!this.mcp.listServers().some((server) => server.id === id)) {
      throw new Error("That connection no longer exists.");
    }
  }

  /**
   * Connection metadata for clients; live state comes from the SDK's MCP
   * broadcast. Rows whose server is gone are dropped, and servers added
   * outside addConnection are listed with an unknown author.
   */
  private publishConnections() {
    const rows = new Map(
      this.sql<{ id: string; catalog_id: string | null; added_by: string; added_at: number }>`
        SELECT id, catalog_id, added_by, added_at FROM connections`.map((row) => [row.id, row]),
    );
    const apps = new Map(
      this.sql<{ server_id: string; app_slug: string | null }>`SELECT server_id, app_slug FROM oauth_clients`.map((row) => [
        row.server_id,
        row.app_slug,
      ]),
    );
    const connections: ConnectionInfo[] = this.mcp
      .listServers()
      .map((server) => {
        const row = rows.get(server.id);
        return {
          addedAt: row?.added_at ?? 0,
          addedBy: row?.added_by ?? "unknown",
          // A server added by its URL is still that catalog entry.
          catalogId: row?.catalog_id ?? CONNECTION_CATALOG.find((entry) => entry.url === server.server_url)?.id ?? null,
          id: server.id,
          installUrl: apps.get(server.id) ? githubInstallUrl(apps.get(server.id) as string) : null,
          name: server.name,
          ownApp: apps.has(server.id),
          // Members see the host only: some servers put a key in the path or query.
          url: originOf(server.server_url),
        };
      })
      .sort((a, b) => b.addedAt - a.addedAt);
    for (const id of rows.keys()) {
      if (!connections.some((c) => c.id === id)) {
        this.sql`DELETE FROM connections WHERE id = ${id}`;
      }
    }
    this.setState({ ...this.state, connections });
  }

  private publishRoles() {
    const roles: RoleSummary[] = this.roles().map(({ hue, id, name, purpose, suggestions }) => ({
      hue,
      id,
      name,
      purpose,
      suggestions,
    }));
    this.setState({ ...this.state, roles });
  }

  /** Stored settings over the defaults, so settings added later get their default. */
  private settings(): OrgSettings {
    const [row] = this.sql<{ config: string }>`SELECT config FROM settings WHERE id = 1`;
    const stored = row ? (JSON.parse(row.config) as Partial<OrgSettings>) : {};
    const settings = { ...defaultSettings(this.name), ...stored };
    // Settings saved by earlier versions can name models that were removed.
    if (settings.jobModel !== AUTO_MODEL && !KNOWN_MODELS.has(settings.jobModel)) {
      settings.jobModel = AUTO_MODEL;
    }
    if (!KNOWN_MODELS.has(settings.routerModel) || !settings.routerModel.startsWith("@cf/")) {
      settings.routerModel = DEFAULT_MODEL;
    }
    return settings;
  }

  private writeSettings(settings: OrgSettings) {
    this.sql`INSERT OR REPLACE INTO settings (id, config) VALUES (1, ${JSON.stringify(settings)})`;
    this.maxConcurrentAgentTools = settings.maxConcurrentJobs;
    this.setState({ ...this.state, settings });
  }

  /**
   * Routes with the Clef decision model, which returns a probability for
   * every role in a fraction of a second. A low-confidence pick goes to the
   * fallback role instead, and is marked unsure. If the Clef call fails, a
   * chat model routes as before (settings.routerModel); with routing off,
   * or on any other failure, the fallback role takes the job, so a dispatch
   * never fails on routing alone.
   */
  private async route(prompt: string, roles: RoleConfig[], settings: OrgSettings) {
    const fallback = roles.find((r) => r.id === settings.fallbackRoleId) ?? roles.find((r) => r.id === DEFAULT_ROLE_ID) ?? roles[0];
    if (!settings.autoRoute || roles.length < 2) {
      return { role: fallback, unsure: false };
    }
    try {
      const { probability, roleId } = await clefRoute(this.env.AI, prompt, roles);
      const role = roles.find((r) => r.id === roleId);
      if (role && probability >= ROUTE_CONFIDENCE) {
        return { role, unsure: false };
      }
      return { role: fallback, unsure: true };
    } catch (error) {
      console.warn("Clef routing failed, routing with the backup model", safeError(error));
    }
    try {
      const { output } = await tracedAI(this.env).generateText({
        model: createWorkersAI({ binding: this.env.AI })(settings.routerModel),
        ...routeRequest(prompt, roles),
        runtimeContext: { agentId: this.name },
        telemetry: { functionId: TRACE_NAMES.router, includeRuntimeContext: { agentId: true } },
      });
      return { role: roles.find((r) => r.id === output) ?? fallback, unsure: false };
    } catch (error) {
      console.warn("Role routing failed, using the fallback role", safeError(error));
      return { role: fallback, unsure: true };
    }
  }

  private run(runId: string) {
    return this.state.runs.find((r) => r.runId === runId);
  }

  /** Only dispatch and run start may create a row; a late report for a pruned run is dropped. */
  private upsertRun(runId: string, patch: Partial<RunSummary>, { create = false } = {}) {
    const runs = [...this.state.runs];
    const index = runs.findIndex((r) => r.runId === runId);
    const existing = runs[index];
    if (!(existing || create)) {
      return;
    }
    // Run rows are broadcast to every member on each change, so text from
    // models and tools is capped here, where every update passes.
    for (const key of ["activity", "error", "prompt", "summary"] as const) {
      const value = patch[key];
      if (typeof value === "string" && value.length > RUN_TEXT_LIMITS[key]) {
        patch = { ...patch, [key]: `${value.slice(0, RUN_TEXT_LIMITS[key] - 1)}…` };
      }
    }
    const next: RunSummary = {
      ...(existing ?? {
        activity: null,
        completedAt: null,
        error: null,
        phase: "running",
        prompt: "",
        roleId: null,
        runId,
        startedAt: Date.now(),
        summary: null,
      }),
      ...patch,
    };
    if (existing) {
      runs[index] = next;
    } else {
      runs.unshift(next);
    }
    this.publishRuns(runs);
    if (existing && existing.phase !== next.phase) {
      this.notifyPhase(next);
    }
  }

  /**
   * Keeps every live run plus the newest finished runs up to historyLimit.
   * Pruned runs have their job facet deleted, so history size also bounds
   * storage instead of leaving old conversations behind.
   */
  private publishRuns(runs: RunSummary[]) {
    const limit = this.state.settings.historyLimit;
    const kept: RunSummary[] = [];
    const pruned: RunSummary[] = [];
    let finished = 0;
    for (const run of runs) {
      if (LIVE_PHASES.has(run.phase)) {
        kept.push(run);
      } else if (finished < limit) {
        finished += 1;
        kept.push(run);
      } else {
        pruned.push(run);
      }
    }
    this.deleteJobs(pruned);
    this.setState({ ...this.state, runs: kept });
  }

  /** Best effort: a failed delete only leaves storage behind, never a visible run. */
  private deleteJobs(runs: RunSummary[]) {
    for (const run of runs) {
      this.sql`DELETE FROM uploads WHERE run_id = ${run.runId}`;
      this.deleteSubAgent(jobClassFor(run.harness), run.runId).catch((error) => {
        console.warn(`Deleting job ${run.runId} failed`, safeError(error));
      });
    }
  }
}
