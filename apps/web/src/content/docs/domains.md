---
title: Domains
description: Domains install curated skill packages into your active AI agent for a specific type of work — without changing your base profile.
---

A domain layers workflow-specific AI skills on top of your active profile. Where a profile installs tools, a domain installs knowledge — curated skill packages sourced from community repositories and loaded into your AI agent.

Domains are additive and independent. Switching domains doesn't touch your tools or your agent installation.

## Available domains

- [General](/domains/general/) — Broad repository work
- [Web](/domains/web/) — UI, frontend, design, and modern web development
- [Backend](/domains/backend/) — APIs, services, and security review
- [DevOps](/domains/devops/) — Rollout planning and infrastructure ops
- [Engineering](/domains/engineering/) — Architecture and testing strategy
- [Design](/domains/design/) — Interface design and design systems
- [Data](/domains/data/) — Analysis and exploratory data workflows
- [Content](/domains/content/) — Content strategy and drafting
- [Marketing](/domains/marketing/) — SEO, copywriting, and strategy
- [Product Management](/domains/product-management/) — PRDs and prioritization
- [Social Media](/domains/social-media/) — Campaign planning and post generation

---

## Using domains

**List available domains:**

```bash
powerhouse domain list
```

**Show details for a domain:**

```bash
powerhouse domain show web
```

**Check which domain is currently active:**

```bash
powerhouse domain current
```

**Switch to a different domain** (preserves your active profile):

```bash
powerhouse domain use web
```

Preview what switching would do without applying it:

```bash
powerhouse domain use engineering --dry-run
```

Skip the confirmation prompt:

```bash
powerhouse domain use backend --yes
```

---

## How skills get installed

When you apply a domain, powerhouse uses the skills CLI to install each skill package into the agents defined by your active profile. Skills are installed globally by default.

You can also install skills directly without switching domains:

```bash
powerhouse skills install anthropics/skills --skill frontend-design
```

Or search for additional skills beyond what's in the registry:

```bash
powerhouse skills find typescript
```

See the [CLI reference](/cli/) for the full skills command surface.
