# powerhouse

One command to a productive AI environment.

## Quick install

**macOS / Linux / WSL**

```bash
curl -fsSL https://raw.githubusercontent.com/frankievalentine/powerhouse/main/install.sh | bash
```

Preview the installation:

```bash
curl -fsSL https://raw.githubusercontent.com/frankievalentine/powerhouse/main/install.sh | bash -s -- --dry-run
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/frankievalentine/powerhouse/main/install.ps1 | iex
```

Preview the installation:

```powershell
$env:POWERHOUSE_DRY_RUN = "1"; irm https://raw.githubusercontent.com/frankievalentine/powerhouse/main/install.ps1 | iex
```

## What it does

Powerhouse resolves three layers into one install plan:

- **Harnesses**: one or more AI environments such as Claude, Codex, Cursor, or Windsurf
- **Domains**: one or more workflow packs such as web, backend, devops, or docs
- **Tools**: explicit optional tool selection on top of harness-required tools

From that plan, Powerhouse installs missing tools, configures curated integrations and MCP servers for the selected harness agents, and installs domain skill packages.

Everything is declared in JSON manifests under [`registry/`](./registry). The CLI resolves a plan, shows it to you, then installs only what is missing.

## Selection model

- Harnesses contribute **required tools**, default agents, integrations, and MCP servers.
- Domains contribute **recommended optional tools** and skill packages.
- Your saved tool selection contains only optional domain tools.
- The final tool plan is: required harness tools + selected optional tools.

## Common commands

```bash
# Run setup
powerhouse setup --harness claude --domain web
powerhouse setup --harness codex --harness cursor --domain backend --tool node --tool bun

# Inspect a plan without installing
powerhouse plan --harness claude --domain engineering

# Change selections incrementally
powerhouse harness add codex
powerhouse domain add docs
powerhouse tool current
powerhouse tool remove bun

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
- Windows (PowerShell)

## Development

If you already have git and want to contribute or run from source:

```bash
# Clone the repository
git clone https://github.com/frankievalentine/powerhouse
cd powerhouse

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
| [`install.sh`](./install.sh) | End-user setup entrypoint |
| [`packages/cli`](./packages/cli) | CLI commands and interactive UX |
| [`packages/core`](./packages/core) | Registry, plans, installers, state |
| [`registry`](./registry) | Manifests for tools, harnesses, domains, integrations, MCPs |
| [`apps/web`](./apps/web) | Astro docs site |
| [`tests`](./tests) | Vitest suite |

## Docs

- Public docs: [powerhouse-pi.vercel.app](https://powerhouse-pi.vercel.app)
- Local contributor docs: [`apps/web/src/content/docs/getting-started.md`](./apps/web/src/content/docs/getting-started.md), [`apps/web/src/content/docs/harnesses.md`](./apps/web/src/content/docs/harnesses.md), [`apps/web/src/content/docs/domains.md`](./apps/web/src/content/docs/domains.md), [`apps/web/src/content/docs/registry.md`](./apps/web/src/content/docs/registry.md), [`apps/web/src/content/docs/cli.md`](./apps/web/src/content/docs/cli.md)
