---
title: Claude Filesystem MCP
description: File system read/write access for Claude Code via the official MCP filesystem server.
---

File system read/write access for Claude Code via the official MCP filesystem server.

## Details

| | |
|---|---|
| **Server name** | `filesystem` |
| **Target agents** | `claude-code` |
| **Server kind** | stdio |
| **Source** | `@modelcontextprotocol/server-filesystem` |
| **Supported scopes** | project, local |
| **Supported platforms** | macOS, Linux, WSL |

## Installing

Install standalone:

```bash
powerhouse mcp install claude-filesystem
```

Or it will be installed automatically during setup if it is included in your active harness selection.
