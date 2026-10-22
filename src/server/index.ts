import { Hono } from "hono";
import { agentsMiddleware } from "hono-agents";
import { type AuthVariables, accessAuth, forwardMember, orgGuard } from "./auth";

// Runs the model-written browser code in a Worker Loader sandbox (browser tool).
export { CodemodeRuntime } from "agents/browser";
export { JobAgent } from "./job-agent";
export { Org } from "./org";

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

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

export default app;
