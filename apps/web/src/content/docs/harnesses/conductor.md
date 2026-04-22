---
title: Conductor
description: Run a team of coding agents on your Mac in isolated workspaces.
---

## Required tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base harness |
| `curl` | Network transfers and setup support | base harness |
| `jq` | JSON processor for APIs and configs | base harness |
| `ripgrep` | Fast recursive text search | base harness |
| `fd` | Fast file discovery | base harness |
| `conductor` | Conductor desktop app | harness-specific |

## Platforms

Supported on **macOS only**.

## Default agents

Skills installed through active domains target **conductor** by default.

## Using this harness

```bash
powerhouse setup --harness conductor
```

Or add it to an existing harness selection:

```bash
powerhouse harness add conductor
```

## Manual install

Conductor must be installed manually before running Powerhouse setup. The vendor does not support Homebrew installation.

1. Download the DMG from [conductor.build](https://conductor.build/)
2. Open the DMG and drag Conductor to `/Applications`
3. Run `powerhouse setup --harness conductor`
