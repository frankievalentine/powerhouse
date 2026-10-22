import { Hono } from "hono";
import { agentsMiddleware } from "hono-agents";
import { type AuthVariables, accessAuth, forwardMember, orgGuard } from "./auth";
import { githubAppRoutes } from "./github-app-routes";
import { authorizeRoutes, connectedAppsRoutes, handleMcpRequest, isMcpPath } from "./mcp";
import { mcpAccessRoutes, setupRoutes } from "./setup-routes";
import { uploadRoutes } from "./upload-routes";
import { voiceRoutes } from "./voice-routes";

// Runs the model-written browser code in a Worker Loader sandbox (browser tool).
export { CodemodeRuntime } from "agents/browser";
export { Deployment } from "./deployment";
export { JobAgent } from "./job-agent";
export { Org } from "./org";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Finish setup answers before sign-in exists, so it is mounted ahead of
// accessAuth; its routes refuse once the deployment is set up.
app.route("/api/setup", setupRoutes);
app.use("/api/*", accessAuth);
app.use("/agents/*", accessAuth, orgGuard, forwardMember);
// The Agents SDK answers an uncaught error with its stack trace; members get
// a plain message instead (the error is still logged by the SDK).
app.use("/agents/*", async (c, next) => {
  await next();
  if (c.res.status >= 500 && c.res.status !== 101) {
    c.res = new Response("Something went wrong. Try again, or check the Worker's logs.", { status: c.res.status });
  }
});
app.use("/agents/*", agentsMiddleware());

app.get("/api/me", (c) => c.json({ email: c.get("email"), orgId: c.get("orgId") }));
app.route("/api/github-app", githubAppRoutes);
app.route("/api/apps", connectedAppsRoutes);
app.route("/api/mcp-access", mcpAccessRoutes);
app.route("/api/uploads", uploadRoutes);
app.route("/api/voice", voiceRoutes);
// The consent page for MCP clients; reached through handleMcpRequest, which
// gives it the OAuth helpers (env.OAUTH_PROVIDER).
app.route("/authorize", authorizeRoutes as unknown as typeof app);

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // The MCP server and its OAuth endpoints go through the OAuth provider,
    // which hands everything else (the consent page) back to the app.
    if (isMcpPath(new URL(request.url).pathname)) {
      return handleMcpRequest(request, env, ctx, app as unknown as ExportedHandler<Env>);
    }
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
