---
title: Codex
description: Codex CLI plus the same terminal-first foundation for repo-centric work.
---

Targets [Codex CLI](https://github.com/openai/codex) — OpenAI's terminal coding agent. Identical base toolchain, wired for Codex instead.

## Tools

| Tool | Purpose |
|---|---|
| `codex` | OpenAI's AI coding agent |
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

Skills installed globally target **Codex** by default.

## Using this profile

```bash
powerhouse bootstrap --profile codex --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use codex
```
