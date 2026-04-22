---
title: Domains
description: Domains layer workflow guidance on top of your active harnesses by contributing recommended tools and curated skill packages.
---

A domain is the workflow layer in Powerhouse. Domains do not define the AI environment itself. Instead, they contribute recommended optional tools, skill packages, and any domain-specific integrations or MCP servers.

You can select one or more domains. Powerhouse unions their recommended tool sets and skill packages into the resolved plan.

## Available domains

- [General](/domains/general/) — Broad repository work
- [Web](/domains/web/) — UI, frontend, design, and modern web development
- [Backend](/domains/backend/) — APIs, services, and security review
- [Mobile](/domains/mobile/) — Native and cross-platform mobile development
- [DevOps](/domains/devops/) — Rollout planning and infrastructure ops
- [Security](/domains/security/) — Threat modeling, security review, and mitigation planning
- [Engineering](/domains/engineering/) — Architecture and testing strategy
- [QA](/domains/qa/) — Test planning, regression analysis, and release validation
- [Design](/domains/design/) — Interface design and design systems
- [Data](/domains/data/) — Analysis and exploratory data workflows
- [AI](/domains/ai/) — LLM apps, prompt design, retrieval, and evaluation
- [Docs](/domains/docs/) — Technical docs, specs, API references, and changelogs
- [Content](/domains/content/) — Content strategy and drafting
- [Marketing](/domains/marketing/) — SEO, copywriting, and strategy
- [Product Management](/domains/product-management/) — PRDs and prioritization
- [Social Media](/domains/social-media/) — Campaign planning and post generation

## Using domains

List the available domains:

```bash
powerhouse domain list
```

Show details for one domain:

```bash
powerhouse domain show web
```

Check the active domain selection:

```bash
powerhouse domain current
```

Replace the current selection:

```bash
powerhouse domain use web
powerhouse domain use web docs
```

Add or remove domains incrementally:

```bash
powerhouse domain add docs
powerhouse domain remove web
```

Preview selection changes with `--dry-run`, or skip confirmation with `--yes`.

## How domain tools work

Domain manifests provide recommended optional tools. Powerhouse selects all recommended tools by default during setup unless you pass explicit `--tool` flags or change them later with `powerhouse tool ...`.

When the domain selection changes, Powerhouse:

- preserves optional tools that are still recommended
- removes optional tools that are no longer recommended
- auto-selects newly recommended tools from newly added domains

Harness-required tools are not part of this optional tool set and cannot be removed through the tool commands.

## How skills get installed

When you apply domains, Powerhouse installs the selected skill packages into the agents defined by your active harness selection.

You can also install skills directly:

```bash
powerhouse skills install anthropics/skills --skill frontend-design
```

Or search for additional skills outside the registry:

```bash
powerhouse skills find typescript
```

See the [CLI reference](/cli/) for the full command surface.
