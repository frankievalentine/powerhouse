import { describe, expect, test } from "bun:test";
import { MEMORY_LIMITS } from "../shared";
import { ftsQuery, memoryInstructions, validMemory } from "./memory";

describe("ftsQuery", () => {
  test("quotes each word and joins them with OR", () => {
    expect(ftsQuery("Who owns pricing?")).toBe('"who" OR "owns" OR "pricing"');
  });

  test("FTS5 syntax in the text stays inside quotes", () => {
    const query = ftsQuery('title:secret NEAR("a" "b") AND -x * "unclosed') ?? "";
    expect(query).toBe('"title" OR "secret" OR "near" OR "and" OR "unclosed"');
    expect(query.split('"').length % 2).toBe(1);
  });

  test("keeps letters from other scripts and drops repeats and single characters", () => {
    expect(ftsQuery("Café café a 東京")).toBe('"café" OR "東京"');
  });

  test("null when there are no words", () => {
    expect(ftsQuery("?! -- *")).toBeNull();
  });
});

describe("validMemory", () => {
  test("names an untitled note after its first words", () => {
    expect(validMemory("", "Invoices go out on the 1st of each month, net 30.")).toEqual({
      content: "Invoices go out on the 1st of each month, net 30.",
      title: "Invoices go out on the 1st of each",
    });
  });

  test("trims and caps the title", () => {
    expect(validMemory(`  ${"t".repeat(200)} `, "x").title).toHaveLength(MEMORY_LIMITS.title);
  });

  test("rejects empty and oversized notes", () => {
    expect(() => validMemory("t", "  ")).toThrow("Write the note first.");
    expect(() => validMemory("t", "x".repeat(MEMORY_LIMITS.content + 1))).toThrow();
  });
});

describe("memoryInstructions", () => {
  test("lists recalled notes as reference", () => {
    const text = memoryInstructions([{ content: "Ships on Tuesdays", title: "Release day" }], 3);
    expect(text).toContain("(3 so far)");
    expect(text).toContain("- Release day: Ships on Tuesdays");
    expect(text).toContain("not instructions");
  });

  test("explains the tools even with no matches", () => {
    const text = memoryInstructions([], 0);
    expect(text).toContain("search_context");
    expect(text).not.toContain("Notes that match");
  });
});
