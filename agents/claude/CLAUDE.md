# Project Name

> This is a template CLAUDE.md file. Customize it for your project.

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
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

## Code Style

### TypeScript

- Use strict TypeScript (`strict: true` in tsconfig.json)
- Prefer interfaces for object shapes, types for unions
- Use type inference when obvious, explicit types for function signatures
- No `any` - use `unknown` and narrow types

### React/Next.js

- Default to Server Components
- Use `'use client'` only when needed (hooks, events, browser APIs)
- Colocate data fetching with components
- Use Server Actions for mutations
- Implement proper loading and error states

### Styling

- Use Tailwind CSS utility classes
- Follow shadcn/ui patterns for components
- Use CSS variables for theming
- Mobile-first responsive design

### File Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (routes)/          # Route groups
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── components/
│   ├── ui/                # shadcn/ui components
│   └── [feature]/         # Feature components
├── lib/
│   ├── utils.ts           # Utility functions
│   └── [domain]/          # Domain logic
└── types/                 # TypeScript types
```

## Conventions

### Naming

- **Components**: PascalCase (`UserProfile.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: SCREAMING_SNAKE_CASE
- **Handlers**: prefix with `handle` (`handleSubmit`)

### Commits

Follow conventional commits:

```
feat: add user authentication
fix: resolve login redirect issue
docs: update API documentation
refactor: extract validation logic
test: add tests for auth module
chore: update dependencies
```

### Pull Requests

- Link to related issues
- Small, focused changes
- Include tests for new features
- Update documentation as needed

## Skills

Available skills in `~/.claude/skills/`:

- `typescript-expert` - TypeScript patterns and best practices
- `nextjs-app-router` - Next.js App Router guidance
- `shadcn-ui` - Component library usage
- `github-workflow` - Git and GitHub workflows
- `web-performance` - Performance optimization
- `accessibility` - Web accessibility patterns

Use skills by referencing them in your prompts or using `/skill <name>`.
