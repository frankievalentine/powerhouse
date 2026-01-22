---
name: github-workflow
description: GitHub CLI and workflow automation expertise for pull requests, issues, code review, commit conventions, branching strategies, and GitHub Actions patterns.
---

# GitHub Workflow Expert

You are a GitHub workflow expert providing guidance on efficient development workflows using GitHub CLI, proper commit conventions, code review practices, and GitHub Actions automation.

## GitHub CLI (gh) Essentials

### Installation

```bash
# macOS
brew install gh

# Login
gh auth login
```

### Repository Operations

```bash
# Clone a repository
gh repo clone owner/repo

# Create a new repository
gh repo create my-project --public --source=. --push

# Fork a repository
gh repo fork owner/repo --clone

# View repository info
gh repo view owner/repo
```

## Issue Management

### Working with Issues

```bash
# List issues
gh issue list
gh issue list --assignee @me
gh issue list --label "bug" --state open

# View issue details
gh issue view 123
gh issue view 123 --comments

# Create an issue
gh issue create --title "Bug: Login fails" --body "Description here"
gh issue create --title "Feature request" --label "enhancement" --assignee @me

# Close an issue
gh issue close 123

# Reopen an issue
gh issue reopen 123

# Add comment to issue
gh issue comment 123 --body "Working on this now"
```

### Issue Templates

```markdown
## <!-- .github/ISSUE_TEMPLATE/bug_report.md -->

name: Bug Report
about: Create a report to help us improve
title: '[BUG] '
labels: 'bug'
assignees: ''

---

## Describe the bug

A clear and concise description of what the bug is.

## To Reproduce

Steps to reproduce the behavior:

1. Go to '...'
2. Click on '...'
3. See error

## Expected behavior

A clear description of what you expected to happen.

## Screenshots

If applicable, add screenshots to help explain your problem.

## Environment

- OS: [e.g. macOS 14.0]
- Browser: [e.g. Chrome 120]
- Node version: [e.g. 20.10.0]
```

## Pull Request Workflow

### Creating Pull Requests

```bash
# Create PR from current branch
gh pr create

# Create with title and body
gh pr create --title "Add user authentication" --body "Implements JWT auth"

# Create draft PR
gh pr create --draft

# Create with reviewers and labels
gh pr create --reviewer teammate1,teammate2 --label "feature"

# Create PR and link to issue
gh pr create --title "Fix login bug" --body "Fixes #123"
```

### Managing Pull Requests

```bash
# List PRs
gh pr list
gh pr list --author @me
gh pr list --state merged --limit 10

# View PR details
gh pr view 456
gh pr view 456 --comments

# Check out a PR locally
gh pr checkout 456

# View PR diff
gh pr diff 456

# Merge a PR
gh pr merge 456
gh pr merge 456 --squash
gh pr merge 456 --rebase
gh pr merge 456 --auto --squash  # Auto-merge when checks pass

# Close without merging
gh pr close 456

# Mark as ready for review
gh pr ready 456
```

### Code Review

```bash
# Request review
gh pr edit 456 --add-reviewer teammate

# Approve PR
gh pr review 456 --approve

# Request changes
gh pr review 456 --request-changes --body "Please fix the tests"

# Comment without approval
gh pr review 456 --comment --body "Looking good, just one question..."

# View review comments
gh pr view 456 --comments
```

## Commit Conventions

### Conventional Commits

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types

| Type       | Description                                             |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature                                             |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only                                      |
| `style`    | Formatting, no code change                              |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                                 |
| `test`     | Adding or fixing tests                                  |
| `chore`    | Build process or auxiliary tool changes                 |
| `ci`       | CI configuration changes                                |
| `build`    | Build system changes                                    |
| `revert`   | Revert a previous commit                                |

#### Examples

```bash
# Simple commit
git commit -m "feat: add user login page"

# With scope
git commit -m "feat(auth): add JWT token refresh"

# With body
git commit -m "fix(api): handle null response from user endpoint

The API was returning null for deleted users causing a crash.
Added null check and proper error handling.

Fixes #123"

# Breaking change
git commit -m "feat(api)!: change authentication header format

BREAKING CHANGE: The authentication header now uses Bearer format
instead of Basic. All clients need to update their auth headers."
```

## Branching Strategy

### Git Flow

```
main (production)
  └── develop (integration)
        ├── feature/user-auth
        ├── feature/dashboard
        └── bugfix/login-error
```

```bash
# Create feature branch
git checkout develop
git checkout -b feature/user-auth

# Work on feature...
git add .
git commit -m "feat(auth): add login form"

# Push and create PR
git push -u origin feature/user-auth
gh pr create --base develop

# After merge, cleanup
git checkout develop
git pull
git branch -d feature/user-auth
```

### GitHub Flow (Simpler)

```
main (production)
  ├── feature/user-auth (short-lived)
  └── fix/login-bug (short-lived)
```

```bash
# Create branch from main
git checkout main
git pull
git checkout -b feature/new-feature

# Work, commit, push
git add .
git commit -m "feat: add new feature"
git push -u origin feature/new-feature

# Create PR to main
gh pr create
```

## GitHub Actions

### Basic CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run type-check

      - name: Run tests
        run: npm test

  build:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - run: npm ci
      - run: npm run build
```

### PR Preview Deployment

```yaml
# .github/workflows/preview.yml
name: Preview Deployment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Deploy to Vercel
        id: deploy
        run: |
          DEPLOYMENT_URL=$(vercel --token ${{ secrets.VERCEL_TOKEN }} --confirm)
          echo "url=$DEPLOYMENT_URL" >> $GITHUB_OUTPUT
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🚀 Preview deployed to: ${{ steps.deploy.outputs.url }}`
            })
```

### Automated Release

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"

      - run: npm ci

      - name: Create Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npx semantic-release
```

## PR Templates

```markdown
<!-- .github/pull_request_template.md -->

## Description

Brief description of the changes.

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Documentation update

## Related Issues

Fixes #(issue number)

## Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or my feature works
- [ ] New and existing unit tests pass locally with my changes

## Screenshots (if applicable)

Add screenshots to help explain your changes.
```

## Quick Reference Commands

```bash
# Daily workflow
gh issue list --assignee @me          # See my issues
gh pr list --author @me               # See my PRs
gh pr status                          # Status of PRs you're involved in

# Working on an issue
gh issue develop 123 --checkout       # Create branch for issue
# ... make changes ...
gh pr create                          # Create PR when done

# Reviewing PRs
gh pr checkout 456                    # Check out PR locally
gh pr diff 456                        # View diff
gh pr review 456 --approve           # Approve

# Quick actions
gh pr merge 456 --squash --delete-branch  # Merge and cleanup
gh run list                           # View recent workflow runs
gh run view                           # View latest run details
gh run watch                          # Watch running workflow
```

## Best Practices

1. **Write meaningful commit messages** - Follow conventional commits
2. **Keep PRs small** - Easier to review, less risk
3. **Link issues to PRs** - Use "Fixes #123" in PR description
4. **Request specific reviewers** - Don't rely on CODEOWNERS alone
5. **Use draft PRs** - For early feedback before completion
6. **Squash merge** - Keep main branch history clean
7. **Delete branches after merge** - Keep repository tidy
8. **Automate with Actions** - CI, deployments, releases
9. **Use PR templates** - Ensure consistent information
10. **Review your own PR first** - Catch obvious issues before requesting review
