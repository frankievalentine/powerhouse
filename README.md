# powerhouse

Your team's own fleet of AI agents, running in your own Cloudflare account. Describe a job, powerhouse sends it to the right role, an agent does the work with real tools and your connected accounts, and anything that changes something outside powerhouse waits for your approval.

Built on [Cloudflare Agents](https://developers.cloudflare.com/agents/), [AI Gateway](https://developers.cloudflare.com/ai-gateway/) and Workers AI. Sign-in is Cloudflare Access, so only the people you allow can use it.


## Get started

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/frankievalentine/powerhouse)

You need:

- A [Cloudflare account](https://dash.cloudflare.com/sign-up). Workers Free runs everything except the browser tool and the open-weight Workers AI models, which need [Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/).
- [Cloudflare Zero Trust](https://one.dash.cloudflare.com) turned on once (free for up to 50 users): choose a team name and the Free plan, which asks for a payment method even on Free. Nothing can do this step for you.
- One way to pay for Claude or GPT: an [Anthropic](https://console.anthropic.com) or [OpenAI](https://platform.openai.com) API key, which you add to your AI Gateway in the Cloudflare dashboard, or [Cloudflare credits](https://developers.cloudflare.com/ai-gateway/features/unified-billing/). Your keys stay on the gateway; powerhouse never sees them. You can also start with open models on Workers AI and add this later.

### Option 1: Deploy to Cloudflare (no terminal)

1. Click **Deploy to Cloudflare** above. Cloudflare copies powerhouse into your GitHub account and deploys it.
2. Open the new `workers.dev` address. It shows **Finish setup**, five short steps:
   1. **Connect your Cloudflare account.** Create a one-time API token from the pre-filled link and paste it. It proves the deployment is yours, is used only during setup, and is never saved.
   2. **Who can sign in.** Your email (you become the admin), anyone else's email or whole `@domains`, and optionally your website.
   3. **AI models.** Your own Anthropic or OpenAI key on your AI Gateway, Cloudflare credits, or open models on Workers AI for now.
   4. **Tools and updates.** Turn on web search if you like (email and the web browser come later, from Settings), and enter your new GitHub repository so the last screen can link to it.
   5. **Finish.** powerhouse protects itself with Cloudflare Access, creates your AI Gateway and saves its settings.
3. Sign in, then delete the setup token as the last screen reminds you.
4. To get updates, add the update workflow and turn on one setting in your new GitHub repository. Finish setup's last screen links to both (see [Updating](#updating)).

Email and the web browser are added afterwards from Settings > Tools, which shows the few lines to commit to your repository.

### Option 2 and 3: from a copy on your computer

These need [Node](https://nodejs.org) 20 or later and the code:

```sh
git clone https://github.com/frankievalentine/powerhouse.git
cd powerhouse
```

#### Option 2: ask a coding agent

Open this folder in a coding agent that can run commands (Claude Code, Codex, Cursor and the like) and send it:

```text
Set up powerhouse in my Cloudflare account. Follow the setup instructions in AGENTS.md, ask me before running anything, and never ask me to paste an API token or key into the chat.
```

The agent runs the same setup command as Option 3 and walks you through the steps that need you: approving the Cloudflare sign-in, creating one API token from a pre-filled page, and adding your AI key to the gateway.

#### Option 3: run the setup command

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

## What it does

- **One prompt, routed.** Type what needs doing and Clef-Flash, a Cloudflare decision model, picks the role in under a second. Press Cmd+K to pick one yourself.
- **Roles you define.** Each role has a purpose, instructions, a model, tools, allowed sites, connections and skills. Start from the defaults or the library (researcher, competitor watcher, site QA tester, product manager, support replies and more), and pick your team when an org starts.
- **Real tools.** Read web pages, search the web, drive a real browser with screenshots and takeover, and send email. Optional tools stay off until you turn them on.
- **Connected accounts.** Connect Linear, Notion, Atlassian, Sentry, GitHub or any remote MCP server once, and allow it for the roles that need it. GitHub gets its own private GitHub App in one click, limited to the repositories you choose; servers that cannot register powerhouse themselves take an OAuth app's client ID and secret.
- **Skills.** 32 bundled [Agent Skills](https://agentskills.io) (copywriting, PRDs, contract review, research synthesis and more). The role editor suggests the ones that fit a role.
- **Safe by default.** Emails, writes to connected accounts and (for roles with connections) reading unknown sites and browser actions wait for your approval, with the full details shown.
- **Voice.** Once an admin turns it on (Settings > Jobs), speak a job instead of typing it, and have an answer read aloud. Runs on Workers AI and is billed only when used.
- **Attach files.** Drop PDFs, Word and Excel documents, CSVs or text files on the composer (up to 5, 5 MB each). powerhouse turns them into text with Workers AI and the job reads them. Images are not supported yet.
- **Use it from your own agent.** Start jobs and read their results from Claude, ChatGPT or Cursor: once an admin turns on Settings > Use from other apps, add `https://<your powerhouse>/mcp` to your agent and click Allow. This is how powerhouse reaches you outside its own page; it has no Slack or other chat integrations.
- **Schedules.** Run a job every day, on weekdays, on chosen days or every few hours, in your time zone.
- **Push notifications.** Get notified on your devices when a job needs you, fails, or finishes a scheduled run.
- **Live fleet view.** Every job shows as a pill with its current step and estimated cost, and everyone in your org sees the same live state.

## How it works

- **Org agent:** one per Cloudflare Access team. It holds roles, settings, connections and schedules, routes prompts, dispatches jobs (at most 10 at a time) and keeps the live run list every member sees.
- **Job agents:** one per job, as sub-agents of the Org ([Think](https://developers.cloudflare.com/agents/)). Each keeps its own conversation and tools, and gets its own browser when it needs one.
- **Models:** jobs run on Claude Opus 5.5 (or GPT-6 Sol) through your AI Gateway by default. Open-weight Workers AI models (Kimi K2.7 Code, DeepSeek, GLM, Qwen) are the alternative, per org or per role. Routing and skill suggestions use Clef-Flash.
- **Stack:** Cloudflare Workers, Durable Objects, AI Gateway, Workers AI, Hono, Vite and React, assistant-ui.

## What it sets up in your Cloudflare account

Everything powerhouse runs on lives in your own Cloudflare account. Setup (the Finish setup page, or `node setup.mjs`) creates these for you, except Zero Trust, which you turn on once yourself.

**Always**

| Service | What powerhouse uses it for | Created by | Plan |
| --- | --- | --- | --- |
| **Workers** | The powerhouse Worker: the app, its API and its `workers.dev` address | Deploy (the button or setup) | Free |
| **Durable Objects** (SQLite) | Your org's data: roles, settings, jobs and their conversations, schedules, team memory, attached files (as text), connection sign-ins. One `Org` object per Access team, with each job inside it; a `Deployment` object keeps what Finish setup saved | Deploy | Free |
| **Workers KV** | One namespace (`OAUTH_KV`) for the apps members connect over MCP (Claude, ChatGPT, Cursor) | Created automatically on the first deploy | Free |
| **Workers AI** | Routing prompts to roles, skill suggestions, turning documents and web pages into text, open-weight models if you pick them, and voice if you turn it on | Nothing to create (the `AI` binding) | Free daily allowance; some open models need Workers Paid |
| **AI Gateway** (`powerhouse`) | Claude and GPT, with your provider keys or Cloudflare credits; logs, spend limits; web search | Setup | Free (models are billed by their provider or your credits) |
| **Zero Trust: Access** | Sign-in. A login method (One-time PIN codes by email, if you have none), the **powerhouse members** policy (who may sign in), the **powerhouse** application for your hostname, and **powerhouse apps (MCP)** with its Bypass policy, which lets MCP clients reach `/mcp`, `/oauth/*` and `/.well-known/*` (powerhouse answers there only when an admin turns it on) | You turn on Zero Trust; setup creates the rest | Free plan (asks for a payment method) |

**With Deploy to Cloudflare:** a copy of this repository in your GitHub account, and **Workers Builds**, which deploys it on every push and when you merge an update pull request.

**Only if you turn them on** (Settings > Tools shows how)

| Service | For | Plan |
| --- | --- | --- |
| **Browser Run** and **Worker Loader** | The browser tool | Workers Paid |
| **Email Service** | Sending email, from a domain you add | Free to verified addresses; sending to anyone needs Workers Paid |
| **AI Gateway web search** | The web search tool | Billed per search (credits or a search provider key on the gateway) |

**API tokens:** setup asks you to create one ("powerhouse setup") from a pre-filled link and uses it once; it is never saved, and you delete it afterwards. Removing powerhouse uses a "powerhouse remove" token the same way. powerhouse keeps no Cloudflare API token.

**Not used:** R2, D1, Queues and Containers. Nothing outside your account: no powerhouse server sits between you and Cloudflare.

## Costs

powerhouse itself is free. Running it uses your accounts:

- **Claude or GPT:** billed by Anthropic or OpenAI on your keys, or to your Cloudflare credits. Each job shows an estimated cost. Set a **spend limit on your AI Gateway** (dashboard > AI > AI Gateway > your gateway > Settings > Spend limits); powerhouse also has an optional daily budget in Settings that pauses scheduled jobs. Every job's requests carry `member` (who started it), `role` and `run` as gateway metadata, so a rule that limits by metadata `member` and splits by value gives each member their own budget. Open models on Workers AI do not go through the gateway, so its limits do not cover them.
- **Cloudflare:** Workers, Durable Objects and a small Workers AI cost for routing. Open-weight models, the browser ([Browser Run](https://developers.cloudflare.com/browser-run/pricing/)), web search and email are billed only if you use them.

Browsers close at the end of every turn, and stay open for up to five minutes only while a job waits for you to take over.

## Security

- **Sign-in:** every request is checked against your Access application's token, and agent state is server-owned.
- **Approvals:** emails, writes to connected accounts, and (for roles with connections) reading sites outside the role's allowed sites and browser actions wait for a person. Tools on custom MCP servers always ask; catalog servers' read-only tools run directly.
- **Untrusted content:** pages, search results, connection results and server-written tool descriptions are marked as untrusted for the model. The app's Content-Security-Policy stops model output from loading images or contacting other sites.
- **Keys and tokens:** AI provider keys live on your AI Gateway; connection tokens live in your Org's storage; the setup token is used once and never saved.
- **Admins and members:** Access decides who may sign in. Admins change settings, roles and connections, and can act on anyone's jobs and schedules; members send jobs and act on their own, and can watch everyone else's. The email you set up with is an admin (`--admins` names others); admins add more in Settings > Members.
- **Use from other apps (MCP):** off until an admin turns it on in Settings. Members then connect Claude, ChatGPT or Cursor to `https://<your powerhouse>/mcp`; the app opens powerhouse's Allow page, behind Access, and gets a token that acts as that member (an hour, refreshed for up to 30 days). Approvals still happen only in powerhouse. Members remove their apps in Settings; admins can disconnect a member's apps in Settings > Members, which matters when someone leaves, since removing them from Access does not end tokens they already have. Turning the switch off stops every app at once. MCP clients reach `/mcp`, `/oauth/*` and `/.well-known/*` without an Access session, so setup adds a second Access application for those paths with a Bypass policy; while the switch is off, they answer 404.
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

## Use from other apps

Settings > Use from other apps lets members start jobs and read their results from Claude, ChatGPT or Cursor (see Security for how sign-in works). An admin turns it on there.

It needs an Access bypass for the MCP paths, which setup creates. Deployments set up before 2026-10-22:

- **From a copy on your computer:** run `node setup.mjs` again; it asks for a token once to add the bypass.
- **With Deploy to Cloudflare:** Settings > Use from other apps shows "One step left" once an admin turns it on: create the one-time API token from its link, paste it, and powerhouse adds the Access application (the token is used once and not kept). By hand instead: Zero Trust > Access controls > Applications > Add an application > Self-hosted, named "powerhouse apps (MCP)", with your powerhouse hostname three times and the paths `mcp`, `oauth/*` and `.well-known/*`, and a policy with the action Bypass that includes Everyone.

## Updating

powerhouse updates follow its [releases](https://github.com/frankievalentine/powerhouse/releases) ([CHANGELOG](CHANGELOG.md)). Settings > Status says when a newer one is out.

- **Deployed with the Deploy to Cloudflare button:** Deploy to Cloudflare does not copy workflow files, so add the update workflow to your repository once. Finish setup's last screen (and Settings > Organization, once your repository is entered there) has a link that opens GitHub's editor with it filled in; click Commit changes. Or create `.github/workflows/update-powerhouse.yml` yourself with [these lines](src/shared/update-workflow.ts). Then turn on Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests". Once a week, or when you run "Update powerhouse" from the Actions tab, it opens a pull request with the new release; merge it and Cloudflare redeploys. Your tool settings live in `wrangler.local.jsonc`, which updates never touch.
- **Set up with `node setup.mjs`:** run `node setup.mjs --update`. It moves your folder to the latest release, keeps your settings and deploys.

Roles you already have are never overwritten: when an update adds a tool or skill, add it to your roles in the Roles sheet; new ready-made roles appear in its library.

## Remove powerhouse

Removing powerhouse deletes everything it stored (roles, jobs, settings, members, schedules and the sign-ins of its connections) for good. Export anything you want to keep first.

**With the command** (needs a copy on your computer; Deploy to Cloudflare users can clone their own repository): run `node setup.mjs --remove`. It lists exactly what it found, asks you to type the Worker's name, and then deletes, in this order, the Access application, the "powerhouse members" policy (unless another application uses it), the Worker with all its data, and the AI Gateway. It asks once for an API token through a pre-filled link; delete that token afterwards.

**By hand in the Cloudflare dashboard,** in this order so nobody can reach a half-removed app:

1. **Access application:** Zero Trust > Access controls > Applications > the "powerhouse" application for your powerhouse address > Delete. Then Access controls > Policies > "powerhouse members" > Delete, unless another application uses it.
2. **Worker and its data:** Workers & Pages > your powerhouse Worker > Settings > Delete. This also stops Workers Builds for a Deploy to Cloudflare repository.
3. **AI Gateway:** AI > AI Gateway > "powerhouse" > Settings > Delete gateway. Its stored provider keys and logs go with it.
4. **API tokens:** My Profile > API Tokens: delete any "powerhouse setup" or "powerhouse remove" token left, and, for a Deploy to Cloudflare deployment, the "<your Worker's name> build token" Workers Builds created to deploy it.

**Keep or remove yourself:**

- Cloudflare Zero Trust and its login methods (One-time PIN): your account's, and other applications may use them.
- A Secrets Store named "powerhouse", if setup stored provider keys there: delete it only if it holds nothing else.
- Email Service domains: yours.
- Connected services such as Linear or Notion: revoke powerhouse's access in each service's settings. For GitHub, also delete powerhouse's GitHub App (GitHub Settings > Developer settings > GitHub Apps).
- Your GitHub repository, if you used Deploy to Cloudflare, and your local folder with `wrangler.local.jsonc`.

## License

[MIT](LICENSE). Bundled skills keep their own licenses (MIT or Apache-2.0): each skill's license and what powerhouse changed are in [`skills-licenses/`](skills-licenses), and Settings in the app lists every skill with its source, license and pinned commit.
