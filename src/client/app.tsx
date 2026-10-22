import { useEffect, useState } from "react";
import { TeamGate } from "./onboarding/team-picker";
import { type Me, OrgProvider } from "./org/org-context";
import pulseStyles from "./pulse/pulse.module.css";
import { PulsePage } from "./pulse/pulse-page";
import { PulseShell } from "./shell/pulse-shell";

/** Access has already authenticated the request; /api/me says which org this user belongs to. */
export function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : Promise.reject(new Error(`Sign-in check failed (${r.status})`))))
      .then(setMe)
      .catch((e: Error) => setError(e.message));
  }, []);

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
