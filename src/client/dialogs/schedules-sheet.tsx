import { SCHEDULE_LIMITS, type ScheduleInfo, type ScheduleRule } from "../../shared";
import { ChevronRight, Plus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { formatAgo } from "../lib/time";
import { type ScheduleDraft, useOrg } from "../org/org-context";
import { useShell } from "../shell/pulse-shell";
import styles from "./sheet.module.css";
import { useModal } from "./use-modal";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function describeRule(rule: ScheduleRule) {
  switch (rule.kind) {
    case "daily":
      return `Every day at ${rule.time}`;
    case "weekdays":
      return `Weekdays at ${rule.time}`;
    case "weekly":
      return `${rule.days.map((d) => DAY_NAMES[d]).join(", ")} at ${rule.time}`;
    case "hourly":
      return rule.every === 1 ? "Every hour" : `Every ${rule.every} hours`;
  }
}

function formatNextRun(ms: number) {
  return new Date(ms).toLocaleString(undefined, { day: "numeric", hour: "2-digit", minute: "2-digit", month: "short", weekday: "short" });
}

/**
 * Recurring jobs: a prompt for a fixed role on a repeat rule, in the org's
 * time zone. Org arms each schedule's next run and records what happened.
 */
export function SchedulesSheet({ onClose }: { onClose: () => void }) {
  const { dialogProps, close } = useModal(onClose);
  const { openRun } = useShell();
  const { state } = useOrg();
  const [editing, setEditing] = useState<ScheduleDraft | null>(null);
  const timeZone = state.settings.timeZone;

  return (
    <dialog {...dialogProps} aria-label="Schedules" className={styles.dialog}>
      <div className={styles.sheet}>
        <header className={styles.head}>
          {editing ? (
            <button className={styles.textButton} onClick={() => setEditing(null)} type="button">
              All schedules
            </button>
          ) : (
            <h2 className={styles.title}>Schedules</h2>
          )}
          <button aria-label="Close" className={styles.iconButton} onClick={close} type="button">
            <X size={15} />
          </button>
        </header>
        {editing ? (
          <ScheduleEditor draft={editing} onDone={() => setEditing(null)} />
        ) : (
          <div className={styles.body}>
            <p className={styles.muted}>
              Jobs that run on their own, for a role you pick. Times are in{" "}
              {timeZone || `${browserTimeZone()} (set when you save the first schedule)`}; change it in Settings.
            </p>
            <ScheduleList
              onEdit={setEditing}
              onStarted={(runId) => {
                close();
                openRun(runId);
              }}
              schedules={state.schedules}
            />
            <button
              className={styles.primary}
              disabled={state.schedules.length >= SCHEDULE_LIMITS.schedules}
              onClick={() =>
                setEditing({
                  enabled: true,
                  prompt: "",
                  roleId: state.settings.fallbackRoleId,
                  rule: { kind: "weekdays", time: "09:00" },
                })
              }
              type="button"
            >
              <Plus size={14} /> New schedule
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

function ScheduleList({
  schedules,
  onEdit,
  onStarted,
}: {
  schedules: ScheduleInfo[];
  onEdit: (draft: ScheduleDraft) => void;
  onStarted: (runId: string) => void;
}) {
  const { rolesById, runScheduleNow, isAdmin, me } = useOrg();
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();

  const runNow = async (id: string) => {
    setRunning(id);
    setError(null);
    try {
      const { runId } = await runScheduleNow(id);
      onStarted(runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(null);
    }
  };

  if (schedules.length === 0) {
    return <p className={styles.muted}>No schedules yet.</p>;
  }
  return (
    <>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <ul className={styles.list}>
        {schedules.map((schedule) => {
          const role = rolesById[schedule.roleId];
          return (
            <li className={styles.scheduleRow} key={schedule.id} style={{ ["--dept-hue" as string]: role?.hue ?? 0 }}>
              <button className={styles.row} onClick={() => onEdit(schedule)} type="button">
                <span className={styles.swatch} />
                <span className={styles.rowText}>
                  <span className={styles.rowName}>
                    {describeRule(schedule.rule)} · {role?.name ?? "Deleted role"}
                  </span>
                  <span className={styles.rowPurpose}>{schedule.prompt}</span>
                  <span className={styles.rowTools}>
                    {schedule.nextRunAt ? `Next: ${formatNextRun(schedule.nextRunAt)}` : "Paused"}
                    {schedule.last &&
                      ` · Last: ${schedule.last.skipped ? `skipped ${formatAgo(schedule.last.at, now)} (${schedule.last.skipped})` : `ran ${formatAgo(schedule.last.at, now)}`}`}
                  </span>
                </span>
                <ChevronRight className={styles.chevron} size={15} />
              </button>
              <button
                className={styles.secondary}
                disabled={running !== null || !role || !(isAdmin || schedule.createdBy === me.email.toLowerCase())}
                onClick={() => void runNow(schedule.id)}
                type="button"
              >
                {running === schedule.id ? "Starting..." : "Run now"}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function ScheduleEditor({ draft, onDone }: { draft: ScheduleDraft; onDone: () => void }) {
  const { deleteSchedule, saveSchedule, state, isAdmin, me } = useOrg();
  // Members edit their own schedules; admins edit all.
  const canEdit = isAdmin || !draft.id || draft.createdBy === me.email.toLowerCase();
  const [prompt, setPrompt] = useState(draft.prompt);
  const [roleId, setRoleId] = useState(draft.roleId);
  const [enabled, setEnabled] = useState(draft.enabled);
  const [kind, setKind] = useState<ScheduleRule["kind"]>(draft.rule.kind);
  const [time, setTime] = useState("time" in draft.rule ? draft.rule.time : "09:00");
  const [days, setDays] = useState<number[]>(draft.rule.kind === "weekly" ? draft.rule.days : [1]);
  const [every, setEvery] = useState(draft.rule.kind === "hourly" ? draft.rule.every : 6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rule = (): ScheduleRule =>
    kind === "hourly" ? { every, kind } : kind === "weekly" ? { days, kind, time } : { kind, time };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The org adopts this browser's time zone if it has none yet.
      await saveSchedule({ enabled, id: draft.id, prompt, roleId, rule: rule(), timeZone: browserTimeZone() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft.id) {
      return;
    }
    setBusy(true);
    try {
      await deleteSchedule(draft.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const toggleDay = (day: number) =>
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));

  return (
    <form className={styles.body} onSubmit={submit}>
      {!canEdit && <p className={styles.notice}>Only {draft.createdBy} or an admin can change this schedule.</p>}
      <fieldset className={styles.plainFieldset} disabled={!canEdit}>
      <label className={styles.field}>
        <span className={styles.label}>Job</span>
        <span className={styles.hint}>What to do each time, written like any job you send.</span>
        <textarea
          className={styles.textarea}
          maxLength={SCHEDULE_LIMITS.prompt}
          onChange={(e) => setPrompt(e.target.value)}
          required
          rows={4}
          value={prompt}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Role</span>
        <select className={styles.input} onChange={(e) => setRoleId(e.target.value)} value={roleId}>
          {state.roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Repeats</span>
        <select className={styles.input} onChange={(e) => setKind(e.target.value as ScheduleRule["kind"])} value={kind}>
          <option value="daily">Every day</option>
          <option value="weekdays">Weekdays</option>
          <option value="weekly">On chosen days</option>
          <option value="hourly">Every few hours</option>
        </select>
      </label>

      {kind === "weekly" && (
        <fieldset className={styles.field}>
          <legend className={styles.label}>Days</legend>
          <div className={styles.dayPicker}>
            {DAY_NAMES.map((name, day) => (
              <label className={styles.check} key={name}>
                <input checked={days.includes(day)} onChange={() => toggleDay(day)} type="checkbox" />
                <span>{name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {kind === "hourly" ? (
        <label className={styles.field}>
          <span className={styles.label}>Every how many hours</span>
          <input
            className={styles.input}
            max={SCHEDULE_LIMITS.maxHours}
            min={SCHEDULE_LIMITS.minHours}
            onChange={(e) => setEvery(Number(e.target.value))}
            type="number"
            value={every}
          />
        </label>
      ) : (
        <label className={styles.field}>
          <span className={styles.label}>Time</span>
          <span className={styles.hint}>In {state.settings.timeZone || browserTimeZone()}.</span>
          <input className={styles.input} onChange={(e) => setTime(e.target.value)} required type="time" value={time} />
        </label>
      )}

      <label className={styles.check}>
        <input checked={enabled} onChange={(e) => setEnabled(e.target.checked)} type="checkbox" />
        <span>
          <span>On</span>
          <span className={styles.hint}>Paused schedules keep their settings and do not run.</span>
        </span>
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      </fieldset>
      {canEdit && (
      <div className={styles.actions}>
        {draft.id &&
          (confirmDelete ? (
            <button className={styles.danger} disabled={busy} onClick={() => void remove()} type="button">
              Delete this schedule?
            </button>
          ) : (
            <button className={styles.secondary} disabled={busy} onClick={() => setConfirmDelete(true)} type="button">
              Delete
            </button>
          ))}
        <button className={styles.primary} disabled={busy || (kind === "weekly" && days.length === 0)} type="submit">
          {draft.id ? "Save" : "Create schedule"}
        </button>
      </div>
      )}
    </form>
  );
}
