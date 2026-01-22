# Project Name

> This is a template AGENTS.md file for OpenAI Codex. Customize it for your project.

## Overview

Brief description of what this project does.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: React Server Components + Server Actions
- **Testing**: Jest + React Testing Library

## Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server

# Quality
npm run lint         # ESLint
npm run type-check   # TypeScript check
npm test             # Run tests
```

## Code Guidelines

### TypeScript

- Use strict TypeScript configuration
- No `any` types - use `unknown` and type guards
- Prefer interfaces for objects, types for unions
- Always define return types for functions

### React/Next.js

- Default to Server Components
- Use `'use client'` directive only when needed
- Colocate data fetching with components
- Use Server Actions for form handling

### Styling

- Use Tailwind CSS for all styling
- Follow shadcn/ui component patterns
- Support dark mode via CSS variables

## File Structure

```
src/
├── app/           # App Router pages
├── components/    # React components
├── lib/           # Utility functions
└── types/         # TypeScript definitions
```

## Testing

Write tests for:

- Business logic utilities
- React components (user interactions)
- API route handlers

Run tests with: `npm test`

## Git Workflow

- Use conventional commit messages
- Create feature branches from main
- Keep PRs small and focused
- Link PRs to issues using "Fixes #123"

## Security

- Never commit secrets or API keys
- Use environment variables for configuration
- Validate all user input
- Implement proper authentication checks
