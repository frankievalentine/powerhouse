---
title: Security
description: Curated skills for threat modeling, application security review, and mitigation planning.
---

Curated skills for threat modeling, application security review, and mitigation planning.

## Recommended optional tools

| Tool | Description |
|---|---|
| `python` | Python interpreter |
| `uv` | Fast Python package manager |
| `gh` | GitHub CLI for repos and PRs |

## Skills

| Skill | Source |
|---|---|
| `security-review` | `vercel-labs/agent-skills` |
| `stride-analysis-patterns` | `wshobson/agents` |
| `attack-tree-construction` | `wshobson/agents` |
| `security-requirement-extraction` | `wshobson/agents` |
| `threat-mitigation-mapping` | `wshobson/agents` |

Recommended domain tools are selected by default during setup. You can refine the optional tool layer later with `powerhouse tool use`, `powerhouse tool add`, or `powerhouse tool remove`.

## Using this domain

```bash
powerhouse setup --domain security
```

Or add it to an existing domain selection:

```bash
powerhouse domain add security
```
