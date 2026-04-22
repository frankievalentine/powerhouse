---
title: Codex
description: OpenAI's Codex CLI, plus the Codex desktop app on macOS.
---

## Required tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base harness |
| `curl` | Network transfers and setup support | base harness |
| `jq` | JSON processor for APIs and configs | base harness |
| `ripgrep` | Fast recursive text search | base harness |
| `fd` | Fast file discovery | base harness |
| `node` | JavaScript/TypeScript runtime | harness-specific |
| `codex` | OpenAI's Codex CLI coding agent | harness-specific |
| `codex-app` | OpenAI's Codex desktop app (macOS only) | harness-specific |

## Integrations

| Integration | Description | Scopes |
|---|---|---|
| [`codex-gmail`](/integrations/codex-gmail) | Official Gmail plugin for Codex. | global |

## MCP Servers

| Server | Description | Scopes |
|---|---|---|
| [`codex-context7`](/mcp/codex-context7) | Configure the Context7 MCP server in Codex. | global, project |
| [`codex-sequential-thinking`](/mcp/codex-sequential-thinking) | Structured multi-step reasoning server for Codex. | global, project |

## Platforms

Supported on **macOS, Linux, WSL**.

## Default agents

Skills installed through active domains target **codex** by default.

## Using this harness

```bash
powerhouse setup --harness codex
```

Or add it to an existing harness selection:

```bash
powerhouse harness add codex
```
