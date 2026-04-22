---
title: Getting Started
description: Install powerhouse, run your first setup, and verify your machine state.
---

## Install powerhouse

You do not need git installed to set up powerhouse. Pick the one-liner for your platform.

### macOS / Linux / WSL

```bash
curl -fsSL https://raw.githubusercontent.com/frankievalentine/powerhouse/main/install.sh | bash
```

Preview the installation:

```bash
curl -fsSL https://raw.githubusercontent.com/frankievalentine/powerhouse/main/install.sh | bash -s -- --dry-run
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/frankievalentine/powerhouse/main/install.ps1 | iex
```

Preview the installation:

```powershell
$env:POWERHOUSE_DRY_RUN = "1"; irm https://raw.githubusercontent.com/frankievalentine/powerhouse/main/install.ps1 | iex
```

### Already have git? Install from source

If you prefer to clone the repository and run locally:

```bash
git clone https://github.com/frankievalentine/powerhouse
cd powerhouse
./install.sh
```

If Powerhouse is already installed, the script detects it and offers to run `powerhouse update` instead.

## What happens during setup

1. Powerhouse detects your platform.
2. It installs Homebrew and Bun if they are missing.
3. You pick one or more [harnesses](/harnesses/).
4. You pick one or more [domains](/domains/).
5. You review the optional domain tools. Harness-required tools are already included and cannot be removed here.
6. Powerhouse resolves the full plan: tools, integrations, MCP servers, and skills.
7. It installs any missing tools, configures integrations and MCP servers, and installs the selected domain skill packages.
8. It records every action in the [ledger](/ledger/) so the system knows what it owns and can manage it later.

After setup completes, the `powerhouse` command is available globally.

## Preview a setup before running it

Use `powerhouse plan` to inspect a combination without changing your machine:

```bash
powerhouse plan --harness claude --domain web
powerhouse plan --harness codex --harness cursor --domain backend --tool node --tool bun
```

## Check your machine state

After setup, inspect what is active:

```bash
powerhouse status
```

Review the current required and optional tool selections:

```bash
powerhouse tool current
```

Run `doctor` to verify every tool in the resolved plan is still available:

```bash
powerhouse doctor
```

Re-sync the active selections if anything drifted:

```bash
powerhouse update
```

## Change your selections

Replace the current harness selection:

```bash
powerhouse harness use codex
```

Add another harness to the active set:

```bash
powerhouse harness add cursor
```

Replace the current domain selection:

```bash
powerhouse domain use backend
```

Change the optional tool set directly:

```bash
powerhouse tool use node bun
powerhouse tool remove bun
```

Preview selection changes with `--dry-run` before applying them.

## What's next

- Read about [Harnesses](/harnesses/) to understand required tools, agents, integrations, and MCP servers
- Read about [Domains](/domains/) to see recommended tools and skill packages
- Read the [CLI reference](/cli/) for the full command surface
- Read about the [Registry](/registry/) to understand the manifest model
- Read about the [Ledger](/ledger/) to understand how powerhouse tracks everything it installs
- Read about [Uninstalling](/uninstalling/) to learn how to fully remove powerhouse and its assets
