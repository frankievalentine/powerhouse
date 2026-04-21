---
title: Goose
description: Block's open-source extensible AI agent.
---

Block's open-source extensible AI agent.

## Tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base profile |
| `curl` | Network transfers and bootstrap support | base profile |
| `jq` | JSON processor for APIs and configs | base profile |
| `ripgrep` | Fast recursive text search | base profile |
| `fd` | Fast file discovery | base profile |
| `goose` | Extensible open-source AI agent | profile-specific |

## Platforms

Supported on **macOS**, **Linux**, **WSL**, and native **Windows** for planning/reporting in the CLI.

## Default agent

Skills installed globally target **Goose** by default.

## Using this profile

```bash
powerhouse bootstrap --profile goose --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use goose
```
