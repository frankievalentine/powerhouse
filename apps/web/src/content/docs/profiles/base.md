---
title: Base
description: Universal tooling required by every Powerhouse profile and domain.
---

The `base` profile is the shared foundation for every selectable profile. It is not user-selectable directly — every agent profile inherits from it automatically.

## Purpose

The baseline exists to prevent duplication across profiles. Instead of every profile declaring the same tools, the base profile holds the universal tooling that every agent and user needs, regardless of domain.

## Tools

| Tool | Purpose |
|---|---|
| `git` | Version control foundation for all workflows |
| `curl` | Network transfers and bootstrap support |
| `jq` | JSON processor for APIs, configs, and structured data |
| `ripgrep` | Fast recursive text search across directories |
| `fd` | Fast file discovery and directory navigation |

These five tools support every use case: a social media manager drafting posts, a backend engineer building APIs, a product manager organizing specs, or a data analyst exploring CSVs.

## What was removed from the baseline

The following tools were previously in every profile but are now domain-specific or profile-specific:

- **node** — required only by npm-installed agents (Codex, Gemini, OpenCode, OpenClaw)
- **python** / **uv** — required only for Python-centric domains (backend, data, engineering, devops)
- **gh** — required only for repository-centric domains (engineering, devops, web)

## Platforms

Supported on **macOS**, **Linux**, **WSL**, and native **Windows** for planning/reporting in the CLI.
