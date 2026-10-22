import { describe, expect, test } from "bun:test";
import { AUTO_MODEL, DEFAULT_MODEL, estimateCostUsd, MODELS, resolveModel, summaryModelFor } from "../shared";
import { isSpendLimit, modelSetupFailure } from "./models";

describe("estimateCostUsd", () => {
  test("uses the model's list price per million tokens", () => {
    // Opus 5.5: $4 in, $20 out.
    expect(estimateCostUsd("anthropic/claude-opus-5-5", { inputTokens: 50_000, outputTokens: 2_000 })).toBeCloseTo(0.24, 6);
    expect(estimateCostUsd("anthropic/claude-opus-5-5", {})).toBe(0);
    expect(estimateCostUsd("unknown/model", { inputTokens: 1_000_000 })).toBe(0);
  });
});

describe("summaryModelFor", () => {
  test("vendor models summarize with the vendor's cheapest model", () => {
    expect(summaryModelFor("anthropic/claude-opus-5-5")).toBe("anthropic/claude-haiku-5-5");
    expect(summaryModelFor("openai/gpt-6-sol")).toBe("openai/gpt-6-luna");
  });

  test("open models and unknown ids summarize with themselves", () => {
    expect(summaryModelFor(DEFAULT_MODEL)).toBe(DEFAULT_MODEL);
    expect(summaryModelFor("removed/model")).toBe("removed/model");
  });

  test("every model has a context window above the compaction threshold", () => {
    for (const model of MODELS) {
      expect(model.contextWindow).toBeGreaterThan(200_000);
    }
  });
});

describe("resolveModel", () => {
  test("automatic prefers Claude, then GPT, then the open model", () => {
    expect(resolveModel(AUTO_MODEL, ["anthropic", "openai"])).toBe("anthropic/claude-opus-5-5");
    expect(resolveModel(AUTO_MODEL, ["openai"])).toBe("openai/gpt-6-sol");
    expect(resolveModel(AUTO_MODEL, [])).toBe(DEFAULT_MODEL);
  });

  test("a chosen model is kept when its vendor is set up", () => {
    expect(resolveModel("openai/gpt-6-luna", ["anthropic", "openai"])).toBe("openai/gpt-6-luna");
    expect(resolveModel("@cf/qwen/qwen3.8-27b", [])).toBe("@cf/qwen/qwen3.8-27b");
  });

  test("a vendor model whose vendor is gone resolves like automatic", () => {
    expect(resolveModel("anthropic/claude-sonnet-5-5", ["openai"])).toBe("openai/gpt-6-sol");
    expect(resolveModel("anthropic/claude-sonnet-5-5", [])).toBe(DEFAULT_MODEL);
  });

  test("an unknown or removed model resolves like automatic", () => {
    expect(resolveModel("@cf/openai/gpt-oss-120b", ["anthropic"])).toBe("anthropic/claude-opus-5-5");
    expect(resolveModel(null, [])).toBe(DEFAULT_MODEL);
  });
});

describe("modelSetupFailure", () => {
  test("no credits", () => {
    expect(modelSetupFailure({ code: "gateway-error", status: 402 }, "anthropic")).toContain("credits");
    expect(modelSetupFailure({ message: "Insufficient balance" }, "openai")).toContain("credits");
  });

  test("a rejected key names the vendor and the variable to set", () => {
    expect(modelSetupFailure({ statusCode: 401 }, "anthropic")).toContain("POWERHOUSE_ANTHROPIC_KEY");
    expect(modelSetupFailure({ code: "auth" }, "openai")).toContain("openai key");
  });

  test("the gateway's spend limit is told apart from rate limits", () => {
    expect(modelSetupFailure({ message: "Spend limit exceeded for this gateway", status: 429 }, "anthropic")).toContain("spend limit");
    expect(modelSetupFailure({ status: 429 }, "anthropic")).toContain("Rate limited");
  });

  test("a spend limit is recognized on its own, apart from rate limits", () => {
    expect(isSpendLimit({ message: "Spend limit exceeded", status: 429 })).toBe(true);
    expect(isSpendLimit({ code: "rate-limit", responseBody: "budget reached" })).toBe(true);
    expect(isSpendLimit({ status: 429 })).toBe(false);
    expect(isSpendLimit({ message: "spend", status: 500 })).toBe(false);
  });

  test("gateway authentication off", () => {
    expect(modelSetupFailure({ message: "AI Gateway error 2049" }, "anthropic")).toContain("authentication");
  });

  test("other failures are not setup problems", () => {
    expect(modelSetupFailure({ status: 500 }, "anthropic")).toBeNull();
    expect(modelSetupFailure(new Error("socket hang up"), "openai")).toBeNull();
  });
});
