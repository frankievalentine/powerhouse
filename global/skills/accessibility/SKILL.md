---
name: accessibility
description: Web accessibility expertise covering ARIA patterns, semantic HTML, keyboard navigation, screen reader support, and WCAG 2.1 compliance for inclusive web applications.
---

# Web Accessibility Expert

You are a web accessibility expert providing guidance on building inclusive web applications that work for everyone, following WCAG 2.1 guidelines and best practices.

## Core Principles (POUR)

1. **Perceivable** - Users must be able to perceive the content
2. **Operable** - Users must be able to operate the interface
3. **Understandable** - Content and operation must be understandable
4. **Robust** - Content must work with assistive technologies

## Semantic HTML

### Use the Right Elements

```tsx
// ❌ Bad - div soup
<div class="header">
  <div class="nav">
    <div class="link" onclick="navigate()">Home</div>
  </div>
</div>

// ✅ Good - semantic HTML
<header>
  <nav>
    <a href="/">Home</a>
  </nav>
</header>
```

### Heading Hierarchy

```tsx
// ✅ Good - proper heading order
<main>
  <h1>Page Title</h1>

  <section>
    <h2>Section Title</h2>
    <p>Content...</p>

    <h3>Subsection</h3>
    <p>More content...</p>
  </section>

  <section>
    <h2>Another Section</h2>
  </section>
</main>

// ❌ Bad - skipped heading levels
<h1>Title</h1>
<h4>Subsection</h4>  // Skipped h2 and h3
```

### Landmarks

```tsx
<body>
  <header>
    <nav aria-label="Main navigation">...</nav>
  </header>

  <main>
    <article>...</article>
    <aside aria-label="Related content">...</aside>
  </main>

  <footer>...</footer>
</body>
```

## ARIA Patterns

### When to Use ARIA

```tsx
// First rule of ARIA: Don't use ARIA if you can use native HTML

// ❌ Unnecessary ARIA
<div role="button" tabindex="0" onclick="handleClick">
  Click me
</div>

// ✅ Use native HTML instead
<button onClick={handleClick}>
  Click me
</button>

// ✅ Use ARIA when native HTML isn't enough
<div
  role="tablist"
  aria-label="Product tabs"
>
  <button role="tab" aria-selected="true">Details</button>
  <button role="tab" aria-selected="false">Reviews</button>
</div>
```

### Common ARIA Attributes

```tsx
// Labels and descriptions
<button aria-label="Close dialog">
  <XIcon />
</button>

<input
  aria-describedby="password-hint"
  type="password"
/>
<p id="password-hint">Must be at least 8 characters</p>

// States
<button aria-pressed="true">Toggle</button>
<button aria-expanded="false">Menu</button>
<div aria-busy="true">Loading...</div>
<input aria-invalid="true" />

// Live regions (for dynamic content)
<div aria-live="polite" role="status">
  Form submitted successfully
</div>

<div aria-live="assertive" role="alert">
  Error: Please fix the following issues
</div>
```

### Modal Dialog Pattern

```tsx
"use client";

import { useEffect, useRef } from "react";

export function Dialog({ isOpen, onClose, title, children }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Save current focus
      previousFocus.current = document.activeElement as HTMLElement;

      // Focus dialog
      dialogRef.current?.focus();

      // Trap focus
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }

        if (e.key === "Tab") {
          // Focus trap logic here
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    } else {
      // Restore focus
      previousFocus.current?.focus();
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        tabIndex={-1}
        className="fixed inset-0 flex items-center justify-center"
      >
        <div className="bg-white rounded-lg p-6 max-w-md">
          <h2 id="dialog-title">{title}</h2>
          <div id="dialog-description">{children}</div>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}
```

### Tabs Pattern

```tsx
"use client";

import { useState } from "react";

export function Tabs({ tabs }: { tabs: TabItem[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    switch (e.key) {
      case "ArrowRight":
        setActiveIndex((index + 1) % tabs.length);
        break;
      case "ArrowLeft":
        setActiveIndex((index - 1 + tabs.length) % tabs.length);
        break;
      case "Home":
        setActiveIndex(0);
        break;
      case "End":
        setActiveIndex(tabs.length - 1);
        break;
    }
  };

  return (
    <div>
      <div role="tablist" aria-label="Content tabs">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={index === activeIndex}
            aria-controls={`panel-${tab.id}`}
            tabIndex={index === activeIndex ? 0 : -1}
            onClick={() => setActiveIndex(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={index !== activeIndex}
          tabIndex={0}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
```

## Keyboard Navigation

### Interactive Elements

```tsx
// ✅ All interactive elements must be keyboard accessible
<button onClick={handleClick}>
  Click me
</button>

// For custom interactive elements, add keyboard support
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Custom button
</div>
```

### Skip Links

```tsx
// Add skip link for keyboard users
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-white focus:text-black"
    >
      Skip to main content
    </a>
  );
}

// In your layout
<body>
  <SkipLink />
  <header>...</header>
  <main id="main-content" tabIndex={-1}>
    ...
  </main>
</body>;
```

### Focus Visible Styles

```css
/* Always provide visible focus indicators */
:focus-visible {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

/* Remove default outline only if custom focus is provided */
:focus:not(:focus-visible) {
  outline: none;
}
```

## Forms

### Labels and Error Messages

```tsx
export function FormField({
  id,
  label,
  error,
  hint,
  required,
  ...props
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {required && <span className="sr-only"> (required)</span>}
      </label>

      <input
        id={id}
        aria-describedby={
          `${hint ? hintId : ""} ${error ? errorId : ""}`.trim() || undefined
        }
        aria-invalid={!!error}
        aria-required={required}
        {...props}
      />

      {hint && (
        <p id={hintId} className="hint">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Form Validation

```tsx
"use client";

export function SignupForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validateForm();

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);

      // Announce errors to screen readers
      const errorSummary = Object.values(newErrors).join(". ");
      announceToScreenReader(`Form has errors: ${errorSummary}`);

      // Focus first invalid field
      const firstErrorField = formRef.current?.querySelector(
        '[aria-invalid="true"]',
      );
      (firstErrorField as HTMLElement)?.focus();
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate>
      {/* Error summary for many errors */}
      {Object.keys(errors).length > 0 && (
        <div role="alert" aria-labelledby="error-summary">
          <h2 id="error-summary">Please fix the following errors:</h2>
          <ul>
            {Object.entries(errors).map(([field, message]) => (
              <li key={field}>
                <a href={`#${field}`}>{message}</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Form fields */}
    </form>
  );
}
```

## Images and Media

### Alternative Text

```tsx
// ✅ Informative images need descriptive alt text
<Image
  src="/chart.png"
  alt="Bar chart showing sales growth of 25% in Q4 2024"
/>

// ✅ Decorative images should have empty alt
<Image
  src="/decorative-border.png"
  alt=""
  role="presentation"
/>

// ✅ Complex images need extended descriptions
<figure>
  <Image
    src="/complex-infographic.png"
    alt="Product lifecycle overview"
    aria-describedby="infographic-desc"
  />
  <figcaption id="infographic-desc">
    Detailed description of the infographic showing...
  </figcaption>
</figure>
```

### Video and Audio

```tsx
// ✅ Provide captions and transcripts
<video controls>
  <source src="/video.mp4" type="video/mp4" />
  <track
    kind="captions"
    src="/captions.vtt"
    srcLang="en"
    label="English"
    default
  />
  <track
    kind="descriptions"
    src="/descriptions.vtt"
    srcLang="en"
    label="Audio Description"
  />
</video>

<a href="/transcript.html">Read transcript</a>
```

## Color and Contrast

### Minimum Contrast Ratios

- **Normal text**: 4.5:1 (WCAG AA)
- **Large text (18px+ or 14px+ bold)**: 3:1
- **UI components and graphics**: 3:1

```css
/* ✅ Good contrast */
.text {
  color: #1a1a1a; /* Dark gray on white = 16:1 */
  background: #ffffff;
}

/* ❌ Bad contrast */
.low-contrast {
  color: #999999; /* Light gray on white = 2.8:1 */
  background: #ffffff;
}
```

### Don't Rely on Color Alone

```tsx
// ❌ Bad - only color indicates error
<input className={hasError ? 'border-red' : 'border-gray'} />

// ✅ Good - multiple indicators
<input
  className={hasError ? 'border-red' : 'border-gray'}
  aria-invalid={hasError}
/>
{hasError && (
  <p className="error">
    <ErrorIcon /> Error: Invalid email format
  </p>
)}
```

## Screen Reader Utilities

```tsx
// Visually hidden but accessible to screen readers
<span className="sr-only">
  Opens in new tab
</span>

// CSS for sr-only
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

// Live region for announcements
export function useAnnounce() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', priority);
    el.setAttribute('aria-atomic', 'true');
    el.className = 'sr-only';
    el.textContent = message;
    document.body.appendChild(el);

    setTimeout(() => el.remove(), 1000);
  }, []);

  return announce;
}
```

## Testing Checklist

- [ ] Navigate with keyboard only (Tab, Enter, Space, Arrows, Escape)
- [ ] Test with screen reader (VoiceOver, NVDA, JAWS)
- [ ] Check color contrast with tools
- [ ] Verify focus indicators are visible
- [ ] Test at 200% zoom
- [ ] Validate with axe DevTools
- [ ] Test reduced motion preference
- [ ] Verify form error handling
- [ ] Check alt text on all images
- [ ] Test with different input methods

## Best Practices Summary

1. **Use semantic HTML** - Elements convey meaning
2. **Provide keyboard access** - All interactions via keyboard
3. **Label everything** - Forms, buttons, images
4. **Manage focus** - Logical focus order, visible indicators
5. **Announce changes** - Live regions for dynamic content
6. **Sufficient contrast** - 4.5:1 for text, 3:1 for UI
7. **Don't rely on color** - Use multiple indicators
8. **Test with assistive tech** - Screen readers, keyboard
9. **Provide alternatives** - Captions, transcripts, alt text
10. **Follow WCAG** - Meet at least AA level
