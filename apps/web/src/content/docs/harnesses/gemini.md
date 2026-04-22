---
title: Gemini
description: Google's Gemini CLI agent.
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
| `gemini-cli` | Google's Gemini CLI agent | harness-specific |

## Integrations

| Integration | Description | Scopes |
|---|---|---|
| [`gemini-workspace`](/integrations/gemini-workspace) | Google Workspace access for Gemini CLI. | global |

## MCP Servers

| Server | Description | Scopes |
|---|---|---|
| [`gemini-context7`](/mcp/gemini-context7) | Install the Context7 MCP server for Gemini CLI. | global, project |
| [`gemini-sequential-thinking`](/mcp/gemini-sequential-thinking) | Structured multi-step reasoning server for Gemini CLI. | global, project |

## Platforms

Supported on **macOS, Linux, Windows, WSL**.

## Default agents

Skills installed through active domains target **gemini-cli** by default.

## Using this harness

```bash
powerhouse setup --harness gemini
```

Or add it to an existing harness selection:

```bash
powerhouse harness add gemini
```
