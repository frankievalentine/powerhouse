---
title: OpenCode Context7 MCP
description: Configure the Context7 MCP server in OpenCode.
---

Configure the Context7 MCP server in OpenCode.

## Details

| | |
|---|---|
| **Server name** | `context7` |
| **Target agents** | `opencode` |
| **Server kind** | http |
| **Source** | `https://mcp.context7.com/mcp` |
| **Supported scopes** | global, project |
| **Supported platforms** | macOS, Linux, Windows, WSL |

## Installing

Install standalone:

```bash
powerhouse mcp install opencode-context7
```

Or it will be installed automatically during setup if it is included in your active harness selection.
