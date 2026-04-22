---
title: The Ledger
description: How powerhouse tracks every asset it installs and configures.
---

The ledger is powerhouse's accounting system. Every tool, integration, MCP server, skill, shell block, and wrapper binary that powerhouse touches is recorded in `ledger.json` so the system knows what it owns and can manage it later.

## Why the ledger exists

Without a ledger, a setup tool is just a fire-and-forget script. You run it once, it installs a bunch of things, and then you have no record of what changed. The ledger solves this by making every install action **reversible** and every state change **inspectable**.

This means powerhouse can:

- **Uninstall cleanly**: Remove only what it installed, leave preexisting tools untouched
- **Prune automatically**: Detect when your harness/domain selection changes and remove out-of-plan assets
- **Detect drift**: Warn you when config files have been modified since install
- **Track ownership**: Distinguish between tools powerhouse installed versus tools you already had

## Where it lives

| Platform | Path |
|---|---|
| macOS / Linux / WSL | `~/.local/state/powerhouse/ledger.json` |
| Windows | `%LOCALAPPDATA%\powerhouse\state\ledger.json` |

## What gets tracked

Every ledger entry has a `kind` that describes what type of asset it is:

### `tool`

Records that a tool was installed or found preexisting.

```json
{
  "kind": "tool",
  "toolId": "claude-code",
  "ownership": "installed",
  "removable": true,
  "installMethods": ["brew"],
  "addedAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

- `ownership`: `installed` means powerhouse installed it; `preexisting` means it was already on your machine
- `removable`: Whether the install method supports safe uninstall (brew, winget, scoop, npm do; shell scripts do not)
- `installMethods`: Which package managers or installers were used

### `integration` and `mcp`

Records that an integration or MCP server was configured, including config file snapshots.

```json
{
  "kind": "integration",
  "id": "claude-github",
  "scope": "global",
  "status": "configured",
  "installKind": "json-config",
  "removable": true,
  "fileChanges": [
    {
      "filePath": "/Users/you/.claude/settings.json",
      "existedBefore": true,
      "beforeContent": "{\"previous\": \"state\"}",
      "afterFingerprint": "abc123",
      "contentChanged": true
    }
  ],
  "addedAt": "2025-01-15T10:31:00Z",
  "updatedAt": "2025-01-15T10:31:00Z"
}
```

The `fileChanges` array stores a snapshot of each config file before powerhouse modified it. During uninstall, powerhouse restores the original content from `beforeContent`.

### `skill`

Records that a domain skill package was installed for an agent.

```json
{
  "kind": "skill",
  "source": "anthropics/skills",
  "skillName": "frontend-design",
  "agent": "claude-code",
  "scope": "global",
  "removable": true,
  "addedAt": "2025-01-15T10:32:00Z",
  "updatedAt": "2025-01-15T10:32:00Z"
}
```

### `shell-block`

Records that the powerhouse PATH block was injected into a shell profile.

```json
{
  "kind": "shell-block",
  "path": "/Users/you/.zshrc",
  "startMarker": "# >>> powerhouse shell setup >>>",
  "endMarker": "# <<< powerhouse shell setup <<<",
  "addedAt": "2025-01-15T10:29:00Z",
  "updatedAt": "2025-01-15T10:29:00Z"
}
```

### `wrapper`

Records that the `powerhouse` command wrapper was installed.

```json
{
  "kind": "wrapper",
  "path": "/Users/you/.local/bin/powerhouse",
  "runtimeDir": "/Users/you/.local/share/powerhouse/runtime",
  "addedAt": "2025-01-15T10:29:00Z",
  "updatedAt": "2025-01-15T10:29:00Z"
}
```

### `runtime`

Records that the managed runtime directory was created.

```json
{
  "kind": "runtime",
  "path": "/Users/you/.local/share/powerhouse/runtime",
  "addedAt": "2025-01-15T10:29:00Z",
  "updatedAt": "2025-01-15T10:29:00Z"
}
```

## How the ledger gets updated

### During setup

When you run `powerhouse setup`, the system:

1. Installs tools and records each one in the ledger
2. Configures integrations and saves config file snapshots
3. Installs MCP servers and saves their config snapshots
4. Installs skills for the selected domains
5. Injects the shell block and records its location
6. Installs the wrapper binary
7. Saves the complete ledger to disk

### During update

When you run `powerhouse update`:

1. Re-evaluates the current plan against the ledger
2. Installs any missing tools that should be present
3. Refreshes integrations and MCP configs if needed
4. Updates skill packages from upstream
5. Replaces the ledger entries for anything that changed

### During prune

When you run `powerhouse prune`:

1. Compares the current ledger against the active harness/domain plan
2. Identifies assets that are no longer part of the plan
3. Removes them and deletes their ledger entries

For example, if you switch from `claude` harness to `codex` harness:

- `claude-code` and `claude-app` become out-of-plan and are removed
- `codex` and `codex-app` are installed and tracked

### During uninstall

When you run `powerhouse uninstall`:

1. Reads every entry from the ledger
2. Reverses each action in order: tools, skills, integrations, MCP configs, shell block, wrapper, runtime
3. Deletes the ledger file itself

## Viewing the ledger

The ledger is a plain JSON file. You can inspect it directly:

```bash
cat ~/.local/state/powerhouse/ledger.json
```

Or on Windows:

```powershell
Get-Content $env:LOCALAPPDATA\powerhouse\state\ledger.json
```

You can also see a summary via `powerhouse status`, which shows how many tracked assets exist and which tools are managed versus preexisting.

## Ledger and drift detection

Powerhouse compares config file snapshots in the ledger against the current files on disk. If a file has changed since install, `powerhouse doctor` reports it as drift.

```bash
powerhouse doctor
# Output: warning: claude-github config drift detected in ~/.claude/settings.json
```

This protects you from accidentally losing manual edits during uninstall or prune. You can force restoration with `--force-drift` if needed.

## Ledger durability

- The ledger survives `powerhouse update` — it is merged, not replaced
- The ledger is scoped to your machine — it is not shared across devices
- The ledger is versioned — schema migrations happen automatically when the format changes
- The ledger is idempotent — running the same setup twice does not create duplicate entries
