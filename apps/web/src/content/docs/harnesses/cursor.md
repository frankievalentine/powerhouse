---
title: Cursor
description: The AI-native code editor with built-in agent capabilities.
---

## Required tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base harness |
| `curl` | Network transfers and setup support | base harness |
| `jq` | JSON processor for APIs and configs | base harness |
| `ripgrep` | Fast recursive text search | base harness |
| `fd` | Fast file discovery | base harness |
| `cursor` | AI-native code editor | harness-specific |

## MCP Servers

| Server | Description | Scopes |
|---|---|---|
| [`cursor-context7`](/mcp/cursor-context7) | Install the Context7 MCP server for Cursor. | global, project |
| [`cursor-sequential-thinking`](/mcp/cursor-sequential-thinking) | Structured multi-step reasoning server for Cursor. | global, project |

## Platforms

Supported on **macOS, Linux, WSL**.

## Default agents

Skills installed through active domains target **cursor** by default.

## Using this harness

```bash
powerhouse setup --harness cursor
```

Or add it to an existing harness selection:

```bash
powerhouse harness add cursor
```
