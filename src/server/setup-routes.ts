import { getAgentByName } from "agents";
import { Hono } from "hono";
import { accessSettings } from "./auth";
import { type DeploymentConfig, deployment } from "./deployment";
import { safeError } from "./log";
import { isRepoSlug } from "../shared";
import { toBase64Url } from "./web-push";

/** The MCP paths' Access bypass, as setup.mjs creates it (same names, so either can update it). */
const MCP_APP_NAME = "powerhouse apps (MCP)";
const MCP_POLICY_NAME = "powerhouse apps (MCP clients)";
const MCP_PATHS = ["mcp", "oauth/*", ".well-known/*"];

/**
 * Finish setup: the wizard a deployment made with the Deploy to Cloudflare
 * button shows before it has Cloudflare Access. It does in the browser what
 * setup.mjs does from a terminal, with the same API calls: the One-time PIN
 * login method, the "powerhouse members" policy, the Access application for
 * this hostname and the AI Gateway, then saves the results in the
 * Deployment object (deployment.ts).
 *
 * These routes are public, so they answer only while the deployment is not
 * set up, and every change needs an API token for the Cloudflare account
 * that owns this Worker: a stranger who opens the page first cannot claim it.
 * The token is used for the request it came with and never stored or logged.
 */
export const setupRoutes = new Hono<{ Bindings: Env }>();

const API = "https://api.cloudflare.com/client/v4";
const POLICY_NAME = "powerhouse members";
const GATEWAY_ID = "powerhouse";

/** The same permissions setup.mjs pre-fills, AI Gateway included. */
const TOKEN_PERMISSIONS = [
  { key: "access", type: "edit" },
  { key: "access_acct", type: "edit" },
  { key: "workers_scripts", type: "read" },
  // AI Gateway: Edit. Undocumented key, confirmed in the dashboard 2026-10-21.
  { key: "aig", type: "edit" },
];

const TOKEN_URL =
  "https://dash.cloudflare.com/profile/api-tokens" +
  `?permissionGroupKeys=${encodeURIComponent(JSON.stringify(TOKEN_PERMISSIONS))}` +
  `&zoneId=all&name=${encodeURIComponent("powerhouse setup")}`;

/** A problem the person can fix, shown as is in the wizard. */
class SetupProblem extends Error {
  constructor(
    message: string,
    readonly link?: { href: string; label: string },
  ) {
    super(message);
  }
}

interface ApiResult<T> {
  success: boolean;
  result: T;
  errors?: { message: string }[];
}

function api(token: string) {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<{ status: number; result: T | null; error: string | null }> => {
    const response = await fetch(`${API}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      method,
    });
    const json = (await response.json().catch(() => null)) as ApiResult<T> | null;
    if (!json?.success) {
      return { error: json?.errors?.map((e) => e.message).join("; ") || `HTTP ${response.status}`, result: null, status: response.status };
    }
    return { error: null, result: json.result, status: response.status };
  };
  /** Like call, but a refusal becomes a SetupProblem naming what failed. */
  const must = async <T>(method: string, path: string, what: string, body?: unknown): Promise<T> => {
    const { error, result, status } = await call<T>(method, path, body);
    if (error !== null || result === null) {
      throw new SetupProblem(
        status === 403
          ? `The API token is missing a permission (${what}). Create a new token from the link in step 1.`
          : `Cloudflare refused to ${what}: ${error}`,
      );
    }
    return result;
  };
  return { call, must };
}

/** This Worker's name and workers.dev subdomain, from the address it is served on. */
function workersDevHost(url: string) {
  const host = new URL(url).hostname;
  const match = /^([a-z0-9-]+)\.([a-z0-9-]+)\.workers\.dev$/.exec(host);
  if (!match) {
    throw new SetupProblem(
      `Do this from the Worker's workers.dev address. ${host} is not one; open the Worker in the Cloudflare dashboard to find it.`,
    );
  }
  return { host, script: match[1], subdomain: match[2] };
}

interface Claim {
  accountId: string;
  accountName: string;
  host: string;
  /** <team>.cloudflareaccess.com, or null when Zero Trust is off. */
  teamDomain: string | null;
}

/**
 * Proves the token belongs to the account that owns this Worker: one of its
 * accounts has this workers.dev subdomain and a Worker with this name.
 */
async function claim(token: string, url: string): Promise<Claim> {
  const { host, script, subdomain } = workersDevHost(url);
  const cf = api(token);
  const verify = await cf.call<{ status: string }>("GET", "/user/tokens/verify");
  if (verify.result?.status !== "active") {
    throw new SetupProblem("Cloudflare did not accept that API token. Copy the whole token and try again.");
  }
  const accounts = await cf.must<{ id: string; name: string }[]>("GET", "/accounts?per_page=50", "list your accounts");
  for (const account of accounts) {
    const sub = await cf.call<{ subdomain: string }>("GET", `/accounts/${account.id}/workers/subdomain`);
    if (sub.result?.subdomain !== subdomain) {
      continue;
    }
    const worker = await cf.call("GET", `/accounts/${account.id}/workers/scripts/${script}/settings`);
    if (worker.error !== null) {
      continue;
    }
    const org = await cf.call<{ auth_domain: string }>("GET", `/accounts/${account.id}/access/organizations`);
    return { accountId: account.id, accountName: account.name, host, teamDomain: org.result?.auth_domain ?? null };
  }
  throw new SetupProblem(
    "That token is for a different Cloudflare account than the one this powerhouse runs in. Create the token while signed in to the account that owns this Worker.",
  );
}

/**
 * MCP clients (Claude, ChatGPT, Cursor) reach /mcp, /oauth/* and
 * /.well-known/* without an Access session: a second, more specific Access
 * application bypasses Access on those paths only, as setup.mjs's
 * mcpAccessApplication does (same names, so either can update it). The
 * Worker answers them only when Settings > Use from other apps is on.
 */
async function mcpAccessBypass(cf: ReturnType<typeof api>, acct: string, host: string) {
  const policies = await cf.must<{ id: string; name: string }[]>("GET", `${acct}/access/policies`, "list Access policies");
  const policyBody = { decision: "bypass", include: [{ everyone: {} }], name: MCP_POLICY_NAME };
  const existingPolicy = policies.find((p) => p.name === MCP_POLICY_NAME);
  const policy = existingPolicy
    ? await cf.must<{ id: string }>("PUT", `${acct}/access/policies/${existingPolicy.id}`, "update the MCP policy", policyBody)
    : await cf.must<{ id: string }>("POST", `${acct}/access/policies`, "create the MCP policy", policyBody);
  const apps = await cf.must<{ id: string; name?: string; domain?: string }[]>("GET", `${acct}/access/apps`, "list Access applications");
  const existing = apps.find((a) => a.name === MCP_APP_NAME && a.domain?.startsWith(`${host}/`));
  const body = {
    destinations: MCP_PATHS.map((path) => ({ type: "public", uri: `${host}/${path}` })),
    domain: `${host}/${MCP_PATHS[0]}`,
    name: MCP_APP_NAME,
    policies: [{ id: policy.id, precedence: 1 }],
    type: "self_hosted",
  };
  await (existing
    ? cf.must("PUT", `${acct}/access/apps/${existing.id}`, "update the MCP Access application", body)
    : cf.must("POST", `${acct}/access/apps`, "create the MCP Access application", body));
}

/** Only what the MCP Access step needs: Access, and reading this Worker to prove the token's account owns it. */
const MCP_TOKEN_PERMISSIONS = [
  { key: "access", type: "edit" },
  { key: "access_acct", type: "edit" },
  { key: "workers_scripts", type: "read" },
];

const MCP_TOKEN_URL =
  "https://dash.cloudflare.com/profile/api-tokens" +
  `?permissionGroupKeys=${encodeURIComponent(JSON.stringify(MCP_TOKEN_PERMISSIONS))}` +
  `&zoneId=all&name=${encodeURIComponent("powerhouse access step")}`;

/**
 * Settings > Use from other apps, for deployments made before the MCP
 * bypass existed: an admin pastes a one-time token, which adds the Access
 * application and is then dropped. Mounted under /api (behind Access); the
 * admin check is passed in by the caller, which can reach Org.
 */
export const mcpAccessRoutes = new Hono<{ Bindings: Env; Variables: { email: string; orgId: string } }>();

mcpAccessRoutes.get("/", (c) => c.json({ tokenUrl: MCP_TOKEN_URL }));

mcpAccessRoutes.post("/", async (c) => {
  try {
    const org = await getAgentByName(c.env.Org, c.get("orgId"));
    if (!(await org.memberIsAdmin(c.get("email")))) {
      return c.json({ error: "Only admins can add the Access step.", link: null }, 403);
    }
    const { token } = await c.req.json<{ token?: string }>().catch(() => ({ token: undefined }));
    if (!token?.trim()) {
      return c.json({ error: "Paste the API token first.", link: null }, 400);
    }
    const found = await claim(token.trim(), c.req.url);
    await mcpAccessBypass(api(token.trim()), `/accounts/${found.accountId}`, found.host);
    await deployment(c.env).setMcpAccess();
    await org.refreshMcpAccess();
    return c.json({ ok: true });
  } catch (error) {
    return c.json(problem(error), 400);
  }
});

function isHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const ZERO_TRUST_LINK = { href: "https://one.dash.cloudflare.com", label: "Set up Zero Trust" };

async function notSetUp(env: Env) {
  return (await accessSettings(env)) === null;
}

function problem(error: unknown) {
  if (error instanceof SetupProblem) {
    return { error: error.message, link: error.link ?? null };
  }
  console.error("[setup] unexpected error", safeError(error));
  return { error: "Something went wrong talking to Cloudflare. Try again.", link: null };
}

setupRoutes.get("/", async (c) => c.json({ setupRequired: await notSetUp(c.env), tokenUrl: TOKEN_URL }));

/** Step 1: check the token and Zero Trust. Changes nothing. */
setupRoutes.post("/connect", async (c) => {
  if (!(await notSetUp(c.env))) {
    return c.json({ error: "This powerhouse is already set up. Sign in instead." }, 409);
  }
  const { token } = (await c.req.json().catch(() => ({}))) as { token?: unknown };
  if (typeof token !== "string" || token.trim().length < 20) {
    return c.json({ error: "Paste the API token from step 1." }, 400);
  }
  try {
    const found = await claim(token.trim(), c.req.url);
    return c.json({
      account: found.accountName,
      teamDomain: found.teamDomain,
      zeroTrustLink: found.teamDomain ? null : ZERO_TRUST_LINK,
    });
  } catch (error) {
    return c.json(problem(error), 400);
  }
});

interface FinishInput {
  token?: unknown;
  admin?: unknown;
  allow?: unknown;
  ai?: unknown;
  providers?: unknown;
  website?: unknown;
  webSearch?: unknown;
  repository?: unknown;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EMAIL_OR_DOMAIN = /^[^@\s]*@[^@\s]+\.[^@\s]+$/;

/** Step 4: creates everything and saves the deployment's settings. */
setupRoutes.post("/finish", async (c) => {
  if (!(await notSetUp(c.env))) {
    return c.json({ error: "This powerhouse is already set up. Sign in instead." }, 409);
  }
  const input = (await c.req.json().catch(() => ({}))) as FinishInput;
  const token = typeof input.token === "string" ? input.token.trim() : "";
  const admin = typeof input.admin === "string" ? input.admin.trim().toLowerCase() : "";
  const others = Array.isArray(input.allow) ? input.allow.filter((e): e is string => typeof e === "string") : [];
  const allow = [...new Set([admin, ...others.map((e) => e.trim().toLowerCase()).filter(Boolean)])];
  const ai = input.ai === "keys" || input.ai === "credits" ? input.ai : "skip";
  const providers = Array.isArray(input.providers)
    ? input.providers.filter((p): p is string => p === "anthropic" || p === "openai")
    : [];
  if (!EMAIL.test(admin)) {
    return c.json({ error: "Enter your own email address: you sign in with it and become the admin." }, 400);
  }
  const invalid = allow.filter((e) => !EMAIL_OR_DOMAIN.test(e));
  if (invalid.length > 0) {
    return c.json({ error: `Not an email or @domain: ${invalid.join(", ")}` }, 400);
  }
  let website = typeof input.website === "string" ? input.website.trim() : "";
  if (website && !/^https?:\/\//i.test(website)) {
    website = `https://${website}`;
  }
  if (website && !isHttps(website)) {
    return c.json({ error: "Enter the website as an address such as https://example.com, or leave it empty." }, 400);
  }
  const repository =
    typeof input.repository === "string"
      ? input.repository.trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$|\/$/, "")
      : "";
  if (repository && !isRepoSlug(repository)) {
    return c.json({ error: "Enter the GitHub repository as owner/name, or leave it empty." }, 400);
  }
  // Web search bills through the AI Gateway, so it needs one.
  const webSearch = input.webSearch === true && ai !== "skip";
  if (ai === "keys" && providers.length === 0) {
    return c.json({ error: "Choose Anthropic, OpenAI or both, or pick another option." }, 400);
  }

  const steps: string[] = [];
  try {
    const found = await claim(token, c.req.url);
    if (!found.teamDomain) {
      throw new SetupProblem("Zero Trust is not set up on this account yet.", ZERO_TRUST_LINK);
    }
    const cf = api(token);
    const acct = `/accounts/${found.accountId}`;

    // Login methods: without one nobody can sign in; One-time PIN needs nothing else.
    const idps = await cf.must<{ name?: string; type: string }[]>("GET", `${acct}/access/identity_providers`, "list login methods");
    if (idps.length === 0) {
      await cf.must("POST", `${acct}/access/identity_providers`, "add the One-time PIN login method", {
        config: {},
        name: "One-time PIN",
        type: "onetimepin",
      });
      steps.push("Turned on sign-in with one-time codes by email");
    }

    // The members policy, then the application for this hostname.
    const include = allow.map((entry) =>
      entry.startsWith("@") ? { email_domain: { domain: entry.slice(1) } } : { email: { email: entry } },
    );
    const policyBody = { decision: "allow", include, name: POLICY_NAME };
    const policies = await cf.must<{ id: string; name: string }[]>("GET", `${acct}/access/policies`, "list Access policies");
    const existingPolicy = policies.find((p) => p.name === POLICY_NAME);
    const policy = existingPolicy
      ? await cf.must<{ id: string }>("PUT", `${acct}/access/policies/${existingPolicy.id}`, "update the members policy", policyBody)
      : await cf.must<{ id: string }>("POST", `${acct}/access/policies`, "create the members policy", policyBody);
    steps.push(`Allowed ${allow.join(", ")} to sign in`);

    const apps = await cf.must<{ id: string; aud: string; domain?: string; name?: string; session_duration?: string; self_hosted_domains?: string[] }[]>(
      "GET",
      `${acct}/access/apps`,
      "list Access applications",
    );
    const existingApp = apps.find((a) => a.domain === found.host || a.self_hosted_domains?.includes(found.host));
    const appBody = {
      auto_redirect_to_identity: idps.length <= 1,
      domain: found.host,
      name: existingApp?.name ?? "powerhouse",
      policies: [{ id: policy.id, precedence: 1 }],
      session_duration: existingApp?.session_duration ?? "24h",
      type: "self_hosted",
    };
    const app = existingApp
      ? await cf.must<{ aud: string }>("PUT", `${acct}/access/apps/${existingApp.id}`, "update the Access application", appBody)
      : await cf.must<{ aud: string }>("POST", `${acct}/access/apps`, "create the Access application", appBody);
    steps.push(`Protected ${found.host} with Cloudflare Access`);

    await mcpAccessBypass(cf, acct, found.host);
    steps.push("Let apps such as Claude reach powerhouse's MCP paths (answered once an admin turns it on in Settings)");

    // AI Gateway, like setup.mjs: authentication on, logs on, caching off.
    let aiGatewayId: string | undefined;
    if (ai !== "skip") {
      const gateway = await cf.call(`GET`, `${acct}/ai-gateway/gateways/${GATEWAY_ID}`);
      if (gateway.status === 404 || gateway.result === null) {
        await cf.must("POST", `${acct}/ai-gateway/gateways`, "create the AI Gateway", {
          authentication: true,
          cache_invalidate_on_update: false,
          cache_ttl: 0,
          collect_logs: true,
          id: GATEWAY_ID,
          rate_limiting_interval: 0,
          rate_limiting_limit: 0,
        });
        steps.push(`Created the AI Gateway "${GATEWAY_ID}"`);
      } else {
        steps.push(`Kept the AI Gateway "${GATEWAY_ID}"`);
      }
      aiGatewayId = GATEWAY_ID;
    }

    // Push notification keys, generated here: a button deployment cannot set secrets.
    const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
    const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
    const publicKey = toBase64Url(new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer));

    const config: DeploymentConfig = {
      access: { aud: app.aud, teamDomain: `https://${found.teamDomain}` },
      adminEmails: admin,
      aiBilling: ai === "skip" ? undefined : ai,
      aiGatewayId,
      aiProviders: ai === "credits" ? "anthropic,openai" : ai === "keys" ? providers.join(",") : undefined,
      completedAt: Date.now(),
      vapid: { privateKey: jwk.d ?? "", publicKey, subject: `https://${found.host}` },
      webSearch,
      website: website || undefined,
      repository: repository || undefined,
      mcpAccess: true,
    };
    // Takes effect on the next request: auth.ts caches only saved settings.
    await deployment(c.env).save(config);
    steps.push("Saved the settings and created notification keys");
    if (webSearch) {
      steps.push("Turned on web search (billed per search through the AI Gateway)");
    }

    return c.json({ ok: true, signInUrl: `https://${found.host}/`, steps });
  } catch (error) {
    return c.json({ ...problem(error), steps }, 400);
  }
});
