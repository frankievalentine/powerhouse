---
description: Review the current PR with thorough code analysis
---

Review this pull request following the PR review workflow.

1. First, get PR details:

```
gh pr view --comments
```

2. Check the diff to understand changes:

```
gh pr diff
```

3. Review for:

- Code quality and style
- TypeScript types (no `any`)
- React/Next.js patterns
- Security concerns
- Performance issues
- Accessibility

4. Run tests to verify:

```
npm test
npm run type-check
npm run lint
```

5. Provide feedback with specific line references and actionable suggestions.
