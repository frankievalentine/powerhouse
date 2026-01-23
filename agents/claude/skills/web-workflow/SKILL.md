---
name: web-workflow
description: Specialized workflows for modern web development (Next.js, React, Tailwind). Automates component creation, test fixing, and state management patterns.
---

# Web Development Workflows

Expert guidance for high-velocity web development. Follow these workflows for consistent and efficient feature implementation.

## 1. Creating New Components

When asked to create a new component:

1.  **Structure**: Create a new directory for the component if it has multiple files.
2.  **Logic**: Implement the component logic using React functional components and hooks.
3.  **Styling**: Use Tailwind CSS for all styling. Follow the project's existing design system.
4.  **Types**: Define props using interfaces.
5.  **Export**: Export the component from an `index.ts` or as a default export.

```tsx
// Example Component Workflow
import { type FC } from "react";

interface MyComponentProps {
  title: string;
}

export const MyComponent: FC<MyComponentProps> = ({ title }) => {
  return (
    <div className="p-4 rounded-lg bg-card text-card-foreground">
      <h2 className="text-xl font-bold">{title}</h2>
    </div>
  );
};
```

## 2. Fixing Failing Tests

When asked to fix tests:

1.  **Run Tests**: Execute `npm test -- <file-path>` to identify the specific failure.
2.  **Analyze Error**: Look at the assertion error or stack trace.
3.  **Verify Logic**: Compare the component's behavior with the test's expectations.
4.  **Apply Fix**: Correct the code or update the test if the requirements have changed.
5.  **Verify**: Re-run the test to confirm the fix.

## 3. Implementing State Management

When asked to add state:

1.  **Local State**: Use `useState` for simple, component-specific state.
2.  **Context**: Use React Context for state shared across a small subtree.
3.  **Server State**: Use React Server Components or specialized hooks for data fetching.

## 4. Design System Compliance

- Always check `tailwind.config.ts` or `globals.css` for custom tokens.
- Use `shadcn/ui` patterns for complex components (dialogs, tabs, etc.).
- Maintain accessibility (A11y) standards: use semantic HTML and ARIA labels.
