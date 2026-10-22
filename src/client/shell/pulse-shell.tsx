import type { DispatchResult } from "../../shared";
import {
  createContext,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DispatchPalette } from "../dialogs/dispatch-palette";
import {
  DOCK_MIN_WIDTH,
  DOCK_RESERVE,
  type JobAnchor,
  JobWindow,
  type OpenWindow,
} from "../job-window/job-window";
import { prefetchLazyParts, RolesSheet, SchedulesSheet, SettingsSheet } from "../lib/lazy-parts";
import { pushSupported } from "../lib/push";
import { useOrg } from "../org/org-context";

interface ShellContextValue {
  /** Dispatch, then open the window next to the element marked with `data-job-anchor`. Resolves null on failure. */
  dispatchAndOpen: (prompt: string, roleId?: string) => Promise<DispatchResult | null>;
  /** Last dispatch failure from any entry point (composer or palette), cleared by the next success. */
  dispatchError: string | null;
  openDispatch: (roleId?: string) => void;
  openRoles: () => void;
  /** Opens a run's window at its pill once Org's state has listed it. */
  openRun: (runId: string) => void;
  openSchedules: () => void;
  /** Opens Settings; "tools" scrolls to the Tools section with the first tool that is off open. */
  openSettings: (section?: "tools") => void;
  /** Open the live job window next to `anchor`. Re-opening focuses it. */
  openJob: (runId: string, anchor: JobAnchor) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useShell must be used inside <PulseShell>");
  }
  return ctx;
}

const MAX_WINDOWS = 3;
const BASE_Z = 50;

function anchorForRun(runId: string): JobAnchor {
  const el = document.querySelector<HTMLElement>(`[data-job-anchor="${runId}"]`);
  return el ?? { x: window.innerWidth / 2 - 220, y: window.innerHeight / 2 };
}

/** Job windows and the Cmd+K palette, layered over the page. */
export function PulseShell({ children, className }: { children: ReactNode; className?: string }) {
  const { dispatch, state } = useOrg();
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  const [palette, setPalette] = useState<{ roleId?: string } | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [schedulesOpen, setSchedulesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState<false | { section?: "tools" }>(false);
  const [wide, setWide] = useState(() => window.innerWidth >= DOCK_MIN_WIDTH);
  const keyRef = useRef(0);
  const zRef = useRef(BASE_Z);

  const openJob = useCallback((runId: string, anchor: JobAnchor) => {
    setWindows((prev) => {
      zRef.current += 2;
      if (prev.some((w) => w.runId === runId)) {
        return prev.map((w) => (w.runId === runId ? { ...w, z: zRef.current } : w));
      }
      keyRef.current += 1;
      return [...prev, { anchor, key: keyRef.current, runId, z: zRef.current }].slice(-MAX_WINDOWS);
    });
  }, []);

  const focusWindow = useCallback((runId: string) => {
    setWindows((prev) => {
      const top = Math.max(...prev.map((w) => w.z));
      const target = prev.find((w) => w.runId === runId);
      if (!target || target.z === top) {
        return prev;
      }
      zRef.current += 2;
      return prev.map((w) => (w.runId === runId ? { ...w, z: zRef.current } : w));
    });
  }, []);

  const closeWindow = useCallback((runId: string) => {
    setWindows((prev) => prev.filter((w) => w.runId !== runId));
  }, []);

  // Two frames: one for the Org state sync to render the pill, one for layout.
  const openRun = useCallback(
    (runId: string) => requestAnimationFrame(() => requestAnimationFrame(() => openJob(runId, anchorForRun(runId)))),
    [openJob],
  );

  // A clicked notification opens its job: through ?run= when it opened this
  // tab, or a message from the service worker when the tab was already open.
  const [pendingRun, setPendingRun] = useState(() => new URLSearchParams(window.location.search).get("run"));
  useEffect(() => {
    if (!pendingRun || !state.runs.some((r) => r.runId === pendingRun)) {
      return;
    }
    openRun(pendingRun);
    setPendingRun(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("run");
    window.history.replaceState(null, "", url);
  }, [pendingRun, state.runs, openRun]);
  useEffect(() => {
    if (!pushSupported()) {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "open-run" && typeof event.data.runId === "string") {
        setPendingRun(event.data.runId);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    prefetchLazyParts();
  }, []);

  const dispatchAndOpen = useCallback(
    async (prompt: string, roleId?: string) => {
      let result: DispatchResult;
      try {
        result = await dispatch(prompt, roleId);
      } catch (error) {
        setDispatchError(error instanceof Error ? error.message : String(error));
        return null;
      }
      setDispatchError(null);
      openRun(result.runId);
      return result;
    },
    [dispatch, openRun],
  );

  const value = useMemo<ShellContextValue>(
    () => ({
      dispatchAndOpen,
      dispatchError,
      openDispatch: (roleId) => setPalette({ roleId }),
      openJob,
      openRoles: () => setRolesOpen(true),
      openRun,
      openSchedules: () => setSchedulesOpen(true),
      openSettings: (section) => setSettingsOpen({ section: section === "tools" ? "tools" : undefined }),
    }),
    [dispatchAndOpen, dispatchError, openJob, openRun],
  );

  // Same test as the window's place(), so the page and the window agree on docking.
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= DOCK_MIN_WIDTH);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => (p ? null : {}));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <ShellContext.Provider value={value}>
      <div
        className={className}
        data-docked={(wide && windows.length > 0) || undefined}
        style={{ ["--dock-reserve" as string]: `${DOCK_RESERVE}px` }}
      >
        {children}
        {windows.map((win) => (
          <JobWindow
            key={win.key}
            onClose={() => closeWindow(win.runId)}
            onFocus={() => focusWindow(win.runId)}
            win={win}
          />
        ))}
        {/* Sheets load on first open; nothing shows while they do. */}
        <Suspense fallback={null}>
          {rolesOpen && <RolesSheet onClose={() => setRolesOpen(false)} />}
          {schedulesOpen && <SchedulesSheet onClose={() => setSchedulesOpen(false)} />}
          {settingsOpen && <SettingsSheet focus={settingsOpen.section} onClose={() => setSettingsOpen(false)} />}
        </Suspense>
        {palette && (
          <DispatchPalette
            initialRoleId={palette.roleId}
            onClose={() => setPalette(null)}
            onDispatch={(roleId, prompt) => {
              setPalette(null);
              void dispatchAndOpen(prompt, roleId);
            }}
          />
        )}
      </div>
    </ShellContext.Provider>
  );
}
