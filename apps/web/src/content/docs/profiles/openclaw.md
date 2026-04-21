---
title: OpenClaw
description: Your own personal AI assistant with a full developer toolchain.
---

Your own personal AI assistant. OpenClaw gateway with a full developer toolchain and skill integration.

## Tools

| Tool | Purpose |
|---|---|
| `openclaw` | Personal AI assistant gateway |
| `git` | Version control |
| `bun` | JavaScript runtime and package manager |
| `node` | Node.js runtime |
| `python` | Python runtime |
| `uv` | Python package and project manager |
| `gh` | GitHub CLI |
| `jq` | JSON processor |
| `curl` | HTTP client |
| `ripgrep` | Fast recursive search |
| `fd` | Fast file finder |
| `fzf` | Fuzzy finder |
| `bat` | Syntax-highlighted cat replacement |
| `eza` | Modern ls replacement |

## Platforms

Supported on **macOS** and **Linux**.

## Default agent

Skills installed globally target **OpenClaw** by default.

## Using this profile

```bash
powerhouse bootstrap --profile openclaw --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use openclaw
```
