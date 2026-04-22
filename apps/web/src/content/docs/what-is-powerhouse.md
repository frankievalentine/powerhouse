---
title: What is powerhouse?
---

Powerhouse is an opinionated setup tool that installs the tools, agents, integrations, and skills your workflow needs in one command. Getting a new machine ready for AI-assisted development is repetitive and error-prone. You need a specific set of CLI tools, a code agent or editor, integrations with GitHub or Gmail, MCP servers for context, and domain-specific skills for the kind of work you do. Each of these has its own install method, config format, and update cycle. Powerhouse unifies them.

## How it works

Powerhouse is built on three layers:

- **Harnesses** define your AI environment. They specify the required tools, default agents, and curated integrations and MCP servers for a given coding agent or editor.
- **Domains** define your workflow. They install curated skill packages and recommend optional tools for a given discipline like web, backend, devops, or design.
- **Tools** are the individual CLI utilities and applications that power your workflow. Some are required by harnesses, others are optional recommendations from domains.

When you run setup, Powerhouse resolves the union of everything your selections need, installs missing tools, configures integrations and MCP servers, installs skill packages, and saves the state so you can update or prune later.

Powerhouse installs skills globally via the upstream [`skills.sh`](https://github.com/vercel-labs/skills) CLI by Vercel. Integrations are installed through each harness's native CLI method — for example, `claude plugin install` for Claude Code, or `gemini extensions install` for Gemini CLI — so plugins always land in the right place for the agent you selected.

## What it installs

### Tools
Homebrew packages, casks, and system utilities. Examples: `git`, `jq`, `ripgrep`, `bun`, `ollama`, `claude-code`, `cursor`.

### Integrations
Harness-specific plugins, IDE extensions, and service connections scoped to global, project, or local level.

### MCP servers
Context providers like Context7, Sequential Thinking, and Memory, configured and registered with your active agents.

### Skills
Domain-specific packages installed into the correct agent skill directories. A skill package is a curated set of instructions and context files for a particular workflow.

## Key commands

```bash
powerhouse setup          # Interactive setup
powerhouse status         # Show active selections
powerhouse doctor         # Verify everything is installed
powerhouse update         # Re-sync to the latest selections
powerhouse plan           # Preview a setup without applying it
```

## Who it is for

Powerhouse is for anyone who wants a reproducible, version-controlled environment for AI-assisted work. Powerhouse adapts to your domain. That means developers, designers, data analysts, marketers, product managers, and content creators can all use it. You might work across multiple machines. You might onboard new team members. Or you might just want to stop copying `.zshrc` snippets around. In any case, Powerhouse gives you a declarative way to define and apply your entire AI workflow.

## Open source

Powerhouse is open source and extensible. The registry is a collection of JSON manifests. Add your own harnesses, domains, tools, integrations, MCP servers, and skills by contributing to the registry.

[Get started →](/getting-started/)
