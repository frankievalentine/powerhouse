import { describe, expect, test } from "bun:test";
import { speakableText } from "./index";

describe("speakableText", () => {
  test("reads words, not Markdown", () => {
    expect(speakableText("## Result\n- **Acme** is [cheaper](https://x.com).\n- See `price`")).toBe("Result\nAcme is cheaper.\nSee price");
  });

  test("leaves out code and bare links", () => {
    const out = speakableText("Run this:\n```js\nrm()\n```\nDocs at https://example.com/docs");
    expect(out).toContain("(code left out)");
    expect(out).not.toContain("rm()");
    expect(out).toContain("a link");
  });
});
