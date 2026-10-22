import {
  AuthorizationError,
  CimdFetchError,
  getOAuthApi,
  type OAuthHelpers,
  OAuthProvider,
  type OAuthProviderOptions,
} from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/server";
import { getAgentByName } from "agents";
import { createMcpHandler } from "agents/mcp/server";
import { Hono } from "hono";
import { z } from "zod";
import { type AuthVariables, accessAuth, deploymentOrgId } from "./auth";
import { safeError } from "./log";
import { consentPage, describeRun, escape, isPublicMcpPath, pageHtml, RUN_PHASE_TEXT } from "./mcp-text";

export { isMcpPath } from "./mcp-text";

/**
 * powerhouse as an MCP server: members start and read their jobs from
 * Claude, ChatGPT or Cursor. The Worker's own Access sign-in is the login:
 * /authorize sits behind Access, so the consent page knows who the member is
 * and issues a grant carrying their email. Everything else here is public to
 * the internet (setup gives these paths an Access bypass) and answers 404
 * while an admin has the feature off.
 */

/** What a grant carries to the MCP tools. */
interface AppProps {
  email: string;
  orgId: string;
  /** The app's name, as it registered itself. */
  client: string;
}

/**
 * Built per request: every deployment has its own hostname, and the resource
 * a client connects to (`${origin}/mcp`) is the audience of its tokens.
 */
export function mcpProviderOptions(origin: string, defaultHandler: ExportedHandler<Env>): OAuthProviderOptions<Env> {
  return {
    accessTokenTTL: 60 * 60,
    apiHandler: { fetch: (request, env, ctx) => mcpFetch(request, env, ctx) },
    apiRoute: "/mcp",
    authorizeEndpoint: "/authorize",
    clientRegistrationEndpoint: "/oauth/register",
    defaultHandler,
    refreshTokenTTL: 30 * 24 * 60 * 60,
    resourceMetadata: {
      authorization_servers: [origin],
      bearer_methods_supported: ["header"],
      resource: `${origin}/mcp`,
      resource_name: "powerhouse",
    },
    tokenEndpoint: "/oauth/token",
  };
}

/** Answers the MCP and OAuth paths; 404 for the public ones while the feature is off. */
export async function handleMcpRequest(request: Request, env: Env, ctx: ExecutionContext, app: ExportedHandler<Env>) {
  const url = new URL(request.url);
  if (isPublicMcpPath(url.pathname) && !(await mcpEnabled(env, request.url))) {
    return new Response("Not found", { status: 404 });
  }
  return new OAuthProvider(mcpProviderOptions(url.origin, app)).fetch(request, env, ctx);
}

async function org(env: Env, orgId: string) {
  return getAgentByName(env.Org, orgId);
}

async function mcpEnabled(env: Env, url: string) {
  const orgId = await deploymentOrgId(env, url);
  if (!orgId) {
    return false;
  }
  try {
    return await (await org(env, orgId)).mcpEnabled();
  } catch (error) {
    console.warn("Checking whether MCP is on failed", safeError(error));
    return false;
  }
}

function mcpFetch(request: Request, env: Env, ctx: ExecutionContext) {
  const props = (ctx as ExecutionContext & { props?: AppProps }).props;
  if (!props?.email) {
    return Promise.resolve(new Response("Unauthorized", { status: 401 }));
  }
  const origin = new URL(request.url).origin;
  const handler = createMcpHandler(() => mcpServer(env, props, origin), { authContext: { props: { ...props } }, route: "/mcp" });
  return handler(request, env, ctx);
}

function text(value: string) {
  return { content: [{ text: value, type: "text" as const }] };
}

function failure(error: unknown) {
  return { ...text(error instanceof Error ? error.message : String(error)), isError: true };
}

function mcpServer(env: Env, props: AppProps, origin: string) {
  const server = new McpServer({ name: "powerhouse", version: __APP_VERSION__ });
  const roleNames = async () => new Map((await (await org(env, props.orgId)).rolesForApp()).map((r) => [r.id, r.name]));

  server.registerTool(
    "list_roles",
    {
      annotations: { readOnlyHint: true },
      description: "The team's roles in powerhouse, each with its id and what it does. Pass a role's id to start_job to send it a job.",
    },
    async () => {
      try {
        const roles = await (await org(env, props.orgId)).rolesForApp();
        return text(roles.map((r) => `- ${r.name} (id: ${r.id}): ${r.purpose}`).join("\n"));
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "start_job",
    {
      description:
        "Start a job in powerhouse as the signed-in member. It returns at once with the job's id; jobs take seconds to minutes, so check on it later with get_job. Without a role, powerhouse picks one. Emails, writes to connected accounts and some browser actions wait for the member's approval in powerhouse, never here.",
      inputSchema: {
        prompt: z.string().min(1).max(4000).describe("What the job should do, as you would tell a colleague"),
        role: z.string().max(80).optional().describe("A role's id or name from list_roles; leave out to let powerhouse pick"),
      },
    },
    async ({ prompt, role }) => {
      try {
        const stub = await org(env, props.orgId);
        let roleId: string | undefined;
        if (role) {
          const roles = await stub.rolesForApp();
          const wanted = role.trim().toLowerCase();
          roleId = roles.find((r) => r.id === role.trim() || r.name.toLowerCase() === wanted)?.id;
          if (!roleId) {
            return failure(new Error(`No role "${role}". Use list_roles for the ids.`));
          }
        }
        const { runId } = await stub.startJobFromApp(props.email, prompt, roleId, props.client);
        return text(
          `Started job ${runId}${roleId ? "" : "; powerhouse is picking a role"}. Check on it with get_job (id ${runId}), or open ${origin}/?run=${encodeURIComponent(runId)}`,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "get_job",
    {
      annotations: { readOnlyHint: true },
      description: "Where a job stands and, once done, its answer. Works for jobs the signed-in member started (admins: any job).",
      inputSchema: { id: z.string().min(1).max(40).describe("The job's id, from start_job or list_my_jobs") },
    },
    async ({ id }) => {
      try {
        const run = await (await org(env, props.orgId)).jobForApp(props.email, id.trim());
        if (!run) {
          return failure(new Error(`No job ${id} that you can see. list_my_jobs shows yours.`));
        }
        const names = await roleNames();
        return text(describeRun(run, run.roleId ? (names.get(run.roleId) ?? null) : null, origin));
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    "list_my_jobs",
    {
      annotations: { readOnlyHint: true },
      description: "The signed-in member's recent jobs in powerhouse, newest first, with where each stands.",
      inputSchema: { limit: z.number().int().min(1).max(20).optional().describe("How many, up to 20 (default 10)") },
    },
    async ({ limit }) => {
      try {
        const stub = await org(env, props.orgId);
        const [runs, names] = await Promise.all([stub.jobsForApp(props.email, limit ?? 10), roleNames()]);
        if (runs.length === 0) {
          return text("You have no jobs in powerhouse yet.");
        }
        return text(
          runs
            .map((r) => `- ${r.runId}: ${RUN_PHASE_TEXT[r.phase] ?? r.phase} · ${r.roleId ? (names.get(r.roleId) ?? "a role") : "routing"} · ${r.prompt.slice(0, 100)}`)
            .join("\n"),
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  return server;
}

// ------------------------------------------------------------ consent page

type ConsentEnv = { Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers }; Variables: AuthVariables };

/**
 * /authorize: the member is signed in through Access (accessAuth), so the
 * page only asks whether this app may act for them. Built on the library's
 * consent helpers: the request stays server-side, and the form's handle is
 * bound to this browser and works once.
 */
export const authorizeRoutes = new Hono<ConsentEnv>();

authorizeRoutes.use("*", accessAuth);

authorizeRoutes.get("/", async (c) => {
  try {
    if (!(await (await org(c.env, c.get("orgId"))).mcpEnabled())) {
      return page("Turned off", "<p>Using powerhouse from other apps is turned off. An admin can turn it on in Settings.</p>", 403);
    }
    const oauth = c.env.OAUTH_PROVIDER;
    const request = await oauth.parseAuthRequest(c.req.raw);
    const details = await oauth.describeConsent(request);
    const consent = await oauth.beginConsent(request);
    consent.headers.set("content-type", "text/html; charset=utf-8");
    return new Response(consentPage(details, consent.handle, c.get("email")), { headers: consent.headers });
  } catch (error) {
    return consentError(error);
  }
});

authorizeRoutes.post("/", async (c) => {
  try {
    const oauth = c.env.OAUTH_PROVIDER;
    const form = await c.req.raw.formData();
    const handle = String(form.get("handle") ?? "");
    if (form.get("decision") !== "approve") {
      const denied = await oauth.denyConsent(c.req.raw, handle);
      return new Response(null, { headers: denied.headers, status: 302 });
    }
    if (!(await (await org(c.env, c.get("orgId"))).mcpEnabled())) {
      return page("Turned off", "<p>Using powerhouse from other apps is turned off. An admin can turn it on in Settings.</p>", 403);
    }
    const approved = await oauth.approveConsent(c.req.raw, handle);
    const client = await oauth.lookupClient(approved.request.clientId);
    const email = c.get("email").toLowerCase();
    const props: AppProps = { client: (client?.clientName ?? "another app").slice(0, 60), email, orgId: c.get("orgId") };
    const { redirectTo } = await oauth.completeAuthorization({
      metadata: { client: props.client },
      props,
      request: approved.request,
      scope: approved.request.scope,
      userId: grantUser(email),
    });
    approved.headers.set("location", redirectTo);
    return new Response(null, { headers: approved.headers, status: 302 });
  } catch (error) {
    return consentError(error);
  }
});

/** Grant user ids cannot contain ":", so the email is encoded. */
function grantUser(email: string) {
  return encodeURIComponent(email.toLowerCase());
}

function consentError(error: unknown) {
  if (error instanceof AuthorizationError && error.redirectTo) {
    return Response.redirect(error.redirectTo, 302);
  }
  if (error instanceof AuthorizationError || error instanceof CimdFetchError) {
    const message = error instanceof AuthorizationError ? error.description : "This app could not be verified.";
    return page("Could not connect", `<p>${escape(message)}</p><p>Start connecting again from the app.</p>`, 400);
  }
  throw error;
}

function page(title: string, body: string, status: number) {
  return new Response(pageHtml(title, body), { headers: { "content-type": "text/html; charset=utf-8" }, status });
}

// ---------------------------------------------------------- connected apps

/** A member's apps (grants), for Settings > Use from other apps. */
export interface ConnectedApp {
  grantId: string;
  client: string;
  createdAt: number;
}

/** Under /api, so Access has checked who is asking. Members see and revoke their own apps; admins also a member's. */
export const connectedAppsRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

function helpers(c: { env: Env; req: { url: string } }) {
  return getOAuthApi(mcpProviderOptions(new URL(c.req.url).origin, { fetch: () => new Response(null, { status: 404 }) }), c.env);
}

/** Whose apps: the caller's, or (for an admin) the member named in ?member=. */
async function subject(c: { env: Env; get: (key: "email" | "orgId") => string; req: { query: (key: string) => string | undefined } }) {
  const me = c.get("email").toLowerCase();
  const member = c.req.query("member")?.toLowerCase();
  if (!member || member === me) {
    return me;
  }
  if (!(await (await org(c.env, c.get("orgId"))).memberIsAdmin(me))) {
    throw new Error("Only admins can see other members' apps.");
  }
  return member;
}

connectedAppsRoutes.get("/", async (c) => {
  try {
    const email = await subject(c);
    const { items } = await helpers(c).listUserGrants(grantUser(email), { limit: 100 });
    const apps: ConnectedApp[] = items.map((g) => ({
      client: typeof g.metadata?.client === "string" ? g.metadata.client : "an app",
      createdAt: g.createdAt * 1000,
      grantId: g.id,
    }));
    return c.json({ apps, email });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 403);
  }
});

connectedAppsRoutes.delete("/:grantId", async (c) => {
  try {
    const email = await subject(c);
    await helpers(c).revokeGrant(c.req.param("grantId"), grantUser(email));
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 403);
  }
});
