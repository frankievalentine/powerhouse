---
title: OpenClaw
description: Your own personal AI assistant.
---

Your own personal AI assistant.

## Tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base profile |
| `curl` | Network transfers and bootstrap support | base profile |
| `jq` | JSON processor for APIs and configs | base profile |
| `ripgrep` | Fast recursive text search | base profile |
| `fd` | Fast file discovery | base profile |
| `node` | Node.js runtime (required for OpenClaw) | profile-specific |
| `openclaw` | Personal AI assistant gateway | profile-specific |

## Platforms

Supported on **macOS**, **Linux**, **WSL**, and native **Windows** for planning/reporting in the CLI.

## Default agent

Skills installed globally target **OpenClaw** by default.

## Using this profile

```bash
powerhouse bootstrap --profile openclaw --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use openclaw
```
