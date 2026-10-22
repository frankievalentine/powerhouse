import { Suspense, useEffect, useState } from "react";
import { FinishSetup } from "./lib/lazy-parts";
import { TeamGate } from "./onboarding/team-picker";
import { type Me, OrgProvider } from "./org/org-context";
import pulseStyles from "./pulse/pulse.module.css";
import { PulsePage } from "./pulse/pulse-page";
import { PulseShell } from "./shell/pulse-shell";

/** Access has already authenticated the request; /api/me says which org this user belongs to. */
export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A deployment without Cloudflare Access yet (Deploy to Cloudflare) shows
  // Finish setup instead. In local dev, /?setup previews it.
  const [setupRequired, setSetupRequired] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has("setup"),
  );

  useEffect(() => {
    if (setupRequired) {
      return;
    }
    fetch("/api/me")
      .then(async (r) => {
        if (r.status === 503 && ((await r.json().catch(() => ({}))) as { setupRequired?: boolean }).setupRequired) {
          setSetupRequired(true);
          return null;
        }
        return r.ok ? (r.json() as Promise<Me>) : Promise.reject(new Error(`Sign-in check failed (${r.status})`));
      })
      .then((value) => value && setMe(value))
      .catch((e: Error) => setError(e.message));
  }, [setupRequired]);

  if (setupRequired) {
    return (
      <div className={pulseStyles.theme}>
        <Suspense fallback={null}>
          <FinishSetup />
        </Suspense>
      </div>
    );
  }

  if (error) {
    return (
      <div className={pulseStyles.theme}>
        <p className={pulseStyles.status} style={{ paddingTop: "30vh" }}>
          {error}
        </p>
      </div>
    );
  }
  if (!me) {
    return <div className={pulseStyles.theme} />;
  }
  return (
    <OrgProvider me={me}>
      <PulseShell className={pulseStyles.theme}>
        <TeamGate>
          <PulsePage />
        </TeamGate>
      </PulseShell>
    </OrgProvider>
  );
}
