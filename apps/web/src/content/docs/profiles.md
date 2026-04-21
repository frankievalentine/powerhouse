---
title: Profiles
description: Profiles define the base shape of your machine — which AI agent gets installed and which core tools come with it.
---

A profile is the starting point for every bootstrap. It declares which AI coding agent you work with and installs a consistent set of developer tools alongside it.

When you run `./install.sh`, you pick a profile interactively. You can also apply one directly with `powerhouse profile use <id>`.

## Available profiles

### `claude`

The default profile. Targets [Claude Code](https://claude.ai/code) — Anthropic's coding agent — with a full developer toolchain.

| Tool | Purpose |
|---|---|
| `claude-code` | Anthropic's AI coding agent |
| `git` | Version control |
| `bun` | JavaScript runtime and package manager |
| `node` | Node.js runtime |
| `python` | Python runtime |
| `uv` | Python package and project manager |
| `gh` | GitHub CLI |
| `jq` | JSON processor |
| `curl` | HTTP client |
| `ripgrep` | Fast recursive search |
| `fd` | Fast file finder |
| `fzf` | Fuzzy finder |
| `bat` | Syntax-highlighted cat replacement |
| `eza` | Modern ls replacement |

Skills installed globally target Claude Code by default.

---

### `codex`

Targets [Codex CLI](https://github.com/openai/codex) — OpenAI's terminal coding agent. Identical base toolchain, wired for Codex instead.

| Tool | Purpose |
|---|---|
| `codex` | OpenAI's AI coding agent |
| `git`, `bun`, `node`, `python`, `uv` | Core runtimes |
| `gh`, `jq`, `curl` | Developer utilities |
| `ripgrep`, `fd`, `fzf`, `bat`, `eza` | Terminal productivity |

Skills installed globally target Codex by default.

---

### `local-models`

For engineers who want provider-agnostic, fully local inference with no external API dependency. Pairs [OpenCode](https://opencode.ai) with [Ollama](https://ollama.com) for local model support.

| Tool | Purpose |
|---|---|
| `opencode` | Provider-agnostic open source agent |
| `ollama` | Local model runtime |
| `git`, `bun`, `node`, `python`, `uv` | Core runtimes |
| `gh`, `jq`, `curl` | Developer utilities |
| `ripgrep`, `fd`, `fzf`, `bat`, `eza` | Terminal productivity |

---

### Additional profiles

Powerhouse also ships profiles for **Cursor**, **Goose**, **Gemini CLI**, **OpenClaw**, **Antigravity**, and **GitHub Copilot**, with skills installation supported for 45+ agents via the upstream [`skills`](https://github.com/vercel-labs/skills) CLI. Run `powerhouse profile list` to see every available profile.

---

## Using profiles

**List available profiles:**

```bash
powerhouse profile list
```

**Show details for a specific profile:**

```bash
powerhouse profile show claude
```

**Check which profile is currently active:**

```bash
powerhouse profile current
```

**Switch to a different profile** (preserves your active domain):

```bash
powerhouse profile use codex
```

Preview what switching would do without applying it:

```bash
powerhouse profile use codex --dry-run
```

Skip the confirmation prompt:

```bash
powerhouse profile use codex --yes
```

---

## How profiles compose with domains

A profile defines the agent and the base toolchain. A domain layers on workflow-specific skills for that agent. They're independent — switching one doesn't affect the other.

```
profile: claude    →  installs claude-code + core tools
domain:  web           →  installs frontend-design + web-design-guidelines skills into claude-code
```

See [Domains](/domains/) for the full list of available workflow layers.
