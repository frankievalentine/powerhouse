import type { ConsentDescription } from "@cloudflare/workers-oauth-provider";
import type { RunSummary } from "../shared";

// The parts of the MCP server (mcp.ts) that need no Workers runtime, so
// they can be tested: which paths are MCP paths, how a run reads to an app,
// and the consent page's HTML.

const PUBLIC_PREFIXES = ["/mcp/", "/oauth/", "/.well-known/oauth-"];

/** Paths the OAuth provider answers (the consent page among them). */
export function isMcpPath(pathname: string) {
  return pathname === "/authorize" || isPublicMcpPath(pathname);
}

/** The paths MCP clients call without an Access session. */
export function isPublicMcpPath(pathname: string) {
  return pathname === "/mcp" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** A run as an app reads it: where it stands, what it said, and where to see it. */
export function describeRun(run: RunSummary, roleName: string | null, origin: string) {
  const link = `${origin}/?run=${encodeURIComponent(run.runId)}`;
  const role = roleName ?? (run.phase === "routing" ? "being routed" : "a role");
  const lines = [`Job ${run.runId} (${role}): ${RUN_PHASE_TEXT[run.phase] ?? run.phase}.`];
  if (run.phase === "awaiting_approval") {
    lines.push(`It is waiting for an approval, which only happens in powerhouse: ${link}`);
  } else if (run.activity && (run.phase === "running" || run.phase === "routing")) {
    lines.push(`Now: ${run.activity}`);
  }
  if (run.error) {
    lines.push(`Error: ${run.error}`);
  }
  if (run.summary) {
    lines.push(`Answer:\n${run.summary}`);
  }
  lines.push(`Open it in powerhouse: ${link}`);
  return lines.join("\n");
}

export const RUN_PHASE_TEXT: Record<string, string> = {
  aborted: "stopped",
  awaiting_approval: "waiting for approval",
  completed: "done",
  error: "failed",
  interrupted: "interrupted",
  routing: "picking a role",
  running: "working",
};

export function escape(value: string) {
  return value.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export function consentPage(details: ConsentDescription, handle: string, email: string) {
  const name = escape(details.clientName);
  const origin = details.clientDomain
    ? `Published by <b>${escape(details.clientDomain)}</b>.`
    : "This app named itself; powerhouse cannot verify the name.";
  return pageHtml(
    `Allow ${name} to use powerhouse?`,
    `<p>${origin} Access goes to <b>${escape(details.redirectHost)}</b>.</p>
     ${details.redirectIsLoopback ? "<p><b>This sends access to an app on your computer.</b> Continue only if you just started connecting from it.</p>" : ""}
     <p>As <b>${escape(email)}</b>, ${name} will be able to:</p>
     <ul><li>see the team's roles</li><li>start jobs as you</li><li>read the jobs you started</li></ul>
     <p>Approvals (emails, writes to connected accounts) still happen only in powerhouse. You can remove this app any time in Settings > Use from other apps.</p>
     <form method="post">
       <input type="hidden" name="handle" value="${escape(handle)}">
       <p><button name="decision" value="approve" type="submit">Allow</button> <button name="decision" value="deny" type="submit">Deny</button></p>
     </form>`,
  );
}

export function pageHtml(title: string, body: string) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:light-dark(#1e1c1a,#ece7e0);background:light-dark(#fbfaf7,#221f1c);color-scheme:light dark}button{font:inherit;padding:6px 14px;border-radius:8px;border:1px solid light-dark(#d8d3cc,#3a3632);background:light-dark(#fff,#2b2724);color:inherit;cursor:pointer}button[value=approve]{background:light-dark(#5b54e8,#8f89ff);color:#fff;border-color:transparent}</style>
<h1 style="font-size:20px">${escape(title)}</h1>${body}`;
}

