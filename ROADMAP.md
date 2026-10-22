# Roadmap

Where powerhouse stands and what comes next. Last updated 2026-10-21.

## Goals

powerhouse is a team's own fleet of agents, running in the team's own Cloudflare account. It is for teams, not only developers.

1. **Running in ten minutes.** A Deploy to Cloudflare button, with no clone or terminal, takes someone to a working org; one command, or one prompt to a coding agent, does the same from a clone. No hand-edited config.
2. **Connect your accounts.** One-click OAuth into the services the team already uses, through MCP, scoped per role.
3. **Safe by default.** One approval, budget and audit layer for every side effect: browser, email, MCP writes and payments.
4. **Meet the team where it works.** Slack, email, push notifications and schedules, not only the pulse UI.

## Where it stands

Built and tested locally, end to end:

- **Fleet:** an Org agent per Cloudflare Access team routes prompts to roles and dispatches each job as a sub-agent (at most 10 at once). The pulse UI shows live state to every member.
- **Roles:** create, edit and delete; a library of 8 templates; per-role model, tools and allowed sites.
- **Tools:** read web pages, web search, persistent browser (closed after every turn, Live View takeover, screenshots, hostname guardrails), and email (approval-gated). Optional tools stay off until configured in `wrangler.local.jsonc`.
- **Settings:** organization name, job and router models, concurrency, steps per turn, routing and fallback role, approval for every browser action, blocked sites, history size and clearing, and a status panel.
- **Self-hosting:** base config plus a gitignored overlay, an MIT license, a README with deploy steps, and tracing through `wrapAISDK`.
- **Harness:** jobs run on Think (`@cloudflare/think`).
- **Admins and members:** admins change settings, roles and connections; members send jobs and act on their own. Enforced on the server.

Deployed once behind Cloudflare Access (2026-10-21, workers.dev hostname): sign-in, dispatch, follow-ups, email approval and resume, browser screenshots and the stop button all work.

## Phase 0: Verify the foundation

Everything after this assumes Access auth works in production and that the job harness is the one we keep.

- [x] First real deploy behind Access. The Access token reaches the Worker, WebSockets pass a hostname-based Access application, and the README deploy steps work. Job traces are unverified (see Known issues).
- [x] Port `JobAgent` from `AIChatAgent` to Think: dispatch, follow-ups, approvals, the browser and stop all work. Adopted.
- [x] Merge `spike/think`. Merged before the job traces were confirmed; see Known issues.

## Phase 1: Setup for non-developers

Setup should not require editing config files. It comes first because nobody gets further without it, and the phase 0 deploy is its first test. Each later phase extends the script and the checklist for its own features. Two entry points, one implementation:

- **A command:** `node setup.mjs`, an interactive wizard.
- **A prompt:** "Set up powerhouse in my Cloudflare account" to a coding agent. An `AGENTS.md` (with a `CLAUDE.md` pointer) tells the agent to run the same script non-interactively.

Node LTS is the only prerequisite for operators: it has a click-through installer, and Vite and Wrangler already run on Node. The script fetches the pinned Bun itself (`npx bun@<packageManager version> install`), so `bun.lock` stays the single source of truth and operators never install Bun. Bun remains the contributor toolchain.

Found by the phase 0 deploy, for the wizard to handle:

- Wrangler does not print the deployed hostname anywhere a script can read it easily; the wizard should look it up and print it.
- The team name is not obvious in the dashboard; the wizard can read it from the Access login redirect or the API.
- Creating the Access app and policy took the most explanation: login methods (One-time PIN when there is no identity provider), the Include rule, and avoiding the Worker's "Protect this Worker" toggle, which breaks WebSockets.
- Deploying twice (once for the hostname, once with the AUD tag) goes away if the wizard creates the Access app before the first deploy, since the workers.dev hostname is predictable.
- `wrangler login` does not grant observability read, so an agent cannot confirm traces on its own.
- Until Access is configured, the static page shell is public (it holds no data; agent and API routes refuse).

Tasks:

- [x] `setup.mjs` entry point: plain ESM with no dependencies, so it can check the Node version and explain an upgrade before anything else runs. Never falls back to `npm install`.
- [x] Wizard: check prerequisites, sign in with `wrangler login` (opens the browser), ask who may sign in (emails or an email domain), create the Access application and policy through the Cloudflare API, write `wrangler.local.jsonc`, deploy, check that Access protects it, and open the URL. AI Gateway is tracked below; no feature needs secrets yet.
- [x] Idempotent and resumable: rerunning skips finished steps and repairs drift. The same script handles updates (`node setup.mjs` after `git pull`).
- [x] Non-interactive mode for agents: every prompt has a flag, output is available as JSON, and errors say what to do next in plain language.
- [x] `AGENTS.md` setup instructions (ensure Node LTS, then run the script non-interactively). Tested by an agent from a fresh clone up to the token step; its findings are fixed (choices kept across the token rerun, token passed only through the environment, account and email confirmed).
- [ ] Verify on Windows: the `bun` npm package's platform binary, and the wizard's shell assumptions.
- [x] Warn before deploy when a chosen feature needs Workers Paid. Today that is the browser tool, through Worker Loader. The warning keys off the config, since reading the plan needs billing permissions.
- [x] In-app setup checklist: Settings lists each tool in plain language with its cost and how to turn it on, and shows "Needs attention" when web search or email fail for a setup reason. Browser failures are not classified yet. Connections join it in phase 3.
- [x] Optional tools in the wizard: `--features` asks, `--enable`/`--disable`/`--email-from` for agents.
- [x] Create the AI Gateway from setup (2026-10-21): jobs run on Claude Opus 5.5 or GPT-6 Sol through it, paid with the person's Anthropic/OpenAI keys or Unified Billing credits. Required after Zero Trust. Keys are added in the dashboard by default, so setup never sees them and its token needs only AI Gateway Edit; setup can store pasted keys instead (adds Secrets Store Edit to the token). Setup ends by reminding people to delete the setup token. Open-weight Workers AI models stay available. The token link pre-fills AI Gateway: Edit with the undocumented template key `aig` (found by testing in the dashboard); Secrets Store's key is still unknown, so the "keys" option asks for it to be added by hand. Setup checks the token can reach AI Gateway right after it is pasted. Not yet tested against a live account.
- [ ] Deploy to Cloudflare button, the main path once the repository is public (it is private for now). See "Getting started" below.

### Getting started (planned 2026-10-21)

Two paths. Both start with the one step nothing can automate: turning on Zero Trust (a team name and the Free plan, which asks for a payment method).

**Button (no clone, primary once public).** Deploy to Cloudflare copies the repository into the person's GitHub account, sets up Workers Builds and deploys, prompting for a setup code they choose. The new URL opens a "Finish setup" page: enter the setup code, say who may sign in, create one API token through a pre-filled link, and powerhouse creates its Access application itself. Then sign in, pick the team, and go. Updates are "Sync fork" in GitHub, which redeploys through Workers Builds.

**Clone (available now).** Install Node, get the repository, run `node setup.mjs` or ask a coding agent (AGENTS.md). Updates: get the new version and rerun the same command.

Open problems before the button can ship:

1. **Access setup in the app.** Without the CLI, the app must create the Access application. Until then the Worker is public: the page shell loads, but agent and API routes refuse ("Access is not configured"), so no data is exposed. A public Finish setup page could be claimed by whoever opens it first, so it requires a `SETUP_CODE` secret the button prompts for (expected from `.dev.vars.example`; to be confirmed). The Worker's "Protect this Worker" toggle is not an alternative: it breaks WebSockets. Access settings (AUD, team domain) are vars today, which a running Worker cannot set, so in-app setup stores them in a Durable Object and `accessAuth` reads them from there. The Access logic in `setup.mjs` moves into code both can use.
2. **Optional tools without `wrangler.local.jsonc`.** The overlay is gitignored, so a Workers Builds deploy has none. Bindings cannot all live in the base config: the Worker Loader is Workers Paid only, so a Free-plan deploy would fail. Button deployments start with the tools that run on Free (read web pages, web search, email, push); turning on the browser needs a decision: edit `wrangler.jsonc` in their repository from Settings through the GitHub API, or document the clone path for it.
3. **Local-only settings in `.dev.vars.example`.** Confirmed in the spike: the button turns every entry in `.dev.vars.example` into a deploy secret, so it pre-filled `DEV_AUTH_EMAIL`, the local sign-in bypass. Harmless deployed (the bypass only applies to `localhost`), but confusing. Fix: build the bypass only into local dev behind `import.meta.env.DEV`, so production builds contain no bypass at all; default the dev email to `dev@localhost` (`.dev.vars` can still override it, and `DEV_AS_MEMBER`), and leave `.dev.vars.example` holding only the secrets a button deploy should ask for. Check the production bundle for the bypass after the change.
4. **Building on Workers Builds.** The repository is a single package at its root since 2026-10-21 (it was a Bun workspace), which removes the workspace question; the build command and the Vite plugin on Workers Builds are still unverified.

Spike in a throwaway account (2026-10-22): the button copies the repository, detects Bun 1.4.3 from `packageManager` (no `BUN_VERSION` needed), builds with `bun run build` and deploys with `bun run deploy`, renaming the Worker to the name chosen on the form. The deployed page shell loads and every agent and API route answers "Access is not configured", as designed. Findings:

- The form makes every var in `wrangler.jsonc` a required field, so the empty `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` had to be filled with placeholders. Access settings should leave the base config (problem 1) so the form does not ask for values nobody has yet.
- It pre-fills secrets from `.dev.vars.example` (problem 3).
- The project is built twice: the deploy command `bun run deploy` runs `vite build` again. Make `deploy` only `wrangler deploy` and have setup run build then deploy, or point the button at `bunx wrangler deploy`.
- Preview URLs are on by default (no `preview_urls` in the config). Each version gets a public `*.workers.dev` hostname that Access does not cover at the edge; the Worker's own Access check still refuses requests, but set `"preview_urls": false` in the base config, for existing deployments too.
- A first build started before the copy was pushed and failed with "Script not found: build"; the next one succeeded. A Cloudflare-side race, nothing to fix here.
- Minor: `vite.config.ts` imports `./config/merge-wrangler` without an extension, which Vite's future native config loader will reject.

Next: the Finish setup page, then decide problem 2.

### Cost guardrails (2026-10-21)

Budgets belong on the AI Gateway (spend limits apply to both BYOK and Unified Billing and block with a 429). powerhouse points there and adds a backstop:

- [x] Setup checks the gateway for spend limits and says how to add one when there are none; gateway updates keep the person's spend limits and other dashboard settings.
- [x] Settings shows when the gateway had no spend limit, and a request blocked by one reads as "spend limit reached".
- [x] Estimated cost per job from token usage and list prices (cached input counted at full price; Browser Run time and searches not included), and the day's total.
- [x] Optional daily budget (off by default) that skips scheduled runs once reached; people's own jobs still run.
- [ ] Settings learns about spend limits only when setup runs; reading them live would need the app to hold an API token.
- [ ] Per-member budgets: the gateway can split a spend limit by metadata, once requests carry the member.

## Phase 2: Skills for current roles

Approved list. Vendor each skill's `SKILL.md`, `references/` and upstream LICENSE/NOTICE into `skills/<name>/`, pinned by commit in `skills.lock.json`, with a `bun run skills:sync` script. Upstream `evals/` folders are not included.

| Skill | Source (license) | Assign to |
| --- | --- | --- |
| copywriting | coreyhaines31/marketingskills (MIT) | Communications, Product marketer |
| copy-editing | coreyhaines31/marketingskills (MIT) | Communications |
| cold-email | coreyhaines31/marketingskills (MIT) | Lead researcher |
| launch | coreyhaines31/marketingskills (MIT) | Product marketer |
| pricing | coreyhaines31/marketingskills (MIT) | Price watcher, Product marketer |
| seo-audit | coreyhaines31/marketingskills (MIT) | Site QA tester |
| competitor-profiling | coreyhaines31/marketingskills (MIT) | Competitor watcher, Product marketer |
| customer-research | coreyhaines31/marketingskills (MIT) | Researcher, Lead researcher |
| internal-comms | anthropics/skills (Apache-2.0) | Generalist, Communications |
| competitive-brief | anthropics/knowledge-work-plugins (Apache-2.0) | Competitor watcher, Researcher |
| write-spec | anthropics/knowledge-work-plugins (Apache-2.0) | Generalist, Product manager |
| synthesize-research | anthropics/knowledge-work-plugins (Apache-2.0) | Researcher, Product manager |
| stakeholder-update | anthropics/knowledge-work-plugins (Apache-2.0) | Communications, Product manager |
| status-report | anthropics/knowledge-work-plugins (Apache-2.0) | Generalist, Changelog digest |
| draft-response | anthropics/knowledge-work-plugins (Apache-2.0) | Support replies |
| kb-article | anthropics/knowledge-work-plugins (Apache-2.0) | Support replies, Docs expert |

All 16 pass the Gen Agent Trust Hub and Socket audits on skills.sh. Snyk passes 5 of them and gives the other 11 W011 (third-party content exposure, an indirect prompt injection risk), with no code or exfiltration findings. Review those 11 by hand before vendoring: they run alongside the browser and email tools.

Tasks:

- [x] Vendor the skills, the lockfile and the sync script: 28 skills pinned in `skills.lock.json`, reviewed by hand, with branch links, sponsored marks and "Related Skills" sections stripped at sync and recorded in `skills-licenses/<name>/CHANGES.md`. Instead of vendoring `CONNECTORS.md`, the skill rules in the prompt tell the model to skip steps for tools it does not have.
- [x] Roles get a `skills` list, picked in the role editor; each job loads only its role's skills. Loaded per turn in `beforeTurn` with `SkillRegistry`, not Think's `getSkills()`: Think reads that once at startup, before a new job has its role, and it replaces the role's system prompt with context blocks. Instructions only; no script execution. Stored roles without a `skills` field read as an empty list.
- [x] Add skills to the default roles and to library templates (the table above was revised by the skills.sh research: write-spec became create-prd, status-report waits for connectors, pricing left Price watcher, and our own web-research, price-check, changelog-digest and answer-from-docs fill the gaps).
- [x] New library templates: Product manager, Product marketer, SEO and content writer, Outbound sales, and Contract reviewer.
- [x] Company profile in Settings, added to every job's instructions; marketing skills use it in place of their product context file.
- [x] Pick your team: a new org's first member chooses its starting roles from the defaults and the library (Generalist always stays as the fallback). Orgs created before the picker are never asked. Keeps routing accurate by not making every template a default.
- [x] Settings and README list the bundled skills with source, license and pinned commit; Settings also shows which roles use each one. The README table is written by `skills:sync`, so it cannot drift from the lockfile. Neither Apache-2.0 source has a NOTICE file at its pinned commit.

Excluded on purpose: connector-dependent skills (account-research, call-prep, draft-outreach, competitive-intelligence, knowledge-synthesis, search-strategy, vendor-check), doc-coauthoring (no license), brand-guidelines (Anthropic-specific). Revisit the connector-dependent ones after phase 3.

## Phase 3: Connections (MCP)

Members connect the team's accounts once, and roles use them. This replaces the separate GitHub decision: GitHub is one connection among many.

OAuth tokens live in the Durable Object that calls `addMcpServer()`. Jobs are short-lived facets, so connections are owned by `Org` and jobs reach them through Org RPC. Personal (per-member) connections come later, with a `Member` agent keyed by Access email.

- [x] Verify first (2026-10-21): Org owns connections and jobs call their tools over RPC; OAuth callbacks pass Access on the default route, and stored connections survive hibernation.

Decided 2026-10-21, after the spike:

- **Admins manage connections**, like roles and settings (see the admin model below). Settings shows who connected each one and when.
- **Direct tools first, Code Mode later.** Code Mode needs a Worker Loader, which is Workers Paid only, so it would leave Free-plan teams without connections. Jobs get AI SDK tools built from Org's tool list, limited to the role's connections; Code Mode becomes an optimization when the Loader is configured.
- **Per-role allowlist, empty by default.** Adding a connection never gives existing roles new tools; library templates start with none.
- **Approval unless read-only.** A tool runs without approval only when it declares `readOnlyHint: true`; every other tool waits for approval through the existing approval UI.
- **Catalog of servers with dynamic client registration**, checked 2026-10-21: Linear, Notion, Atlassian, Sentry and Cloudflare docs, plus a custom URL. Asana's current endpoint (`/v2/mcp`) signs in through `app.asana.com` without dynamic registration; only its older SSE endpoint has it. GitHub needs a pre-registered OAuth app (client id and secret), so it waits for support for your own OAuth app's credentials; PayPal waits for phase 6; Stripe and HubSpot did not confirm dynamic registration.

Tasks:

- [x] Org connection methods: add (catalog entry or custom https URL, explicit `callbackHost`), retry, remove, and who added each one and when. `configureOAuthCallback` in `onStart` with a popup result page.
- [x] Connections section in Settings: catalog, custom URL, live state from `onMcpUpdate`, sign-in popup, remove with a reminder to revoke the grant at the provider (removing deletes our tokens only). Measure the `cf_agent_mcp_servers` broadcast with a real server and send summaries instead if it is large.
- [x] Per-role connection allowlist in the role editor, like allowed sites. Stored roles without one read as empty.
- [x] Job tools: build tools for the role's connections each turn, await `waitForConnections()` in Org's RPC methods, require approval unless `readOnlyHint`, wrap results as untrusted content like `webFetch`, return `isError` results as text the model can act on.
- [x] Health and timings: each connection's live state in Settings ("Needs sign-in", "Needs attention" with the error, Retry); each call's duration and outcome in the run's activity (logs from a job's detached turn are lost); roles told which of their connections are unavailable.
- [ ] Deploy test with Linear or Notion: sign-in behind Access, a read job, a write that waits for approval.
- [ ] Later: Code Mode `McpConnector` when a Worker Loader is configured, so jobs discover tools with `codemode.search()` / `describe()` instead of loading every schema.
- [ ] Later: your own OAuth app's client id and secret for servers without dynamic registration (GitHub).
- [ ] Later: a per-tool "run without asking" switch for custom MCP servers, which now always ask.
- [ ] Later: member-owned connections (personal mail, calendar). A job uses the connections of the member who started it.

## Phase 4: Workspace (code execution)

Gives jobs a place to run code. Off unless configured, like the browser.

- [ ] Prototype: a job clones a public repo and runs its tests in a Cloudflare Sandbox (Containers; Workers Paid; billed per use).
- [ ] Settle the open question: containers attach to a top-level Durable Object class, and jobs are sub-agents. Either a job owns a container directly, or it uses a companion workspace agent.
- [ ] Image with git, Node and Python. Internet off by default and allow-listed when needed. Shut down when idle, like the browser.
- [ ] `run_command` tool with output caps and timeouts. Enable skill script execution (Worker Loader, shared with phase 3).

## Phase 5: Channels

- [ ] Slack: one workspace maps to one Org. Prompts arrive by mention or DM, and jobs reply in the thread. Approvals link back to the pulse UI.
- [x] Push notifications, turned on per device in Settings: "needs you" (approval or takeover) to every member who turned them on, failures and finished scheduled runs to whoever started the run, one notification per job, and a click opens the job. Web Push is implemented with WebCrypto (checked against the RFC 8291 example) instead of the Node `web-push` package. Setup creates the keys once (public key as a var, private key and subject as secrets after the deploy); `bun run push:keys` does the same for local development. Verified on the deploy (2026-10-21): an approval notification arrived with the tab in the background and opened the job. iPhone and iPad need the app on the Home Screen, which needs a web app manifest we do not ship yet. If keys are ever regenerated, existing subscriptions stop receiving until each device turns notifications off and on.
- [x] Scheduled and recurring jobs: a prompt for a fixed role on a repeat rule (every day, weekdays, chosen days, or every N hours, at least 1), up to 20 per org, from a Schedules sheet with Run now, pause and delete. The SDK's cron runs in UTC, so Org keeps the rule and the org's time zone (Settings, set from the first schedule's browser) and arms a one-shot alarm for each next run, which keeps local times right across daylight-saving changes (`bun run test` covers them). A run is skipped, with the reason shown, when the previous one is still going, the role was deleted, the org is at its job limit, or the alarm fired over an hour late.
- [ ] Inbound email: a role's address starts a job.

## Phase 6: Payments (experimental)

Jobs pay for services over HTTP 402. Client side only; powerhouse does not charge for anything. Off by default, testnet (`base-sepolia`) until explicitly switched.

- [ ] MPP client (`mppx`) for HTTP fetch and MCP tool calls. It also pays x402 services, so no separate x402 client.
- [ ] Wallet key as a Worker secret, set up through `bun run setup`. Document scoped keys and spend limits (mpp.dev, "Manage Agent spend").
- [ ] Guardrails: a per-org budget, a per-job cap, an allowlist of payment origins, and approval above a threshold through the existing approval UI (`onPaymentRequired` / `onChallenge`).
- [ ] Receipt ledger in Org state, shown in settings and in the job log.

## Phase 7: Engineering roles

Built on phases 3 and 4, with the engineering skills excluded from phase 2. GitHub access comes through a phase 3 connection: jobs read freely, and pushing a branch or opening a pull request requires approval. powerhouse never merges.

- [ ] Frontend engineer: `frontend-design` (anthropics/skills), `tdd` (mattpocock/skills); browser screenshots of the result.
- [ ] Backend engineer: `tdd`, `diagnosing-bugs` (mattpocock/skills).
- [ ] Code reviewer: `code-review` (mattpocock/skills); posts a draft review, never approves.
- [ ] QA / test automation: end-to-end tests against a preview URL.
- [ ] Data analyst, which also needs phase 8: `explore-data`, `statistical-analysis`, `create-viz` (knowledge-work-plugins/data).

## Phase 8: Data inputs

- [ ] File uploads to R2, copied into the job's sandbox.
- [ ] Later: read-only database connections.

## Later

- [ ] An Ops role connected to Cloudflare's API MCP server (`mcp.cloudflare.com/mcp`) that helps operate the deployment. Every write requires approval. Not used for first setup.
- [ ] Upgrade the role editor when Pi Durable gains tool approvals; re-evaluate Pi as a harness then (unless phase 0 settles on Think).
- [x] Code-split the client (2026-10-21): the first screen loads about 146 KB gzipped instead of 363 KB. The job transcript (209 KB) and the Roles, Schedules and Settings sheets load on first use, prefetched once the page is idle.
- [ ] Worker bundle: 2.19 MB of the 3 MB Workers Free limit. Think's `just-bash` workspace shell (about 14% of the bundle's source) is never enabled; leaving it out of the build would buy room.

Not planned: charging for powerhouse tools (`paidTool`, paid MCP servers) or a hosted multi-tenant service. Revisit if self-hosting turns out to be too high a bar even with phase 1.

## Known issues and unverified items

- **Worker bundle size.** 2.19 MB gzipped (Workers Free allows 3 MB) after skills and the vendor AI SDK providers. If later phases approach the limit, serve skills from R2 with `skills.r2()` instead of bundling them.
- **Skill use is the model's call.** Roles only see skill names and descriptions until the model activates one; a short job may skip a relevant skill. Watch real jobs before adding more skills per role.
- **Job traces only cover follow-up turns.** On the deploy, a follow-up sent from the job thread (Think trigger `ws-chat`) records `invoke_agent powerhouse-job` with its `chat` span, and routing records `invoke_agent powerhouse-router`. A job's first turn, which Org starts with a detached `runAgentTool`, records nothing, and neither does the turn that resumes after an approval. The `agents` tracer says why: work that outlives the invocation that started it cannot be traced, and only `ws-chat` turns are bound to their invocation. Wrapping the model ourselves would not help. Not-detached dispatch would keep Org's `dispatch` call open for the whole job, so the fix belongs upstream. Tool spans are unconfirmed, since the one traced turn called no tools.
- **Web search** needs AI Gateway credits or a provider key on the gateway, or it fails with `web_search_payment_required`. The phase 1 checklist should explain this.
- **Untested models.** Only Kimi K2.7 Code is tested against tools and approvals. GLM 5.3 Flash completed one multi-step `webFetch` job.
- **Concurrency cap message** in the pulse UI is untested; jobs finish too fast to hold 10 open.
- **Orphaned job storage** from runs pruned before the history cleanup existed. New runs are cleaned up; a one-off sweep could remove the old ones.
- **Routing is slow.** The router's Workers AI call takes about 20 seconds on the deploy (up to 38 seen). Dispatch no longer waits for it: the run is listed as "Routing" at once, and the job starts in the background. A smaller router model would shorten the wait itself, at some risk to routing quality. A run still routing when the Org is evicted or redeployed is marked interrupted rather than retried; that path is untested.
- **Router quality** depends on how role purposes are written. Prompts sometimes go to Researcher where Generalist was expected.
