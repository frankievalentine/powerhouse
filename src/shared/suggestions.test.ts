import { describe, expect, test } from "bun:test";
import { type Capabilities, isNewerVersion, resolveSuggestion, runnableSuggestions } from ".";

const off: Capabilities = { browser: false, sendEmail: false, webFetch: true, webSearch: false };
const ctx = { capabilities: off, me: "ana@example.com", website: "" };

describe("role suggestions", () => {
  test("plain lines show as written", () => {
    expect(resolveSuggestion("Summarize our week", ctx)).toBe("Summarize our week");
  });

  test("a tool tag hides the line until the tool is on, then is stripped", () => {
    expect(resolveSuggestion("[web search] Find competitors", ctx)).toBeNull();
    expect(resolveSuggestion("[web search] Find competitors", { ...ctx, capabilities: { ...off, webSearch: true } })).toBe(
      "Find competitors",
    );
  });

  test("an unknown tag hides the line", () => {
    expect(resolveSuggestion("[teleport] Go", ctx)).toBeNull();
  });

  test("{website} needs a website; {me} is the member's email", () => {
    expect(resolveSuggestion("Check {website}", ctx)).toBeNull();
    expect(resolveSuggestion("Check {website}", { ...ctx, website: "https://acme.test" })).toBe("Check https://acme.test");
    expect(resolveSuggestion("Send it to {me}", ctx)).toBe("Send it to ana@example.com");
  });

  test("the first runnable line falls back past ones that need a tool", () => {
    const lines = ["[browser] Check {website} at phone size", "Read {website} for broken links"];
    expect(runnableSuggestions(lines, { ...ctx, website: "https://acme.test" })[0]).toBe("Read https://acme.test for broken links");
    expect(runnableSuggestions(lines, ctx)).toEqual([]);
  });
});

describe("isNewerVersion", () => {
  test("compares major, minor and patch, with or without v", () => {
    expect(isNewerVersion("0.1.0", "1.0.0")).toBe(true);
    expect(isNewerVersion("v1.2.0", "1.10.0")).toBe(true);
    expect(isNewerVersion("1.2.3", "v1.2.3")).toBe(false);
    expect(isNewerVersion("1.3.0", "1.2.9")).toBe(false);
  });
});
