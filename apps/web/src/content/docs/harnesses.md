---
title: Harnesses
description: Harnesses define AI environments. They contribute required tools, default agents, curated integrations, and curated MCP servers.
---

A harness is the AI environment layer in Powerhouse. Harnesses are where agent choice lives. They contribute required tools, default agents, and any curated integrations or MCP servers that should follow those agents.

You can select one or more harnesses. Powerhouse unions their required tools, integrations, MCP servers, and agents into one resolved plan.

## Available harnesses

- [Claude](/harnesses/claude/) — Anthropic's Claude Code agent and desktop app
- [Codex](/harnesses/codex/) — OpenAI's Codex CLI and desktop app
- [OpenCode](/harnesses/opencode/) — Provider-agnostic open source coding agent
- [Cursor](/harnesses/cursor/) — The AI-native code editor
- [Goose](/harnesses/goose/) — Block's open-source extensible AI agent
- [Gemini](/harnesses/gemini/) — Google's Gemini CLI
- [OpenClaw](/harnesses/openclaw/) — Personal AI assistant
- [Antigravity](/harnesses/antigravity/) — Google's Antigravity ecosystem
- [GitHub Copilot](/harnesses/github-copilot/) — GitHub Copilot agent experience
- [T3 Code](/harnesses/t3code/) — Minimal GUI for AI code agents
- [Conductor](/harnesses/conductor/) — Run a team of coding agents on your Mac
- [Superset](/harnesses/superset/) — The code editor for AI agents

Run `powerhouse harness list` to see every available harness.

## Harness inheritance

Most harnesses extend the `base` harness, which provides the universal tooling every setup needs:

- `git`
- `curl`
- `jq`
- `ripgrep`
- `fd`

Harness manifests only define required environment tools. Optional workflow tooling belongs to domains and your explicit tool selection.

## Using harnesses

List the available harnesses:

```bash
powerhouse harness list
```

Show details for one harness:

```bash
powerhouse harness show claude
```

Check the active harness selection:

```bash
powerhouse harness current
```

Replace the current selection:

```bash
powerhouse harness use claude
powerhouse harness use claude cursor
```

Add or remove harnesses incrementally:

```bash
powerhouse harness add codex
powerhouse harness remove cursor
```

Preview selection changes with `--dry-run`, or skip confirmation with `--yes`.

## How harnesses compose with domains and tools

- Harnesses define required tools and agent-facing setup.
- Domains define recommended optional tools and skill packages.
- `powerhouse tool ...` manages only the optional domain tool layer.
- Required harness tools are always included and cannot be removed from the tool selection.

Changing harnesses can change the required tool set, planned integrations, planned MCP servers, and the agents that receive skill installs.

See [Domains](/domains/) for the workflow layer that sits on top of harnesses.
