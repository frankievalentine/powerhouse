---
invokable: true
---

# Code Review

Review the selected code for quality, best practices, and potential issues.

## Review Checklist

### Code Quality

- Is the code readable and well-organized?
- Are variable and function names descriptive?
- Is there unnecessary duplication?
- Are functions focused and small?

### TypeScript

- Are types properly defined (no `any`)?
- Are interfaces/types well-structured?
- Is type inference used appropriately?

### React/Next.js

- Is it the right type of component (Server vs Client)?
- Are hooks used correctly?
- Is state managed appropriately?
- Are there potential re-render issues?

### Performance

- Are there obvious performance concerns?
- Is data fetching efficient?
- Are images optimized?

### Security

- Is user input validated?
- Are there any XSS vulnerabilities?
- Are sensitive data handled properly?

### Accessibility

- Are interactive elements keyboard accessible?
- Are there proper ARIA attributes?
- Is semantic HTML used?

## Provide Feedback

For each issue found:

1. Explain what the problem is
2. Explain why it matters
3. Suggest a specific fix
