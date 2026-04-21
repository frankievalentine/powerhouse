---
title: Profiles
description: Profiles define the base shape of your machine — which AI agent gets installed and which core tools come with it.
---

A profile is the starting point for every bootstrap. It declares which AI coding agent you work with and installs a consistent set of developer tools alongside it.

When you run `./install.sh`, you pick a profile interactively. You can also apply one directly with `powerhouse profile use <id>`.

## Available profiles

- [Claude](/profiles/claude/) — Anthropic's Claude Code agent
- [Codex](/profiles/codex/) — OpenAI's Codex CLI
- [Local Models](/profiles/local-models/) — OpenCode with Ollama for local inference
- [Cursor](/profiles/cursor/) — The AI-native code editor
- [Goose](/profiles/goose/) — Block's open-source extensible AI agent
- [Gemini](/profiles/gemini/) — Google's Gemini CLI
- [OpenClaw](/profiles/openclaw/) — Personal AI assistant
- [Antigravity](/profiles/antigravity/) — Google's Antigravity ecosystem
- [GitHub Copilot](/profiles/github-copilot/) — GitHub Copilot agent experience

Run `powerhouse profile list` to see every available profile.

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
