---
description: Analyze and improve test coverage for a codebase
---

# Test Coverage Workflow

Follow these steps to analyze current test coverage and improve it.

## Step 1: Generate Coverage Report

```bash
# Run tests with coverage
npm test -- --coverage

# For specific paths
npm test -- --coverage --collectCoverageFrom='src/**/*.{ts,tsx}'
```

## Step 2: Analyze Coverage Report

The coverage report shows:

- **Statements**: % of statements executed
- **Branches**: % of conditional branches taken
- **Functions**: % of functions called
- **Lines**: % of lines executed

### Coverage Targets

| Level     | Statements | Branches | Functions | Lines |
| --------- | ---------- | -------- | --------- | ----- |
| Minimum   | 60%        | 50%      | 60%       | 60%   |
| Good      | 80%        | 75%      | 80%       | 80%   |
| Excellent | 90%+       | 85%+     | 90%+      | 90%+  |

## Step 3: Identify Gaps

Review uncovered code:

```bash
# Open HTML coverage report
open coverage/lcov-report/index.html
```

Look for:

1. **Untested functions** - Functions never called in tests
2. **Untested branches** - if/else paths not covered
3. **Edge cases** - Error handling, empty states
4. **Integration gaps** - Components not tested together

## Step 4: Prioritize Test Addition

Priority order for new tests:

1. **Critical business logic** - Auth, payments, data validation
2. **High-traffic code paths** - Most used features
3. **Recently changed code** - New features, bug fixes
4. **Complex logic** - Algorithms, state machines
5. **Error handling** - Edge cases, failure modes

## Step 5: Write Missing Tests

### Unit Tests for Functions

```tsx
// src/lib/utils.test.ts
import { formatCurrency, validateEmail } from "./utils";

describe("formatCurrency", () => {
  it("formats positive numbers correctly", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles negative numbers", () => {
    expect(formatCurrency(-50)).toBe("-$50.00");
  });
});

describe("validateEmail", () => {
  it("returns true for valid emails", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  it("returns false for invalid emails", () => {
    expect(validateEmail("not-an-email")).toBe(false);
    expect(validateEmail("")).toBe(false);
  });
});
```

### Component Tests

```tsx
// src/components/Button/Button.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders children correctly", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: /click me/i }),
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows loading state", () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });
});
```

### Integration Tests

```tsx
// src/features/auth/LoginForm.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("submits with valid credentials", async () => {
    const onSuccess = jest.fn();
    render(<LoginForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText(/email/i), "user@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("shows error for invalid credentials", async () => {
    render(<LoginForm onSuccess={jest.fn()} />);

    await userEvent.type(screen.getByLabelText(/email/i), "wrong@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
```

## Step 6: Add Edge Case Tests

```tsx
describe('UserProfile', () => {
  // Happy path
  it('displays user information', () => { ... });

  // Edge cases
  it('handles missing avatar gracefully', () => { ... });
  it('truncates long names', () => { ... });
  it('shows placeholder for loading state', () => { ... });

  // Error cases
  it('displays error message when fetch fails', () => { ... });
  it('retries on network error', () => { ... });
});
```

## Step 7: Verify Coverage Improvement

```bash
# Re-run coverage
npm test -- --coverage

# Compare with previous
# Check that coverage has improved in target areas
```

## Step 8: Add Coverage Enforcement

Update `jest.config.js`:

```js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Require higher coverage for critical paths
    "./src/lib/auth/**/*.ts": {
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
};
```

## Checklist

- [ ] Coverage report generated
- [ ] Low-coverage areas identified
- [ ] Critical paths prioritized
- [ ] Unit tests for utilities
- [ ] Component tests added
- [ ] Integration tests for features
- [ ] Edge cases covered
- [ ] Error handling tested
- [ ] Coverage thresholds set
- [ ] CI enforces coverage
