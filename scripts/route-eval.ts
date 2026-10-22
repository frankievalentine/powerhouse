// Compares router models on speed and accuracy, using the exact request Org
// sends (src/server/router.ts) over the default and library roles, which is
// the hardest set an org can have. Calls Workers AI's REST API on the
// account you are signed in to with wrangler, billed as usual. (Wrangler's
// local binding proxy is not used: it relays calls over RPC, which stalls
// and cannot carry abort signals.)
//
//   bun run route:eval                      every candidate, 3 rounds
//   bun run route:eval --models @cf/a,@cf/b --rounds 1 --concurrency 4 --reasoning none

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { MODELS } from "../src/shared";
import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { DEFAULT_ROLES, ROLE_LIBRARY } from "../src/server/roles";
import { clefRouteRequest, type RoutableRole, routeRequest } from "../src/server/router";

/** Each case lists every role that is a reasonable answer. */
const CASES: { prompt: string; expect: string[] }[] = [
  { expect: ["generalist"], prompt: "What's 15% of 2,340?" },
  { expect: ["generalist"], prompt: "Turn these notes into a tidy bullet list: call vendor, fix invoice, book flights" },
  { expect: ["generalist"], prompt: "Explain the difference between a VPN and a proxy in plain words" },
  { expect: ["generalist", "communications"], prompt: "Rewrite this sentence to sound friendlier: We cannot process your request." },
  { expect: ["researcher"], prompt: "Find the three most cited studies on remote work productivity since 2023 and summarize them with links" },
  { expect: ["researcher"], prompt: "What are the main differences between Postgres and MySQL for a small SaaS? Cite sources" },
  { expect: ["researcher", "changelog-digest"], prompt: "Research what changed in the EU AI Act this year" },
  { expect: ["researcher"], prompt: "Look up how other companies structure a four-day work week pilot" },
  { expect: ["communications"], prompt: "Email ops@example.com a one-paragraph status update on this week" },
  { expect: ["communications"], prompt: "Send a thank-you email to jane@acme.com for yesterday's workshop" },
  { expect: ["communications"], prompt: "Draft and send an email to the team announcing the office move on Friday" },
  { expect: ["competitor-watcher"], prompt: "What did Acme change on their pricing and features pages this month?" },
  { expect: ["competitor-watcher", "researcher"], prompt: "Keep an eye on what our competitor Linear shipped recently" },
  { expect: ["site-qa-tester"], prompt: "Check that every page on example.com loads and has no broken links" },
  { expect: ["site-qa-tester", "seo-content-writer"], prompt: "Our signup page looks broken on mobile, can you test it?" },
  { expect: ["meeting-prep"], prompt: "I have a call with the CTO of Stripe tomorrow, prepare a brief" },
  { expect: ["meeting-prep", "lead-researcher"], prompt: "Give me background on Jane Doe from Acme before our meeting" },
  { expect: ["support-replies"], prompt: "Reply to this customer who can't reset their password: ..." },
  { expect: ["support-replies"], prompt: "A customer asks whether we offer refunds after 30 days, answer them" },
  { expect: ["changelog-digest"], prompt: "Summarize the latest Cloudflare Agents SDK releases" },
  { expect: ["changelog-digest"], prompt: "What matters in the React 20 release notes?" },
  { expect: ["docs-expert"], prompt: "According to our docs, how do I rotate an API key?" },
  { expect: ["docs-expert"], prompt: "Answer from our documentation only: what are the rate limits?" },
  { expect: ["lead-researcher"], prompt: "Build profiles of 5 mid-size logistics companies in Germany with a contact for each" },
  { expect: ["lead-researcher", "outbound-sales"], prompt: "Who should we contact at Shopify about a partnership?" },
  { expect: ["price-watcher"], prompt: "Is the Sony WH-1000XM6 in stock at Best Buy and what does it cost?" },
  { expect: ["price-watcher"], prompt: "Check the current prices of these three product pages" },
  { expect: ["product-manager"], prompt: "Write a PRD for adding SSO to our admin dashboard" },
  { expect: ["product-manager"], prompt: "Synthesize these five user interview notes into themes and next steps" },
  { expect: ["product-manager", "communications"], prompt: "Write a stakeholder update on the Q4 roadmap slip" },
  { expect: ["product-marketer"], prompt: "Draft positioning and a launch plan for our new analytics feature" },
  { expect: ["product-marketer", "seo-content-writer"], prompt: "Write homepage headline options for our booking app" },
  { expect: ["seo-content-writer"], prompt: "Audit our blog post on remote hiring for SEO problems" },
  { expect: ["seo-content-writer"], prompt: "Plan a content calendar of articles that could rank for 'vet clinic software'" },
  { expect: ["outbound-sales"], prompt: "Find 10 dental clinics in Austin and send each a personalized cold email" },
  { expect: ["outbound-sales"], prompt: "Write and send a cold email to the head of ops at Flexport" },
  { expect: ["contract-reviewer"], prompt: "Review this NDA and flag anything risky" },
  { expect: ["contract-reviewer"], prompt: "Is the liability clause in this vendor contract reasonable?" },
  { expect: ["generalist", "researcher"], prompt: "Help me plan a 3-day team offsite in Lisbon" },
  { expect: ["generalist"], prompt: "hi" },
];

const flag = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const DEFAULT_CANDIDATES = [
  "@cf/cloudflare/clef-flash",
  "@cf/moonshotai/kimi-k2.7-code",
  "@cf/zai-org/glm-5.3-flash",
  "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
  "@cf/qwen/qwen3.8-27b",
];
const models = flag("models")?.split(",") ?? DEFAULT_CANDIDATES;
const rounds = Number(flag("rounds") ?? 3);
/** Calls in flight per model: a few, like an org sending jobs, without one slow call blocking the run. */
const concurrency = Number(flag("concurrency") ?? 4);
/** "none" turns a model's thinking off for the call (Workers AI reasoning_effort: null). */
const reasoning = flag("reasoning") as "none" | "low" | undefined;

const roles: RoutableRole[] = [
  ...DEFAULT_ROLES.map(({ id, name, purpose }) => ({ id, name, purpose })),
  ...ROLE_LIBRARY.map(({ name, purpose, templateId }) => ({ id: templateId, name, purpose })),
];
for (const c of CASES) {
  for (const id of c.expect) {
    if (!roles.some((r) => r.id === id)) {
      throw new Error(`Case "${c.prompt}" expects unknown role "${id}"`);
    }
  }
}

const wrangler = (...args: string[]) => {
  const result = spawnSync("node", [join(import.meta.dirname, "../node_modules/wrangler/bin/wrangler.js"), ...args], {
    encoding: "utf8",
  });
  return JSON.parse(result.stdout);
};
const { token } = wrangler("auth", "token", "--json") as { token: string };
const accountId =
  process.env.CLOUDFLARE_ACCOUNT_ID ?? (wrangler("whoami", "--json") as { accounts: { id: string }[] }).accounts[0]?.id;
if (!(token && accountId)) {
  throw new Error("Sign in with wrangler first, and set CLOUDFLARE_ACCOUNT_ID if you have several accounts.");
}
const workersai = createWorkersAI({ accountId, apiKey: token });

/** Clef models are decision models, not chat models: they take a state and typed questions. */
async function clefRoute(model: string, prompt: string) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    body: JSON.stringify(clefRouteRequest(prompt, roles)),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    method: "POST",
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const { result } = (await response.json()) as { result: { answers: { role: { choice: string; confidence: number } } } };
  return result.answers.role;
}
/** A call slower than this counts as an error, so one stuck call cannot stall the run. */
const CALL_TIMEOUT_MS = 60_000;

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
};

console.log(`${CASES.length} prompts, ${roles.length} roles, ${rounds} round(s), ${concurrency} at a time, reasoning ${reasoning ?? "default"}\n`);
const rows: string[] = [];
for (const model of models) {
  const label = MODELS.find((m) => m.id === model)?.label ?? model;
  const times: number[] = [];
  let correct = 0;
  let failed = 0;
  const misses = new Map<string, number>();
  const queue = Array.from({ length: rounds }, () => CASES).flat();
  const worker = async () => {
    for (let c = queue.shift(); c; c = queue.shift()) {
      let miss: string | null = null;
      let elapsed = 0;
      for (let attempt = 0; ; attempt++) {
        const started = performance.now();
        try {
          const output = model.startsWith("@cf/cloudflare/clef")
            ? (await clefRoute(model, c.prompt)).choice
            : (
                await generateText({
                  abortSignal: AbortSignal.timeout(CALL_TIMEOUT_MS),
                  maxRetries: 0,
                  model: workersai(model as never),
                  ...routeRequest(c.prompt, roles),
                  ...(reasoning ? { reasoning } : {}),
                })
              ).output;
          elapsed = performance.now() - started;
          miss = c.expect.includes(output) ? null : `"${c.prompt.slice(0, 50)}" -> ${output}`;
          if (!miss) {
            correct++;
          }
        } catch (error) {
          // Workers AI's per-model rate limit is about the eval's own pace,
          // not the model: wait it out, untimed and uncounted.
          if (attempt < 5 && String(error).includes("429")) {
            await new Promise((resolve) => setTimeout(resolve, 15_000));
            continue;
          }
          elapsed = performance.now() - started;
          failed++;
          miss = `error: ${String(error).replace(/\s+/g, " ").slice(0, 220)}`;
        }
        break;
      }
      times.push(elapsed);
      if (miss) {
        misses.set(miss, (misses.get(miss) ?? 0) + 1);
      }
      process.stderr.write(".");
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stderr.write("\n");
  const total = CASES.length * rounds;
  const row = `${label.padEnd(18)} accuracy ${((correct / total) * 100).toFixed(0).padStart(3)}%  p50 ${(percentile(times, 50) / 1000).toFixed(1)}s  p90 ${(percentile(times, 90) / 1000).toFixed(1)}s  max ${(Math.max(...times) / 1000).toFixed(1)}s  errors ${failed}`;
  rows.push(row);
  console.log(row);
  for (const [miss, count] of [...misses].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`    ${count}x ${miss}`);
  }
}
console.log(`\nSummary\n${rows.join("\n")}`);
