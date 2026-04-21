---
title: Cursor
description: The AI-native code editor plus a full developer toolchain.
---

The AI-native code editor. Cursor plus the full developer toolchain, with skills wired into your agent context.

## Tools

| Tool | Purpose |
|---|---|
| `cursor` | AI-native code editor |
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

Skills installed globally target **Cursor** by default.

## Using this profile

```bash
powerhouse bootstrap --profile cursor --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use cursor
```
