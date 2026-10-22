import {
  AUTO_MODEL,
  CONNECTION_CATALOG,
  type ConnectionInfo,
  type FeatureFailure,
  type MemberInfo,
  type UpdateStatus,
  LIVE_PHASES,
  MODELS,
  type OrgSettings,
  SETTINGS_LIMITS,
  TOOL_INFO,
  type ToolId,
} from "../../shared";
import { X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { setThemeChoice, type ThemeChoice, useThemeChoice } from "../lib/theme";
import { autoModelLabel, ModelOptions } from "../components/model-options";
import { currentSubscription, pushSupported, subscribe } from "../lib/push";
import { formatUsd, spentToday } from "../lib/spend";
import { formatAgo } from "../lib/time";
import { type ConnectionSource, useOrg } from "../org/org-context";
import styles from "./sheet.module.css";
import { useModal } from "./use-modal";

const lines = (value: string) =>
  value
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/**
 * Org-wide settings. One form, one save: only changed fields are sent, and
 * the server validates them. Running jobs keep the settings they were
 * dispatched with.
 */
export function SettingsSheet({ focus, onClose }: { focus?: "tools"; onClose: () => void }) {
  const { dialogProps, close } = useModal(onClose);
  const { state, me, saveSettings, clearHistory, isAdmin } = useOrg();
  const saved = state.settings;
  // Opened from "... are off. Set up": scroll to Tools with the first off tool open.
  const toolsRef = useRef<HTMLElement>(null);
  const firstOffTool = focus === "tools" ? CHECKLIST_ORDER.find((id) => !state.capabilities[id]) : undefined;
  useEffect(() => {
    if (focus === "tools") {
      toolsRef.current?.scrollIntoView({ block: "start" });
    }
  }, [focus]);
  const [draft, setDraft] = useState<OrgSettings>(saved);
  const [blocked, setBlocked] = useState(saved.blockedHosts.join("\n"));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const set = <K extends keyof OrgSettings>(key: K, value: OrgSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const next: OrgSettings = { ...draft, blockedHosts: lines(blocked) };
  const changed = (Object.keys(next) as (keyof OrgSettings)[]).filter(
    (key) => JSON.stringify(next[key]) !== JSON.stringify(saved[key]),
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (changed.length === 0) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const patch = Object.fromEntries(changed.map((key) => [key, next[key]]));
      const result = await saveSettings(patch);
      setDraft(result);
      setBlocked(result.blockedHosts.join("\n"));
      setMessage({ kind: "ok", text: "Settings saved." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const finished = state.runs.filter((r) => !LIVE_PHASES.has(r.phase)).length;
  const clear = async () => {
    setBusy(true);
    try {
      await clearHistory();
      setConfirmClear(false);
      setMessage({ kind: "ok", text: "History cleared." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog {...dialogProps} aria-label="Settings" className={styles.dialog}>
      <div className={styles.sheet}>
        <header className={styles.head}>
          <h2 className={styles.title}>Settings</h2>
          <button aria-label="Close" className={styles.iconButton} onClick={close} type="button">
            <X size={15} />
          </button>
        </header>

        <form className={styles.body} onSubmit={submit}>
          {!isAdmin && (
            <p className={styles.notice}>You can see these settings; only admins can change them.</p>
          )}
          {/* Everything an admin changes; for members, view only. */}
          <fieldset className={styles.plainFieldset} disabled={!isAdmin}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Organization</h3>
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <span className={styles.hint}>Shown in the header. Your org id stays {me.orgId}.</span>
              <input
                className={styles.input}
                maxLength={SETTINGS_LIMITS.orgName}
                onChange={(e) => set("orgName", e.target.value)}
                required
                value={draft.orgName}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Company profile</span>
              <span className={styles.hint}>
                What you do, for whom, how you are different, and how you sound. Every job reads it, so roles write and
                research with your context instead of guessing. Up to {SETTINGS_LIMITS.companyProfile} characters.
              </span>
              <textarea
                className={styles.textarea}
                maxLength={SETTINGS_LIMITS.companyProfile}
                onChange={(e) => set("companyProfile", e.target.value)}
                placeholder={"Acme makes scheduling software for dental clinics in the US.\nCustomers: clinic owners and front-desk staff.\nDifferent because: setup takes a day, not a month.\nVoice: plain, warm, no jargon."}
                rows={5}
                value={draft.companyProfile}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Website</span>
              <span className={styles.hint}>Jobs know it, and role suggestions can use it (Site QA, SEO, pricing).</span>
              <input
                className={styles.input}
                maxLength={SETTINGS_LIMITS.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://example.com"
                type="url"
                value={draft.website}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Time zone</span>
              <span className={styles.hint}>
                Schedules run in this zone, including its daylight-saving changes. Your browser is in{" "}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              </span>
              <select className={styles.input} onChange={(e) => set("timeZone", e.target.value)} value={draft.timeZone}>
                <option value="">Not set (UTC)</option>
                {Intl.supportedValuesOf("timeZone").map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Models</h3>
            <AiModelsStatus />
            <label className={styles.field}>
              <span className={styles.label}>Job model</span>
              <span className={styles.hint}>
                Used by every role that does not choose its own. Automatic picks Claude, then GPT, then an open model,
                depending on what is set up.
              </span>
              <select
                className={styles.input}
                onChange={(e) => set("jobModel", e.target.value as OrgSettings["jobModel"])}
                value={draft.jobModel}
              >
                <option value={AUTO_MODEL}>Automatic ({autoModelLabel(state.providers)})</option>
                <ModelOptions providers={state.providers} />
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Backup router model</span>
              <span className={styles.hint}>Picks the role only when Clef-Flash is unavailable.</span>
              <select
                className={styles.input}
                onChange={(e) => set("routerModel", e.target.value as OrgSettings["routerModel"])}
                value={draft.routerModel}
              >
                <ModelOptions only="workers-ai" providers={state.providers} />
              </select>
            </label>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Jobs</h3>
            <label className={styles.field}>
              <span className={styles.label}>Daily budget (USD)</span>
              <span className={styles.hint}>
                A backstop to the spend limits on your AI Gateway, which are where budgets belong. Once today's estimated
                model spend reaches it, scheduled jobs are skipped; jobs you send still run. 0 turns it off. Today so far:{" "}
                {formatUsd(spentToday(state.spend, state.settings.timeZone))}.
              </span>
              <input
                className={styles.input}
                max={SETTINGS_LIMITS.dailyBudgetUsd.max}
                min={SETTINGS_LIMITS.dailyBudgetUsd.min}
                onChange={(e) => set("dailyBudgetUsd", Number(e.target.value))}
                step="any"
                type="number"
                value={draft.dailyBudgetUsd}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Concurrent jobs</span>
              <span className={styles.hint}>
                Jobs that can run at once ({SETTINGS_LIMITS.maxConcurrentJobs.min} to{" "}
                {SETTINGS_LIMITS.maxConcurrentJobs.max}). Jobs waiting for you do not count.
              </span>
              <input
                className={styles.input}
                max={SETTINGS_LIMITS.maxConcurrentJobs.max}
                min={SETTINGS_LIMITS.maxConcurrentJobs.min}
                onChange={(e) => set("maxConcurrentJobs", Number(e.target.value))}
                type="number"
                value={draft.maxConcurrentJobs}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Steps per turn</span>
              <span className={styles.hint}>
                Model calls a job may make before it has to answer ({SETTINGS_LIMITS.maxSteps.min} to{" "}
                {SETTINGS_LIMITS.maxSteps.max}). Higher allows longer research, at more cost.
              </span>
              <input
                className={styles.input}
                max={SETTINGS_LIMITS.maxSteps.max}
                min={SETTINGS_LIMITS.maxSteps.min}
                onChange={(e) => set("maxSteps", Number(e.target.value))}
                type="number"
                value={draft.maxSteps}
              />
            </label>
            <label className={styles.check}>
              <input checked={draft.autoRoute} onChange={(e) => set("autoRoute", e.target.checked)} type="checkbox" />
              <span>
                <span className={styles.toolName}>Route prompts automatically</span>
                <span className={styles.hint}>A model picks the role. When off, prompts go to the fallback role.</span>
              </span>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Fallback role</span>
              <span className={styles.hint}>Takes prompts when routing is off or cannot decide.</span>
              <select
                className={styles.input}
                onChange={(e) => set("fallbackRoleId", e.target.value)}
                value={draft.fallbackRoleId}
              >
                {state.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.check}>
              <input
                checked={draft.approveBrowserActions}
                disabled={!state.capabilities.browser}
                onChange={(e) => set("approveBrowserActions", e.target.checked)}
                type="checkbox"
              />
              <span>
                <span className={styles.toolName}>Ask before every browser action</span>
                <span className={styles.hint}>
                  {state.capabilities.browser
                    ? "Each browser step waits for your approval and shows the code it will run."
                    : "The web browser is not configured for this deployment."}
                </span>
              </span>
            </label>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Safety</h3>
            <label className={styles.field}>
              <span className={styles.label}>Blocked sites</span>
              <span className={styles.hint}>
                No role may read these with "Read web pages", whatever its allowed sites say. One per line, like
                example.com or *.example.com. The web browser can only be limited by each role's allowed sites.
              </span>
              <textarea
                className={styles.textarea}
                onChange={(e) => setBlocked(e.target.value)}
                placeholder="internal.example.com"
                rows={3}
                value={blocked}
              />
            </label>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>History</h3>
            <label className={styles.field}>
              <span className={styles.label}>Finished runs kept</span>
              <span className={styles.hint}>
                Older finished runs, and their conversations, are deleted ({SETTINGS_LIMITS.historyLimit.min} to{" "}
                {SETTINGS_LIMITS.historyLimit.max}). Running jobs are always kept.
              </span>
              <input
                className={styles.input}
                max={SETTINGS_LIMITS.historyLimit.max}
                min={SETTINGS_LIMITS.historyLimit.min}
                onChange={(e) => set("historyLimit", Number(e.target.value))}
                type="number"
                value={draft.historyLimit}
              />
            </label>
            <div className={styles.actions}>
              {confirmClear ? (
                <button className={styles.danger} disabled={busy} onClick={() => void clear()} type="button">
                  Delete {finished} finished {finished === 1 ? "run" : "runs"}?
                </button>
              ) : (
                <button
                  className={styles.secondary}
                  disabled={finished === 0}
                  onClick={() => setConfirmClear(true)}
                  type="button"
                >
                  Clear history
                </button>
              )}
            </div>
          </section>

          <section className={styles.section} id="settings-tools" ref={toolsRef}>
            <h3 className={styles.sectionTitle}>Tools</h3>
            <ul className={styles.checklist}>
              {CHECKLIST_ORDER.map((id) => (
                <ChecklistItem
                  configured={state.capabilities[id]}
                  failure={state.featureHealth[id]}
                  id={id}
                  key={id}
                  open={id === firstOffTool}
                  setupKind={state.setupKind}
                />
              ))}
            </ul>
          </section>

          </fieldset>

          <AppearanceSection />

          <NotificationsSection />

          <fieldset className={styles.plainFieldset} disabled={!isAdmin}>
            <ConnectionsSection />
          </fieldset>

          {isAdmin && <MembersSection />}


          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Status</h3>
            <dl className={styles.status}>
              <dt>Signed in as</dt>
              <dd>{me.email}</dd>
              <dt>Org id</dt>
              <dd>{me.orgId}</dd>
              <dt>Version</dt>
              <dd>{__APP_VERSION__}</dd>
            </dl>
            <UpdateNotice setupKind={state.setupKind} />
          </section>

          {message && (
            <p className={message.kind === "error" ? styles.error : styles.muted} role={message.kind === "error" ? "alert" : "status"}>
              {message.text}
            </p>
          )}
          {isAdmin && (
            <div className={styles.actions}>
              <button className={styles.primary} disabled={busy || changed.length === 0} type="submit">
                {changed.length === 0 ? "Saved" : "Save changes"}
              </button>
            </div>
          )}
        </form>
      </div>
    </dialog>
  );
}

/**
 * Push notifications for this browser: a member turns them on per device.
 * "Needs you" reaches every member who has; failures, and scheduled runs
 * finishing, reach whoever started the run.
 */
function NotificationsSection() {
  const { pushPublicKey, state, subscribePush, unsubscribePush } = useOrg();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = pushSupported();

  useEffect(() => {
    if (!supported) {
      return;
    }
    currentSubscription().then(
      (subscription) => setEnabled(subscription !== null),
      () => setEnabled(false),
    );
  }, [supported]);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        const subscription = await currentSubscription();
        if (subscription) {
          await unsubscribePush(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setEnabled(false);
      } else {
        const key = await pushPublicKey();
        if (!key) {
          throw new Error("Push notifications are not set up on this deployment.");
        }
        await subscribePush(await subscribe(key));
        setEnabled(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Notifications</h3>
      <p className={styles.hint}>
        Get a notification on this device when a job needs you, even with powerhouse closed. You also hear when a job you
        started fails, or when your scheduled jobs finish.
      </p>
      {!state.push && (
        <p className={styles.muted}>Not set up on this deployment. Rerun node setup.mjs to add the keys it needs.</p>
      )}
      {state.push && !supported && (
        <p className={styles.muted}>
          This browser does not support push notifications. On iPhone and iPad, add powerhouse to your Home Screen
          first.
        </p>
      )}
      {state.push && supported && (
        <label className={styles.check}>
          <input
            checked={enabled ?? false}
            disabled={busy || enabled === null}
            onChange={() => void toggle()}
            type="checkbox"
          />
          <span>
            <span>Notifications on this device</span>
            <span className={styles.hint}>Each device you use is turned on separately.</span>
          </span>
        </label>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

const VENDORS = [
  { id: "anthropic", label: "Claude (Anthropic)" },
  { id: "openai", label: "GPT (OpenAI)" },
] as const;

const AI_GATEWAY_DASHBOARD = "https://dash.cloudflare.com/?to=/:account/ai/ai-gateway";

/**
 * What runs the org's AI: the router, each gateway vendor (set up, not set
 * up, or an error from a job or a test), and whether the gateway has a
 * spend limit. Test makes one tiny call per vendor; its result shows next
 * to the button, and a failure also marks the vendor.
 */
function AiModelsStatus() {
  const { state, testModels } = useOrg();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: true } | { ok: false; message: string } | null>(null);
  const now = Date.now();

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const outcome = await testModels();
      const failures = Object.entries(outcome).filter(([, failure]) => failure);
      setResult(
        failures.length === 0
          ? { ok: true }
          : { message: failures.map(([vendor, failure]) => `${vendor === "anthropic" ? "Claude" : "GPT"}: ${failure}`).join(" "), ok: false },
      );
    } catch (err) {
      setResult({ message: err instanceof Error ? err.message : String(err), ok: false });
    } finally {
      setTesting(false);
    }
  };

  const billing = state.aiBilling === "credits" ? "Paid with Cloudflare credits." : "Paid with your API key.";
  const gatewayReady = state.providers.length > 0;
  return (
    <>
      <ul className={styles.checklist}>
        <li className={styles.checkItem} data-status="on">
          <div className={styles.checkHead}>
            <span className={styles.checkLabel}>Routing</span>
            <span className={styles.checkStatus}>Clef-Flash</span>
          </div>
          <p className={styles.hint}>
            A Cloudflare decision model picks the role for each job in under a second. If it is unavailable, the backup
            router model below picks instead.
          </p>
        </li>
        {VENDORS.map((vendor) => {
          const ready = state.providers.includes(vendor.id);
          const failure = state.modelHealth[vendor.id];
          const status = !ready ? "off" : failure ? "failing" : "on";
          return (
            <li className={styles.checkItem} data-status={status} key={vendor.id}>
              <div className={styles.checkHead}>
                <span className={styles.checkLabel}>{vendor.label}</span>
                <span className={styles.checkStatus}>
                  {status === "on" && "Set up"}
                  {status === "off" && "Not set up"}
                  {status === "failing" && "Error"}
                </span>
              </div>
              <p className={styles.hint}>{ready ? `Through your AI Gateway. ${billing}` : "Add it by rerunning setup."}</p>
              {failure && (
                <p className={styles.checkFailure} role="status">
                  {failure.message} <span className={styles.hint}>{formatAgo(failure.at, now)}.</span>
                </p>
              )}
            </li>
          );
        })}
        {gatewayReady && (
          <li className={styles.checkItem} data-status={state.spendLimits ? "on" : "failing"}>
            <div className={styles.checkHead}>
              <span className={styles.checkLabel}>Spend limit</span>
              <span className={styles.checkStatus}>{state.spendLimits ? "Set" : state.spendLimits === false ? "Not set" : "Not checked"}</span>
            </div>
            <p className={styles.hint}>
              {state.spendLimits ? "Your AI Gateway caps what Claude and GPT can spend." : "Recommended: cap what Claude and GPT can spend."}{" "}
              <a
                className={styles.checkLink}
                href={AI_GATEWAY_DASHBOARD}
                rel="noopener noreferrer"
                target="_blank"
                title="Set it under your gateway's Settings > Spend limits. This status updates the next time setup runs."
              >
                Open AI Gateway
              </a>
            </p>
          </li>
        )}
      </ul>
      {!gatewayReady && (
        <p className={styles.hint}>
          Claude and GPT are not set up yet, so jobs use the open model below, which needs the Workers Paid plan. Rerun
          setup to add them.
        </p>
      )}
      {gatewayReady && (
        <div className={styles.testRow}>
          <button className={styles.secondary} disabled={testing} onClick={() => void test()} type="button">
            {testing ? "Testing..." : "Test"}
          </button>
          {result?.ok && <span className={styles.testOk}>Success</span>}
          {result && !result.ok && (
            <span className={styles.testFailed} role="alert">
              {result.message}
            </span>
          )}
        </div>
      )}
    </>
  );
}

const THEME_OPTIONS: { label: string; value: ThemeChoice }[] = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
];

/** Light, dark or the device's setting; per device, so not an org setting. */
function AppearanceSection() {
  const choice = useThemeChoice();
  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Appearance</h3>
      <div aria-label="Theme" className={styles.tabs} role="radiogroup">
        {THEME_OPTIONS.map((option) => (
          <button
            aria-checked={choice === option.value}
            className={styles.tab}
            key={option.value}
            onClick={() => setThemeChoice(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className={styles.hint}>Saved on this device. System follows your device's light or dark setting.</p>
    </section>
  );
}

/**
 * For admins: everyone who has signed in, and who is an admin. Access (in
 * Cloudflare) decides who may sign in; this decides who may change things.
 */
/** A newer powerhouse release, and how to get it on this kind of deployment. */
function UpdateNotice({ setupKind }: { setupKind: "cli" | "browser" }) {
  const { updateStatus } = useOrg();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  useEffect(() => {
    updateStatus().then(setStatus, () => setStatus(null));
  }, [updateStatus]);
  if (!status?.latest) {
    return null;
  }
  if (!status.updateAvailable) {
    return <p className={styles.hint}>Up to date.</p>;
  }
  return (
    <div className={styles.notice}>
      <p className={styles.hint} style={{ margin: 0 }}>
        powerhouse {status.latest.version} is available.{" "}
        <a href={status.latest.url} rel="noreferrer" target="_blank">
          What changed
        </a>
      </p>
      <p className={styles.hint} style={{ margin: "6px 0 0" }}>
        {setupKind === "browser"
          ? "Merge the \u201cUpdate powerhouse\u201d pull request in your powerhouse repository on GitHub, and Cloudflare redeploys. None yet? Run the Update powerhouse workflow from the repository's Actions tab."
          : "In your powerhouse folder, run node setup.mjs --update."}
      </p>
    </div>
  );
}

function MembersSection() {
  const { listMembers, me, setAdmin } = useOrg();
  const [members, setMembers] = useState<MemberInfo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();

  const load = useCallback(() => listMembers().then(setMembers, (e: Error) => setError(e.message)), [listMembers]);
  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (member: MemberInfo) => {
    setBusy(member.email);
    setError(null);
    try {
      await setAdmin(member.email, !member.admin);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Members</h3>
      <p className={styles.hint}>
        Admins change settings, roles and connections, and can act on anyone's jobs and schedules. Members send jobs and
        manage their own. Who may sign in at all is set in your Cloudflare Access policy.
      </p>
      {!members && !error && <p className={styles.muted}>Loading...</p>}
      <ul className={styles.checklist}>
        {members?.map((member) => (
          <li className={styles.checkItem} data-status={member.admin ? "on" : "off"} key={member.email}>
            <div className={styles.checkHead}>
              <span className={styles.checkLabel}>
                {member.email}
                {member.email === me.email.toLowerCase() ? " (you)" : ""}
              </span>
              <span className={styles.checkStatus}>{member.admin ? "Admin" : "Member"}</span>
            </div>
            <p className={styles.hint}>
              Last seen {formatAgo(member.lastSeen, now)}
              {member.fromSetup && " · Admin from setup (change with node setup.mjs --admins)"}
            </p>
            {!member.fromSetup && (
              <div className={styles.actions}>
                <button
                  className={styles.secondary}
                  disabled={busy !== null}
                  onClick={() => void toggle(member)}
                  type="button"
                >
                  {member.admin ? "Make member" : "Make admin"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** How each MCP connection state reads in Settings, and its checklist tone. */
const CONNECTION_STATUS: Record<string, { label: string; status: "on" | "off" | "failing" }> = {
  authenticating: { label: "Needs sign-in", status: "failing" },
  connected: { label: "Connecting...", status: "off" },
  connecting: { label: "Connecting...", status: "off" },
  discovering: { label: "Connecting...", status: "off" },
  failed: { label: "Needs attention", status: "failing" },
  "not-connected": { label: "Not connected", status: "failing" },
  ready: { label: "Connected", status: "on" },
};

/**
 * Org-owned MCP connections: the team's accounts, connected once and used by
 * the roles allowed to. A sign-in popup is opened during the click, while it
 * still counts as a user gesture, and pointed at the provider afterwards.
 */
function ConnectionsSection() {
  const { addConnection, mcp, removeConnection, retryConnection, state } = useOrg();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const now = Date.now();

  const run = async (key: string, signIn: boolean, action: () => Promise<{ authUrl: string | null }>) => {
    setBusy(key);
    setError(null);
    const popup = signIn ? window.open("about:blank", "powerhouse-sign-in", "popup,width=520,height=720") : null;
    try {
      const { authUrl } = await action();
      // The sign-in page is the provider's: it must not be able to reach
      // back and redirect this tab, and only https pages are opened.
      if (authUrl && popup && /^https:/i.test(authUrl)) {
        popup.opener = null;
        popup.location.href = authUrl;
      } else {
        popup?.close();
      }
      return true;
    } catch (err) {
      popup?.close();
      setError(err instanceof Error ? err.message : String(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const add = async (key: string, source: ConnectionSource, signIn: boolean) => {
    if (await run(key, signIn, () => addConnection(source))) {
      setName("");
      setUrl("");
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    setError(null);
    try {
      await removeConnection(id);
      setConfirmRemove(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const available = CONNECTION_CATALOG.filter((entry) => !state.connections.some((c) => c.catalogId === entry.id));

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Connections</h3>
      <p className={styles.hint}>
        Connect your team's accounts once; roles use only the connections they are allowed in the Roles sheet. Tools that
        change anything wait for your approval.
      </p>
      {state.connections.length > 0 && (
        <ul className={styles.checklist}>
          {state.connections.map((connection) => (
            <ConnectionItem
              busy={busy === connection.id}
              confirmRemove={confirmRemove === connection.id}
              connection={connection}
              key={connection.id}
              now={now}
              onCancelRemove={() => setConfirmRemove(null)}
              onRemove={() => (confirmRemove === connection.id ? void remove(connection.id) : setConfirmRemove(connection.id))}
              onRetry={() => void run(connection.id, true, () => retryConnection(connection.id))}
              server={mcp.servers[connection.id]}
              tools={mcp.tools.filter((t) => t.serverId === connection.id).length}
            />
          ))}
        </ul>
      )}
      {available.length > 0 && (
        <ul className={styles.checklist}>
          {available.map((entry) => (
            <li className={styles.checkItem} data-status="off" key={entry.id}>
              <div className={styles.checkHead}>
                <span className={styles.checkLabel}>{entry.name}</span>
                <button
                  className={styles.secondary}
                  disabled={busy !== null}
                  onClick={() => void add(entry.id, { catalogId: entry.id }, entry.signIn)}
                  type="button"
                >
                  {busy === entry.id ? "Connecting..." : "Connect"}
                </button>
              </div>
              <p className={styles.hint}>{entry.description}</p>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.field}>
        <span className={styles.label}>Another server</span>
        <span className={styles.hint}>Any remote MCP server reachable over https. It may ask you to sign in.</span>
        <input className={styles.input} onChange={(e) => setName(e.target.value)} placeholder="Name" value={name} />
        <input
          className={styles.input}
          inputMode="url"
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/mcp"
          value={url}
        />
      </div>
      <div className={styles.actions}>
        <button
          className={styles.secondary}
          disabled={!url.trim() || busy !== null}
          onClick={() => void add("custom", { name, url }, true)}
          type="button"
        >
          {busy === "custom" ? "Connecting..." : "Connect server"}
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function ConnectionItem({
  busy,
  confirmRemove,
  connection,
  now,
  onCancelRemove,
  onRemove,
  onRetry,
  server,
  tools,
}: {
  busy: boolean;
  confirmRemove: boolean;
  connection: ConnectionInfo;
  now: number;
  onCancelRemove: () => void;
  onRemove: () => void;
  onRetry: () => void;
  server: { state: string; error: string | null } | undefined;
  tools: number;
}) {
  const status = CONNECTION_STATUS[server?.state ?? "not-connected"] ?? CONNECTION_STATUS["not-connected"];
  // Custom servers may have signed in; catalog entries say whether they do.
  const signIn = CONNECTION_CATALOG.find((entry) => entry.id === connection.catalogId)?.signIn ?? true;
  const needsAction = server?.state === "authenticating" || server?.state === "failed" || server?.state === "not-connected" || !server;
  return (
    <li className={styles.checkItem} data-status={status?.status}>
      <div className={styles.checkHead}>
        <span className={styles.checkLabel}>{connection.name}</span>
        <span className={styles.checkStatus}>{status?.label}</span>
      </div>
      <p className={styles.hint}>
        {server?.state === "ready" ? `${tools} ${tools === 1 ? "tool" : "tools"} · ` : ""}
        Added by {connection.addedBy}
        {connection.addedAt ? ` ${formatAgo(connection.addedAt, now)}` : ""}
      </p>
      {server?.error && server.state === "failed" && (
        <p className={styles.checkFailure} role="status">
          {server.error}
        </p>
      )}
      {confirmRemove && signIn && (
        <p className={styles.hint}>
          Removing deletes powerhouse's sign-in for {connection.name}. To revoke its access completely, also remove it
          from the connected apps in your {connection.name} account.
        </p>
      )}
      <div className={styles.actions}>
        {needsAction && !confirmRemove && (
          <button className={styles.secondary} disabled={busy} onClick={onRetry} type="button">
            {server?.state === "authenticating" ? "Sign in" : "Retry"}
          </button>
        )}
        {confirmRemove && (
          <button className={styles.secondary} disabled={busy} onClick={onCancelRemove} type="button">
            Cancel
          </button>
        )}
        <button className={confirmRemove ? styles.danger : styles.secondary} disabled={busy} onClick={onRemove} type="button">
          {confirmRemove ? `Remove ${connection.name}` : "Remove"}
        </button>
      </div>
    </li>
  );
}


/** Optional tools first, in the order an operator would usually turn them on. */
const CHECKLIST_ORDER: readonly ToolId[] = ["webSearch", "browser", "sendEmail", "webFetch"];

/**
 * What to put in wrangler.local.jsonc in the deployment's GitHub repository
 * to turn a tool on, for deployments made with Deploy to Cloudflare: bindings
 * come from the repository, and a commit redeploys through Workers Builds.
 * The build merges that file over wrangler.jsonc, and powerhouse updates
 * never touch it, so the person's settings never conflict with an update.
 */
const REPO_SNIPPETS: Partial<Record<ToolId, { steps: string; snippet: string }>> = {
  browser: {
    snippet: `{\n  "browser": { "binding": "BROWSER" },\n  "worker_loaders": [{ "binding": "LOADER" }]\n}`,
    steps:
      "Needs the Workers Paid plan. In your powerhouse repository on GitHub, create a file named wrangler.local.jsonc with these lines (if it already exists, add the two entries inside its braces) and commit. Cloudflare redeploys, and this shows On.",
  },
  sendEmail: {
    snippet: `{\n  "send_email": [{ "name": "EMAIL" }],\n  "vars": { "EMAIL_FROM": "powerhouse@your-domain.com" }\n}`,
    steps:
      "First add a domain you own to Cloudflare Email Service (its DNS must be on Cloudflare). Then, in your powerhouse repository on GitHub, create a file named wrangler.local.jsonc with these lines and your sender address (if it already exists, add the two entries inside its braces) and commit. Sending to anyone but your verified addresses needs Workers Paid.",
  },
};

function ChecklistItem({
  configured,
  failure,
  id,
  open,
  setupKind,
}: {
  configured: boolean;
  failure?: FeatureFailure;
  id: ToolId;
  open: boolean;
  setupKind: "cli" | "browser";
}) {
  const { isAdmin, setWebSearch } = useOrg();
  const info = TOOL_INFO[id];
  const status = !configured ? "off" : failure ? "failing" : "on";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const repo = REPO_SNIPPETS[id];
  // Web search has no binding: on browser-set-up deployments it is a switch here.
  const switchable = id === "webSearch" && setupKind === "browser" && isAdmin;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await setWebSearch(!configured);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <li className={styles.checkItem} data-status={status}>
      <div className={styles.checkHead}>
        <span className={styles.checkLabel}>{info.label}</span>
        <span className={styles.checkStatus}>
          {status === "on" && (info.setup ? "On" : "Always on")}
          {status === "off" && "Off"}
          {status === "failing" && "Needs attention"}
        </span>
      </div>
      <p className={styles.hint}>
        {info.description} · Billed: {info.cost}
        {info.needsWorkersPaid && " · Workers Paid"}
      </p>
      {status === "failing" && failure && (
        <p className={styles.checkFailure} role="status">
          {failure.message} · {formatAgo(failure.at, Date.now())}
        </p>
      )}
      {switchable && (
        <div className={styles.actions}>
          <button className={styles.secondary} disabled={busy} onClick={() => void toggle()} type="button">
            {configured ? "Turn off web search" : "Turn on web search"}
          </button>
        </div>
      )}
      {status === "off" && !switchable && (
        <details className={styles.guide} open={open}>
          <summary>How to turn it on</summary>
          {setupKind === "browser" && repo ? (
            <>
              <p className={styles.hint}>{repo.steps}</p>
              <pre className={styles.snippet}>{repo.snippet}</pre>
              <div className={styles.actions}>
                <button className={styles.secondary} onClick={() => void copy(repo.snippet)} type="button">
                  {copied ? "Copied" : "Copy lines"}
                </button>
              </div>
            </>
          ) : setupKind === "browser" && id === "webSearch" ? (
            <p className={styles.hint}>An admin can turn it on here. Each search bills through your AI Gateway.</p>
          ) : (
            info.setup && <p className={styles.hint}>{info.setup}</p>
          )}
        </details>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {status !== "on" && info.link && (
        <a className={styles.checkLink} href={info.link.href} rel="noreferrer" target="_blank">
          {info.link.label}
        </a>
      )}
    </li>
  );
}
