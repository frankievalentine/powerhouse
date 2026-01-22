---
description: Create a new React/Next.js component with TypeScript, proper structure, and accessibility
---

# Component Creation Workflow

Follow these steps to create a new component following best practices.

## Step 1: Plan the Component

Before creating, consider:

1. **Purpose**: What does this component do?
2. **Props**: What inputs does it need?
3. **Variants**: Does it have different states/styles?
4. **Accessibility**: What ARIA attributes are needed?
5. **Server or Client**: Can it be a Server Component?

## Step 2: Create Component File

### For Server Components (default):

Create `src/components/<component-name>/<component-name>.tsx`:

```tsx
interface <ComponentName>Props {
  // Define props with JSDoc comments
  /** Primary content */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export function <ComponentName>({ children, className }: <ComponentName>Props) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
```

### For Client Components:

```tsx
'use client';

import { useState } from 'react';

interface <ComponentName>Props {
  // Props
}

export function <ComponentName>({ ...props }: <ComponentName>Props) {
  const [state, setState] = useState();

  const handleEvent = () => {
    // Event handler
  };

  return (
    <div>
      {/* Component content */}
    </div>
  );
}
```

## Step 3: Add Accessibility

Ensure the component is accessible:

```tsx
export function Button({
  children,
  isLoading,
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      aria-disabled={disabled}
      {...props}
    >
      {isLoading && (
        <>
          <Spinner aria-hidden="true" />
          <span className="sr-only">Loading...</span>
        </>
      )}
      <span aria-hidden={isLoading}>{children}</span>
    </button>
  );
}
```

## Step 4: Add Styling with Tailwind/CVA

Use class-variance-authority for variants:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-11 px-8 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

## Step 5: Create Index Export

Create `src/components/<component-name>/index.ts`:

```tsx
export { <ComponentName> } from './<component-name>';
export type { <ComponentName>Props } from './<component-name>';
```

Update `src/components/index.ts`:

```tsx
export { <ComponentName> } from './<component-name>';
```

## Step 6: Create Tests

Create `src/components/<component-name>/<component-name>.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { <ComponentName> } from './<component-name>';

describe('<ComponentName>', () => {
  it('renders correctly', () => {
    render(<<ComponentName>>Content</<ComponentName>>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    render(<<ComponentName> onClick={handleClick}>Click me</<ComponentName>>);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is accessible', () => {
    const { container } = render(<<ComponentName> />);
    // Run axe accessibility checks if configured
  });
});
```

## Step 7: Run Verification

```bash
# Type check
npm run type-check

# Run tests
npm test -- --testPathPattern="<component-name>"

# Run linter
npm run lint

# Run dev to visually verify
npm run dev
```

## Step 8: Document Usage

Add JSDoc comments to the component:

````tsx
/**
 * A button component with multiple variants and sizes.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="lg">
 *   Click me
 * </Button>
 * ```
 */
export function Button({ ... }: ButtonProps) {
  // ...
}
````

## Checklist

- [ ] Component follows naming conventions
- [ ] Props are properly typed
- [ ] Accessibility attributes included
- [ ] Keyboard navigation works
- [ ] Variants use CVA or similar
- [ ] Exported from index
- [ ] Tests pass
- [ ] No lint errors
- [ ] Visually verified
