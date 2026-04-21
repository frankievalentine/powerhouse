---
title: Local Models
description: OpenCode with Ollama for fully local inference — no API required.
---

For engineers who want provider-agnostic, fully local inference with no external API dependency. Pairs [OpenCode](https://opencode.ai) with [Ollama](https://ollama.com) for local model support.

## Tools

| Tool | Purpose |
|---|---|
| `opencode` | Provider-agnostic open source agent |
| `ollama` | Local model runtime |
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

Skills installed globally target **OpenCode** by default.

## Using this profile

```bash
powerhouse bootstrap --profile local-models --domain web
```

Or switch to it from another profile:

```bash
powerhouse profile use local-models
```
