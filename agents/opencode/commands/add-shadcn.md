---
description: Add a shadcn/ui component to the project
---

Add a shadcn/ui component with proper setup.

**Component Name**: $ARGUMENTS

## Steps

1. Add the component using the CLI:

```
npx shadcn@latest add $ARGUMENTS
```

2. Verify the component was added:

```
ls -la src/components/ui/
```

3. Review the component source for customization opportunities

4. Create a usage example if this is a commonly used component

5. Check that the component works correctly:

```
npm run dev
```

## Common Components

```bash
# Form components
npx shadcn@latest add button input label form

# Layout components
npx shadcn@latest add card dialog sheet sidebar

# Data display
npx shadcn@latest add table avatar badge

# Feedback
npx shadcn@latest add alert toast sonner
```

## After Adding

- Review the component in `src/components/ui/`
- Customize variants in the component file as needed
- Add to your component exports if using barrel files
