---
description: Create a new React component with TypeScript, tests, and proper structure
---

Create a new component following best practices:

**Component Name**: $ARGUMENTS

## Steps

1. Create the component file at `src/components/$ARGUMENTS/$ARGUMENTS.tsx`:
   - Use TypeScript with proper interface for props
   - Add JSDoc comments for documentation
   - Include accessibility attributes
   - Use Tailwind CSS for styling
   - Determine if it should be Server or Client Component

2. Create index export at `src/components/$ARGUMENTS/index.ts`

3. Create test file at `src/components/$ARGUMENTS/$ARGUMENTS.test.tsx`:
   - Test rendering
   - Test interactions
   - Test accessibility

4. Update `src/components/index.ts` to export the new component

5. Run verification:

```
npm run type-check
npm test -- --testPathPattern="$ARGUMENTS"
npm run lint
```

Follow the component-create workflow for detailed guidance.
