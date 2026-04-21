---
title: Antigravity
description: Curated terminal toolchain for Google's Antigravity agent ecosystem.
---

Google's Antigravity agent ecosystem. Full developer toolchain with skills wired for Antigravity context.

## Tools

| Tool | Purpose |
|---|---|
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

Skills installed globally target **Antigravity** by default. Antigravity itself is managed through the Gemini ecosystem.

## Using this profile

```bash
powerhouse bootstrap --profile antigravity --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use antigravity
```
