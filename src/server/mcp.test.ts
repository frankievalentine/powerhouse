import { describe, expect, test } from "bun:test";
import type { RunSummary } from "../shared";
import { consentPage, describeRun, isMcpPath, isPublicMcpPath } from "./mcp-text";

describe("MCP paths", () => {
  test("the public paths MCP clients call", () => {
    for (const path of ["/mcp", "/oauth/token", "/oauth/register", "/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-authorization-server"]) {
      expect(isPublicMcpPath(path)).toBe(true);
    }
  });

  test("the consent page goes through the provider but is not public", () => {
    expect(isMcpPath("/authorize")).toBe(true);
    expect(isPublicMcpPath("/authorize")).toBe(false);
  });

  test("the app's own paths are not MCP paths", () => {
    for (const path of ["/", "/api/me", "/agents/org/x", "/mcpx", "/.well-known/security.txt"]) {
      expect(isMcpPath(path)).toBe(false);
    }
  });
});

const run = (patch: Partial<RunSummary>): RunSummary => ({
  activity: null,
  completedAt: null,
  error: null,
  phase: "completed",
  prompt: "Compare pricing",
  roleId: "researcher",
  runId: "R1",
  startedAt: 0,
  summary: null,
  ...patch,
});

describe("describeRun", () => {
  test("a finished job gives its answer and a link", () => {
    const textOut = describeRun(run({ summary: "X is cheaper." }), "Researcher", "https://ph.example.com");
    expect(textOut).toContain("Job R1 (Researcher): done.");
    expect(textOut).toContain("Answer:\nX is cheaper.");
    expect(textOut).toContain("https://ph.example.com/?run=R1");
  });

  test("an approval points to powerhouse, where it happens", () => {
    const textOut = describeRun(run({ phase: "awaiting_approval" }), "Support replies", "https://ph.example.com");
    expect(textOut).toContain("only happens in powerhouse");
  });
});

describe("consentPage", () => {
  test("escapes everything the app chose", () => {
    const html = consentPage(
      {
        clientId: "c1",
        clientName: '<img src=x onerror="alert(1)">',
        redirectHost: "evil.example<script>",
        redirectIsLoopback: true,
        redirectUri: "https://evil.example/cb",
        scope: [],
      },
      'h"1',
      "a@b.com",
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&#34;");
    expect(html).toContain("an app on your computer");
  });
});
