---
title: T3 Code
description: Minimal GUI for AI code agents by T3 Tools.
---

## Required tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base harness |
| `curl` | Network transfers and setup support | base harness |
| `jq` | JSON processor for APIs and configs | base harness |
| `ripgrep` | Fast recursive text search | base harness |
| `fd` | Fast file discovery | base harness |
| `t3code` | T3 Code desktop app | harness-specific |

## Platforms

Supported on **macOS, Linux, WSL**.

## Default agents

Skills installed through active domains target **t3code** by default.

## Using this harness

```bash
powerhouse setup --harness t3code
```

Or add it to an existing harness selection:

```bash
powerhouse harness add t3code
```

## Manual install on Linux

T3 Code does not yet have an automated installer on Linux. Download the AppImage from [t3.codes/download](https://t3.codes/download) and make it executable before running `powerhouse setup`.
