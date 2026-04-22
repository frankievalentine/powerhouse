---
title: Claude Mem
description: Persistent memory and context compression plugin for Claude Code.
---

## What it does

[Claude Mem](https://github.com/thedotmack/claude-mem) adds persistent memory to Claude Code. It automatically captures observations from your coding sessions, compresses them with AI, and injects relevant context back into future sessions.

**Key features:**

- Persistent memory across sessions
- AI-powered context compression
- Automatic observation capture
- Web viewer UI at `http://localhost:37777`
- Progressive disclosure (layered memory retrieval)
- Skill-based search with `mem-search`

## Installation

Claude Mem is installed automatically when you select the [Claude harness](/harnesses/claude/):

```bash
powerhouse setup --harness claude
```

Or install it manually via the integration command:

```bash
powerhouse integration install claude-mem --scope global
```

The install runs:

```bash
npx claude-mem install
```

This sets up:
- Plugin hooks in `~/.claude/plugins/marketplaces/thedotmack/`
- Worker service on port `37777`
- SQLite database for persistent storage
- Chroma vector database for semantic search

## Requirements

- Node.js 18.0.0 or higher
- Claude Code (installed by the Claude harness)
- Bun (auto-installed if missing)
- uv Python package manager (auto-installed if missing)

## Restart required

After installation, **restart Claude Code** for the plugin hooks to take effect. The integration status will show `restart_required` until you do.

## Usage

Once installed and restarted, Claude Mem works automatically:

1. **Captures** — Observations from tool usage and conversations are saved automatically
2. **Compresses** — AI summarizes and compresses context for efficient storage
3. **Injects** — Relevant context from past sessions appears in new sessions

### Web viewer

Open the memory stream viewer in your browser:

```
http://localhost:37777
```

### Search

Query your project history with natural language:

```
Use the mem-search skill to find the authentication implementation from last week.
```

### Privacy

Use `<private>` tags in conversations to exclude sensitive content from storage:

```
<private>
This password and API key discussion will not be saved to memory.
</private>
```

## Configuration

Settings are managed in `~/.claude-mem/settings.json` (auto-created on first run):

```json
{
  "CLAUDE_MEM_MODE": "code"
}
```

Available modes:
- `code` — Default English mode
- `code--zh` — Simplified Chinese
- `code--ja` — Japanese
- Other languages follow `code--[lang]` pattern

See the [full configuration guide](https://docs.claude-mem.ai/configuration) for all options.

## Uninstall

Claude Mem is installed as a native-cli integration. Because it modifies files outside of standard config paths, powerhouse cannot safely remove it automatically.

To uninstall manually:

```bash
# Remove the plugin directory
rm -rf ~/.claude/plugins/marketplaces/thedotmack

# Stop the worker service
npx claude-mem stop

# Optional: remove global data
rm -rf ~/.claude-mem
```

## Troubleshooting

If Claude Mem is not working after restart:

1. Check that the worker is running: `curl http://localhost:37777/health`
2. Review logs: `~/.claude-mem/logs/`
3. Re-install: `npx claude-mem install`

See the [official troubleshooting guide](https://docs.claude-mem.ai/troubleshooting) for more.
