---
title: Domains
description: Domains install curated skill packages into your active AI agent for a specific type of work — without changing your base profile.
---

A domain layers workflow-specific AI skills on top of your active profile. Where a profile installs tools, a domain installs knowledge — curated skill packages sourced from community repositories and loaded into your AI agent.

Domains are additive and independent. Switching domains doesn't touch your tools or your agent installation.

## Available domains

### `general`

A conservative default for broad repository work. Installed when no domain is specified.

| Skills | Source |
|---|---|
| `skill-creator` | `vercel-labs/agent-skills` |

---

### `web`

UI, frontend implementation, and design-heavy work.

| Skills | Source |
|---|---|
| `frontend-design` | `anthropics/skills` |
| `web-design-guidelines` | `vercel-labs/agent-skills` |

---

### `web-development`

Implementation-heavy web application work. Testing-oriented and framework-aware.

| Skills | Source |
|---|---|
| `web-coder` | `github/awesome-copilot` |
| `modern-web-development` | `mindrally/skills` |
| `webapp-testing` | `anthropics/skills` |

---

### `backend`

APIs, services, and security-oriented code review.

| Skills | Source |
|---|---|
| `security-review` | `github/awesome-copilot` |

---

### `devops`

Rollout planning, automation, and infrastructure operations.

| Skills | Source |
|---|---|
| `devops-rollout-plan` | `github/awesome-copilot` |
| `devops-engineer` | `jeffallan/claude-skills` |

---

### `engineering`

Architecture, technical decision-making, and testing strategy across stacks.

| Skills | Source |
|---|---|
| `architecture-patterns` | `wshobson/agents` |
| `architecture-decision-records` | `wshobson/agents` |
| `testing-strategies` | `supercent-io/skills-template` |

---

### `design`

Interface design, visual exploration, and design system work.

| Skills | Source |
|---|---|
| `frontend-design` | `anthropics/skills` |
| `canvas-design` | `anthropics/skills` |
| `extract-design-system` | `arvindrk/extract-design-system` |

---

### `data`

Analysis, reporting, and exploratory data workflows.

| Skills | Source |
|---|---|
| `data-analysis` | `supercent-io/skills-template` |
| `exploratory-data-analysis` | `davila7/claude-code-templates` |

---

### `content`

Content strategy, research, and drafting workflows.

| Skills | Source |
|---|---|
| `content-strategy` | `coreyhaines31/marketingskills` |
| `content-research-writer` | `composiohq/awesome-claude-skills` |

---

### `marketing`

SEO, copywriting, and marketing strategy.

| Skills | Source |
|---|---|
| `seo-audit` | `coreyhaines31/marketingskills` |
| `copywriting` | `coreyhaines31/marketingskills` |
| `marketing-psychology` | `coreyhaines31/marketingskills` |

---

### `product-management`

PRDs, feature prioritization, and user feedback synthesis.

| Skills | Source |
|---|---|
| `prd-writer` | `pmprompt/claude-plugin-product-management` |
| `feature-prioritization-assistant` | `pmprompt/claude-plugin-product-management` |
| `user-feedback-synthesizer` | `pmprompt/claude-plugin-product-management` |

---

### `social-media`

Social campaign planning and channel-ready content.

| Skills | Source |
|---|---|
| `social-media-marketing` | `dengineproblem/agents-monorepo` |
| `social-media-posts` | `jezweb/claude-skills` |

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
powerhouse domain use web-development
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
