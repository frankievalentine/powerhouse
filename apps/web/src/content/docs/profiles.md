---
title: Profiles
description: Profiles define which AI agent you work with. Every profile inherits a shared baseline of universal tools, then adds only the agent-specific binaries it needs.
---

A profile is the starting point for every bootstrap. It declares which AI coding agent you work with. All profiles share a common baseline of universal tools — version control, network access, JSON processing, and file search — so profiles stay focused on their real purpose: agent selection. Platform support is now explicit per profile, including `wsl` and native Windows planning support where available.

When you run `./install.sh`, you pick a profile interactively. You can also apply one directly with `powerhouse profile use <id>`.

## Available profiles

- [Claude](/profiles/claude/) — Anthropic's Claude Code agent and desktop app
- [Codex](/profiles/codex/) — OpenAI's Codex CLI and desktop app
- [OpenCode](/profiles/opencode/) — Provider-agnostic open source coding agent
- [Cursor](/profiles/cursor/) — The AI-native code editor
- [Goose](/profiles/goose/) — Block's open-source extensible AI agent
- [Gemini](/profiles/gemini/) — Google's Gemini CLI
- [OpenClaw](/profiles/openclaw/) — Personal AI assistant
- [Antigravity](/profiles/antigravity/) — Google's Antigravity ecosystem
- [GitHub Copilot](/profiles/github-copilot/) — GitHub Copilot agent experience

Run `powerhouse profile list` to see every available profile.

---

## Profile inheritance

Every profile extends the `base` profile, which provides the universal tooling every agent and user needs:

- **git** — version control foundation
- **curl** — network transfers and bootstrap support
- **jq** — JSON processing for APIs and configs
- **ripgrep** — fast recursive text search
- **fd** — fast file discovery

Agent profiles add only their specific binaries on top of this baseline. Domains add workflow-specific tools on top of both. This keeps installs lean and prevents duplication across profiles.

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

A profile defines the agent. A domain layers on workflow-specific skills and tools for that agent. They're independent — switching one doesn't affect the other.

```
profile: claude    →  installs claude-code (inherits base tools)
domain:  web           →  installs node, bun + frontend-design skills into claude-code
```

See [Domains](/domains/) for the full list of available workflow layers.
