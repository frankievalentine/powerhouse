---
description: Check and improve accessibility of the current component or page
---

Audit and improve accessibility for the current code.

## Steps

1. Review the code for common accessibility issues:
   - Missing alt text on images
   - Missing labels on form inputs
   - Missing ARIA attributes on interactive elements
   - Improper heading hierarchy
   - Missing keyboard navigation

2. Check for:

### Images

```tsx
// ❌ Bad
<img src="/photo.jpg" />

// ✅ Good
<Image src="/photo.jpg" alt="Description of the image" />
```

### Form Inputs

```tsx
// ❌ Bad
<input type="email" />

// ✅ Good
<label htmlFor="email">Email</label>
<input id="email" type="email" aria-describedby="email-hint" />
<p id="email-hint">We'll never share your email</p>
```

### Interactive Elements

```tsx
// ❌ Bad
<div onClick={handleClick}>Click me</div>

// ✅ Good
<button onClick={handleClick}>Click me</button>

// Or if must use div:
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Click me
</div>
```

### Headings

```tsx
// ❌ Bad - skipped levels
<h1>Title</h1>
<h4>Subsection</h4>

// ✅ Good - proper hierarchy
<h1>Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
```

3. Add screen reader text where needed:

```tsx
<span className="sr-only">Additional context for screen readers</span>
```

4. Test with keyboard navigation (Tab, Enter, Escape, Arrow keys)

5. Run accessibility linting if available:

```
npm run lint
```
