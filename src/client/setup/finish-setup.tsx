import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import styles from "./finish-setup.module.css";

/**
 * Shown by a deployment that has no Cloudflare Access yet, typically one made
 * with the Deploy to Cloudflare button: four steps that do in the browser
 * what `node setup.mjs` does in a terminal (server: setup-routes.ts). The API
 * token stays in this tab's memory and is sent with each step; the server
 * never stores it.
 */

type Ai = "keys" | "credits" | "skip";

const AI_GATEWAY_URL = "https://dash.cloudflare.com/?to=/:account/ai/ai-gateway";
type Link = { href: string; label: string } | null;

interface Connected {
  account: string;
  teamDomain: string | null;
  zeroTrustLink: Link;
}

interface Finished {
  signInUrl: string;
  steps: string[];
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string; link?: Link; steps?: string[] };
  if (!response.ok) {
    throw Object.assign(new Error(json.error ?? `Setup request failed (${response.status})`), { link: json.link ?? null, steps: json.steps ?? [] });
  }
  return json;
}

function Step({
  number,
  title,
  state,
  summary,
  children,
}: {
  number: number;
  title: string;
  state: "todo" | "active" | "done";
  summary?: string;
  children?: ReactNode;
}) {
  return (
    <li className={styles.step} data-state={state}>
      <div className={styles.stepHead}>
        <span aria-hidden="true" className={styles.stepNumber}>
          {state === "done" ? "✓" : number}
        </span>
        <span>{title}</span>
        {state === "done" && summary && <span className={styles.stepSummary}>{summary}</span>}
      </div>
      {state === "active" && children}
    </li>
  );
}

export function FinishSetup() {
  const [tokenUrl, setTokenUrl] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState<Connected | null>(null);
  const [admin, setAdmin] = useState("");
  const [others, setOthers] = useState("");
  const [website, setWebsite] = useState("");
  const [webSearch, setWebSearch] = useState(false);
  const [ai, setAi] = useState<Ai>("keys");
  const [providers, setProviders] = useState<string[]>(["anthropic"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; link: Link } | null>(null);
  // Local dev only: /?setup=done previews this screen.
  const [finished, setFinished] = useState<Finished | null>(() =>
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("setup") === "done"
      ? { signInUrl: "/", steps: ["Protected this address with Cloudflare Access", "Created the AI Gateway \"powerhouse\""] }
      : null,
  );
  const [partial, setPartial] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/setup")
      .then((r) => r.json() as Promise<{ tokenUrl: string }>)
      .then((r) => setTokenUrl(r.tokenUrl))
      .catch(() => setTokenUrl(null));
  }, []);

  const fail = (e: unknown) => {
    const err = e as Error & { link?: Link; steps?: string[] };
    setError({ link: err.link ?? null, text: err.message });
    setPartial(err.steps ?? []);
  };

  const connect = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await post<Connected>("/api/setup/connect", { token });
      setConnected(result);
      if (result.teamDomain) {
        setStep(2);
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const allowList = others
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const finish = async () => {
    setBusy(true);
    setError(null);
    setPartial([]);
    try {
      setFinished(
        await post<Finished>("/api/setup/finish", {
          admin,
          ai,
          allow: allowList,
          providers,
          token,
          webSearch: webSearch && ai !== "skip",
          website,
        }),
      );
      // The token is not needed any more; drop it from memory.
      setToken("");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const toggleProvider = (provider: string) =>
    setProviders((current) => (current.includes(provider) ? current.filter((p) => p !== provider) : [...current, provider]));

  const errorView = error && (
    <p className={styles.error} role="alert">
      {error.text}{" "}
      {error.link && (
        <a href={error.link.href} rel="noreferrer" target="_blank">
          {error.link.label}
        </a>
      )}
    </p>
  );

  if (finished) {
    // What is left to do, in order; each has one button.
    const next = [
      ai === "keys" && {
        action: { href: AI_GATEWAY_URL, label: "Open AI Gateway" },
        text: "In the Cloudflare dashboard: AI > AI Gateway > powerhouse > Provider Keys. Until it is there, jobs run on open models. Then check it in powerhouse under Settings > Models > Test.",
        title: `Add your ${providers.map((p) => (p === "anthropic" ? "Anthropic" : "OpenAI")).join(" and ")} API key`,
      },
      ai === "credits" && {
        action: { href: AI_GATEWAY_URL, label: "Open AI Gateway" },
        text: "In the Cloudflare dashboard: AI > AI Gateway > Credits. Until you have some, jobs run on open models.",
        title: "Buy AI Gateway credits",
      },
      {
        action: { href: "https://github.com", label: "Open GitHub" },
        text: 'In your powerhouse repository: Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests". New releases then arrive as pull requests you merge.',
        title: "Turn on updates",
      },
      {
        action: { href: "https://dash.cloudflare.com/profile/api-tokens", label: "Open API tokens" },
        text: 'Delete the "powerhouse setup" token. Nothing needs it any more.',
        title: "Delete the setup token",
      },
    ].filter((item): item is { action: { href: string; label: string }; text: string; title: string } => Boolean(item));

    return (
      <main className={styles.page}>
        <span className={styles.wordmark}>powerhouse</span>
        <div>
          <h1 className={styles.title}>powerhouse is ready</h1>
          <ul className={styles.log}>
            {finished.steps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <section aria-labelledby="next-title">
          <h2 className={styles.subtitle} id="next-title">
            {next.length === 1 ? "One thing left" : `${next.length === 2 ? "Two" : "Three"} things left`}
          </h2>
          <ol className={styles.steps}>
            {next.map((item, i) => (
              <li className={styles.step} data-state="active" key={item.title}>
                <div className={styles.stepHead}>
                  <span aria-hidden="true" className={styles.stepNumber}>
                    {i + 1}
                  </span>
                  <span>{item.title}</span>
                </div>
                <p className={styles.muted}>{item.text}</p>
                <div className={styles.actions}>
                  <a className={styles.secondary} href={item.action.href} rel="noreferrer" target="_blank">
                    {item.action.label}
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className={styles.actions}>
          <a className={styles.primary} href={finished.signInUrl}>
            Sign in
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <span className={styles.wordmark}>powerhouse</span>
      <div>
        <h1 className={styles.title}>Finish setup</h1>
        <p className={styles.intro}>
          powerhouse is deployed. Five steps protect it with Cloudflare Access, so only the people you choose can sign
          in. Until then this page is all anyone can reach.
        </p>
      </div>

      <ol className={styles.steps}>
        <Step
          number={1}
          state={step === 1 ? "active" : "done"}
          summary={connected ? connected.account : undefined}
          title="Connect your Cloudflare account"
        >
          <p className={styles.muted}>
            Create a one-time API token. The link fills in the permissions: click &quot;Continue to summary&quot;, then
            &quot;Create token&quot;, and paste it here. It proves this powerhouse is yours and is used only during setup;
            it is never saved.
          </p>
          <div className={styles.actions}>
            {tokenUrl && (
              <a className={styles.secondary} href={tokenUrl} rel="noreferrer" target="_blank">
                Create the token
              </a>
            )}
          </div>
          <form className={styles.field} onSubmit={connect}>
            <label className={styles.label} htmlFor="setup-token">
              API token
            </label>
            <input
              autoComplete="off"
              className={styles.input}
              id="setup-token"
              onChange={(e) => setToken(e.target.value)}
              spellCheck={false}
              type="password"
              value={token}
            />
            <div className={styles.actions}>
              <button className={styles.primary} disabled={busy || token.trim().length < 20} type="submit">
                {busy ? "Checking..." : connected && !connected.teamDomain ? "Check again" : "Check"}
              </button>
            </div>
          </form>
          {connected && !connected.teamDomain && (
            <p className={styles.error} role="alert">
              Account {connected.account} does not have Cloudflare Zero Trust yet. Set it up once: choose a team name and
              the Free plan (it asks for a payment method even on Free), then check again.{" "}
              {connected.zeroTrustLink && (
                <a href={connected.zeroTrustLink.href} rel="noreferrer" target="_blank">
                  {connected.zeroTrustLink.label}
                </a>
              )}
            </p>
          )}
          {errorView}
        </Step>

        <Step
          number={2}
          state={step === 2 ? "active" : step > 2 ? "done" : "todo"}
          summary={step > 2 ? [admin, ...allowList].join(", ") : undefined}
          title="Who can sign in"
        >
          <label className={styles.field} htmlFor="setup-admin">
            <span className={styles.label}>Your email</span>
            <span className={styles.muted}>You sign in with it and become powerhouse&apos;s admin.</span>
            <input
              autoComplete="email"
              className={styles.input}
              id="setup-admin"
              onChange={(e) => setAdmin(e.target.value)}
              type="email"
              value={admin}
            />
          </label>
          <label className={styles.field} htmlFor="setup-others">
            <span className={styles.label}>Others who may sign in (optional)</span>
            <span className={styles.muted}>
              Emails or whole domains such as @example.com, separated by commas. You can change this later in Cloudflare
              Access.
            </span>
            <input className={styles.input} id="setup-others" onChange={(e) => setOthers(e.target.value)} value={others} />
          </label>
          <label className={styles.field} htmlFor="setup-website">
            <span className={styles.label}>Your website (optional)</span>
            <span className={styles.muted}>Roles use it for their first suggestions, such as checking it for broken links.</span>
            <input
              className={styles.input}
              id="setup-website"
              inputMode="url"
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              value={website}
            />
          </label>
          <div className={styles.actions}>
            <button className={styles.primary} disabled={!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(admin.trim())} onClick={() => setStep(3)} type="button">
              Continue
            </button>
          </div>
        </Step>

        <Step
          number={3}
          state={step === 3 ? "active" : step > 3 ? "done" : "todo"}
          summary={step > 3 ? (ai === "keys" ? "Your own API keys" : ai === "credits" ? "Cloudflare credits" : "Open models for now") : undefined}
          title="AI models"
        >
          <p className={styles.muted}>
            Claude and GPT run through your own AI Gateway, where your keys, logs and spend limits live. Cloudflare&apos;s
            open models work without one.
          </p>
          <fieldset className={styles.choices} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="sr-only">How to pay for Claude or GPT</legend>
            <label className={styles.choice}>
              <input checked={ai === "keys"} name="ai" onChange={() => setAi("keys")} type="radio" />
              <span>My own API key: I add it to the AI Gateway in the Cloudflare dashboard afterwards.</span>
            </label>
            {ai === "keys" && (
              <div className={styles.subchoices}>
                <label className={styles.choice}>
                  <input checked={providers.includes("anthropic")} onChange={() => toggleProvider("anthropic")} type="checkbox" />
                  Anthropic
                </label>
                <label className={styles.choice}>
                  <input checked={providers.includes("openai")} onChange={() => toggleProvider("openai")} type="checkbox" />
                  OpenAI
                </label>
              </div>
            )}
            <label className={styles.choice}>
              <input checked={ai === "credits"} name="ai" onChange={() => setAi("credits")} type="radio" />
              <span>Cloudflare credits (Unified Billing), bought in the dashboard. Covers Claude and GPT.</span>
            </label>
            <label className={styles.choice}>
              <input checked={ai === "skip"} name="ai" onChange={() => setAi("skip")} type="radio" />
              <span>Not now: open models on Workers AI. Most need the Workers Paid plan.</span>
            </label>
          </fieldset>
          <div className={styles.actions}>
            <button className={styles.primary} disabled={ai === "keys" && providers.length === 0} onClick={() => setStep(4)} type="button">
              Continue
            </button>
            <button className={styles.secondary} onClick={() => setStep(2)} type="button">
              Back
            </button>
          </div>
        </Step>

        <Step
          number={4}
          state={step === 4 ? "active" : step > 4 ? "done" : "todo"}
          summary={step > 4 ? (webSearch && ai !== "skip" ? "Web search on" : "Reading web pages") : undefined}
          title="Tools"
        >
          <p className={styles.muted}>Every role can read web pages. These tools are optional:</p>
          <div className={styles.choices}>
            <label className={styles.choice}>
              <input
                checked={webSearch && ai !== "skip"}
                disabled={ai === "skip"}
                onChange={(e) => setWebSearch(e.target.checked)}
                type="checkbox"
              />
              <span>
                Search the web. Billed per search through your AI Gateway, from credits or a search provider key on it.
                {ai === "skip" && " Needs the AI Gateway: choose a way to pay for models in step 3 first."}
              </span>
            </label>
            <p className={styles.muted}>
              Send email and the web browser are added later in Settings &gt; Tools: they need a small file in your GitHub
              repository, plus a domain on Cloudflare Email Service for email and the Workers Paid plan for the browser.
            </p>
          </div>
          <div className={styles.actions}>
            <button className={styles.primary} onClick={() => setStep(5)} type="button">
              Continue
            </button>
            <button className={styles.secondary} onClick={() => setStep(3)} type="button">
              Back
            </button>
          </div>
        </Step>

        <Step number={5} state={step === 5 ? "active" : "todo"} title="Finish">
          <p className={styles.muted}>
            powerhouse creates the Cloudflare Access application for this address, allows the people you listed,
            {ai === "skip" ? "" : " creates the AI Gateway,"} and saves its settings. Then you sign in.
          </p>
          {partial.length > 0 && (
            <ul className={styles.log}>
              {partial.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {errorView}
          <div className={styles.actions}>
            <button className={styles.primary} disabled={busy} onClick={() => void finish()} type="button">
              {busy ? "Setting up..." : partial.length > 0 ? "Try again" : "Finish setup"}
            </button>
            <button className={styles.secondary} disabled={busy} onClick={() => setStep(4)} type="button">
              Back
            </button>
          </div>
        </Step>
      </ol>
    </main>
  );
}
