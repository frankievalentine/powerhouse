import { type AttachmentInfo, LIVE_PHASES, type RoleSummary, type RunSummary, runnableSuggestions, UPLOAD_LIMITS } from "../../shared";
import { ArrowUp, Clock, CornerDownRight, Paperclip, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentGlyph } from "../components/agent-state";
import { oklchToRgb, prefersReducedMotion } from "../lib/color";
import { useResolvedTheme } from "../lib/theme";
import { plainText } from "../lib/plain-text";
import { formatAgo, formatElapsed, useNow } from "../lib/time";
import { useOrg } from "../org/org-context";
import { spentToday } from "../lib/spend";
import { useShell } from "../shell/pulse-shell";
import { type BallSpec, PulseBlob } from "./blob";
import styles from "./pulse.module.css";

const ROUTED_NOTICE_MS = 3200;
const EARLIER_LIMIT = 5;
const SETUP_HINT_KEY = "powerhouse.setupHintDismissed";

/** Per-browser dismissal; storage can be unavailable (private windows, blocked site data). */
function useSetupHintDismissed() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(SETUP_HINT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(SETUP_HINT_KEY, "1");
    } catch {
      // Dismissed for this page load only.
    }
  };
  return [dismissed, dismiss] as const;
}

/** A run with no role was never routed; a role id with no role was deleted. */
function roleLabel(run: RunSummary, role: RoleSummary | undefined) {
  if (!run.roleId) {
    return run.phase === "routing" ? "Routing" : "Not routed";
  }
  return role?.name ?? run.roleId;
}

/** The idle sphere: pearl on the light page, a darker stone on the dark one. */
const CORE_LIGHT: [number, number, number] = [0.93, 0.91, 0.88];
const CORE_DARK: [number, number, number] = [0.42, 0.39, 0.36];

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusSentence(connected: boolean, live: number, approvals: number) {
  if (!connected) {
    return "Connecting...";
  }
  if (live === 0) {
    return "Everything is quiet.";
  }
  const working = `${live} ${live === 1 ? "job is" : "jobs are"} running`;
  return approvals > 0 ? `${working}. ${approvals} ${approvals === 1 ? "needs" : "need"} you.` : `${working}.`;
}

/** Loaded only when voice is on, so its code stays out of everyone else's page. */
const Dictation = lazy(() => import("./dictation"));

export function PulsePage() {
  const blobHost = useRef<HTMLDivElement>(null);
  const blobRef = useRef<PulseBlob | null>(null);
  const { state, rolesById, connected, orgId, isAdmin, me } = useOrg();
  const theme = useResolvedTheme();
  const roleOf = (run: RunSummary) => (run.roleId ? rolesById[run.roleId] : undefined);
  const { dispatchAndOpen, dispatchError, openJob, openRoles, openSchedules, openSettings } = useShell();
  const now = useNow(1000);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<AttachmentInfo[]>([]);
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const addDictation = useCallback((said: string) => {
    if (said) {
      setText((current) => (current.trim() ? `${current.trimEnd()} ${said}` : said));
    }
  }, []);
  const [routed, setRouted] = useState<{ role: RoleSummary; unsure: boolean } | null>(null);
  // The run just sent from the composer, until routing gives it a role.
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [hintDismissed, dismissHint] = useSetupHintDismissed();
  // Wait for the Org's state: the placeholder has every optional tool off.
  const offTools = [
    !state.capabilities.webSearch && "Web search",
    !state.capabilities.browser && "the browser",
    !state.capabilities.sendEmail && "email",
  ].filter((t): t is string => Boolean(t));
  const showSetupHint = connected && !hintDismissed && offTools.length > 0;
  const offText =
    offTools.length === 1
      ? `${capitalize(offTools[0] ?? "")} is off.`
      : `${capitalize(offTools.slice(0, -1).join(", "))} and ${offTools.at(-1)} are off.`;

  const live = state.runs.filter((r) => LIVE_PHASES.has(r.phase));
  const budget = state.settings.dailyBudgetUsd;
  const overBudget = budget > 0 && spentToday(state.spend, state.settings.timeZone) >= budget;
  const earlier = state.runs.filter((r) => !LIVE_PHASES.has(r.phase)).slice(0, EARLIER_LIMIT);
  // Only approvals this viewer can give: their own jobs, or anyone's for admins.
  const approvals = live.filter(
    (r) => r.phase === "awaiting_approval" && (isAdmin || r.startedBy?.toLowerCase() === me.email.toLowerCase()),
  ).length;
  // Each role's first suggestion that can run here (tools on, website set).
  const suggestions = useMemo(() => {
    const ctx = { capabilities: state.capabilities, me: me.email, website: state.settings.website };
    return state.roles.flatMap((r) =>
      runnableSuggestions(r.suggestions, ctx)
        .slice(0, 1)
        .map((text) => ({ roleId: r.id, text })),
    );
  }, [state.roles, state.capabilities, state.settings.website, me.email]);
  const liveKey = live.map((r) => `${r.runId}:${r.phase === "awaiting_approval"}:${r.roleId}`).join();

  useEffect(() => {
    const host = blobHost.current;
    if (!host) {
      return;
    }
    const blob = new PulseBlob(host, prefersReducedMotion() ? 0.15 : 1);
    blobRef.current = blob;
    return () => {
      blob.dispose();
      blobRef.current = null;
    };
  }, []);

  // liveKey captures membership, approval state and role; `live` is a new array every update.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on liveKey
  useEffect(() => {
    const balls: BallSpec[] = [
      {
        alert: 0,
        color: theme === "dark" ? CORE_DARK : CORE_LIGHT,
        id: "core",
        radius: 0.5 + Math.min(live.length, 6) * 0.02,
      },
      ...live.slice(0, 8).map((run) => ({
        alert: run.phase === "awaiting_approval" ? 1 : 0,
        // Gray until routing picks a role.
        color: oklchToRgb(0.78, run.roleId ? 0.14 : 0, roleOf(run)?.hue ?? 0),
        id: run.runId,
        radius: 0.2,
      })),
    ];
    blobRef.current?.setBalls(balls);
    blobRef.current?.energy(Math.min(1, live.length / 6));
  }, [liveKey, rolesById, theme]);

  const pendingRun = pendingRunId ? state.runs.find((r) => r.runId === pendingRunId) : undefined;
  useEffect(() => {
    // The run's row may not have synced yet; keep waiting until it has.
    if (!pendingRun) {
      return;
    }
    if (pendingRun.roleId) {
      const role = rolesById[pendingRun.roleId];
      setRouted(role ? { role, unsure: pendingRun.routedUnsure === true } : null);
      setPendingRunId(null);
    } else if (pendingRun.phase !== "routing") {
      // Canceled or failed before a role was picked; the pill says why.
      setPendingRunId(null);
    }
  }, [pendingRun, rolesById]);

  useEffect(() => {
    if (!routed) {
      return;
    }
    const id = setTimeout(() => setRouted(null), ROUTED_NOTICE_MS);
    return () => clearTimeout(id);
  }, [routed]);

  // A suggestion names its role, so it skips the router. Attached files go
  // with what is typed in the composer, not with a suggestion.
  const send = async (prompt: string, roleId?: string) => {
    const value = prompt.trim();
    if (!value || sending || uploading > 0) {
      return;
    }
    setSending(true);
    const attached = roleId ? [] : files.map((f) => f.id);
    const result = await dispatchAndOpen(value, roleId, attached);
    setSending(false);
    if (result) {
      setText("");
      if (attached.length > 0) {
        setFiles([]);
      }
      setRouted(null);
      setPendingRunId(result.runId);
    }
  };

  /** Each file becomes text on the server (Workers AI for documents) before the job is sent. */
  const attach = async (picked: FileList | File[]) => {
    setUploadError(null);
    const room = UPLOAD_LIMITS.files - files.length;
    const list = [...picked].slice(0, Math.max(room, 0));
    if (picked.length > list.length) {
      setUploadError(`Attach up to ${UPLOAD_LIMITS.files} files to a job.`);
    }
    for (const file of list) {
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/uploads", { body, method: "POST" });
        const result = (await response.json()) as AttachmentInfo & { error?: string };
        if (!response.ok) {
          throw new Error(result.error ?? `Could not attach ${file.name}.`);
        }
        setFiles((current) => [...current, { chars: result.chars, id: result.id, name: result.name }]);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <span className={styles.wordmark}>powerhouse</span>
        <span className={styles.org}>{state.settings.orgName || orgId}</span>
        <button className={styles.headerLink} onClick={openRoles} type="button">
          Roles
        </button>
        <button className={`${styles.headerLink} ${styles.headerLinkNext}`} onClick={openSchedules} type="button">
          Schedules
        </button>
        <button className={`${styles.headerLink} ${styles.headerLinkNext}`} onClick={() => openSettings()} type="button">
          Settings
          {isAdmin && state.memoryProposals > 0 && (
            <span className={styles.reviewCount} title="Team memory notes to review">
              {state.memoryProposals}
            </span>
          )}
        </button>
        <a className={styles.signout} href="/cdn-cgi/access/logout">
          Sign out
        </a>
      </header>

      <section className={styles.hero}>
        <div aria-hidden="true" className={styles.blob} ref={blobHost} />
        <p aria-live="polite" className={styles.status}>
          {statusSentence(connected, live.length, approvals)}
        </p>
      </section>

      <form
        className={styles.composer}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          if (e.dataTransfer.files.length > 0) {
            e.preventDefault();
            void attach(e.dataTransfer.files);
          }
        }}
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
      >
        <label className="sr-only" htmlFor="pulse-ask">
          Describe a job
        </label>
        <textarea
          className={styles.input}
          id="pulse-ask"
          maxLength={4000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          placeholder="What needs doing?"
          rows={2}
          value={text}
        />
        {heard && (
          <p aria-live="polite" className={styles.heard}>
            {heard}
          </p>
        )}
        {(files.length > 0 || uploading > 0) && (
          <ul aria-label="Attached files" className={styles.files}>
            {files.map((f) => (
              <li className={styles.fileChip} key={f.id}>
                <span>{f.name}</span>
                <button
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((current) => current.filter((x) => x.id !== f.id))}
                  type="button"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
            {uploading > 0 && <li className={styles.fileChip}>Reading {uploading === 1 ? "a file" : `${uploading} files`}...</li>}
          </ul>
        )}
        <div className={styles.composerFoot}>
          <span aria-live="polite" className={styles.route} data-visible={sending || pendingRunId || routed ? true : undefined}>
            {(sending || pendingRunId) && (state.settings.autoRoute ? "Routing..." : "Sending...")}
            {!(sending || pendingRunId) && routed && (
              <>
                <CornerDownRight size={13} />
                Sent to <b style={{ ["--dept-hue" as string]: routed.role.hue }}>{routed.role.name}</b>
                {routed.unsure && " (unsure which role fits)"}
              </>
            )}
          </span>
          <span className={styles.composerActions}>
            <input
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ods,.odt,.txt,.md,.csv,.tsv,.json,.xml,.html,.htm"
              hidden
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  void attach(e.target.files);
                }
                e.target.value = "";
              }}
              ref={fileInput}
              type="file"
            />
            {state.settings.voice && (
              <Suspense fallback={null}>
                <Dictation disabled={sending} onInterim={setHeard} onText={addDictation} orgId={orgId} />
              </Suspense>
            )}
            <button
              aria-label="Attach files"
              className={styles.attach}
              disabled={sending || files.length >= UPLOAD_LIMITS.files}
              onClick={() => fileInput.current?.click()}
              title="Attach documents or text (up to 5 files, 5 MB each)"
              type="button"
            >
              <Paperclip size={15} />
            </button>
            <button aria-label="Send" className={styles.send} disabled={!text.trim() || sending || uploading > 0} type="submit">
              <ArrowUp size={16} />
            </button>
          </span>
        </div>
      </form>
      {uploadError && (
        <p className={styles.error} role="alert">
          {uploadError}
        </p>
      )}
      {dispatchError && (
        <p className={styles.error} role="alert">
          {dispatchError}
        </p>
      )}
      {overBudget && (
        <p className={styles.budgetNote} role="status">
          Today's estimated spend reached the daily budget, so scheduled jobs are paused until tomorrow. Jobs you send
          still run.
        </p>
      )}
      <div className={styles.suggestions}>
        {suggestions.map((s) => (
          <button
            className={styles.suggestion}
            disabled={sending}
            key={`${s.roleId}:${s.text}`}
            onClick={() => void send(s.text, s.roleId)}
            type="button"
          >
            {s.text}
          </button>
        ))}
      </div>

      <section aria-label="Running now" className={styles.list}>
        {live.map((run) => {
          const role = roleOf(run);
          return (
            <button
              className={styles.pill}
              data-alert={run.phase === "awaiting_approval" || undefined}
              data-routing={!run.roleId || undefined}
              data-job-anchor={run.runId}
              key={run.runId}
              onClick={(e) => openJob(run.runId, e.currentTarget)}
              style={{ ["--dept-hue" as string]: role?.hue ?? 0 }}
              type="button"
            >
              <AgentGlyph state={run.phase} />
              <span className={styles.pillRole}>
                {run.scheduleId && <Clock aria-label="Scheduled" className={styles.pillScheduled} size={11} />}
                {roleLabel(run, role)}
              </span>
              <span className={styles.pillActivity}>
                {run.phase === "awaiting_approval" ? (run.activity ?? "Needs you") : (run.activity ?? run.prompt)}
              </span>
              <span className={styles.pillTime}>{formatElapsed(run.startedAt, now)}</span>
            </button>
          );
        })}
      </section>

      {earlier.length > 0 && (
        <details className={styles.earlier}>
          <summary>Earlier</summary>
          {earlier.map((run) => (
            <button
              className={styles.pill}
              data-job-anchor={run.runId}
              data-muted
              key={run.runId}
              onClick={(e) => openJob(run.runId, e.currentTarget)}
              type="button"
            >
              <AgentGlyph state={run.phase} />
              <span className={styles.pillRole}>
                {run.scheduleId && <Clock aria-label="Scheduled" className={styles.pillScheduled} size={11} />}
                {roleLabel(run, roleOf(run))}
              </span>
              <span className={styles.pillActivity}>{run.summary ? plainText(run.summary) : (run.error ?? run.prompt)}</span>
              <span className={styles.pillTime}>{formatAgo(run.completedAt ?? run.startedAt, now)}</span>
            </button>
          ))}
        </details>
      )}
      {showSetupHint && (
        <p className={styles.setupHint}>
          {offText}{" "}
          <button className={styles.setupHintLink} onClick={() => openSettings("tools")} type="button">
            Set up
          </button>
          <button aria-label="Dismiss" className={styles.setupHintDismiss} onClick={dismissHint} type="button">
            <X size={13} />
          </button>
        </p>
      )}
      <p className={styles.footnote}>Cmd+K to pick a role yourself.</p>
    </main>
  );
}
