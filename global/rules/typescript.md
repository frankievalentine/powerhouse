# TypeScript Coding Standards

This document defines the global TypeScript standards for all Powerhouse-supported projects.

## Core Rules

- **Strict Mode**: Always enable `strict: true` in `tsconfig.json`.
- **No Implicit Any**: Use `unknown` or `any` (only when absolutely necessary) with explicit reasoning.
- **Interfaces over Types**: Use `interface` for object shapes, `type` for unions/aliases.
- **Explicit Returns**: Annotate return types for all exported functions to improve predictability and IDE support.

## Patterns

- **Early Returns**: Keep logic flat.
- **Const over Let**: Favor immutability.
- **Discriminated Unions**: Use for complex state or response objects.

## Styling

- Use camelCase for variables and PascalCase for types/classes.
- Avoid default exports for internal modules; prefer named exports.
