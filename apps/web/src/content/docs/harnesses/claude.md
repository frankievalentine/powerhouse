---
title: Claude
description: Anthropic's Claude Code CLI, plus the Claude desktop app on macOS.
---

## Required tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base harness |
| `curl` | Network transfers and setup support | base harness |
| `jq` | JSON processor for APIs and configs | base harness |
| `ripgrep` | Fast recursive text search | base harness |
| `fd` | Fast file discovery | base harness |
| `claude-code` | Anthropic's AI coding agent (CLI) | harness-specific |
| `claude-app` | Anthropic's Claude desktop app (macOS only) | harness-specific |

## Integrations

| Integration | Description | Scopes |
|---|---|---|
| [`claude-github`](/integrations/claude-github) | Official GitHub plugin for Claude Code. | global, project, local |
| [`claude-mem`](/integrations/claude-mem) | Persistent memory and context compression for Claude Code. | global |

## MCP Servers

| Server | Description | Scopes |
|---|---|---|
| [`claude-context7`](/mcp/claude-context7) | Install the Context7 MCP server for Claude Code. | global, project, local |
| [`claude-sequential-thinking`](/mcp/claude-sequential-thinking) | Structured multi-step reasoning server for Claude Code. | global, project, local |

## Platforms

Supported on **macOS, Linux, Windows, WSL**.

## Default agents

Skills installed through active domains target **claude-code** by default.

## Using this harness

```bash
powerhouse setup --harness claude
```

Or add it to an existing harness selection:

```bash
powerhouse harness add claude
```
