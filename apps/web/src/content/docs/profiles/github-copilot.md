---
title: GitHub Copilot
description: Curated terminal toolchain optimized for the GitHub Copilot agent experience.
---

GitHub Copilot agent experience. Full developer toolchain with skills integrated into Copilot context.

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

Skills installed globally target **GitHub Copilot** by default. Copilot is managed through your editor or the `gh` CLI extension.

## Using this profile

```bash
powerhouse bootstrap --profile github-copilot --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use github-copilot
```
