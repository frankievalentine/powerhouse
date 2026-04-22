---
title: OpenCode
description: Provider-agnostic open source coding agent for any development workflow.
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
| `opencode` | Provider-agnostic open source coding agent | harness-specific |

## MCP Servers

| Server | Description | Scopes |
|---|---|---|
| [`opencode-context7`](/mcp/opencode-context7) | Configure the Context7 MCP server in OpenCode. | global, project |
| [`opencode-sequential-thinking`](/mcp/opencode-sequential-thinking) | Structured multi-step reasoning server for OpenCode. | global, project |

## Platforms

Supported on **macOS, Linux, Windows, WSL**.

## Default agents

Skills installed through active domains target **opencode** by default.

## Using this harness

```bash
powerhouse setup --harness opencode
```

Or add it to an existing harness selection:

```bash
powerhouse harness add opencode
```
