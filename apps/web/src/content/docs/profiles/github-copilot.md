---
title: GitHub Copilot
description: GitHub Copilot agent experience.
---

GitHub Copilot agent experience. Copilot is managed through your editor or the `gh` CLI extension.

## Tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base profile |
| `curl` | Network transfers and bootstrap support | base profile |
| `jq` | JSON processor for APIs and configs | base profile |
| `ripgrep` | Fast recursive text search | base profile |
| `fd` | Fast file discovery | base profile |

No additional profile-specific tools. Copilot is managed through your editor or the `gh` CLI extension.

## Platforms

Supported on **macOS**, **Linux**, **WSL**, and native **Windows** for planning/reporting in the CLI.

## Default agent

Skills installed globally target **GitHub Copilot** by default. Copilot is managed through your editor or the `gh` CLI extension.

## Using this profile

```bash
powerhouse bootstrap --profile github-copilot --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use github-copilot
```
