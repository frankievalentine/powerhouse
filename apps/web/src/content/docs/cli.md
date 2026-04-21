---
title: CLI Reference
description: Full reference for all powerhouse commands, flags, and examples.
---

All commands run via `powerhouse` (after bootstrap) or `bun run cli` from the repo root during development.

## Bootstrap

### `bootstrap`

Resolve and apply a full install plan from a profile and domain combination.

```bash
powerhouse bootstrap
powerhouse bootstrap --profile claude --domain web
powerhouse bootstrap --profile codex --domain backend --yes
powerhouse bootstrap --profile claude --domain engineering --dry-run
```

**Flags**

| Flag | Description |
|---|---|
| `--profile <id>` | Profile to bootstrap. Prompts interactively if omitted. |
| `--domain <id>` | Domain to apply. Prompts interactively if omitted. |
| `--integration-scope <scope>` | Preferred integration scope: `auto`, `global`, `project`, or `local`. |
| `--mcp-scope <scope>` | Preferred MCP scope: `auto`, `global`, `project`, or `local`. |
| `--dry-run` | Resolve and print the full plan without installing anything. |
| `--yes` | Skip confirmation prompts. |

When run without flags, `bootstrap` uses interactive prompts (powered by [clack](https://github.com/natemoo-re/clack)) to walk you through profile and domain selection before showing the plan.

---

### `plan`

Resolve and print an install plan without running it. Useful for validating a profile and domain combination on any platform.

```bash
powerhouse plan
powerhouse plan --profile claude --domain web
powerhouse plan --profile codex --domain devops --platform linux
powerhouse plan --profile claude --domain engineering --json
```

**Flags**

| Flag | Description |
|---|---|
| `--profile <id>` | Profile to resolve. |
| `--domain <id>` | Domain to resolve. |
| `--platform <os>` | Target platform: `darwin`, `linux`, `win32`, or `wsl`. Defaults to current. |
| `--integration-scope <scope>` | Preferred integration scope: `auto`, `global`, `project`, or `local`. |
| `--mcp-scope <scope>` | Preferred MCP scope: `auto`, `global`, `project`, or `local`. |
| `--json` | Output the resolved plan as JSON. |

---

## Machine state

### `status`

Summarise the current machine state — active profile and domain, installed tools and agents, platform info, and last run result.

```bash
powerhouse status
```

---

### `doctor`

Check every tool in the active profile against the registry using each tool's typed `check` command. Reports what's installed, what's missing, and what may have drifted.

```bash
powerhouse doctor
```

---

### `update`

Re-sync the active profile and domain. Re-installs any missing tools and refreshes installed skills from upstream without requiring a full rebootstrap.

```bash
powerhouse update
```

---

## Profiles

### `profile list`

List all profiles in the registry.

```bash
powerhouse profile list
```

### `profile current`

Show the currently saved active profile.

```bash
powerhouse profile current
```

### `profile show <id>`

Show full details for a profile including its tools and default agents.

```bash
powerhouse profile show claude
powerhouse profile show opencode
```

### `profile use <id>`

Apply a profile while preserving the current active domain.

```bash
powerhouse profile use claude
powerhouse profile use codex --dry-run
powerhouse profile use opencode --yes
```

**Flags**

| Flag | Description |
|---|---|
| `--dry-run` | Preview what would change without applying. |
| `--yes` | Skip confirmation. |

---

## Domains

### `domain list`

List all domains in the registry.

```bash
powerhouse domain list
```

### `domain current`

Show the currently saved active domain.

```bash
powerhouse domain current
```

### `domain show <id>`

Show full details for a domain including its skill packages and sources.

```bash
powerhouse domain show web
powerhouse domain show engineering
```

### `domain use <id>`

Apply a domain while preserving the current active profile.

```bash
powerhouse domain use web
powerhouse domain use backend --dry-run
powerhouse domain use devops --yes
```

**Flags**

| Flag | Description |
|---|---|
| `--dry-run` | Preview what would change without applying. |
| `--yes` | Skip confirmation. |

---

## Tools

### `tool list`

List all tools in the registry with their kind and supported platforms.

```bash
powerhouse tool list
```

### `tool show <id>`

Show full details for a tool — description, check command, install methods per platform, and doctor hint.

```bash
powerhouse tool show claude-code
powerhouse tool show ripgrep
```

---

## Integrations

Integration commands let users discover curated plugins and extensions for the active profile or a specified agent.

### `integration list`

List all curated integrations compatible with the active profile's agents. Use `--profile` or `--agent` when you want to inspect another target explicitly.

```bash
powerhouse integration list
powerhouse integration list --profile claude
powerhouse integration list --agent codex
```

### `integration find [query]`

Search the curated integration catalog. This is the main "what can I install for this agent?" entrypoint after choosing a profile.

```bash
powerhouse integration find github
powerhouse integration find docs --profile gemini
```

### `integration show <id>`

Show the full manifest for one curated integration.

```bash
powerhouse integration show claude-github
```

### `integration install <id>`

Install one curated integration. If the manifest declares bundled MCP servers, Powerhouse installs those in the same run.

```bash
powerhouse integration install claude-github
powerhouse integration install gemini-workspace --scope global
powerhouse integration install opencode-wakatime --scope project --dry-run
```

**Flags**

| Flag | Description |
|---|---|
| `--scope <scope>` | Install scope: `auto`, `global`, `project`, or `local`. |
| `--dry-run` | Preview the native CLI/config changes without writing them. |

---

## MCP

MCP commands expose the curated server catalog directly, again defaulting to the active profile when state is initialized.

### `mcp list`

List curated MCP servers for the active or specified profile.

```bash
powerhouse mcp list
powerhouse mcp list --profile codex
```

### `mcp find [query]`

Search curated MCP servers by name, description, source, or tags.

```bash
powerhouse mcp find context7
powerhouse mcp find figma --agent claude-code
```

### `mcp show <id>`

Show one MCP server manifest.

```bash
powerhouse mcp show claude-context7
```

### `mcp install <id>`

Install one curated MCP server.

```bash
powerhouse mcp install claude-context7 --scope global
powerhouse mcp install codex-context7 --scope project --dry-run
```

**Flags**

| Flag | Description |
|---|---|
| `--scope <scope>` | Install scope: `auto`, `global`, `project`, or `local`. |
| `--dry-run` | Preview the native CLI/config changes without writing them. |

---

## Skills

Skills commands delegate to the upstream skills CLI. All flags below are passed through.

### `skills list`

List installed skills, optionally filtered by scope or agent.

```bash
powerhouse skills list
powerhouse skills list --global
powerhouse skills list --agent claude-code
```

### `skills install <source>`

Install one or more skills from a GitHub repository source.

```bash
powerhouse skills install anthropics/skills --skill frontend-design
powerhouse skills install vercel-labs/agent-skills --skill web-design-guidelines
powerhouse skills install github/awesome-copilot --skill security-review --agent claude-code
```

**Flags**

| Flag | Description |
|---|---|
| `--skill <name>` | Specific skill to install from the source. |
| `--agent <agent>` | Target agent. Defaults to agents in the active profile. |
| `--project` | Install as a project-scoped skill rather than globally. |

### `skills find [query]`

Search available skills beyond what's in the registry.

```bash
powerhouse skills find typescript
powerhouse skills find testing
```

### `skills remove [skills...]`

Remove installed skills.

```bash
powerhouse skills remove frontend-design
powerhouse skills remove --all --yes
powerhouse skills remove --agent claude-code --global
```

**Flags**

| Flag | Description |
|---|---|
| `--agent <agent>` | Target a specific agent. |
| `--global` | Remove from global scope. |
| `--all` | Remove all installed skills. |
| `--yes` | Skip confirmation. |

---

## Registry

### `registry validate`

Validate cross-manifest consistency across all profiles, domains, and tools in the registry. Run this before pushing changes.

```bash
powerhouse registry validate
```

### `registry scaffold-domain <id>`

Generate a new domain manifest scaffold.

```bash
powerhouse registry scaffold-domain my-domain
powerhouse registry scaffold-domain my-domain --title "My Domain"
powerhouse registry scaffold-domain my-domain --dry-run
```

### `registry scaffold-profile <id>`

Generate a new profile manifest scaffold.

```bash
powerhouse registry scaffold-profile my-profile
powerhouse registry scaffold-profile my-profile --title "My Profile" --dry-run
```

### `registry scaffold-tool <id>`

Generate a new tool manifest scaffold.

```bash
powerhouse registry scaffold-tool my-tool
powerhouse registry scaffold-tool my-tool --title "My Tool"
```
