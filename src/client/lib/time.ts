import { useEffect, useState } from "react";

/** Re-renders every `ms` so elapsed timers tick without global state. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function formatElapsed(fromMs: number | null, toMs: number) {
  if (fromMs === null) {
    return "0:00";
  }
  const total = Math.max(0, Math.floor((toMs - fromMs) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatAgo(fromMs: number, now: number) {
  const s = Math.max(0, Math.floor((now - fromMs) / 1000));
  if (s < 60) {
    return `${s}s ago`;
  }
  const m = Math.floor(s / 60);
  if (m < 60) {
    return `${m}m ago`;
  }
  return `${Math.floor(m / 60)}h ago`;
}
