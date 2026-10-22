import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { type AccessSettings, deployment } from "./deployment";
import { devEmail } from "./dev";

export interface AuthVariables {
  email: string;
  orgId: string;
}

type AppEnv = { Bindings: Env; Variables: AuthVariables };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const LOCAL_ORG_ID = "local";

/**
 * One org per Access team. A deployment verifies tokens against a single team
 * domain and AUD, so the org id is the team name:
 * https://acme.cloudflareaccess.com -> "acme".
 */
function orgIdForTeam(teamDomain: string) {
  const team = new URL(teamDomain).hostname.split(".")[0];
  if (!team) {
    throw new Error(`Cannot derive an org id from the Access team domain "${teamDomain}"`);
  }
  return team;
}

/** Settings saved by Finish setup, cached per isolate; refreshed after a minute. */
let saved: { at: number; settings: AccessSettings } | null = null;
const SAVED_TTL_MS = 60_000;

/**
 * The Access application to verify against: setup.mjs's vars when present
 * (wrangler.local.jsonc), else what Finish setup saved. Null until either
 * exists: the deployment is not set up yet.
 */
export async function accessSettings(env: Env): Promise<AccessSettings | null> {
  if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
    return { aud: env.ACCESS_AUD, teamDomain: env.ACCESS_TEAM_DOMAIN };
  }
  if (saved && Date.now() - saved.at < SAVED_TTL_MS) {
    return saved.settings;
  }
  const settings = await deployment(env).access();
  // Only a saved result is cached, so a deployment being set up sees its
  // settings on the next request after Finish setup saves them.
  saved = settings ? { at: Date.now(), settings } : null;
  return settings;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksTeam: string | null = null;

function getJwks(teamDomain: string) {
  if (!jwks || jwksTeam !== teamDomain) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksTeam = teamDomain;
  }
  return jwks;
}

/**
 * Verifies the Cloudflare Access JWT on every request that reaches the Worker.
 * Workers' built-in `ctx.access` is not an option here: Access does not pass
 * it to Workers that serve static assets, which this one does.
 * Access already gates the hostname at the edge; verifying here stops requests
 * that bypass it (for example via the workers.dev route).
 *
 * Local dev signs requests to localhost in as the dev user (see dev.ts).
 * That branch exists only in `bun run dev`: production builds drop it.
 */
export const accessAuth = createMiddleware<AppEnv>(async (c, next) => {
  const env = c.env;
  const host = new URL(c.req.url).hostname;

  if (import.meta.env.DEV && LOCAL_HOSTS.has(host)) {
    c.set("email", devEmail(env));
    c.set("orgId", LOCAL_ORG_ID);
    return next();
  }

  const access = await accessSettings(env);
  if (!access) {
    // Not set up yet: the page shows Finish setup (see setup-routes.ts).
    return c.json({ error: "Setup required", setupRequired: true }, 503);
  }
  let orgId: string;
  try {
    orgId = orgIdForTeam(access.teamDomain);
  } catch {
    return c.json({ error: "Access is not configured" }, 500);
  }

  const token =
    c.req.header("cf-access-jwt-assertion") ??
    getCookie(c.req.header("cookie"), "CF_Authorization");
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, getJwks(access.teamDomain), {
      // Access signs with RS256.
      algorithms: ["RS256"],
      audience: access.aud,
      issuer: access.teamDomain,
    });
    if (typeof payload.email !== "string") {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("email", payload.email);
    c.set("orgId", orgId);
    return next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
});

/**
 * Agent URLs are /agents/{class}/{instance}/...; the only top-level agent is
 * Org, and a caller may only reach the Org instance they belong to. Sub-agent
 * paths (/sub/job-agent/{runId}) are further gated by Org.onBeforeSubAgent.
 */
export const orgGuard = createMiddleware<AppEnv>(async (c, next) => {
  const [, prefix, agent, instance] = new URL(c.req.url).pathname.split("/");
  if (prefix !== "agents" || agent !== "org" || instance !== c.get("orgId")) {
    return c.json({ error: "Forbidden" }, 403);
  }
  return next();
});

/** Header prefixes the Agents SDK and partyserver use between their own components. */
const INTERNAL_HEADER_PREFIXES = ["x-cf-agents-", "x-agents-", "x-partykit-"];

/** Carries the verified member email from the Worker to the Org agent. */
export const MEMBER_EMAIL_HEADER = "x-powerhouse-member-email";

/**
 * Sets the member header from the verified Access email, replacing any value
 * the client sent, so agents can trust it, and drops internal headers a
 * client must not set. Runs after accessAuth, for every agent request.
 */
export const forwardMember = createMiddleware<AppEnv>(async (c, next) => {
  const headers = new Headers(c.req.raw.headers);
  // The Agents SDK and partyserver trust these when present (sub-agent
  // routing, lifecycle props, room names); only their own routing may set
  // them. A client-sent x-cf-agents-subagent-url, for one, would open a
  // job agent without Org.onBeforeSubAgent's check.
  for (const name of [...headers.keys()]) {
    if (INTERNAL_HEADER_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      headers.delete(name);
    }
  }
  headers.set(MEMBER_EMAIL_HEADER, c.get("email"));
  c.req.raw = new Request(c.req.raw, { headers });
  return next();
});

function getCookie(header: string | undefined, name: string) {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return undefined;
}
