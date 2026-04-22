---
title: GitHub Copilot
description: GitHub Copilot agent experience.
---

## Required tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base harness |
| `curl` | Network transfers and setup support | base harness |
| `jq` | JSON processor for APIs and configs | base harness |
| `ripgrep` | Fast recursive text search | base harness |
| `fd` | Fast file discovery | base harness |

## Platforms

Supported on **macOS, Linux, Windows, WSL**.

## Default agents

Skills installed through active domains target **github-copilot** by default.

## Using this harness

```bash
powerhouse setup --harness github-copilot
```

Or add it to an existing harness selection:

```bash
powerhouse harness add github-copilot
```
