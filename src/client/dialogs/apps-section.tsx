import { useCallback, useEffect, useState } from "react";
import { formatAgo } from "../lib/time";
import { useOrg } from "../org/org-context";
import styles from "./sheet.module.css";

interface ConnectedApp {
  grantId: string;
  client: string;
  createdAt: number;
}

/** A member's MCP apps, from the Worker (the grants live in the OAuth provider's KV, not in Org). */
export async function listApps(member?: string): Promise<ConnectedApp[]> {
  const response = await fetch(`/api/apps${member ? `?member=${encodeURIComponent(member)}` : ""}`);
  const body = (await response.json()) as { apps?: ConnectedApp[]; error?: string };
  if (!response.ok) {
    throw new Error(body.error ?? "Could not list the apps.");
  }
  return body.apps ?? [];
}

export async function removeApp(grantId: string, member?: string) {
  const response = await fetch(`/api/apps/${encodeURIComponent(grantId)}${member ? `?member=${encodeURIComponent(member)}` : ""}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(((await response.json()) as { error?: string }).error ?? "Could not remove the app.");
  }
}

/** Where each app takes the URL; menu names change often, so the steps stay general. */
const CLIENT_STEPS = [
  { name: "Claude", steps: "Settings > Connectors > Add custom connector, then paste the URL." },
  { name: "ChatGPT", steps: "Settings > Apps & Connectors > Create (developer mode), then paste the URL." },
  { name: "Cursor", steps: 'Settings > MCP > Add, with { "url": "<the URL>" }.' },
];

/**
 * Settings > MCP: members start and read their jobs from
 * Claude, ChatGPT or Cursor over MCP. Admins turn it on; each member
 * connects their apps and can remove them here.
 */
/**
 * For deployments made before the MCP paths' Access bypass existed: an admin
 * pastes a one-time token (pre-filled link, Access permissions only), the
 * Worker adds the Access application, and the token is not kept.
 */
function AccessStep() {
  const [tokenUrl, setTokenUrl] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/mcp-access")
      .then((r) => r.json() as Promise<{ tokenUrl: string }>)
      .then((body) => setTokenUrl(body.tokenUrl), () => setError("Could not load the token link."));
  }, []);
  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/mcp-access", {
        body: JSON.stringify({ token }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Adding the Access step failed.");
      }
      setToken("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={styles.field}>
      <span className={styles.label}>One step left</span>
      <span className={styles.hint}>
        Apps reach powerhouse without signing in to Cloudflare Access, so Access needs to let them through to the MCP
        paths only. This deployment was set up before that existed.{" "}
        {tokenUrl && (
          <a href={tokenUrl} rel="noopener noreferrer" target="_blank">
            Create a one-time API token
          </a>
        )}{" "}
        (click Continue to summary, then Create token, and copy it), paste it here, and powerhouse adds the Access
        application. The token is used once and not kept; delete it afterwards.
      </span>
      <input
        aria-label="API token"
        autoComplete="off"
        className={styles.input}
        onChange={(e) => setToken(e.target.value)}
        placeholder="API token"
        type="password"
        value={token}
      />
      <div className={styles.actions}>
        <button className={styles.secondary} disabled={busy || !token.trim()} onClick={() => void add()} type="button">
          {busy ? "Adding..." : "Add the Access step"}
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AppsSection() {
  const { isAdmin, saveSettings, state } = useOrg();
  const [apps, setApps] = useState<ConnectedApp[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const on = state.settings.mcpServer;
  const url = `${location.origin}/mcp`;
  const now = Date.now();

  const load = useCallback(() => listApps().then(setApps, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    if (on) {
      void load();
    }
  }, [load, on]);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Denied or unavailable; the URL is on screen to copy by hand.
    }
  };

  return (
    <section className={styles.section}>
      <h3 className={styles.sectionTitle}>Use powerhouse in Claude, ChatGPT or Cursor</h3>
      <p className={styles.hint}>
        powerhouse is an MCP server too: members connect their AI app to it, then start jobs and read their results from
        there, signed in as themselves. Approvals still happen here.
      </p>
      <label className={styles.check}>
        <input
          checked={on}
          disabled={!isAdmin || busy}
          onChange={(e) => void act(() => saveSettings({ mcpServer: e.target.checked }))}
          type="checkbox"
        />
        <span>
          <span className={styles.toolName}>Allow AI apps to connect</span>
          <span className={styles.hint}>
            {isAdmin ? "Turning it off stops every connected app at once." : "Only admins can turn this on or off."}
          </span>
        </span>
      </label>
      {on && !state.mcpAccessReady && (isAdmin ? <AccessStep /> : <p className={styles.hint}>An admin needs to finish one setup step before apps can connect.</p>)}
      {on && state.mcpAccessReady && (
        <>
          <div className={styles.field}>
            <span className={styles.label}>Connect an app</span>
            <code className={styles.snippet}>{url}</code>
            <div className={styles.actions}>
              <button className={styles.secondary} onClick={() => void copy()} type="button">
                {copied ? "Copied" : "Copy URL"}
              </button>
            </div>
            <ul className={styles.hint}>
              {CLIENT_STEPS.map((c) => (
                <li key={c.name}>
                  <b>{c.name}:</b> {c.steps}
                </li>
              ))}
            </ul>
            <span className={styles.hint}>The app opens powerhouse to ask you to allow it. Click Allow, and you are done.</span>
          </div>
          <p className={styles.label}>Your connected apps</p>
          {!apps && !error && <p className={styles.muted}>Loading...</p>}
          {apps?.length === 0 && <p className={styles.muted}>None yet.</p>}
          <ul className={styles.checklist}>
            {apps?.map((app) => (
              <li className={styles.checkItem} data-status="on" key={app.grantId}>
                <div className={styles.checkHead}>
                  <span className={styles.checkLabel}>{app.client}</span>
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => void act(async () => {
                      await removeApp(app.grantId);
                      await load();
                    })}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
                <p className={styles.hint}>Connected {formatAgo(app.createdAt, now)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
