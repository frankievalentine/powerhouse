# Contributing

This is for working on powerhouse's code. To deploy powerhouse for your team, see the [README](README.md); you never need local development for that.

## Local development

You need [Bun](https://bun.sh) and a Cloudflare account. Use `bun` and `bunx`, not npm or npx.

```sh
bun install
bun run push:keys   # optional: push notifications locally
bunx wrangler login
bun run dev
```

Open the URL Vite prints. There is no Cloudflare Access in front of `localhost`, so local dev signs you in as `dev@localhost`, an admin, in an org called `local`. This sign-in bypass exists only in `bun run dev`: it sits behind `import.meta.env.DEV`, which production builds remove, so a deployment contains no bypass at all.

To change the defaults, copy `.dev.vars.example` to `.dev.vars` (gitignored):

- `DEV_AUTH_EMAIL=someone@localhost` signs you in as someone else.
- `DEV_AS_MEMBER=on` makes you a member instead of an admin, to try what members can and cannot do.

Local dev merges your `wrangler.local.jsonc` like a deploy does, so with an AI Gateway set up, local jobs run on Claude or GPT through it. Workers AI and the browser run remotely and bill your account; local dev names the Worker `powerhouse-dev`, so it never touches your deployed hostname.

## Checks

Run these before committing:

```sh
bun run typecheck   # TypeScript, for the app and the Vite config
bun run test        # unit tests
```

Other scripts:

```sh
bun run deploy       # build and deploy with your wrangler.local.jsonc
bun run types        # regenerate env.d.ts after changing wrangler.jsonc (move .dev.vars aside first, or its local values end up in the types)
bun run skills:sync  # re-vendor skills pinned in skills.lock.json
bun run route:eval   # compare router models on accuracy and latency (calls Workers AI, billed)
```

## Code layout

The repository is one Bun package: `src/server` is the Worker, `src/client` the UI, and `src/shared` holds what both use. [AGENTS.md](AGENTS.md) has a file-by-file map, and the rules coding agents follow here apply to people too:

- Never edit `wrangler.jsonc` for one deployment; deployment settings go in the gitignored `wrangler.local.jsonc`.
- `setup.mjs` stays plain ESM with no dependencies, because it runs before anything is installed.
- Tools that change something outside powerhouse need approval, and content from pages, connections and tools is untrusted.

[ROADMAP.md](ROADMAP.md) lists features teams asked for and the decisions on them. To ask for one, open an issue describing the job you wanted done.

## Security

Please report security issues privately through GitHub's [private vulnerability reporting](https://github.com/frankievalentine/powerhouse/security/advisories/new) rather than in a public issue.
