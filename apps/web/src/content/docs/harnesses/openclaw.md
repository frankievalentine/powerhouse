---
title: OpenClaw
description: OpenClaw personal AI assistant.
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
| `openclaw` | OpenClaw personal AI assistant | harness-specific |

## Platforms

Supported on **macOS, Linux, Windows, WSL**.

## Default agents

Skills installed through active domains target **openclaw** by default.

## Using this harness

```bash
powerhouse setup --harness openclaw
```

Or add it to an existing harness selection:

```bash
powerhouse harness add openclaw
```
