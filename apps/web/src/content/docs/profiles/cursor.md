---
title: Cursor
description: The AI-native code editor with built-in agent capabilities.
---

The AI-native code editor.

## Tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base profile |
| `curl` | Network transfers and bootstrap support | base profile |
| `jq` | JSON processor for APIs and configs | base profile |
| `ripgrep` | Fast recursive text search | base profile |
| `fd` | Fast file discovery | base profile |
| `cursor` | AI-native code editor | profile-specific |

## Platforms

Supported on **macOS**, **Linux**, and **WSL**. Native **Windows** is plan-capable in the CLI, but installs should run under WSL.

## Default agent

Skills installed globally target **Cursor** by default.

## Using this profile

```bash
powerhouse bootstrap --profile cursor --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use cursor
```
