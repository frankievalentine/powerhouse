---
description: Comprehensive pull request review workflow for code quality, security, and best practices
---

# PR Review Workflow

Follow these steps to review a pull request thoroughly.

## Step 1: Fetch PR Details

```bash
# View PR summary
gh pr view <PR_NUMBER>

# View with comments and reviews
gh pr view <PR_NUMBER> --comments

# Check out the PR locally
gh pr checkout <PR_NUMBER>
```

## Step 2: Understand the Context

1. Read the PR description and linked issues
2. Understand what problem is being solved
3. Check if there are breaking changes

## Step 3: Review the Code

### Check the diff:

```bash
gh pr diff <PR_NUMBER>
```

### Review for:

**Code Quality:**

- [ ] Follows project coding style
- [ ] No unused imports or variables
- [ ] Appropriate naming conventions
- [ ] No code duplication
- [ ] Functions are focused and small

**TypeScript:**

- [ ] Proper types (no `any` unless justified)
- [ ] Interfaces/types are well-defined
- [ ] No type assertions without reason

**React/Next.js:**

- [ ] Correct use of Server vs Client Components
- [ ] Proper data fetching patterns
- [ ] No unnecessary re-renders
- [ ] Correct use of hooks

**Security:**

- [ ] No hardcoded secrets
- [ ] Input validation
- [ ] Proper authentication checks
- [ ] XSS prevention

**Performance:**

- [ ] No obvious performance issues
- [ ] Images optimized
- [ ] Lazy loading where appropriate

**Accessibility:**

- [ ] Semantic HTML used
- [ ] ARIA attributes where needed
- [ ] Keyboard navigation works

## Step 4: Run Tests Locally

```bash
# Run tests
npm test

# Run affected tests only
npm test -- --changedSince=main

# Run type check
npm run type-check

# Run linter
npm run lint
```

## Step 5: Test Manually (if applicable)

```bash
# Start dev server
npm run dev
```

- Test the feature/fix works as expected
- Test edge cases
- Test on different screen sizes

## Step 6: Provide Feedback

### Approve if good:

```bash
gh pr review <PR_NUMBER> --approve --body "LGTM! Great work on the implementation."
```

### Request changes if issues found:

```bash
gh pr review <PR_NUMBER> --request-changes --body "Please address the following:

1. [File:Line] - Issue description
2. [File:Line] - Issue description

Overall feedback here."
```

### Comment for minor suggestions:

```bash
gh pr review <PR_NUMBER> --comment --body "Looks good overall. A few minor suggestions:

- Consider using X for Y
- Optional: Could simplify Z"
```

## Step 7: Follow Up

- Respond to author's questions
- Re-review after changes
- Approve once issues are resolved
