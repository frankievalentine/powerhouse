---
title: Antigravity
description: Google's Antigravity agent ecosystem.
---

Google's Antigravity agent ecosystem. Antigravity itself is managed through the Gemini ecosystem.

## Tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base profile |
| `curl` | Network transfers and bootstrap support | base profile |
| `jq` | JSON processor for APIs and configs | base profile |
| `ripgrep` | Fast recursive text search | base profile |
| `fd` | Fast file discovery | base profile |

No additional profile-specific tools. Antigravity is managed through the Gemini ecosystem.

## Platforms

Supported on **macOS** and **Linux**.

## Default agent

Skills installed globally target **Antigravity** by default. Antigravity itself is managed through the Gemini ecosystem.

## Using this profile

```bash
powerhouse bootstrap --profile antigravity --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use antigravity
```
