---
title: OpenCode
description: Provider-agnostic open source coding agent for any development workflow.
---

[OpenCode](https://opencode.ai) is a provider-agnostic, open source coding agent that runs in your terminal. Use it with cloud providers or pair it with [Ollama](https://ollama.com) for fully local, offline inference.

## Tools

| Tool | Purpose | Source |
|---|---|---|
| `git` | Version control foundation | base profile |
| `curl` | Network transfers and bootstrap support | base profile |
| `jq` | JSON processor for APIs and configs | base profile |
| `ripgrep` | Fast recursive text search | base profile |
| `fd` | Fast file discovery | base profile |
| `node` | Node.js runtime (required for OpenCode) | profile-specific |
| `opencode` | Provider-agnostic open source coding agent | profile-specific |

## Optional: local LLM support

When you bootstrap the OpenCode profile, the CLI asks if you want to install **Ollama** alongside it. Ollama lets you run local models (like Llama, Mistral, or CodeLlama) entirely on your machine with no external API dependency.

```bash
powerhouse bootstrap --profile opencode --domain web
```

If you already have the OpenCode profile active and want to add Ollama later, install it manually:

```bash
brew install ollama
```

## Platforms

Supported on **macOS**, **Linux**, **WSL**, and native **Windows** for planning/reporting in the CLI.

## Default agent

Skills installed globally target **OpenCode** by default.

## Using this profile

```bash
powerhouse bootstrap --profile opencode --domain engineering
```

Or switch to it from another profile:

```bash
powerhouse profile use opencode
```
