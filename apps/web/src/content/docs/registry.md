---
title: Registry
description: The registry is the source of truth for everything powerhouse installs — profiles, domains, tools, and skills all live in JSON manifests you can read, diff, and evolve.
---

The registry is a set of JSON manifest files that live in the `registry/` directory of the repository. When you run `bootstrap` or `plan`, the CLI reads these manifests, resolves a concrete install plan, and shows it to you before anything runs.

Nothing installs from a remote source at plan time — the registry is local, version-controlled, and fully auditable.

## Structure

```
registry/
├── profiles/
│   ├── claude-dev.json
│   ├── codex-dev.json
│   └── local-models.json
├── domains/
│   ├── general.json
│   ├── web.json
│   ├── web-development.json
│   ├── backend.json
│   ├── devops.json
│   ├── engineering.json
│   ├── design.json
│   ├── data.json
│   ├── content.json
│   ├── marketing.json
│   ├── product-management.json
│   └── social-media.json
└── tools/
    ├── git.json
    ├── bun.json
    ├── claude-code.json
    └── ...
```

---

## Profile manifests

A profile declares its base tools, the default agents it targets for skill installation, and platform support.

```json
{
  "id": "claude-dev",
  "title": "Claude Dev",
  "description": "AI coding with Claude Code. Installs a full developer toolchain and targets Claude Code for global skill installs.",
  "defaultAgents": ["claude-code"],
  "tools": ["git", "curl", "node", "bun", "jq", "gh", "python", "uv", "ripgrep", "fd", "fzf", "bat", "eza", "claude-code"],
  "supportedPlatforms": ["darwin", "linux"]
}
```

**Fields**

| Field | Description |
|---|---|
| `id` | Unique identifier. Used with `--profile` and `profile use`. |
| `title` | Display name shown in interactive prompts and `profile list`. |
| `description` | Short description shown as a hint in the profile picker. |
| `defaultAgents` | Agents that receive global skill installs when this profile is active. |
| `tools` | Ordered list of tool IDs to install. Tools are resolved in priority order from their own manifests. |
| `supportedPlatforms` | `darwin`, `linux`, or both. |

---

## Domain manifests

A domain declares its skill packages — each one points to a GitHub repository and lists which skills to install from it.

```json
{
  "id": "web",
  "title": "Web",
  "description": "UI, frontend implementation, and design-heavy work.",
  "notes": "The web domain starts with design and frontend guidance, not framework lock-in.",
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
  "extraTools": []
}
```

**Fields**

| Field | Description |
|---|---|
| `id` | Unique identifier. Used with `--domain` and `domain use`. |
| `title` | Display name shown in interactive prompts and `domain list`. |
| `description` | Short description shown as a hint in the domain picker. |
| `notes` | Internal context for contributors about domain scope decisions. |
| `skillPackages` | Array of skill package definitions to install when the domain is applied. |
| `skillPackages[].source` | GitHub `owner/repo` the skill is sourced from. |
| `skillPackages[].skills` | Which skills to install from that source. |
| `extraTools` | Additional tools to install beyond what the profile provides. |

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
  "supportedPlatforms": ["darwin", "linux"],
  "checkCommand": "rg --version",
  "doctorHint": "Install ripgrep with: brew install ripgrep",
  "installs": {
    "darwin": [{ "method": "brew", "target": "ripgrep" }],
    "linux": [{ "method": "brew", "target": "ripgrep" }]
  }
}
```

**Fields**

| Field | Description |
|---|---|
| `id` | Unique identifier. Referenced in profile `tools` arrays. |
| `title` | Display name. |
| `description` | What this tool does and why it's in the registry. |
| `kind` | `ai-cli`, `developer-tool`, `runtime`, or `utility`. |
| `priority` | Install order within a plan. Lower numbers install first. |
| `checkCommand` | Shell command used by `doctor` to verify the tool is present. |
| `doctorHint` | Guidance text shown when the check command fails. |
| `installs` | Per-platform install steps. Supports `brew`, `npm`, and `script` methods. |

**Install methods**

| Method | Fields |
|---|---|
| `brew` | `target` — formula name |
| `brew-cask` | `target` — cask name |
| `npm` | `package` — npm package name |
| `script` | `url` — URL of the install script, `args` — optional arguments |

---

## Validating the registry

Before pushing any changes to manifests, run:

```bash
powerhouse registry validate
```

This checks cross-manifest consistency — that every tool referenced in a profile exists in the tools registry, that all platforms are declared correctly, and that required fields are present.

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
```

Add `--dry-run` to preview the output without writing files:

```bash
powerhouse registry scaffold-domain my-domain --dry-run
```

After scaffolding, fill in the fields and run `registry validate` before committing.
