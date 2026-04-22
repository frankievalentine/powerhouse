---
title: Antigravity
description: Google's Antigravity agent ecosystem.
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

Supported on **macOS, Linux**.

## Default agents

Skills installed through active domains target **antigravity** by default.

## Using this harness

```bash
powerhouse setup --harness antigravity
```

Or add it to an existing harness selection:

```bash
powerhouse harness add antigravity
```
