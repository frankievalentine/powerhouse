# powerhouse

Your team's own fleet of AI agents, running in your own Cloudflare account. Describe a job, powerhouse sends it to the right role, an agent does the work with real tools and your connected accounts, and anything that changes something outside powerhouse waits for your approval.

Built on [Cloudflare Agents](https://developers.cloudflare.com/agents/), [AI Gateway](https://developers.cloudflare.com/ai-gateway/) and Workers AI. Sign-in is Cloudflare Access, so only the people you allow can use it.


## Get started

You need:

- A [Cloudflare account](https://dash.cloudflare.com/sign-up). Workers Free runs everything except the browser tool and the open-weight Workers AI models, which need [Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/).
- [Cloudflare Zero Trust](https://one.dash.cloudflare.com) turned on once (free for up to 50 users): choose a team name and the Free plan, which asks for a payment method even on Free. Setup cannot do this step for you.
- One way to pay for Claude or GPT: an [Anthropic](https://console.anthropic.com) or [OpenAI](https://platform.openai.com) API key, which you add to your AI Gateway in the Cloudflare dashboard, or [Cloudflare credits](https://developers.cloudflare.com/ai-gateway/features/unified-billing/). Your keys stay on the gateway; powerhouse never sees them.
- [Node](https://nodejs.org) 20 or later, and this repository on your computer.

Get the code:

```sh
git clone https://github.com/frankievalentine/powerhouse.git
cd powerhouse
```

### Option 1: ask a coding agent (recommended)

Open this folder in a coding agent that can run commands (Claude Code, Codex, Cursor and the like) and send it:

```text
Set up powerhouse in my Cloudflare account. Follow the setup instructions in AGENTS.md, ask me before running anything, and never ask me to paste an API token or key into the chat.
```

The agent runs the same setup command as Option 2 and walks you through the steps that need you: approving the Cloudflare sign-in, creating one API token from a pre-filled page, and adding your AI key to the gateway.

### Option 2: run the setup command

```sh
node setup.mjs
```

It asks a few questions, then:

1. signs you in to Cloudflare (in your browser),
2. protects powerhouse with Cloudflare Access, asking once for an API token through a pre-filled token page, and makes you its admin,
3. creates your AI Gateway and waits while you add your Anthropic or OpenAI key to it (or use credits),
4. turns on the optional tools you choose, creates the push notification keys, deploys, checks that Access protects it, and opens powerhouse.

Sign in with an address you allowed, then open Settings > Models and press Test. Delete the setup token afterwards, as setup reminds you.

Rerunning setup is safe: it skips what is done. It is also how you update (see [Updating](#updating)). `node setup.mjs --help` lists every flag, including `--yes --json` for running without prompts.

### Option 3: Deploy to Cloudflare (coming)

A one-click Deploy to Cloudflare button is planned for when the repository is public. It also needs powerhouse to finish its own setup in the browser: a button deploy builds from a copy of the repository, which cannot hold your Access and AI Gateway settings, so setup has to move into the app first. The plan and its open problems are in [ROADMAP.md](ROADMAP.md#getting-started-planned-2026-10-21).

## What it does

- **One prompt, routed.** Type what needs doing and Clef-Flash, a Cloudflare decision model, picks the role in under a second. Press Cmd+K to pick one yourself.
- **Roles you define.** Each role has a purpose, instructions, a model, tools, allowed sites, connections and skills. Start from the defaults or the library (researcher, competitor watcher, site QA tester, product manager, support replies and more), and pick your team when an org starts.
- **Real tools.** Read web pages, search the web, drive a real browser with screenshots and takeover, and send email. Optional tools stay off until you turn them on.
- **Connected accounts.** Connect Linear, Notion, Atlassian, Sentry or any remote MCP server once, and allow it for the roles that need it.
- **Skills.** 32 bundled [Agent Skills](https://agentskills.io) (copywriting, PRDs, contract review, research synthesis and more). The role editor suggests the ones that fit a role.
- **Safe by default.** Emails, writes to connected accounts and (for roles with connections) reading unknown sites and browser actions wait for your approval, with the full details shown.
- **Schedules.** Run a job every day, on weekdays, on chosen days or every few hours, in your time zone.
- **Push notifications.** Get notified on your devices when a job needs you, fails, or finishes a scheduled run.
- **Live fleet view.** Every job shows as a pill with its current step and estimated cost, and everyone in your org sees the same live state.

## How it works

- **Org agent:** one per Cloudflare Access team. It holds roles, settings, connections and schedules, routes prompts, dispatches jobs (at most 10 at a time) and keeps the live run list every member sees.
- **Job agents:** one per job, as sub-agents of the Org ([Think](https://developers.cloudflare.com/agents/)). Each keeps its own conversation and tools, and gets its own browser when it needs one.
- **Models:** jobs run on Claude Opus 5.5 (or GPT-6 Sol) through your AI Gateway by default. Open-weight Workers AI models (Kimi K2.7 Code, DeepSeek, GLM, Qwen) are the alternative, per org or per role. Routing and skill suggestions use Clef-Flash.
- **Stack:** Cloudflare Workers, Durable Objects, AI Gateway, Workers AI, Hono, Vite and React, assistant-ui.

## Costs

powerhouse itself is free. Running it uses your accounts:

- **Claude or GPT:** billed by Anthropic or OpenAI on your keys, or to your Cloudflare credits. Each job shows an estimated cost. Set a **spend limit on your AI Gateway** (dashboard > AI > AI Gateway > your gateway > Settings > Spend limits); powerhouse also has an optional daily budget in Settings that pauses scheduled jobs.
- **Cloudflare:** Workers, Durable Objects and a small Workers AI cost for routing. Open-weight models, the browser ([Browser Run](https://developers.cloudflare.com/browser-run/pricing/)), web search and email are billed only if you use them.

Browsers close at the end of every turn, and stay open for up to five minutes only while a job waits for you to take over.

## Security

- **Sign-in:** every request is checked against your Access application's token, and agent state is server-owned.
- **Approvals:** emails, writes to connected accounts, and (for roles with connections) reading sites outside the role's allowed sites and browser actions wait for a person. Tools on custom MCP servers always ask; catalog servers' read-only tools run directly.
- **Untrusted content:** pages, search results, connection results and server-written tool descriptions are marked as untrusted for the model. The app's Content-Security-Policy stops model output from loading images or contacting other sites.
- **Keys and tokens:** AI provider keys live on your AI Gateway; connection tokens live in your Org's storage; the setup token is used once and never saved.
- **Admins and members:** Access decides who may sign in. Admins change settings, roles and connections, and can act on anyone's jobs and schedules; members send jobs and act on their own, and can watch everyone else's. The email you set up with is an admin (`--admins` names others); admins add more in Settings > Members.
- **Live View links** are bearer credentials: fetched only when you open the browser, never stored and never given to the model. **Trace payloads** can contain personal data and are off unless you set `TRACE_PAYLOADS` to `"on"`.

## Configure

Setup writes your settings to `wrangler.local.jsonc` (gitignored), which is merged over the base `wrangler.jsonc` for every dev run and deploy: top-level keys replace the base's, and `vars` merge key by key. Never edit `wrangler.jsonc` for your deployment. [`wrangler.local.example.jsonc`](wrangler.local.example.jsonc) documents every setting.

| Feature | How to turn it on | Billed by |
| --- | --- | --- |
| Claude and GPT | Setup (AI Gateway step) | Anthropic or OpenAI, or Cloudflare credits |
| Read web pages | Always on | Your Worker's requests |
| Search the web | `node setup.mjs --enable web-search` | AI Gateway: credits or a search provider key on the gateway, or every search fails |
| Web browser (Workers Paid) | `node setup.mjs --enable browser` | [Browser Run](https://developers.cloudflare.com/browser-run/pricing/) and [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/pricing/) |
| Send email | `node setup.mjs --enable email --email-from you@your-domain`, on a domain in [Email Service](https://developers.cloudflare.com/email-service/) | Email Service |
| Push notifications | Setup creates the keys | Free |
| Tracing | `"observability": { "traces": { "enabled": true } }` in `wrangler.local.jsonc` | [Cloudflare Observability](https://developers.cloudflare.com/observability/pricing/) |

## Deploy by hand

Setup does all of this; these steps are for people who want to see or control each one.

1. **Turn on Zero Trust** and note your team domain, `https://<your-team>.cloudflareaccess.com`. The team name becomes your org's id.
2. **Create `wrangler.local.jsonc`** from the example: `cp wrangler.local.example.jsonc wrangler.local.jsonc`, and keep only what you use.
3. **Deploy once** with `bun install && bun run deploy`, so the Worker and its `powerhouse.<your-subdomain>.workers.dev` hostname exist. Until Access is configured, the page shell loads but every agent and API request is refused.
4. **Protect the hostname with Access:** Zero Trust > Access controls > Applications > Create new application > Self-hosted and private > Add public hostname; enter powerhouse's hostname and add an Allow policy for the people who should use it. Do **not** use the Worker's one-click "Protect this Worker" option: [it does not support WebSockets](https://developers.cloudflare.com/workers/configuration/cloudflare-access/#protect-one-worker), which powerhouse runs on.
5. **Copy the AUD tag** (the application's Configure > Additional settings) and set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` in `wrangler.local.jsonc`.
6. **Create an AI Gateway** (dashboard > AI > AI Gateway) with authentication on, add your Anthropic and/or OpenAI key under Provider Keys (or buy credits), and set `AI_GATEWAY_ID`, `AI_PROVIDERS` and `AI_BILLING` as the example shows. Add a spend limit while you are there.
7. **Deploy again** with `bun run deploy`, open the hostname and sign in.

Push notifications need a VAPID key pair: the public key in `VAPID_PUBLIC_KEY`, and the private key and a contact URL as the Worker secrets `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (`bunx wrangler secret put`). Setup does this for you. If you serve powerhouse on a custom domain, protect that domain in step 4 and consider `"workers_dev": false`.

## Contributing

Working on powerhouse's code? [CONTRIBUTING.md](CONTRIBUTING.md) covers local development, tests and the code layout.

## Updating

Get the new version (`git pull`) and rerun `node setup.mjs`. It keeps your settings, applies new ones and deploys. Roles you already have are never overwritten: when an update adds a tool or skill, add it to your roles in the Roles sheet; new ready-made roles appear in its library.

## Bundled skills

Roles can use these [Agent Skills](https://agentskills.io). Each job loads only its role's skills, as instructions; skill scripts never run. Vendored skills are pinned to an upstream commit in `skills.lock.json`. Their license files, and a `CHANGES.md` listing what powerhouse changed, are in [`skills-licenses/`](skills-licenses). Settings in the app shows the same list, with the roles that use each skill.

<!-- skills:start (written by `bun run skills:sync`; do not edit by hand) -->
| Skill | Source | License | Pinned |
| --- | --- | --- | --- |
| accessibility | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | MIT | [`afa8da9`](https://github.com/addyosmani/web-quality-skills/tree/afa8da942115f2961fdbfa80807ea0b232ff6c00/skills/accessibility) |
| account-research | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache-2.0 | [`bc8f692`](https://github.com/anthropics/knowledge-work-plugins/tree/bc8f6922cfeea215a202cdcc9f0d299a990889a8/sales/skills/account-research) |
| answer-from-docs | powerhouse | MIT |  |
| changelog-digest | powerhouse | MIT |  |
| cold-email | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | [`e85f3cb`](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/cold-email) |
| competitive-battlecard | [phuryn/pm-skills](https://github.com/phuryn/pm-skills) | MIT | [`07b34f6`](https://github.com/phuryn/pm-skills/tree/07b34f64ee828df08953f505b7f747aef85ae7c6/pm-go-to-market/skills/competitive-battlecard) |
| competitive-brief | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache-2.0 | [`bc8f692`](https://github.com/anthropics/knowledge-work-plugins/tree/bc8f6922cfeea215a202cdcc9f0d299a990889a8/marketing/skills/competitive-brief) |
| competitor-profiling | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | [`e85f3cb`](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/competitor-profiling) |
| content-strategy | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | [`e85f3cb`](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/content-strategy) |
| copy-editing | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | [`e85f3cb`](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/copy-editing) |
| copywriting | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | [`e85f3cb`](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/copywriting) |
| create-prd | [phuryn/pm-skills](https://github.com/phuryn/pm-skills) | MIT | [`07b34f6`](https://github.com/phuryn/pm-skills/tree/07b34f64ee828df08953f505b7f747aef85ae7c6/pm-execution/skills/create-prd) |
| customer-research | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | [`e85f3cb`](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/customer-research) |
| draft-response | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache-2.0 | [`bc8f692`](https://github.com/anthropics/knowledge-work-plugins/tree/bc8f6922cfeea215a202cdcc9f0d299a990889a8/customer-support/skills/draft-response) |
| exploratory-testing | [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) | MIT | [`462126b`](https://github.com/petrkindlmann/qa-skills/tree/462126bcc4d3bfe94a7c064b848c690c1366f343/skills/exploratory-testing) |
| internal-comms | [anthropics/skills](https://github.com/anthropics/skills) | Apache-2.0 | [`dbd4588`](https://github.com/anthropics/skills/tree/dbd4588f9e1033efb41dad4bef2f7947c8993d44/skills/internal-comms) |
| kb-article | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache-2.0 | [`bc8f692`](https://github.com/anthropics/knowledge-work-plugins/tree/bc8f6922cfeea215a202cdcc9f0d299a990889a8/customer-support/skills/kb-article) |
| launch | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | [`e85f3cb`](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/launch) |
| legal-risk-assessment | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache-2.0 | [`bc8f692`](https://github.com/anthropics/knowledge-work-plugins/tree/bc8f6922cfeea215a202cdcc9f0d299a990889a8/legal/skills/legal-risk-assessment) |
| pre-mortem | [phuryn/pm-skills](https://github.com/phuryn/pm-skills) | MIT | [`07b34f6`](https://github.com/phuryn/pm-skills/tree/07b34f64ee828df08953f505b7f747aef85ae7c6/pm-execution/skills/pre-mortem) |
| price-check | powerhouse | MIT |  |
| product-marketing | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | [`e85f3cb`](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/product-marketing) |
| prospecting | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | [`e85f3cb`](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/prospecting) |
| release-notes | [phuryn/pm-skills](https://github.com/phuryn/pm-skills) | MIT | [`07b34f6`](https://github.com/phuryn/pm-skills/tree/07b34f64ee828df08953f505b7f747aef85ae7c6/pm-execution/skills/release-notes) |
| review-contract | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache-2.0 | [`bc8f692`](https://github.com/anthropics/knowledge-work-plugins/tree/bc8f6922cfeea215a202cdcc9f0d299a990889a8/legal/skills/review-contract) |
| sales-discovery-questions | [mbfinotti/sales-skills](https://github.com/mbfinotti/sales-skills) | MIT | [`1ef6888`](https://github.com/mbfinotti/sales-skills/tree/1ef68881b2ed853fb1f02272b57dc71dd375677f/skills/sales-discovery-questions) |
| seo-audit | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | MIT | [`e85f3cb`](https://github.com/coreyhaines31/marketingskills/tree/e85f3cbc2e4a79bf33b2a12e9bdd9087d414735b/skills/seo-audit) |
| stakeholder-update | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache-2.0 | [`bc8f692`](https://github.com/anthropics/knowledge-work-plugins/tree/bc8f6922cfeea215a202cdcc9f0d299a990889a8/product-management/skills/stakeholder-update) |
| synthesize-research | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache-2.0 | [`bc8f692`](https://github.com/anthropics/knowledge-work-plugins/tree/bc8f6922cfeea215a202cdcc9f0d299a990889a8/product-management/skills/synthesize-research) |
| ticket-triage | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache-2.0 | [`bc8f692`](https://github.com/anthropics/knowledge-work-plugins/tree/bc8f6922cfeea215a202cdcc9f0d299a990889a8/customer-support/skills/ticket-triage) |
| triage-nda | [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | Apache-2.0 | [`bc8f692`](https://github.com/anthropics/knowledge-work-plugins/tree/bc8f6922cfeea215a202cdcc9f0d299a990889a8/legal/skills/triage-nda) |
| web-research | powerhouse | MIT |  |
<!-- skills:end -->

## License

[MIT](LICENSE). Bundled skills keep their own licenses, listed above.
