---
name: typescript-rules
description: Global TypeScript coding standards and rules. Use this to ensure all TypeScript code follows strict type checking, modern patterns, and project conventions.
---

# TypeScript Coding Rules

Follow these rules and patterns for all TypeScript development to ensure high code quality, type safety, and maintainability.

## Core Principles

1.  **Strict Typing**: Always use `strict: true` in `tsconfig.json`. Avoid `any` at all costs; use `unknown` if a type is truly unknown and narrow it down.
2.  **Explicit Types**: Provide explicit return types for all public functions and exported methods.
3.  **Interfaces vs Types**: Use `interface` for object shapes and `type` for unions, intersections, and aliases.
4.  **Dry Principle**: Modularize logic and share types across components.

## Naming Conventions

- **Classes/Interfaces/Types**: `PascalCase` (e.g., `UserService`, `UserAccount`)
- **Functions/Variables**: `camelCase` (e.g., `fetchUser`, `isLoggedIn`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- **Event Handlers**: Prefix with `handle` (e.g., `handleClick`, `onSubmit`)

## Functional Programming Patterns

- **Immutability**: Prefer `const` over `let`. Use `readonly` for array and object properties that shouldn't change.
- **Pure Functions**: Aim for side-effect-free functions wherever possible.
- **Early Returns**: Use early returns to reduce indentation and improve readability.

```typescript
// ✅ Good
const validateUser = (user: User) => {
  if (!user.email) return false;
  if (!user.name) return false;
  return true;
};

// ❌ Avoid
const validateUser = (user: User) => {
  if (user.email) {
    if (user.name) {
      return true;
    }
  }
  return false;
};
```

## Error Handling

- **Throw Early**: Validate inputs and throw errors at the start of functions.
- **Custom Errors**: Use specialized error classes for better error tracking.
- **Try-Catch**: Use targeted try-catch blocks around risky asynchronous operations.

## Documentation

- **JSDoc**: Use JSDoc comments for complex functions and classes to explain parameters, return values, and behavior.
