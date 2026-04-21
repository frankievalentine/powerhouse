---
title: Getting Started
description: Clone powerhouse, run your first bootstrap, and verify your machine state.
---

## Clone the repository

```bash
git clone https://github.com/frankievalentine/powerhouse
cd powerhouse
```

## Run your first bootstrap

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
3. Prompts you to pick a [profile](/profiles/) and a [domain](/domains/).
4. Resolves your selection into a concrete list of tools and skills.
5. Installs anything that isn't already there.
6. Saves a record of what was installed so `status` and `doctor` can reference it later.

After bootstrap completes, the `powerhouse` command is available globally.

## Preview a setup before running it

Want to see what a particular profile and domain combination would install without committing? Use `powerhouse plan`:

```bash
powerhouse plan --profile claude --domain web
```

This prints the resolved plan — tools, skills, install order — without running anything.

## Check your machine state

After bootstrapping, see what's active and installed:

```bash
powerhouse status
```

Run `doctor` to verify every tool in your active profile is still present and healthy:

```bash
powerhouse doctor
```

Re-sync your profile and domain if anything drifted:

```bash
powerhouse update
```

## Switch profiles or domains

Change your profile while keeping your current domain:

```bash
powerhouse profile use codex
```

Change your domain while keeping your current profile:

```bash
powerhouse domain use backend
```

Preview either change with `--dry-run` before applying it.

## What's next

- Read about [Profiles](/profiles/) to understand the base toolchains and agents
- Read about [Domains](/domains/) to see what skills are available for each workflow
- Read the [CLI reference](/cli/) for the full command surface
- Read about the [Registry](/registry/) to learn how manifests work
