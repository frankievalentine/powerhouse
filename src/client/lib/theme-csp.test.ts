import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// index.html's inline theme script runs only if public/_headers allows its hash.
test("the theme script's hash is in the Content-Security-Policy", () => {
  const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
  const headers = readFileSync(new URL("../../../public/_headers", import.meta.url), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  expect(scripts).toHaveLength(1);
  const hash = createHash("sha256").update(scripts[0]).digest("base64");
  expect(headers).toContain(`'sha256-${hash}'`);
});
