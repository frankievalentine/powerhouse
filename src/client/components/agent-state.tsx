import type { RunPhase } from "../../shared";
import clsx from "clsx";
import styles from "./agent-state.module.css";

export type AgentStateValue = RunPhase | "idle";

const LABELS: Record<AgentStateValue, string> = {
  aborted: "Stopped",
  awaiting_approval: "Needs you",
  completed: "Done",
  error: "Failed",
  idle: "Idle",
  interrupted: "Interrupted",
  routing: "Routing",
  running: "Working",
};

const TONE: Record<AgentStateValue, "spin" | "warn" | "ok" | "bad" | "rest"> = {
  aborted: "rest",
  awaiting_approval: "warn",
  completed: "ok",
  error: "bad",
  idle: "rest",
  interrupted: "bad",
  routing: "spin",
  running: "spin",
};

export function agentStateLabel(state: AgentStateValue) {
  return LABELS[state];
}

/** The indicator alone: spinner, pulse, check, cross or dot. */
export function AgentGlyph({ state, className }: { state: AgentStateValue; className?: string }) {
  return <span aria-hidden="true" className={clsx(styles.glyph, styles[TONE[state]], className)} />;
}

export function AgentState({
  state,
  label,
  className,
}: {
  state: AgentStateValue;
  label?: string;
  className?: string;
}) {
  return (
    <span className={clsx(styles.chip, className)} data-tone={TONE[state]}>
      <AgentGlyph state={state} />
      <span>{label ?? LABELS[state]}</span>
    </span>
  );
}
