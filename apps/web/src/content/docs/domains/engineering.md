---
title: Engineering
description: Curated skills for architecture, technical decision-making, and testing strategy.
---

Curated skills for architecture, technical decision-making, and testing strategy.

## Recommended optional tools

| Tool | Description |
|---|---|
| `python` | Python interpreter |
| `uv` | Fast Python package manager |
| `gh` | GitHub CLI for repos and PRs |

## Skills

| Skill | Source |
|---|---|
| `architecture-patterns` | `wshobson/agents` |
| `architecture-decision-records` | `wshobson/agents` |
| `testing-strategies` | `supercent-io/skills-template` |

## MCP Servers

| Server | Description |
|---|---|
| [`claude-sequential-thinking`](/mcp/claude-sequential-thinking) | Structured multi-step reasoning server for Claude Code. |
| [`opencode-sequential-thinking`](/mcp/opencode-sequential-thinking) | Structured multi-step reasoning server for OpenCode. |

Recommended domain tools are selected by default during setup. You can refine the optional tool layer later with `powerhouse tool use`, `powerhouse tool add`, or `powerhouse tool remove`.

## Using this domain

```bash
powerhouse setup --domain engineering
```

Or add it to an existing domain selection:

```bash
powerhouse domain add engineering
```
