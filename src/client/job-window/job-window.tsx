import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { LIVE_PHASES } from "../../shared";
import { Square, X } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AgentState } from "../components/agent-state";
import { formatElapsed, useNow } from "../lib/time";
import { useOrg } from "../org/org-context";
import { LiveSession } from "../lib/lazy-parts";
import styles from "./job-window.module.css";

gsap.registerPlugin(useGSAP);

export type JobAnchor =
  | HTMLElement
  | { x: number; y: number; width?: number; height?: number };

export interface OpenWindow {
  anchor: JobAnchor;
  runId: string;
  key: number;
  z: number;
}

const WIDTH = 400;
const GAP = 14;
const MARGIN = 12;

/**
 * At or above this width, windows dock to the right edge at full height and
 * the page shifts left to make room (see PulseShell), so a window never
 * covers the composer or the pills it is tethered to.
 */
export const DOCK_MIN_WIDTH = 1100;
/** Horizontal space the page gives up while a window is docked. */
export const DOCK_RESERVE = WIDTH + MARGIN * 2;

interface Placement {
  height: number;
  left: number;
  /** "float": no room beside the anchor, so the window overlaps it untethered. */
  side: "right" | "left" | "float" | "sheet";
  top: number;
}

function anchorRect(anchor: JobAnchor): DOMRect {
  if (anchor instanceof HTMLElement) {
    return anchor.getBoundingClientRect();
  }
  return new DOMRect(anchor.x, anchor.y, anchor.width ?? 0, anchor.height ?? 0);
}

function drawTether(path: SVGPathElement | null, rect: DOMRect, p: Placement) {
  if (!path || p.side === "sheet" || p.side === "float") {
    return;
  }
  const ax = p.side === "right" ? rect.right : rect.left;
  const ay = rect.top + rect.height / 2;
  const wx = p.side === "right" ? p.left : p.left + WIDTH;
  const wy = Math.min(Math.max(ay, p.top + 24), p.top + p.height - 24);
  const mx = (ax + wx) / 2;
  path.setAttribute("d", `M${ax},${ay} C${mx},${ay} ${mx},${wy} ${wx},${wy}`);
}

function place(rect: DOMRect): Placement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const height = Math.min(580, vh - MARGIN * 2);
  if (vw < WIDTH + MARGIN * 2 + 40) {
    return {
      height: Math.min(vh * 0.78, 620),
      left: 0,
      side: "sheet",
      top: vh - Math.min(vh * 0.78, 620),
    };
  }
  if (vw >= DOCK_MIN_WIDTH) {
    return { height: vh - MARGIN * 2, left: vw - WIDTH - MARGIN, side: "right", top: MARGIN };
  }
  const top = Math.min(
    Math.max(MARGIN, rect.top + rect.height / 2 - height / 2),
    vh - height - MARGIN
  );
  if (rect.right + GAP + WIDTH + MARGIN <= vw) {
    return { height, left: rect.right + GAP, side: "right", top };
  }
  if (rect.left - GAP - WIDTH >= MARGIN) {
    return { height, left: rect.left - GAP - WIDTH, side: "left", top };
  }
  return { height, left: vw - WIDTH - MARGIN, side: "float", top };
}

export function JobWindow({
  win,
  onClose,
  onFocus,
}: {
  win: OpenWindow;
  onClose: () => void;
  onFocus: () => void;
}) {
  const { cancel, state, rolesById, isAdmin, me } = useOrg();
  const run = state.runs.find((r) => r.runId === win.runId);
  const now = useNow(1000);
  const ref = useRef<HTMLDivElement>(null);
  const tetherRef = useRef<SVGPathElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const dragged = useRef<{ x: number; y: number } | null>(null);
  const closing = useRef(false);

  // Follow the anchor while it moves (scroll, layout shifts, canvas motion)
  // until the window is dragged away from it. When the anchor leaves the DOM
  // (its run finished and the pill unmounted), keep placing from its last
  // rect so the window still responds to viewport changes, and drop the
  // tether since there is nothing left to point at.
  useEffect(() => {
    let raf = 0;
    let lastRect: DOMRect | null = null;
    const tick = () => {
      const detached = win.anchor instanceof HTMLElement && !win.anchor.isConnected;
      if (!detached) {
        lastRect = anchorRect(win.anchor);
      }
      if (!dragged.current && lastRect) {
        const next = place(lastRect);
        setPlacement((prev) =>
          prev &&
          prev.left === next.left &&
          prev.top === next.top &&
          prev.height === next.height &&
          prev.side === next.side
            ? prev
            : next
        );
        if (detached) {
          tetherRef.current?.style.setProperty("opacity", "0");
        } else {
          drawTether(tetherRef.current, lastRect, next);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [win.anchor]);

  useGSAP(
    () => {
      if (!(placement && ref.current)) {
        return;
      }
      const fromX = { float: 0, left: 18, right: -18, sheet: 0 }[
        placement.side
      ];
      gsap.fromTo(
        ref.current,
        {
          autoAlpha: 0,
          clipPath:
            placement.side === "sheet"
              ? "inset(100% 0 0 0)"
              : "inset(8% 0 8% 0 round 14px)",
          scale: 0.96,
          x: fromX,
          y: placement.side === "sheet" ? 40 : 0,
        },
        {
          autoAlpha: 1,
          clipPath: "inset(0% 0 0% 0 round 0px)",
          duration: 0.5,
          ease: "expo.out",
          scale: 1,
          x: 0,
          y: 0,
        }
      );
      drawTether(tetherRef.current, anchorRect(win.anchor), placement);
      if (tetherRef.current) {
        const len = tetherRef.current.getTotalLength();
        gsap.fromTo(
          tetherRef.current,
          { strokeDasharray: len, strokeDashoffset: len },
          { duration: 0.6, ease: "power2.out", strokeDashoffset: 0 }
        );
      }
    },
    { dependencies: [placement === null, win.key], scope: ref }
  );

  const close = useCallback(() => {
    if (closing.current || !ref.current) {
      return;
    }
    closing.current = true;
    gsap.to(ref.current, {
      autoAlpha: 0,
      duration: 0.22,
      ease: "power2.in",
      onComplete: onClose,
      scale: 0.97,
    });
    if (tetherRef.current) {
      gsap.to(tetherRef.current, { duration: 0.2, opacity: 0 });
    }
  }, [onClose]);

  // Escape closes the window that currently holds focus.
  const ready = placement !== null;
  useEffect(() => {
    const el = ref.current;
    if (!(ready && el)) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [close, ready]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest("button") ||
      !ref.current ||
      placement?.side === "sheet"
    ) {
      return;
    }
    onFocus();
    const el = ref.current;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = el.getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const x = rect.left + ev.clientX - startX;
      const y = rect.top + ev.clientY - startY;
      if (
        !dragged.current &&
        Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4
      ) {
        return;
      }
      dragged.current = { x, y };
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      if (tetherRef.current) {
        tetherRef.current.style.opacity = "0";
      }
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  if (!(run && placement)) {
    return null;
  }

  // No role yet while routing; a role id with no role was deleted.
  const role = run.roleId ? rolesById[run.roleId] : undefined;
  if (run.roleId && !role) {
    return null;
  }
  const live = LIVE_PHASES.has(run.phase);
  // Mirrors the job agent's check; the server enforces it.
  const owner = run.startedBy?.toLowerCase() ?? null;
  const access = { canAct: isAdmin || owner === me.email.toLowerCase(), owner };
  const name = role?.name ?? (run.phase === "routing" ? "Routing" : "Not routed");

  return (
    <>
      {(placement.side === "left" || placement.side === "right") && (
        <svg
          aria-hidden="true"
          className={styles.tether}
          style={{ zIndex: win.z - 1 }}
        >
          <path ref={tetherRef} />
        </svg>
      )}
      <div
        aria-label={`${name} job`}
        className={styles.window}
        data-routing={!role || undefined}
        data-side={placement.side}
        onPointerDownCapture={onFocus}
        ref={ref}
        role="dialog"
        style={{
          ["--dept-hue" as string]: role?.hue ?? 0,
          height: placement.height,
          left: dragged.current?.x ?? placement.left,
          top: dragged.current?.y ?? placement.top,
          width: placement.side === "sheet" ? "100%" : WIDTH,
          zIndex: win.z,
        }}
      >
        {/* Jobs have no step count, so the bar is indeterminate while live and full once settled. */}
        <div className={styles.progress} data-live={live || undefined} style={{ transform: `scaleX(${live ? 0.4 : 1})` }} />
        <div className={styles.header} onPointerDown={onPointerDown}>
          <div className={styles.titleRow}>
            <span className={styles.deptDot} />
            <span className={styles.role}>{name}</span>
            <span className={styles.spacer} />
            <button
              aria-label="Close"
              className={styles.iconButton}
              onClick={close}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
          <div className={styles.metaRow}>
            <AgentState state={run.phase} />
            <span className={styles.activity}>{run.activity ?? run.error ?? ""}</span>
            <span className={styles.elapsed}>
              {run.costUsd ? `${run.costUsd < 0.01 ? "<$0.01" : `~$${run.costUsd.toFixed(2)}`} · ` : ""}
              {formatElapsed(run.startedAt, run.completedAt ?? now)}
            </span>
          </div>
          <div className={styles.machine}>{role?.purpose ?? "Picking the best role for this job."}</div>
        </div>
        <div className={styles.body}>
          {/* The job agent does not exist until routing is done, and never
              does for a run stopped before then; there is nothing to connect to. */}
          {run.started === false ? (
            <div className={styles.pending}>
              <p className={styles.pendingPrompt}>{run.prompt}</p>
              {run.phase === "routing" && access.canAct && (
                <button className={styles.pendingStop} onClick={() => void cancel(run.runId)} type="button">
                  <Square aria-hidden="true" size={11} />
                  Stop
                </button>
              )}
            </div>
          ) : (
            <Suspense fallback={<p className={styles.loading}>Loading the transcript...</p>}>
              <LiveSession access={access} live={live} runId={run.runId} />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}
