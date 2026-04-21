---
title: Getting Started
description: Bootstrap your first machine, preview the plan, and run the docs site locally.
---

## Your first bootstrap

Run the setup script from the repo root:

```bash
./install.sh
```

Not sure what it's going to do? Run with `--dry-run` first — it resolves the full install plan and prints it out without changing anything on your machine:

```bash
./install.sh --dry-run
```

## What happens when you run it

1. Detects your platform (macOS or Linux).
2. Installs Homebrew and Bun if they're missing.
3. Resolves your selected profile and domain into a concrete list of tools.
4. Installs anything that isn't already there.
5. Sets up AI agent skills for your chosen workflow.
6. Saves a record of what was installed so `status` and `doctor` can reference it later.

## Preview a specific setup

Want to see what a particular profile and domain combination would install before committing? Use the CLI directly:

```bash
bun run cli plan --profile claude-dev --domain web --platform darwin
```

This prints the resolved plan — tools, skills, install order — without running anything.

## Run the docs site locally

Install workspace dependencies and start the dev server:

```bash
bun install
bun run web:dev
```

## Before pushing changes

Run the standard checks to make sure everything is in order:

```bash
bun run test
bun run typecheck
bun run cli registry validate
```

## What's in scope for v1

- macOS and Linux
- CLI-first — no GUI installer
- Profiles, domains, tools, and skills via the registry
- `status`, `doctor`, and `update` for machine state

GUI flows, plugin installers, MCP installers, and config symlink management are planned for later.
