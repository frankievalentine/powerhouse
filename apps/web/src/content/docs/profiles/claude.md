---
title: Claude
description: Anthropic's Claude Code agent and desktop app.
---

Targets [Claude Code](https://claude.ai/code) — Anthropic's coding agent — and the [Claude App](https://claude.com/download) on macOS.

## Tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base profile |
| `curl` | Network transfers and bootstrap support | base profile |
| `jq` | JSON processor for APIs and configs | base profile |
| `ripgrep` | Fast recursive text search | base profile |
| `fd` | Fast file discovery | base profile |
| `claude-code` | Anthropic's AI coding agent (CLI) | profile-specific |
| `claude-app` | Anthropic's Claude desktop app (macOS only) | profile-specific |

## Platforms

Supported on **macOS**, **Linux**, **WSL**, and native **Windows** for planning/reporting in the CLI.

## Default agent

Skills installed globally target **Claude Code** by default.

## Using this profile

```bash
powerhouse bootstrap --profile claude --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use claude
```
