---
invokable: true
---

# Generate Tests

Generate comprehensive tests for the selected code using Jest and React Testing Library.

## Test Generation Guidelines

### For Functions/Utilities

```typescript
describe("functionName", () => {
  // Happy path
  it("should handle normal input correctly", () => {});

  // Edge cases
  it("should handle empty input", () => {});
  it("should handle null/undefined", () => {});

  // Error cases
  it("should throw on invalid input", () => {});
});
```

### For React Components

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ComponentName", () => {
  // Rendering
  it("renders correctly with default props", () => {});
  it("renders correctly with all props", () => {});

  // Interactions
  it("handles click events", async () => {});
  it("handles form submission", async () => {});

  // States
  it("shows loading state", () => {});
  it("shows error state", () => {});

  // Accessibility
  it("has accessible name", () => {});
  it("supports keyboard navigation", () => {});
});
```

### Testing Best Practices

- Test behavior, not implementation
- Use accessible queries (getByRole, getByLabelText)
- Test user interactions with userEvent
- Mock external dependencies
- Test error boundaries
