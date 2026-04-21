---
title: Gemini
description: Google's Gemini CLI agent.
---

Google's Gemini CLI brings AI directly into your terminal.

## Tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base profile |
| `curl` | Network transfers and bootstrap support | base profile |
| `jq` | JSON processor for APIs and configs | base profile |
| `ripgrep` | Fast recursive text search | base profile |
| `fd` | Fast file discovery | base profile |
| `node` | Node.js runtime (required for Gemini CLI on Linux) | profile-specific |
| `gemini-cli` | Google's AI terminal agent | profile-specific |

## Platforms

Supported on **macOS**, **Linux**, **WSL**, and native **Windows** for planning/reporting in the CLI.

## Default agent

Skills installed globally target **Gemini CLI** by default.

## Using this profile

```bash
powerhouse bootstrap --profile gemini --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use gemini
```
