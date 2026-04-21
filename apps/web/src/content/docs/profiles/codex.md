---
title: Codex
description: OpenAI's Codex CLI agent and desktop app.
---

Targets [Codex CLI](https://github.com/openai/codex) — OpenAI's terminal coding agent — and the [Codex App](https://openai.com/codex) on macOS.

## Tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base profile |
| `curl` | Network transfers and bootstrap support | base profile |
| `jq` | JSON processor for APIs and configs | base profile |
| `ripgrep` | Fast recursive text search | base profile |
| `fd` | Fast file discovery | base profile |
| `node` | Node.js runtime (required for Codex on Linux) | profile-specific |
| `codex` | OpenAI's AI coding agent (CLI) | profile-specific |
| `codex-app` | OpenAI's Codex desktop app (macOS only) | profile-specific |

## Platforms

Supported on **macOS**, **Linux**, and **WSL**. Native **Windows** is plan-capable in the CLI, but installs should run under WSL.

## Default agent

Skills installed globally target **Codex** by default.

## Using this profile

```bash
powerhouse bootstrap --profile codex --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use codex
```
