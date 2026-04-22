---
title: CLI Reference
description: Full reference for Powerhouse commands, flags, and examples.
---

All commands run via `powerhouse` after setup, or `bun run cli` from the repo root during development.

## Setup

### `setup`

Resolve and apply a full install plan from harness, domain, and tool selections.

```bash
powerhouse setup
powerhouse setup --harness claude --domain web
powerhouse setup --harness codex --harness cursor --domain backend --tool node --tool bun
powerhouse setup --harness claude --domain engineering --dry-run
powerhouse setup --harness codex --domain backend --yes
```

| Flag | Description |
|---|---|
| `--harness <id>` | Harness manifest id. Repeatable. |
| `--domain <id>` | Domain manifest id. Repeatable. |
| `--tool <id>` | Optional tool id. Repeatable. Only valid for tools recommended by the selected domains. |
| `--integration-scope <scope>` | Preferred integration scope: `auto`, `global`, `project`, or `local`. |
| `--mcp-scope <scope>` | Preferred MCP scope: `auto`, `global`, `project`, or `local`. |
| `--dry-run` | Resolve and print the plan without installing anything. |
| `--yes` | Skip prompts and use defaults when selections are omitted. |

Interactive setup walks through:

1. Pick your harnesses.
2. Pick your domains.
3. Pick your optional tools.

Required harness tools are always included. Optional tools default to all tools recommended by the selected domains.

### `plan`

Resolve and print an install plan without running it.

```bash
powerhouse plan
powerhouse plan --harness claude --domain web
powerhouse plan --harness codex --harness cursor --domain backend --tool node
powerhouse plan --harness claude --domain engineering --platform linux --json
```

| Flag | Description |
|---|---|
| `--harness <id>` | Harness manifest id. Repeatable. |
| `--domain <id>` | Domain manifest id. Repeatable. |
| `--tool <id>` | Optional tool id. Repeatable. |
| `--platform <os>` | Target platform: `darwin`, `linux`, `win32`, or `wsl`. Defaults to current. |
| `--integration-scope <scope>` | Preferred integration scope: `auto`, `global`, `project`, or `local`. |
| `--mcp-scope <scope>` | Preferred MCP scope: `auto`, `global`, `project`, or `local`. |
| `--json` | Output the resolved plan as JSON. |

### `prune`

Remove out-of-plan managed assets that no longer belong to the active harness, domain, and optional tool selections.

```bash
powerhouse prune
powerhouse prune --yes
powerhouse prune --keep-tools
powerhouse prune --keep-configs
```

| Flag | Description |
|---|---|
| `--yes` | Skip confirmation. |
| `--keep-tools` | Skip removing out-of-plan managed tools. |
| `--keep-configs` | Skip restoring integration and MCP config file changes. |

### `uninstall`

Fully remove Powerhouse-managed assets: tools, skills, integrations, MCP servers, the shell PATH block, the wrapper binary, and the managed runtime directory.

```bash
powerhouse uninstall
powerhouse uninstall --yes
powerhouse uninstall --keep-tools
powerhouse uninstall --purge-cache
powerhouse uninstall --force-drift
```

| Flag | Description |
|---|---|
| `--yes` | Skip confirmation. |
| `--keep-tools` | Skip removing managed tools. |
| `--keep-configs` | Skip restoring integration and MCP config changes. |
| `--purge-cache` | Also remove the Powerhouse cache directory. |
| `--force-drift` | Restore config snapshots even if files changed since install. |

## Machine state

### `status`

Summarize the current machine state: active harnesses, active domains, selected optional tools, planned assets, and last run result.

```bash
powerhouse status
```

### `doctor`

Check the health of the current resolved plan. `doctor` verifies every tool in the active plan and reports missing or drifted state.

```bash
powerhouse doctor
```

### `update`

Re-sync the active harness, domain, and optional tool selections. Reinstalls missing tools and refreshes installed skills from upstream without requiring a full setup run.

```bash
powerhouse update
```

## Harnesses

### `harness list`

List all harnesses in the registry.

```bash
powerhouse harness list
powerhouse harness list --platform linux
```

### `harness current`

Show the currently saved active harness selection.

```bash
powerhouse harness current
```

### `harness show <id>`

Show full details for one harness: required tools, default agents, integrations, and MCP servers.

```bash
powerhouse harness show claude
powerhouse harness show codex --platform darwin
```

### `harness use <ids...>`

Replace the active harness set while preserving the current domain selection.

```bash
powerhouse harness use claude
powerhouse harness use claude cursor
powerhouse harness use codex --dry-run
```

### `harness add <ids...>`

Add one or more harnesses to the active selection.

```bash
powerhouse harness add cursor
powerhouse harness add codex goose --yes
```

### `harness remove <ids...>`

Remove one or more harnesses from the active selection.

```bash
powerhouse harness remove cursor
powerhouse harness remove goose --dry-run
```

`use`, `add`, and `remove` support:

| Flag | Description |
|---|---|
| `--dry-run` | Preview the resolved change without applying it. |
| `--yes` | Skip confirmation. |

## Domains

### `domain list`

List all domains in the registry.

```bash
powerhouse domain list
```

### `domain current`

Show the currently saved active domain selection.

```bash
powerhouse domain current
```

### `domain show <id>`

Show full details for one domain: recommended tools and skill packages.

```bash
powerhouse domain show web
powerhouse domain show engineering
```

### `domain use <ids...>`

Replace the active domain set while preserving the current harness selection.

```bash
powerhouse domain use web
powerhouse domain use web docs
powerhouse domain use backend --dry-run
```

### `domain add <ids...>`

Add one or more domains to the active selection.

```bash
powerhouse domain add docs
powerhouse domain add qa security --yes
```

### `domain remove <ids...>`

Remove one or more domains from the active selection.

```bash
powerhouse domain remove docs
powerhouse domain remove qa --dry-run
```

When the domain selection changes, Powerhouse preserves optional tools that are still recommended, drops tools that are no longer recommended, and auto-selects tools newly recommended by added domains.

`use`, `add`, and `remove` support:

| Flag | Description |
|---|---|
| `--dry-run` | Preview the resolved change without applying it. |
| `--yes` | Skip confirmation. |

## Tools

### `tool list`

List all tools in the registry.

```bash
powerhouse tool list
powerhouse tool list --platform darwin
```

### `tool current`

Show the current required and optional tool selections.

```bash
powerhouse tool current
```

### `tool show <id>`

Show full details for one tool: description, check command, install methods, and doctor hint.

```bash
powerhouse tool show ripgrep
powerhouse tool show claude-code --platform linux
```

### `tool use [ids...]`

Replace the selected optional tool set.

```bash
powerhouse tool use
powerhouse tool use node bun
powerhouse tool use uv --dry-run
```

### `tool add <ids...>`

Add one or more optional tools to the active selection.

```bash
powerhouse tool add bun
powerhouse tool add node uv --yes
```

### `tool remove <ids...>`

Remove one or more optional tools from the active selection.

```bash
powerhouse tool remove bun
powerhouse tool remove node --dry-run
```

Tool commands only manage optional tools recommended by the active domains. Required harness tools are locked and cannot be removed here.

`use`, `add`, and `remove` support:

| Flag | Description |
|---|---|
| `--dry-run` | Preview the resolved change without applying it. |
| `--yes` | Skip confirmation. |

## Integrations

Integration commands let you inspect and install curated plugins and extensions for the active harness agents.

### `integration list`

```bash
powerhouse integration list
powerhouse integration list --harness claude
powerhouse integration list --agent codex
```

### `integration find [query]`

```bash
powerhouse integration find github
powerhouse integration find docs --harness gemini
```

### `integration show <id>`

```bash
powerhouse integration show claude-github
```

### `integration install <id>`

```bash
powerhouse integration install claude-github
powerhouse integration install gemini-workspace --scope global
powerhouse integration install claude-github --scope project --dry-run
```

| Flag | Description |
|---|---|
| `--harness <id>` | Harness manifest id for `list` and `find`. |
| `--agent <agent...>` | Filter catalog output to specific agents. |
| `--scope <scope>` | Install scope: `auto`, `global`, `project`, or `local`. |
| `--dry-run` | Preview the native CLI or config changes without writing them. |

## MCP

MCP commands expose the curated server catalog directly, defaulting to the active harness selection when state exists.

### `mcp list`

```bash
powerhouse mcp list
powerhouse mcp list --harness codex
```

### `mcp find [query]`

```bash
powerhouse mcp find context7
powerhouse mcp find figma --agent claude-code
```

### `mcp show <id>`

```bash
powerhouse mcp show claude-context7
```

### `mcp install <id>`

```bash
powerhouse mcp install claude-context7 --scope global
powerhouse mcp install codex-context7 --scope project --dry-run
```

| Flag | Description |
|---|---|
| `--harness <id>` | Harness manifest id for `list` and `find`. |
| `--agent <agent...>` | Filter catalog output to specific agents. |
| `--scope <scope>` | Install scope: `auto`, `global`, `project`, or `local`. |
| `--dry-run` | Preview the native CLI or config changes without writing them. |

## Skills

Skills commands delegate to the upstream skills CLI.

### `skills list`

```bash
powerhouse skills list
powerhouse skills list --global
powerhouse skills list --agent claude-code
```

### `skills install <source>`

```bash
powerhouse skills install anthropics/skills --skill frontend-design
powerhouse skills install vercel-labs/agent-skills --skill web-design-guidelines
powerhouse skills install github/awesome-copilot --skill security-review --agent claude-code
```

| Flag | Description |
|---|---|
| `--skill <name>` | Specific skill to install from the source. |
| `--agent <agent>` | Target agent. Defaults to agents from the active harness selection. |
| `--project` | Install as a project-scoped skill rather than globally. |

### `skills find [query]`

```bash
powerhouse skills find typescript
powerhouse skills find testing
```

### `skills remove [skills...]`

```bash
powerhouse skills remove frontend-design
powerhouse skills remove --all --yes
powerhouse skills remove --agent claude-code --global
```

| Flag | Description |
|---|---|
| `--agent <agent>` | Target a specific agent. |
| `--global` | Remove from global scope. |
| `--all` | Remove all installed skills. |
| `--yes` | Skip confirmation. |

## Registry

### `registry validate`

Validate cross-manifest consistency across all harnesses, domains, tools, integrations, and MCP servers.

```bash
powerhouse registry validate
```

### `registry scaffold-domain <id>`

```bash
powerhouse registry scaffold-domain my-domain
powerhouse registry scaffold-domain my-domain --title "My Domain"
powerhouse registry scaffold-domain my-domain --dry-run
```

### `registry scaffold-harness <id>`

```bash
powerhouse registry scaffold-harness my-harness
powerhouse registry scaffold-harness my-harness --title "My Harness" --dry-run
```

### `registry scaffold-tool <id>`

```bash
powerhouse registry scaffold-tool my-tool
powerhouse registry scaffold-tool my-tool --title "My Tool"
```

### `registry scaffold-integration <id>`

```bash
powerhouse registry scaffold-integration my-integration
powerhouse registry scaffold-integration my-integration --title "My Integration" --dry-run
```

### `registry scaffold-mcp <id>`

```bash
powerhouse registry scaffold-mcp my-mcp-server
powerhouse registry scaffold-mcp my-mcp-server --title "My MCP Server" --dry-run
```
