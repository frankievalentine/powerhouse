---
title: Uninstalling
description: Remove powerhouse and everything it installed from your machine.
---

The `powerhouse uninstall` command fully removes powerhouse-managed assets, restores modified config files, and cleans up the runtime directory.

## What gets removed

`uninstall` walks the [ledger](/ledger/) and removes every tracked asset:

| Asset | What happens |
|---|---|
| **Installed tools** | Uninstalled via the same package manager that installed them (brew, winget, scoop, npm) |
| **Skills** | Removed via the upstream skills CLI |
| **Integrations** | Config snapshots restored; native CLI plugins uninstalled |
| **MCP servers** | Config snapshots restored |
| **Shell block** | The `powerhouse` PATH block removed from your shell profile |
| **Wrapper binary** | The `powerhouse` command wrapper deleted from `~/.local/bin` or `%LOCALAPPDATA%\powerhouse\bin` |
| **Managed runtime** | The `~/.local/share/powerhouse/runtime` or `%LOCALAPPDATA%\powerhouse\runtime` directory deleted |
| **State** | `state.json`, `last-run.json`, and `ledger.json` removed |
| **Cache** | Optionally purged with `--purge-cache` |

## Quick uninstall

```bash
powerhouse uninstall
```

You will be prompted to confirm. To skip the confirmation:

```bash
powerhouse uninstall --yes
```

## Options

| Flag | Description |
|---|---|
| `--yes` | Skip the confirmation prompt |
| `--keep-tools` | Leave installed tools on your machine |
| `--keep-configs` | Leave integration and MCP config changes in place |
| `--purge-cache` | Also remove the powerhouse cache directory |
| `--force-drift` | Restore config snapshots even if files changed since install |

## Partial uninstall

### Keep installed tools

If you want to stop using powerhouse but keep the tools it installed:

```bash
powerhouse uninstall --keep-tools
```

This removes integrations, MCP configs, skills, the shell block, and the wrapper binary, but leaves tools like `claude-code`, `node`, `ripgrep`, etc. on your system.

### Keep config changes

If you want to uninstall tools but preserve the integration and MCP config changes:

```bash
powerhouse uninstall --keep-configs
```

Useful when you have manually edited config files after setup and do not want powerhouse to restore them.

## Handling drift

If you modified an integration or MCP config file after powerhouse installed it, the uninstaller warns you and skips restoration to avoid overwriting your changes.

To force restoration anyway:

```bash
powerhouse uninstall --force-drift
```

## What is NOT removed

- **Preexisting tools**: If a tool was already on your machine before setup, it is tracked as `preexisting` and never removed.
- **Non-removable install methods**: Tools installed via one-off shell scripts (`script` or `powershell-script` type) are marked non-removable and skipped during uninstall.
- **Manual-only tools**: Tools with no automated install steps are never tracked in the ledger, so they are never removed.

## After uninstall

Once uninstall completes, the `powerhouse` command is no longer available. To reinstall, run the original install command:

```bash
curl -fsSL https://raw.githubusercontent.com/frankievalentine/powerhouse/main/install.sh | bash
```

Or on Windows:

```powershell
irm https://raw.githubusercontent.com/frankievalentine/powerhouse/main/install.ps1 | iex
```
