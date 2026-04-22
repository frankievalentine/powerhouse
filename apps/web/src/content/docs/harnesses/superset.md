---
title: Superset
description: The code editor for AI agents. Orchestrate parallel coding agents with isolated Git worktrees.
---

## Required tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base harness |
| `curl` | Network transfers and setup support | base harness |
| `jq` | JSON processor for APIs and configs | base harness |
| `ripgrep` | Fast recursive text search | base harness |
| `fd` | Fast file discovery | base harness |
| `superset` | Superset CLI and host service | harness-specific |

## Platforms

Supported on **macOS, Linux, and WSL**.

## Default agents

Skills installed through active domains target **superset** by default.

## Using this harness

```bash
powerhouse setup --harness superset
```

Or add it to an existing harness selection:

```bash
powerhouse harness add superset
```

## Installation

On macOS and Linux, Powerhouse installs Superset automatically via Homebrew from the `superset-sh/homebrew-tap` tap.

```bash
brew tap superset-sh/homebrew-tap
brew install superset
```

Alternatively, download the desktop app from [superset.sh](https://superset.sh/).
