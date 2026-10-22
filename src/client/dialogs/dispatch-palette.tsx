import { LIVE_PHASES, type RoleSummary, runnableSuggestions } from "../../shared";
import { CornerDownLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { AgentGlyph } from "../components/agent-state";
import { useOrg } from "../org/org-context";
import styles from "./dialogs.module.css";
import { useModal } from "./use-modal";

/** Cmd+K: pick the role yourself instead of letting the router choose. */
export function DispatchPalette({
  initialRoleId,
  onClose,
  onDispatch,
}: {
  initialRoleId?: string;
  onClose: () => void;
  onDispatch: (roleId: string, prompt: string) => void;
}) {
  const { dialogProps } = useModal(onClose);
  const { state, rolesById, me } = useOrg();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [role, setRole] = useState<RoleSummary | undefined>(
    initialRoleId ? rolesById[initialRoleId] : undefined,
  );
  const [prompt, setPrompt] = useState("");

  const busy = useMemo(
    () => new Set(state.runs.filter((r) => LIVE_PHASES.has(r.phase)).map((r) => r.roleId)),
    [state.runs],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.roles.filter(
      (r) => !q || r.name.toLowerCase().includes(q) || r.purpose.toLowerCase().includes(q),
    );
  }, [query, state.roles]);

  const submit = () => {
    if (role && prompt.trim()) {
      onDispatch(role.id, prompt.trim());
    }
  };

  return (
    <dialog {...dialogProps} aria-label="Dispatch a job" className={styles.dialog}>
      <div className={`${styles.panel} ${styles.palette}`}>
        {role ? (
          <>
            <div className={styles.selected} style={{ ["--dept-hue" as string]: role.hue }}>
              <span className={styles.swatch} style={{ marginTop: 0 }} />
              <strong>{role.name}</strong>
              <button
                className={styles.back}
                onClick={() => setRole(undefined)}
                style={{ marginLeft: "auto" }}
                type="button"
              >
                Change role
              </button>
            </div>
            <textarea
              aria-label="Job description"
              autoFocus
              className={styles.prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={`What should the ${role.name.toLowerCase()} do?`}
              value={prompt}
            />
            <div className={styles.suggestions}>
              {runnableSuggestions(role.suggestions, {
                capabilities: state.capabilities,
                me: me.email,
                website: state.settings.website,
              }).map((p) => (
                <button className={styles.suggestion} key={p} onClick={() => setPrompt(p)} type="button">
                  {p}
                </button>
              ))}
            </div>
            <div className={styles.footer}>
              <span>
                <kbd>Shift</kbd> + <kbd>Enter</kbd> new line
              </span>
              <button className={styles.run} disabled={!prompt.trim()} onClick={submit} type="button">
                Run job
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              aria-label="Search roles"
              autoFocus
              className={styles.search}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  const r = filtered[active];
                  if (r) {
                    setRole(r);
                  }
                }
              }}
              placeholder="Which role should do the work?"
              value={query}
            />
            <div className={styles.list} role="listbox">
              {filtered.map((r, i) => (
                <button
                  aria-selected={i === active}
                  className={styles.option}
                  data-active={i === active}
                  key={r.id}
                  onClick={() => setRole(r)}
                  onMouseEnter={() => setActive(i)}
                  role="option"
                  style={{ ["--dept-hue" as string]: r.hue }}
                  type="button"
                >
                  <AgentGlyph state={busy.has(r.id) ? "running" : "idle"} />
                  <span>{r.name}</span>
                  <span className={styles.optionPurpose}>{r.purpose}</span>
                </button>
              ))}
            </div>
            <div className={styles.footer}>
              <span>
                <kbd>Up</kbd> <kbd>Down</kbd> to move, <CornerDownLeft size={11} /> to pick
              </span>
              <span style={{ marginLeft: "auto" }}>
                <kbd>Esc</kbd> to close
              </span>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
