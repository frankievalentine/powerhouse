# GitHub Copilot Instructions

This repository uses a modern web development stack. Follow these guidelines when generating code.

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Testing**: Jest + React Testing Library

## Code Style

### TypeScript

- Always use strict TypeScript - no `any` types
- Prefer interfaces for object shapes, types for unions
- Use proper type inference, explicit types for function signatures
- Use discriminated unions for state management

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

// ✅ Good - discriminated union
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };
```

### React/Next.js

- Default to Server Components (no 'use client' unless needed)
- Use Server Actions for form handling and mutations
- Colocate data fetching with components
- Always implement loading and error states

```tsx
// ✅ Server Component (default)
export default async function Page() {
  const data = await fetchData();
  return <div>{data.title}</div>;
}

// ✅ Client Component (only when needed)
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

### Styling

- Use Tailwind CSS utility classes
- Follow shadcn/ui component patterns
- Support dark mode with CSS variables
- Use mobile-first responsive design

### Accessibility

- Use semantic HTML elements
- Include proper ARIA attributes
- Ensure keyboard navigation works
- Provide alt text for images

```tsx
// ✅ Good
<button 
  onClick={handleClick}
  aria-label="Close dialog"
  className="focus:ring-2 focus:ring-primary"
>
  <XIcon aria-hidden="true" />
</button>
```

### Naming Conventions

- **Components**: PascalCase (`UserProfile.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: SCREAMING_SNAKE_CASE
- **Event handlers**: prefix with `handle` (`handleSubmit`, `handleClick`)

### File Structure

```
src/
├── app/                 # App Router pages
├── components/
│   ├── ui/             # shadcn/ui components
│   └── [feature]/      # Feature components
├── lib/                # Utilities
└── types/              # TypeScript types
```

## Testing

When generating tests:

- Use Jest and React Testing Library
- Test user behavior, not implementation
- Include accessibility checks
- Cover happy path and edge cases

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('Button', () => {
  it('handles click events', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });
});
```

## Commit Messages

Follow conventional commits:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance
