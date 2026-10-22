import { useSyncExternalStore } from "react";

/** What a person picked in Settings; "system" follows the device. Kept per device. */
export type ThemeChoice = "system" | "light" | "dark";

/** Same key as the script in index.html, which applies the choice before the first paint. */
const STORAGE_KEY = "powerhouse-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";
/** The page background in each theme, for the browser's toolbar (theme-color). */
const BACKGROUNDS = { dark: "#171513", light: "#f4f1ec" } as const;

const listeners = new Set<() => void>();

export function themeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, choice);
    }
  } catch {
    // Private windows can refuse storage; the choice still applies until reload.
  }
  applyTheme(choice);
}

/** Applies the stored choice to the theme-color tags; index.html already set data-theme. */
export function initTheme() {
  applyTheme(themeChoice());
}

function resolvedTheme(choice = themeChoice()): "light" | "dark" {
  if (choice !== "system") {
    return choice;
  }
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = choice;
  }
  // With an explicit choice the media-matched theme-color tags would be
  // wrong half the time, so both carry the chosen background.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes("dark") ? "dark" : "light";
    meta.content = BACKGROUNDS[choice === "system" ? scheme : choice];
  }
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", listener);
  };
}

/** The person's choice, updating when they change it. */
export function useThemeChoice() {
  return useSyncExternalStore(subscribe, themeChoice);
}

/** The theme on screen, "light" or "dark", following the system when the choice is "system". */
export function useResolvedTheme() {
  return useSyncExternalStore(subscribe, () => resolvedTheme());
}
