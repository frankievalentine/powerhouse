---
title: Registry
description: The registry is the source of truth for everything powerhouse installs — profiles, domains, tools, integrations, MCP servers, and skills all live in JSON manifests you can read, diff, and evolve.
---

The registry is a set of JSON manifest files that live in the `registry/` directory of the repository. When you run `bootstrap` or `plan`, the CLI reads these manifests, resolves a concrete install plan, and shows it to you before anything runs.

Nothing installs from a remote source at plan time — the registry is local, version-controlled, and fully auditable.

## Structure

```
registry/
  ├── profiles/
  │   ├── base.json
  │   ├── claude.json
  │   ├── codex.json
  │   ├── opencode.json
  │   ├── cursor.json
  │   ├── goose.json
  │   ├── gemini.json
  │   ├── openclaw.json
  │   ├── antigravity.json
  │   └── github-copilot.json
  ├── domains/
  │   ├── general.json
  │   ├── web.json

  │   ├── backend.json
  │   ├── devops.json
  │   ├── engineering.json
  │   ├── design.json
  │   ├── data.json
  │   ├── content.json
  │   ├── marketing.json
  │   ├── product-management.json
  │   └── social-media.json
  ├── integrations/
  │   ├── claude-github.json
  │   ├── gemini-workspace.json
  │   └── ...
  ├── mcp/
  │   ├── claude-context7.json
  │   ├── codex-context7.json
  │   └── ...
  └── tools/
      ├── git.json
      ├── bun.json
      ├── claude-code.json
      └── ...
```

---

## Profile manifests

A profile declares which AI agent you work with. Most profiles extend the `base` profile to inherit universal tooling, then add only agent-specific binaries.

```json
{
  "id": "claude",
  "title": "Claude",
  "description": "Anthropic's Claude Code agent.",
  "kind": "terminal-agent",
  "extends": "base",
  "defaultAgents": ["claude-code"],
  "toolIds": ["claude-code"],
  "supportedPlatforms": ["darwin", "linux", "win32", "wsl"]
}
```

**Fields**

| Field | Description |
|---|---|
| `id` | Unique identifier. Used with `--profile` and `profile use`. |
| `title` | Display name shown in interactive prompts and `profile list`. |
| `description` | Short description shown as a hint in the profile picker. |
| `kind` | `terminal-agent`, `editor-integrated`, `ecosystem`, or `local-first`. Optional taxonomy for UI grouping and validation rules. |
| `extends` | Parent profile ID to inherit `toolIds` from. Most profiles extend `base`. |
| `integrationIds` | Curated integrations that should be resolved automatically when the profile is applied. |
| `mcpServerIds` | Curated MCP servers that should be resolved automatically when the profile is applied. |
| `defaultAgents` | Agents that receive global skill installs and discovery filtering when this profile is active. |
| `toolIds` | Ordered list of tool IDs to install. Combined with inherited parent tool IDs. Tools are resolved in priority order from their own manifests. |
| `supportedPlatforms` | Any mix of `darwin`, `linux`, `win32`, and `wsl`. |

---

## Domain manifests

A domain declares its skill packages — each one points to a GitHub repository and lists which skills to install from it.

```json
{
  "id": "web",
  "title": "Web",
  "description": "UI, frontend implementation, and design-heavy work.",
  "extraToolIds": ["node", "bun"],
  "skillPackages": [
    {
      "source": "anthropics/skills",
      "skills": ["frontend-design"],
      "description": "Frontend and UI design guidance"
    },
    {
      "source": "vercel-labs/agent-skills",
      "skills": ["web-design-guidelines"],
      "description": "Web presentation and design direction"
    }
  ],
  "notes": ["The web domain starts with design and frontend guidance, not framework lock-in."]
}
```

**Fields**

| Field | Description |
|---|---|
| `id` | Unique identifier. Used with `--domain` and `domain use`. |
| `title` | Display name shown in interactive prompts and `domain list`. |
| `description` | Short description shown as a hint in the domain picker. |
| `extraToolIds` | Additional tools to install beyond what the profile provides. |
| `integrationIds` | Curated integrations to add to the resolved plan for this domain. |
| `mcpServerIds` | Curated MCP servers to add to the resolved plan for this domain. |
| `skillPackages` | Array of skill package definitions to install when the domain is applied. |
| `skillPackages[].source` | GitHub `owner/repo` the skill is sourced from. |
| `skillPackages[].skills` | Which skills to install from that source. |
| `notes` | Internal context for contributors about domain scope decisions. |

---

## Tool manifests

A tool manifest declares how to check if the tool is already installed and how to install it per platform.

```json
{
  "id": "ripgrep",
  "title": "ripgrep",
  "description": "Fast recursive search tool, used by many AI agents for code traversal.",
  "kind": "utility",
  "priority": 25,
  "supportedPlatforms": ["darwin", "linux", "win32", "wsl"],
  "check": { "command": "rg", "args": ["--version"] },
  "doctorHint": "Install ripgrep with: brew install ripgrep",
  "installs": {
    "darwin": [{ "type": "brew", "name": "ripgrep" }],
    "linux": [{ "type": "brew", "name": "ripgrep" }],
    "win32": [],
    "wsl": []
  }
}
```

**Fields**

| Field | Description |
|---|---|
| `id` | Unique identifier. Referenced in profile `toolIds` arrays. |
| `title` | Display name. |
| `description` | What this tool does and why it's in the registry. |
| `kind` | `ai-cli`, `developer-tool`, `runtime`, or `utility`. |
| `priority` | Install order within a plan. Lower numbers install first. |
| `check` | Structured command used by `doctor` to verify the tool is present. |
| `doctorHint` | Guidance text shown when the check command fails. |
| `installs` | Per-platform install steps. Supports `brew`, `npm`, `script`, `winget`, `powershell-script`, and `scoop`. |

**Install methods**

| Method | Fields |
|---|---|
| `brew` | `name` — formula name. Optional `packageType` (`formula` or `cask`). Optional `tap`. |
| `npm` | `package` — npm package name. Optional `bin`. Optional `global` (default `true`). |
| `script` | `url` — URL of the install script. Optional `args`. |
| `winget` | `id` — winget package id. Optional `exact` (default `true`). |
| `powershell-script` | `url` — URL of the install script. Optional `args`. |
| `scoop` | `name` — scoop package name. Optional `bucket`. |

---

## Integration manifests

An integration manifest declares a curated plugin or extension for a specific agent.

```json
{
  "id": "claude-github",
  "title": "Claude GitHub Plugin",
  "description": "Official GitHub plugin for Claude Code.",
  "targetAgent": "claude-code",
  "supportedPlatforms": ["darwin", "linux", "wsl"],
  "supportedScopes": ["global", "project", "local"],
  "installKind": "native-cli",
  "source": "github@claude-plugins-official",
  "bundledMcpIds": [],
  "install": {
    "kind": "native-cli",
    "command": "claude",
    "args": ["plugin", "install", "{{source}}", "--scope", "{{nativeScope}}"]
  }
}
```

**Fields**

| Field | Description |
|---|---|
| `id` | Unique identifier. Used with `integration show` and `integration install`. |
| `targetAgent` | Agent/tool id this integration targets, such as `claude-code` or `gemini-cli`. |
| `supportedPlatforms` | Platforms where this integration is supported. |
| `supportedScopes` | Powerhouse's normalized `global`, `project`, and `local` scopes. |
| `installKind` | High-level install strategy. Mirrors `install.kind`. |
| `source` | Native source identifier passed to the platform installer or config. |
| `bundledMcpIds` | MCP server ids that should be installed alongside the integration. |
| `install` | Platform-native install details. Supports `native-cli`, `json-config`, `toml-config`, and `manual`. |

---

## MCP manifests

An MCP manifest declares a curated server setup for one or more agents.

```json
{
  "id": "codex-context7",
  "title": "Codex Context7 MCP",
  "description": "Configure the Context7 MCP server in Codex.",
  "serverName": "context7",
  "targetAgents": ["codex"],
  "supportedPlatforms": ["darwin", "linux", "win32", "wsl"],
  "supportedScopes": ["global", "project"],
  "serverKind": "stdio",
  "source": "@upstash/context7-mcp",
  "install": {
    "kind": "toml-config",
    "scopePaths": {
      "global": "~/.codex/config.toml",
      "project": ".codex/config.toml"
    }
  }
}
```

**Fields**

| Field | Description |
|---|---|
| `id` | Unique identifier. Used with `mcp show` and `mcp install`. |
| `serverName` | Native MCP server name written into agent config. |
| `targetAgents` | Agents this server can be configured for. |
| `supportedPlatforms` | Platforms where the configuration path is supported. |
| `supportedScopes` | Supported Powerhouse scopes for this server. |
| `serverKind` | `stdio`, `http`, or `sse`. |
| `source` | Package, URL, or endpoint used to configure the server. |
| `install` | Platform-native install details. Supports `native-cli`, `json-config`, `toml-config`, and `manual`. |

---

## Validating the registry

Before pushing any changes to manifests, run:

```bash
powerhouse registry validate
```

This checks cross-manifest consistency — that every tool, integration, and MCP server reference resolves, that bundled MCP links are valid, that all platforms are declared correctly, and that required fields are present.

---

## Scaffolding new manifests

Use the scaffold commands to generate a valid starting point for new entries rather than writing JSON by hand.

```bash
# New domain
powerhouse registry scaffold-domain my-domain --title "My Domain"

# New profile
powerhouse registry scaffold-profile my-profile --title "My Profile"

# New tool
powerhouse registry scaffold-tool my-tool --title "My Tool"

# New integration
powerhouse registry scaffold-integration my-plugin --title "My Plugin"

# New MCP server
powerhouse registry scaffold-mcp my-server --title "My Server"
```

Add `--dry-run` to preview the output without writing files:

```bash
powerhouse registry scaffold-domain my-domain --dry-run
```

After scaffolding, fill in the fields and run `registry validate` before committing.
