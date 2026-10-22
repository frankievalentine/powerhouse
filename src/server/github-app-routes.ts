import { getAgentByName } from "agents";
import { Hono } from "hono";
import type { AuthVariables } from "./auth";
import { safeError } from "./log";

/**
 * Where GitHub sends the admin after creating the org's GitHub App from the
 * manifest (Settings > Connections > GitHub). Mounted under /api, so Access
 * has already checked who this is; Org checks that this admin started it.
 */
export const githubAppRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

githubAppRoutes.get("/created", async (c) => {
  const code = c.req.query("code") ?? "";
  const state = c.req.query("state") ?? "";
  const origin = new URL(c.req.url).origin;
  try {
    const org = await getAgentByName(c.env.Org, c.get("orgId"));
    const app = await org.finishGitHubApp(code, state, c.get("email"), origin);
    return page(
      "GitHub App created",
      `<p>powerhouse now has its own GitHub App${app.owner ? ` on <b>${escape(app.owner)}</b>` : ""}. Two steps left:</p>
       <ol>
         <li><a href="${escape(app.installUrl)}" rel="noopener noreferrer" target="_blank">Choose the repositories</a> jobs may reach.</li>
         <li>Back in powerhouse, <a href="/">open Settings > Connections</a> and click <b>Sign in</b> next to GitHub.</li>
       </ol>`,
      200,
    );
  } catch (error) {
    console.warn("Finishing the GitHub App failed", safeError(error));
    return page("GitHub was not connected", `<p>${escape(error instanceof Error ? error.message : String(error))}</p><p><a href="/">Back to powerhouse</a></p>`, 400);
  }
});

function escape(text: string) {
  return text.replace(/[&<>"']/g, (ch) => ({ '"': "&quot;", "&": "&amp;", "'": "&#39;", "<": "&lt;", ">": "&gt;" })[ch] as string);
}

function page(title: string, body: string, status: 200 | 400) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
     <style>body{font:15px/1.6 system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:light-dark(#1e1c1a,#ece7e0);background:light-dark(#fbfaf7,#221f1c);color-scheme:light dark}a{color:light-dark(#5b54e8,#8f89ff)}</style>
     <h1 style="font-size:20px">${title}</h1>${body}`,
    { headers: { "content-type": "text/html; charset=utf-8", "referrer-policy": "no-referrer" }, status },
  );
}
