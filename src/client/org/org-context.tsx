import type {
  DispatchResult,
  MemberInfo,
  OrgSettings,
  OrgState,
  RoleConfig,
  RoleSummary,
  RoleTemplate,
  ScheduleInfo,
  ScheduleRule,
  SkillInfo,
  TeamChoice,
} from "../../shared";
import type { MCPServersState } from "agents";
import { useAgent } from "agents/react";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";

/** What the roles editor sends; omit id to create. */
export type RoleDraft = Omit<RoleConfig, "id"> & { id?: string };

export interface Me {
  email: string;
  orgId: string;
}

/** What the schedule editor sends; omit id to create. */
export interface ScheduleDraft {
  enabled: boolean;
  /** The browser's time zone, which the org adopts if it has none yet. */
  timeZone?: string;
  /** Who created it; members edit only their own. Absent for a new one. */
  createdBy?: string;
  id?: string;
  prompt: string;
  roleId: string;
  rule: ScheduleRule;
}

/** A connection to add: one from the catalog, or a custom server. */
export type ConnectionSource = { catalogId: string } | { name: string; url: string };

interface OrgContextValue {
  /** Resolves with the sign-in URL when the server needs OAuth. */
  addConnection: (source: ConnectionSource) => Promise<{ authUrl: string | null; id: string }>;
  addFromLibrary: (templateId: string) => Promise<RoleConfig>;
  /** Admins change settings, roles and connections, and act on anyone's jobs and schedules. */
  isAdmin: boolean;
  /** For admins: everyone who has signed in. */
  listMembers: () => Promise<MemberInfo[]>;
  setAdmin: (email: string, admin: boolean) => Promise<void>;
  /** Deployments set up in the browser switch web search here (it has no binding). */
  setWebSearch: (on: boolean) => Promise<void>;
  chooseTeam: (choice: TeamChoice) => Promise<RoleConfig[]>;
  listSkills: () => Promise<SkillInfo[]>;
  /** Skill names that suit a role, from the Clef decision model; empty when it cannot say. */
  suggestSkills: (role: { name: string; purpose: string }) => Promise<string[]>;
  cancel: (runId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  connected: boolean;
  deleteRole: (id: string) => Promise<void>;
  /** Without a roleId the Org agent routes the prompt to a role. */
  dispatch: (prompt: string, roleId?: string) => Promise<DispatchResult>;
  listLibrary: () => Promise<RoleTemplate[]>;
  /** Full role configs, including prompts; fetched on demand by the roles editor. */
  listRoles: () => Promise<RoleConfig[]>;
  me: Me;
  /** Live MCP server state and tools, from the SDK's broadcast. */
  mcp: MCPServersState;
  orgId: string;
  removeConnection: (id: string) => Promise<void>;
  /** One tiny call per gateway vendor; a vendor maps to its problem, or null when it worked. */
  testModels: () => Promise<Partial<Record<"anthropic" | "openai", string | null>>>;
  /** Null when push is not set up on this deployment. */
  pushPublicKey: () => Promise<string | null>;
  subscribePush: (subscription: { endpoint: string; keys: { auth: string; p256dh: string } }) => Promise<void>;
  unsubscribePush: (endpoint: string) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  /** Starts the schedule's job now; its next run is unchanged. */
  runScheduleNow: (id: string) => Promise<DispatchResult>;
  saveSchedule: (draft: ScheduleDraft) => Promise<ScheduleInfo>;
  retryConnection: (id: string) => Promise<{ authUrl: string | null }>;
  rolesById: Readonly<Record<string, RoleSummary>>;
  saveRole: (draft: RoleDraft) => Promise<RoleConfig>;
  /** Saves any subset of settings. */
  saveSettings: (patch: Partial<OrgSettings>) => Promise<OrgSettings>;
  state: OrgState;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrg must be used inside <OrgProvider>");
  }
  return ctx;
}

/** The single Org socket: fleet state for the whole surface, plus dispatch and cancel. */
export function OrgProvider({ me, children }: { me: Me; children: ReactNode }) {
  const { orgId } = me;
  const [state, setState] = useState<OrgState>({
    admins: [],
    setupKind: "cli",
    capabilities: { browser: false, sendEmail: false, webFetch: true, webSearch: false },
    connections: [],
    aiBilling: null,
    featureHealth: {},
    modelHealth: {},
    providers: [],
    push: false,
    schedules: [],
    spend: { date: "", usd: 0 },
    spendLimits: null,
    roles: [],
    runs: [],
    // Off until the Org says otherwise, so the picker never flashes for an existing org.
    teamPending: false,
    // Replaced by the Org's state as soon as the socket opens.
    settings: {
      approveBrowserActions: false,
      autoRoute: true,
      blockedHosts: [],
      companyProfile: "",
      dailyBudgetUsd: 0,
      fallbackRoleId: "",
      historyLimit: 50,
      jobModel: "auto",
      maxConcurrentJobs: 10,
      maxSteps: 8,
      orgName: me.orgId,
      routerModel: "@cf/moonshotai/kimi-k2.7-code",
      timeZone: "",
    website: "",
    },
  });
  const [connected, setConnected] = useState(false);
  const [mcp, setMcp] = useState<MCPServersState>({ prompts: [], resources: [], servers: {}, tools: [] });
  const org = useAgent<OrgState>({
    agent: "org",
    name: orgId,
    onClose: () => setConnected(false),
    onMcpUpdate: setMcp,
    onOpen: () => setConnected(true),
    onStateUpdate: (next) => setState(next),
  });

  const value = useMemo<OrgContextValue>(
    () => ({
      addConnection: (source) => org.call<{ authUrl: string | null; id: string }>("addConnection", [source]),
      addFromLibrary: (templateId) => org.call<RoleConfig>("addFromLibrary", [templateId]),
      isAdmin: state.admins.includes(me.email.toLowerCase()),
      listMembers: () => org.call<MemberInfo[]>("listMembers", []),
      setAdmin: (email, admin) => org.call<void>("setAdmin", [email, admin]),
      setWebSearch: (on) => org.call<void>("setWebSearch", [on]),
      chooseTeam: (choice) => org.call<RoleConfig[]>("chooseTeam", [choice]),
      listSkills: () => org.call<SkillInfo[]>("listSkills", []),
      suggestSkills: (role) => org.call<string[]>("suggestSkills", [role]),
      cancel: (runId) => org.call<void>("cancel", [runId]),
      clearHistory: () => org.call<void>("clearHistory", []),
      connected,
      deleteRole: (id) => org.call<void>("deleteRole", [id]),
      dispatch: (prompt, roleId) =>
        org.call<DispatchResult>("dispatch", roleId ? [prompt, roleId] : [prompt]),
      listLibrary: () => org.call<RoleTemplate[]>("listLibrary", []),
      listRoles: () => org.call<RoleConfig[]>("listRoles", []),
      me,
      mcp,
      orgId,
      removeConnection: (id) => org.call<void>("removeConnection", [id]),
      testModels: () => org.call("testModels", []),
      pushPublicKey: () => org.call<string | null>("pushPublicKey", []),
      subscribePush: (subscription) => org.call<void>("subscribePush", [subscription]),
      unsubscribePush: (endpoint) => org.call<void>("unsubscribePush", [endpoint]),
      deleteSchedule: (id) => org.call<void>("deleteSchedule", [id]),
      runScheduleNow: (id) => org.call<DispatchResult>("runScheduleNow", [id]),
      saveSchedule: (draft) => org.call<ScheduleInfo>("saveSchedule", [draft]),
      retryConnection: (id) => org.call<{ authUrl: string | null }>("retryConnection", [id]),
      rolesById: Object.fromEntries(state.roles.map((r) => [r.id, r])),
      saveRole: (draft) => org.call<RoleConfig>("saveRole", [draft]),
      saveSettings: (patch) => org.call<OrgSettings>("saveSettings", [patch]),
      state,
    }),
    [org, connected, mcp, me, orgId, state],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}
