# powerhouse

One command to a productive AI environment.

```bash
./install.sh
```

Preview what it will do first:

```bash
./install.sh --dry-run
```

## What it does

Powerhouse picks an AI agent profile and a workflow domain, then installs everything you need to start coding with it.

- **Profiles** — the AI agent you want to use (Claude, Codex, OpenCode, Cursor, etc.)
- **Domains** — the kind of work you do (web, backend, devops, data, etc.)
- **Tools** — developer dependencies checked and installed per platform
- **Integrations & MCPs** — plugins and servers configured for your agent
- **Skills** — curated knowledge packages loaded into your agent

Everything is declared in JSON manifests under [`registry/`](./registry). The CLI resolves a plan, shows it to you, then installs only what is missing.

## Available profiles

| Profile | Agent |
|---|---|
| `claude` | Anthropic Claude Code + desktop app |
| `codex` | OpenAI Codex CLI + desktop app |
| `opencode` | Provider-agnostic open source agent |
| `cursor` | AI-native code editor |
| `goose` | Block's open-source extensible agent |
| `gemini` | Google's Gemini CLI |
| `openclaw` | Personal AI assistant |
| `antigravity` | Google's Antigravity ecosystem |
| `github-copilot` | GitHub Copilot agent |

## Available domains

| Domain | Focus |
|---|---|
| `general` | Broad repository work |
| `web` | UI, frontend, design, and modern web development |
| `backend` | APIs, services, and security review |
| `devops` | Rollout planning and infrastructure |
| `engineering` | Architecture and testing strategy |
| `design` | Interface design and design systems |
| `data` | Analysis and exploratory workflows |
| `content` | Content strategy and drafting |
| `marketing` | SEO, copywriting, and strategy |
| `product-management` | PRDs and prioritization |
| `social-media` | Campaign planning and content |

## Common commands

```bash
# Bootstrap a full setup
powerhouse bootstrap --profile claude --domain web

# Inspect a plan without installing
powerhouse plan --profile codex --domain backend

# Switch agent or workflow
powerhouse profile use codex
powerhouse domain use backend

# Check environment health
powerhouse doctor
powerhouse status

# Browse the catalog
powerhouse integration list
powerhouse mcp list
powerhouse skills find typescript

# Validate registry changes
powerhouse registry validate
```

## Supported platforms

- macOS
- Linux
- WSL
- Windows (plan/status/doctor only)

## Development

```bash
# Install dependencies
bun install

# Run locally
bun run cli --help
bun run web:dev

# Before committing
bun run test
bun run typecheck
bun run cli registry validate
```

## Repository layout

| Path | Purpose |
|---|---|
| [`install.sh`](./install.sh) | End-user bootstrap entrypoint |
| [`packages/cli`](./packages/cli) | CLI commands and interactive UX |
| [`packages/core`](./packages/core) | Registry, plans, installers, state |
| [`registry`](./registry) | Manifests for tools, profiles, domains, integrations, MCPs |
| [`apps/web`](./apps/web) | Astro docs site |
| [`tests`](./tests) | Vitest suite |

## Docs

Full documentation lives at [powerhouse-pi.vercel.app](https://powerhouse-pi.vercel.app).

---

See [`docs/architecture.md`](./docs/architecture.md) and [`docs/registry.md`](./docs/registry.md) for contributor details.
