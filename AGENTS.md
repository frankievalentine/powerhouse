# Instructions for coding agents

## Setting up powerhouse for someone

When asked to set up, install or deploy powerhouse, run the setup script. Do not edit Wrangler config files by hand or run `wrangler deploy` directly.

1. Check that Node 20 or later is installed (`node --version`). If it is missing or older, ask the person to install the current LTS from https://nodejs.org; do not install it for them with a version manager they did not ask for.
2. Ask before running anything:
   - **Zero Trust:** whether Cloudflare Zero Trust is set up on their account. If not, they set it up once at https://one.dash.cloudflare.com: choose a team name and the Free plan, which asks for a payment method even on Free. Setup cannot do this, and only finds out after the token step, so ask first.
   - **Who may sign in:** email addresses and/or email domains such as `@example.com`. Leaving out `--allow` allows only the email they sign in to Cloudflare with; setup prints it in the `sign-in` step. Confirm that address with them before the Access step, or pass `--allow` explicitly.
   - **How to pay for Claude or GPT** (required): `--ai-billing dashboard`, where they add their own Anthropic and/or OpenAI API key to the AI Gateway in the Cloudflare dashboard, or `--ai-billing credits` (Cloudflare Unified Billing, bought in the dashboard under AI > AI Gateway > Credits, which covers both). Setup creates the gateway; it cannot buy credits. Use `dashboard`, not `keys`: provider keys should never pass through you or your shell.
   - **Who are admins:** admins change settings, roles and connections; everyone else sends jobs. By default the only admin is the email they sign in to Cloudflare with; pass `--admins "<emails>"` to name others. More can be added later in Settings > Members.
   - **Which optional tools:**
     - `web-search`: each search is billed through AI Gateway, which needs AI Gateway credits or a search provider key stored on the gateway (https://developers.cloudflare.com/ai-gateway/). Without either, searches fail and Settings in the app shows the tool as "Needs attention".
     - `browser`: needs the Workers Paid plan. So do the open-weight Workers AI models, except Qwen 3.8 27B; with Claude or GPT through the gateway, everything else runs on Workers Free.
     - `email`: needs a domain they own added to Cloudflare Email Service, and a sender address on it (`--email-from`).
3. Run, from the repository root:
   ```sh
   node setup.mjs --yes --json --allow "<emails and @domains>" [--admins "<emails>"] --ai-billing <dashboard|credits> --enable "<tools, comma-separated>" [--email-from "<sender>"]
   ```
   The first run installs dependencies, which takes a minute. Progress goes to stderr; stdout is one JSON object. On failure it has `"ok": false`, the `step` that failed, an `error`, and a `next` saying what to do. Follow `next`, then **rerun the exact same command with the same flags**; setup skips what is already done.
4. Check the `sign-in` step's detail: it names the Cloudflare account and email. If it is not the account they meant, run `node node_modules/wrangler/bin/wrangler.js logout` and rerun so they can sign in to the right one, or pass `--account <id>` when they have several.
5. Steps that need the person:
   - **sign-in:** when not already signed in, setup opens a Cloudflare sign-in page in their browser. Tell them to approve it.
   - **access-token:** the first run needs an API token, for Cloudflare Access and the AI Gateway (later runs need one again only to set up the gateway). `next` contains a link that pre-fills the token's permissions, AI Gateway included. Give them the link and ask them to click "Continue to summary", then "Create token", then the copy button next to the token, and to tell you when it is copied (not to paste it to you). Rerun the same command with the token read from their clipboard into `POWERHOUSE_SETUP_TOKEN`, so it never appears in logs, shell history or your messages:
     - macOS: `POWERHOUSE_SETUP_TOKEN="$(pbpaste)" node setup.mjs ...`
     - Windows PowerShell: `$env:POWERHOUSE_SETUP_TOKEN = Get-Clipboard; node setup.mjs ...`
     - Linux: `POWERHOUSE_SETUP_TOKEN="$(wl-paste 2>/dev/null || xclip -o -selection clipboard)" node setup.mjs ...`

     If setup says Cloudflare did not accept the token, the clipboard probably held something else; ask them to copy it again. Never write the token to a file or include it in your messages.
   - **ai-gateway:** with `--ai-billing dashboard`, setup creates the gateway and stops until a key is on it. Give them the instructions from `next` (AI > AI Gateway > their gateway > Provider Keys > add their Anthropic or OpenAI key), wait until they say it is done, and rerun. If setup cannot list the keys, rerun with `--ai-providers` naming the ones they added. With `--ai-billing credits`, remind them to buy credits; jobs fail until they do.
   - **zero-trust:** if Zero Trust turns out not to be set up, they set it up as in step 2, then you rerun.
6. When it succeeds, give them the `url` from the result and tell them to sign in with an address they allowed, then to check Settings > Models > Test. If `ai.spendLimits` is false, recommend a spend limit on the gateway (Cloudflare dashboard > AI > AI Gateway > their gateway > Settings > Spend limits): budgets belong there. If the result has `"deleteSetupToken": true`, tell them to delete the "powerhouse setup" API token at https://dash.cloudflare.com/profile/api-tokens; nothing needs it after setup. With `--skip-deploy`, nothing is deployed and `url` can be missing.

To turn tools on or off later, rerun with `--enable` or `--disable`. Settings in the app shows which tools are on, what they cost, and which need attention.

Rerunning setup is safe: it skips finished steps. To update a deployment to the latest release, run `node setup.mjs --update` (a Deploy to Cloudflare copy updates through the pull requests its Update powerhouse workflow opens). `node setup.mjs --help` lists every flag.

## Removing powerhouse

Only when the person asks. Removal deletes all of powerhouse's data for good, so first say exactly that, and what is kept (Zero Trust, login methods, domains, their GitHub repository), and get an explicit yes that names the Worker. Then run `node setup.mjs --remove --yes --json`, with a token read from their clipboard into `POWERHOUSE_SETUP_TOKEN` as in setup (the result's `next` links the pre-filled token page). Afterwards, tell them to delete the "powerhouse remove" token. The README's "Remove powerhouse" section has the dashboard steps.

## Working on the code

One Bun package at the repository root. Use `bun`/`bunx`, never npm or npx. [CONTRIBUTING.md](CONTRIBUTING.md) has the same setup for people.

```sh
bun install
# local dev signs you in as dev@localhost (admin); optional overrides in .dev.vars, see .dev.vars.example
bun run push:keys                # optional: push notification keys for local dev
bun run dev                      # Vite + the Worker; Workers AI and the browser run remotely and bill the account
bun run typecheck                # tsc for the app and the Vite config
bun run test                     # bun test: schedule time math, Web Push crypto, models, connection tools
bun run skills:sync              # re-vendor skills pinned in skills.lock.json; rewrites the README table
bun run route:eval               # compare router models on accuracy and latency (calls Workers AI, billed)
```

Where things are:

- `src/server/index.ts`: the Worker (Hono). Access auth, the org guard and header stripping are in `auth.ts`; the local-dev sign-in in `dev.ts`, used only behind `import.meta.env.DEV` so production builds drop it.
- `src/server/org.ts`: the Org agent, one per Access team: roles, settings, routing, dispatch, connections (MCP), schedules, push notifications, spend. Its `@callable` methods are what clients can call; every other method is internal.
- `src/server/job-agent.ts`: one Think agent per job (an Org sub-agent): tools, skills, connection tools and model per turn.
- `src/server/tools.ts`, `connections.ts`, `skills.ts`: the tools a role is given; connection tools call back into Org, which holds the OAuth tokens.
- `src/server/models.ts`, `router.ts`, `clef.ts`: models through AI Gateway or Workers AI, and Clef decision models for routing and skill suggestions.
- `src/server/web-push.ts`, `schedule-rules.ts`, `schedules.ts`: Web Push (WebCrypto), schedule time math in the org's time zone.
- `src/shared/index.ts`: types and constants the server and client share (models, limits, catalog).
- `src/client`: the React UI. `pulse/` is the main page, `job-window/` and `session/` the job transcript, `dialogs/` the Roles, Schedules and Settings sheets, `org/org-context.tsx` the Org connection. Heavy parts load lazily (`lib/lazy-parts.ts`).
- `setup.mjs`: setup and updates. It must stay plain ESM with no dependencies, because it runs before anything is installed.
- `config/merge-wrangler.ts`: merges `wrangler.local.jsonc` over `wrangler.jsonc` for dev and deploys.

Rules:

- Never edit `wrangler.jsonc` for one deployment; deployment settings go in the gitignored `wrangler.local.jsonc`.
- Provider API keys and setup tokens never pass through you: they go on the AI Gateway (dashboard) or through environment variables read from the clipboard, as in the setup steps above.
- Keep approvals safe by default: tools that change something outside powerhouse (email, connection writes, browser actions where required) need approval; content from pages, connections and tools is untrusted.
- Every release must keep working with data saved by earlier versions (Durable Object storage, stored roles, settings and schedules): read old shapes with defaults and upgrade them on read, never assume a fresh org. Deployments update in place.
- Releasing: bump `version` in `package.json`, move CHANGELOG.md's Unreleased notes under the new version, commit, tag `vX.Y.Z`, push the tag, and create the GitHub release with those notes (`gh release create vX.Y.Z --notes-file ...`). Deployments update to the latest release, so only tag what works.
- `.github/workflows/update.yml` is a reusable workflow every Deploy to Cloudflare copy calls from `main` (through the short workflow in `src/shared/update-workflow.ts`, which copies add once). A broken `main` breaks updates everywhere, so test changes to it before merging. Keep the caller in `update-workflow.ts` unchanged: copies cannot update it.
- Run `bun run typecheck` and `bun run test` before committing. `ROADMAP.md` lists planned work, decisions and known issues; update it when you finish or change course on something listed there.
