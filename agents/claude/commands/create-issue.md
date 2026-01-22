---
description: Create a new GitHub issue for a bug or feature
---

Create a well-structured GitHub issue.

## Steps

1. Determine issue type:
   - **Bug**: Something isn't working correctly
   - **Feature**: New functionality request
   - **Enhancement**: Improvement to existing feature

2. For **bugs**, gather:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details

3. For **features**, consider:
   - Use case / problem being solved
   - Proposed solution
   - Alternatives considered

4. Create the issue:

```bash
# Bug report
gh issue create \
  --title "[BUG] Brief description" \
  --label "bug" \
  --body "## Description
What happened?

## Steps to Reproduce
1. ...
2. ...

## Expected Behavior
What should happen?

## Environment
- OS:
- Browser:
- Node version:"

# Feature request
gh issue create \
  --title "[FEATURE] Brief description" \
  --label "enhancement" \
  --body "## Problem
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives
What else was considered?"
```

5. Assign and add to project if applicable:

```bash
gh issue edit <number> --add-assignee @me
```
