---
title: Registry
description: "The registry is the source of truth for everything Powerhouse resolves: harnesses, domains, tools, integrations, MCP servers, and skill packages."
---

The registry is a set of JSON manifests under `registry/`. When you run `setup` or `plan`, the CLI loads these manifests, resolves a concrete install plan, and shows it before anything changes on your machine.

Nothing is fetched from a remote catalog at plan time. The registry is local, version-controlled, and auditable.

## Structure

```text
registry/
  ├── harnesses/
  ├── domains/
  ├── integrations/
  ├── mcp/
  └── tools/
```

New harness manifests live in `registry/harnesses`. The loader still understands legacy `registry/profiles` data for migration and compatibility, but new writes and scaffolds use `harnesses`.

## Resolution model

Powerhouse resolves three layers into a final plan:

1. Harnesses contribute required tools, default agents, integrations, and MCP servers.
2. Domains contribute recommended optional tools, skill packages, and any domain-level integrations or MCP servers.
3. The saved tool selection picks from the recommended optional tools only.

The final tool set is:

```text
required harness tools + selected optional domain tools
```

## Harness manifests

Harness manifests define the AI environment layer.

```json
{
  "id": "claude",
  "title": "Claude",
  "description": "Anthropic's Claude Code agent.",
  "kind": "terminal-agent",
  "extends": "base",
  "defaultAgents": ["claude-code"],
  "requiredToolIds": ["claude-code"],
  "supportedPlatforms": ["darwin", "linux", "win32", "wsl"]
}
```

| Field | Description |
|---|---|
| `id` | Unique identifier. Used with `--harness` and `powerhouse harness ...`. |
| `title` | Display name shown in prompts and lists. |
| `description` | Short description shown in harness selection UIs. |
| `kind` | Optional taxonomy such as `terminal-agent`, `editor-integrated`, `ecosystem`, or `local-first`. |
| `extends` | Parent harness id. Most harnesses extend `base`. |
| `defaultAgents` | Agents that receive skill installs and catalog filtering when the harness is active. |
| `requiredToolIds` | Required tool ids contributed by this harness. Combined with inherited parent tools. |
| `integrationIds` | Curated integrations that should be included when this harness is active. |
| `mcpServerIds` | Curated MCP servers that should be included when this harness is active. |
| `supportedPlatforms` | Any mix of `darwin`, `linux`, `win32`, and `wsl`. |

## Domain manifests

Domain manifests define the workflow layer.

```json
{
  "id": "web",
  "title": "Web",
  "description": "UI, frontend implementation, and design-heavy work.",
  "recommendedToolIds": ["node", "bun"],
  "skillPackages": [
    {
      "source": "anthropics/skills",
      "skills": ["frontend-design"],
      "description": "Frontend and UI design guidance"
    }
  ],
  "notes": ["The web domain starts with design and frontend guidance, not framework lock-in."]
}
```

| Field | Description |
|---|---|
| `id` | Unique identifier. Used with `--domain` and `powerhouse domain ...`. |
| `title` | Display name shown in prompts and lists. |
| `description` | Short description shown in domain selection UIs. |
| `recommendedToolIds` | Optional tool ids recommended by this domain. These become candidates for the saved tool selection. |
| `integrationIds` | Curated integrations to add to the resolved plan for this domain. |
| `mcpServerIds` | Curated MCP servers to add to the resolved plan for this domain. |
| `skillPackages` | Skill package definitions to install when the domain is active. |
| `skillPackages[].source` | GitHub `owner/repo` the skills are sourced from. |
| `skillPackages[].skills` | Specific skills to install from that source. |
| `notes` | Contributor notes about the domain's scope and intent. |

## Tool manifests

Tool manifests define how Powerhouse detects and installs tools on each platform.

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

| Field | Description |
|---|---|
| `id` | Unique identifier. Referenced from `requiredToolIds` and `recommendedToolIds`. |
| `title` | Display name. |
| `description` | What the tool does and why it exists in the registry. |
| `kind` | `ai-cli`, `developer-tool`, `runtime`, or `utility`. |
| `priority` | Install order within a plan. Lower numbers install first. |
| `check` | Structured command used by `doctor` to verify the tool is present. |
| `doctorHint` | Guidance shown when the check command fails. |
| `installs` | Per-platform install steps. Supports `brew`, `npm`, `script`, `winget`, `powershell-script`, and `scoop`. |

## Integration manifests

Integration manifests describe curated plugins or extensions for a specific agent.

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

## MCP manifests

MCP manifests describe curated server configurations for one or more agents.

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

## Adding new manifests

Use the scaffold commands to create new manifests with the current schema:

```bash
powerhouse registry scaffold-harness my-harness
powerhouse registry scaffold-domain my-domain
powerhouse registry scaffold-tool my-tool
powerhouse registry scaffold-integration my-integration
powerhouse registry scaffold-mcp my-mcp
```

Then validate the full registry:

```bash
powerhouse registry validate
```
