---
description: Commit staged changes with a conventional commit message
---

Create a well-formatted commit for staged changes.

## Steps

1. Check what's staged:

```
git status
git diff --staged
```

2. Analyze the changes and determine:
   - **Type**: feat, fix, docs, refactor, test, chore
   - **Scope**: Component or area affected (optional)
   - **Description**: What the change does (imperative mood)

3. Format the commit message:

```
<type>(<scope>): <description>

<optional body with details>
```

## Examples

```
feat(auth): add login form validation
fix(api): handle null response from user endpoint
docs: update README with installation steps
refactor(utils): extract date formatting logic
test(Button): add accessibility tests
chore: update dependencies
```

4. Create the commit:

```
git commit -m "<your message>"
```
