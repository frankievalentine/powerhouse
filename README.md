# Powerhouse

A comprehensive repository of agent skills, workflows, and configurations for AI coding assistants, focused on **web development best practices**.

## Supported AI Assistants

| Assistant          | Config Directory | Context File          | Skills Location     | Status       |
| ------------------ | ---------------- | --------------------- | ------------------- | ------------ |
| **Claude Code**    | `.claude/`       | `CLAUDE.md`           | `.claude/skills/`   | ✅ Native    |
| **OpenCode**       | `.opencode/`     | `OPENCODE.md`         | `.opencode/skills/` | ✅ Native    |
| **Antigravity**    | `.gemini/`       | `GEMINI.md`           | `.gemini/skills/`   | ✅ Native    |
| **OpenAI Codex**   | `.codex/`        | `AGENTS.md`           | `~/.codex/skills/`  | ✅ Native    |
| **Continue.dev**   | `.continue/`     | `config.yaml`         | Prompts             | 🔄 Converted |
| **GitHub Copilot** | `.copilot/`      | `.copilot/skills/`    | `.copilot/skills/`  | ✅ Native    |
| **Cursor**         | `.cursor/`       | `.cursor/rules/*.mdc` | Rules               | ✅ Native    |

## What's Included

### Global Skills (Web Development Focused)

- **typescript-expert** - Strict TypeScript configuration, type patterns, modern ES2022+ features
- **nextjs-app-router** - Server Components, data fetching, App Router patterns
- **shadcn-ui** - Component library usage, theming, accessibility
- **web-performance** - Core Web Vitals, optimization techniques, caching strategies
- **github-workflow** - PR management, commit conventions, GitHub CLI automation
- **accessibility** - ARIA patterns, semantic HTML, keyboard navigation

### Workflows

- **pr-review** - Comprehensive pull request review process
- **component-create** - Create React/Next.js components with tests
- **test-coverage** - Analyze and improve test coverage
- **deploy-preview** - Deploy preview environments

### Commands

Slash commands for common development tasks:

| Command             | Description                                    | Agents                   |
| ------------------- | ---------------------------------------------- | ------------------------ |
| `/review-pr`        | Review current PR with code quality checklist  | Claude, OpenCode, Gemini |
| `/create-component` | Create React component with TypeScript & tests | Claude, OpenCode, Gemini |
| `/fix-tests`        | Diagnose and fix failing tests                 | Claude, OpenCode, Gemini |
| `/commit`           | Create conventional commit message             | Claude, OpenCode, Gemini |
| `/add-shadcn`       | Add shadcn/ui component to project             | Claude, OpenCode, Gemini |
| `/a11y-audit`       | Audit accessibility issues in code             | Claude, OpenCode, Gemini |
| `/create-issue`     | Create GitHub issue (bug/feature)              | Claude                   |
| `/optimize-assets`  | Optimize images for performance                | Gemini                   |

**Continue.dev Prompts:** `/code-review`, `/generate-tests`, `/explain-code`

## Installation

### Quick Install (All Agents)

```bash
./install.sh
```

### Manual Installation

#### Claude Code

```bash
# Global skills (available in all projects)
mkdir -p ~/.claude/skills
cp -r global/skills/* ~/.claude/skills/

# Project-specific (copy to your project)
cp -r agents/claude/.claude /path/to/your/project/
cp agents/claude/CLAUDE.md /path/to/your/project/
```

#### OpenCode

```bash
mkdir -p ~/.config/opencode/skills
cp -r global/skills/* ~/.config/opencode/skills/

cp -r agents/opencode/.opencode /path/to/your/project/
```

#### Antigravity (Gemini CLI)

```bash
mkdir -p ~/.gemini/skills ~/.gemini/antigravity
cp -r global/skills/* ~/.gemini/skills/
cp -r agents/gemini/antigravity/* ~/.gemini/antigravity/

cp -r agents/gemini/.gemini /path/to/your/project/
cp agents/gemini/GEMINI.md /path/to/your/project/
```

#### OpenAI Codex

```bash
mkdir -p ~/.codex/skills
cp -r global/skills/* ~/.codex/skills/

cp agents/codex/AGENTS.md /path/to/your/project/
```

#### Continue.dev

```bash
cp agents/continue/config.yaml ~/.continue/config.yaml
```

#### GitHub Copilot

```bash
mkdir -p /path/to/your/project/.copilot/skills
cp -r agents/copilot/skills/* /path/to/your/project/.copilot/skills/
```

#### Cursor

```bash
mkdir -p /path/to/your/project/.cursor/rules
cp agents/cursor/rules/* /path/to/your/project/.cursor/rules/
```

## Repository Structure

```
powerhouse/
├── README.md
├── install.sh                    # Universal installer
├── global/                       # Shared across all agents
│   ├── rules/
│   │   └── typescript.md
│   ├── skills/
│   │   ├── typescript-expert/
│   │   ├── nextjs-app-router/
│   │   ├── shadcn-ui/
│   │   ├── web-performance/
│   │   ├── github-workflow/
│   │   └── accessibility/
│   └── workflows/
│       ├── pr-review.md
│       ├── component-create.md
│       ├── test-coverage.md
│       └── deploy-preview.md
├── agents/                       # Agent-specific configurations
│   ├── claude/
│   ├── opencode/
│   ├── gemini/
│   ├── codex/
│   ├── continue/
│   ├── copilot/
│   └── cursor/
└── site/                         # Next.js landing page

```

## Skill Format

All skills use a universal format compatible with Claude Code, OpenCode, Gemini CLI, and Codex:

```markdown
---
name: skill-name
description: Brief description of what this skill provides (used for discovery)
---

# Skill Title

Detailed instructions for the AI agent...
```

Skills are automatically discovered and loaded on-demand when relevant to your task.

## Usage

### Invoking Skills

Most agents support explicit skill invocation:

```
# Claude Code / OpenCode / Gemini CLI
/skill typescript-expert

# Or mention in conversation
"Use the nextjs-app-router skill to help me set up data fetching"
```

### Running Workflows

```
# Using slash commands
/workflow pr-review

# Or reference directly
"Follow the component-create workflow to build a new Button component"
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Adding a New Skill

1. Create a new directory under `global/skills/your-skill-name/`
2. Add a `SKILL.md` file with proper frontmatter
3. Add any reference files or scripts
4. Test with at least one AI assistant
5. Submit a PR

## License

MIT License - see [LICENSE](LICENSE) for details.

---
