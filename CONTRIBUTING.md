# Contributing to Powerhouse

Thank you for your interest in contributing! This document provides guidelines for contributing to the Powerhouse agent skills repository.

## 🎯 What We're Looking For

We welcome contributions that improve AI coding assistant workflows for web development:

- **New Skills**: Expertise areas that help with web development
- **Improved Workflows**: Better processes for common tasks
- **Agent Configurations**: Templates and settings for different AI assistants
- **Bug Fixes**: Corrections to existing skills or documentation
- **Documentation**: Improvements to READMEs, examples, and guides

## 📁 Repository Structure

```
powerhouse/
├── global/
│   ├── skills/          # Universal skills (work across all agents)
│   └── workflows/       # Task-based workflows
├── agents/
│   ├── claude/          # Claude Code specific
│   ├── opencode/        # OpenCode specific
│   ├── gemini/          # Gemini CLI specific
│   ├── codex/           # OpenAI Codex specific
│   ├── continue/        # Continue.dev specific
│   ├── copilot/         # GitHub Copilot specific
│   └── cursor/          # Cursor specific
└── templates/           # Project starter templates
```

## 🛠️ Adding a New Skill

### 1. Create the Skill Directory

```bash
mkdir -p global/skills/your-skill-name
```

### 2. Create SKILL.md

Every skill must have a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: your-skill-name
description: A clear, concise description that helps AI agents understand when to use this skill (max 1024 chars)
---

# Skill Title

Detailed instructions, patterns, and examples...
```

### 3. Add Supporting Files (Optional)

```
your-skill-name/
├── SKILL.md              # Required
├── references/           # Optional reference materials
│   ├── config-example.json
│   └── pattern-guide.md
└── scripts/              # Optional utility scripts
    └── validate.sh
```

### 4. Test Your Skill

1. Install the skill in your local agent configuration
2. Invoke it in conversations to verify it works
3. Test with at least one AI assistant

## 📝 Adding a Workflow

Workflows go in `global/workflows/` and use this format:

```markdown
---
description: One-line description of what this workflow accomplishes
---

# Workflow Title

Step-by-step instructions with commands and examples...
```

## ✅ Quality Guidelines

### For Skills

- **Be specific**: Focus on actionable, concrete guidance
- **Include examples**: Show code snippets and patterns
- **Stay current**: Reference modern best practices
- **Consider edge cases**: Address common problems
- **Keep it focused**: One skill = one expertise area

### For Workflows

- **Step-by-step**: Clear, numbered steps
- **Include commands**: Actual commands to run
- **Add checkpoints**: Verification after key steps
- **Handle errors**: What to do when things go wrong

### General

- **Test your changes**: Verify with at least one AI assistant
- **No sensitive data**: No API keys, passwords, or personal info
- **Proper formatting**: Use consistent Markdown
- **Clear naming**: Descriptive file and folder names

## 🔄 Pull Request Process

1. **Fork the repository**

2. **Create a feature branch**

   ```bash
   git checkout -b feat/your-feature-name
   ```

3. **Make your changes**

4. **Test locally**
   - Install skills: `./install.sh`
   - Test with your preferred AI assistant

5. **Commit with conventional commits**

   ```bash
   git commit -m "feat(skills): add react-query skill"
   git commit -m "docs: improve installation instructions"
   git commit -m "fix(workflow): correct test command in pr-review"
   ```

6. **Push and create PR**

   ```bash
   git push origin feat/your-feature-name
   gh pr create --fill
   ```

7. **Address review feedback**

## 📋 Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]
```

**Types**:

- `feat` - New skill, workflow, or feature
- `fix` - Bug fix
- `docs` - Documentation only
- `refactor` - Code restructuring
- `test` - Adding tests
- `chore` - Maintenance

**Scopes**:

- `skills` - Global skills
- `workflows` - Global workflows
- `claude` - Claude Code specific
- `gemini` - Gemini CLI specific
- `copilot` - GitHub Copilot specific
- etc.

## 🤝 Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on the work, not the person

## 📫 Questions?

- Open an issue for questions or suggestions
- Tag maintainers for urgent items
- Join discussions in PRs

Thank you for contributing! 🚀
