---
title: Claude
description: The default profile. Claude Code plus a full developer toolchain.
---

The default profile. Targets [Claude Code](https://claude.ai/code) — Anthropic's coding agent — with a full developer toolchain.

## Tools

| Tool | Purpose |
|---|---|
| `claude-code` | Anthropic's AI coding agent |
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

Skills installed globally target **Claude Code** by default.

## Using this profile

```bash
powerhouse bootstrap --profile claude --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use claude
```
