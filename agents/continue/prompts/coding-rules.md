# Global Coding Rules

Follow these project-wide standards for all TypeScript and web development:

## Core Rules

- **Strict Mode**: Ensure `strict: true` is enabled in `tsconfig.json`.
- **Type Safety**: Avoid `any`; use `unknown` and narrow types where possible.
- **Interfaces over Types**: Prefer `interface` for object shapes.
- **Explicit Returns**: Annotate return types for exported functions.

## Patterns

- **Early Returns**: Keep logic flat and readable.
- **Immutability**: Favor `const` over `let`.
- **Naming**: camelCase for variables/functions, PascalCase for types/classes.
- **Events**: Prefix handlers with `handle` (e.g., `handleClick`).
