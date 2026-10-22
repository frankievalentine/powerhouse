import { type RoleConfig, type RoleTemplate, TOOL_INFO, type ToolId } from "../../shared";
import { Check } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useOrg } from "../org/org-context";
import styles from "./team-picker.module.css";

interface Choice {
  /** A default role id, or a library template id. */
  id: string;
  kind: "default" | "template";
  name: string;
  purpose: string;
  tools: ToolId[];
}

/** Shows the team picker instead of the page while a new org has not picked its roles. */
export function TeamGate({ children }: { children: ReactNode }) {
  const { connected, state } = useOrg();
  return connected && state.teamPending ? <TeamPicker /> : children;
}

function TeamPicker() {
  const { chooseTeam, listLibrary, listRoles, state } = useOrg();
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fallbackId = state.settings.fallbackRoleId;

  useEffect(() => {
    Promise.all([listRoles(), listLibrary()]).then(
      ([roles, templates]: [RoleConfig[], RoleTemplate[]]) => {
        setChoices([
          ...roles.map((r): Choice => ({ id: r.id, kind: "default", name: r.name, purpose: r.purpose, tools: r.tools })),
          ...templates.map((t): Choice => ({ id: t.id, kind: "template", name: t.name, purpose: t.purpose, tools: t.tools })),
        ]);
        setSelected(new Set(roles.map((r) => r.id)));
      },
      (e: Error) => setError(e.message),
    );
  }, [listLibrary, listRoles]);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  };

  const submit = async (useDefaults: boolean) => {
    if (!choices) {
      return;
    }
    setBusy(true);
    setError(null);
    const picked = useDefaults ? choices.filter((c) => c.kind === "default") : choices.filter((c) => selected.has(c.id));
    try {
      await chooseTeam({
        add: picked.filter((c) => c.kind === "template").map((c) => c.id),
        keep: picked.filter((c) => c.kind === "default").map((c) => c.id),
      });
    } catch (e) {
      // Another member may have picked first; the Org's state closes the picker then.
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const count = choices ? choices.filter((c) => c.id === fallbackId || selected.has(c.id)).length : 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.wordmark}>powerhouse</span>
        <h1 className={styles.title}>Pick your team</h1>
        <p className={styles.intro}>
          Each role is an agent with its own instructions and tools. Start with the ones your team will use; jobs are
          routed to the best fit. You can add, edit or remove roles anytime under Roles.
        </p>
      </header>

      {!choices && !error && <p className={styles.muted}>Loading roles...</p>}
      {choices && (
        <ul className={styles.grid}>
          {choices.map((choice) => {
            const locked = choice.id === fallbackId;
            const checked = locked || selected.has(choice.id);
            const off = choice.tools.filter((t) => !state.capabilities[t]);
            return (
              <li key={choice.id}>
                <button
                  aria-pressed={checked}
                  className={styles.card}
                  disabled={locked || busy}
                  onClick={() => toggle(choice.id)}
                  type="button"
                >
                  <span className={styles.cardHead}>
                    <span className={styles.cardName}>{choice.name}</span>
                    <span aria-hidden="true" className={styles.check} data-checked={checked || undefined}>
                      {checked && <Check size={13} strokeWidth={3} />}
                    </span>
                  </span>
                  <span className={styles.cardPurpose}>{choice.purpose}</span>
                  <span className={styles.cardTools}>{choice.tools.map((t) => TOOL_INFO[t].label).join(" / ")}</span>
                  {locked && <span className={styles.cardNote}>Always included: takes jobs no other role fits.</span>}
                  {!locked && off.length > 0 && (
                    <span className={styles.cardNote}>
                      {off.map((t) => TOOL_INFO[t].label).join(" and ")} {off.length === 1 ? "is" : "are"} off in this
                      deployment; see Settings to turn {off.length === 1 ? "it" : "them"} on.
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button className={styles.primary} disabled={!choices || busy} onClick={() => void submit(false)} type="button">
          {busy ? "Setting up..." : `Start with ${count} ${count === 1 ? "role" : "roles"}`}
        </button>
        <button className={styles.secondary} disabled={!choices || busy} onClick={() => void submit(true)} type="button">
          Use the defaults
        </button>
      </div>
    </main>
  );
}
