import { lazy } from "react";

/**
 * Parts of the app the first screen does not need, loaded on first use so
 * the pulse page appears sooner: the job transcript (the AI SDK, assistant-ui
 * and the markdown renderer, about half the code) and the larger sheets.
 * prefetchLazyParts loads them in the background once the page is idle, so
 * opening one rarely waits.
 */
const loaders = {
  liveSession: () => import("../session/live-session"),
  rolesSheet: () => import("../dialogs/roles-sheet"),
  schedulesSheet: () => import("../dialogs/schedules-sheet"),
  settingsSheet: () => import("../dialogs/settings-sheet"),
};

/** Only a deployment without Access shows it, so it is not prefetched. */
export const FinishSetup = lazy(() => import("../setup/finish-setup").then((m) => ({ default: m.FinishSetup })));
export const LiveSession = lazy(() => loaders.liveSession().then((m) => ({ default: m.LiveSession })));
export const RolesSheet = lazy(() => loaders.rolesSheet().then((m) => ({ default: m.RolesSheet })));
export const SchedulesSheet = lazy(() => loaders.schedulesSheet().then((m) => ({ default: m.SchedulesSheet })));
export const SettingsSheet = lazy(() => loaders.settingsSheet().then((m) => ({ default: m.SettingsSheet })));

export function prefetchLazyParts() {
  const load = () => {
    for (const loader of Object.values(loaders)) {
      // A failed prefetch is retried by the lazy component when it is opened.
      loader().catch(() => {});
    }
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(load, { timeout: 4000 });
  } else {
    setTimeout(load, 1500);
  }
}
