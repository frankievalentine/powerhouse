---
name: web-performance
description: Web performance optimization expertise for Core Web Vitals (LCP, INP, CLS), bundle optimization, image optimization, caching strategies, and runtime performance analysis.
---

# Web Performance Expert

You are a web performance expert providing guidance on optimizing Core Web Vitals, reducing bundle sizes, implementing efficient loading strategies, and improving runtime performance.

## Core Web Vitals

### LCP (Largest Contentful Paint) - < 2.5s

The largest visible content element should load within 2.5 seconds.

**Common Causes of Poor LCP:**

- Slow server response times
- Render-blocking resources
- Slow resource load times
- Client-side rendering

**Solutions:**

```tsx
// ✅ Preload critical images
// In Next.js, use priority prop
import Image from "next/image";

export function HeroImage() {
  return (
    <Image
      src="/hero.jpg"
      alt="Hero"
      width={1200}
      height={600}
      priority // Preloads this image
      fetchPriority="high"
    />
  );
}

// ✅ Preload fonts
// In Next.js layout
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap", // Prevents invisible text
});
```

```html
<!-- Preload critical resources in <head> -->
<link
  rel="preload"
  href="/fonts/inter.woff2"
  as="font"
  type="font/woff2"
  crossorigin
/>
<link rel="preload" href="/hero.jpg" as="image" />

<!-- Preconnect to required origins -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

### INP (Interaction to Next Paint) - < 200ms

Time from user interaction to visual feedback should be under 200ms.

**Solutions:**

```tsx
// ✅ Use transitions for optimistic updates
"use client";

import { useTransition } from "react";

export function LikeButton({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition();
  const [liked, setLiked] = useState(false);

  const handleClick = () => {
    // Immediate visual feedback
    setLiked(!liked);

    // Background update
    startTransition(async () => {
      await toggleLike(postId);
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={liked ? "text-red-500" : "text-gray-500"}
    >
      {liked ? "❤️" : "🤍"}
    </button>
  );
}
```

```tsx
// ✅ Debounce expensive operations
import { useDeferredValue } from "react";

export function SearchResults({ query }: { query: string }) {
  // Defers re-rendering of results while typing
  const deferredQuery = useDeferredValue(query);

  return <Results query={deferredQuery} />;
}
```

```tsx
// ✅ Break up long tasks
const processLargeList = async (items: Item[]) => {
  const BATCH_SIZE = 100;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    processBatch(batch);

    // Yield to main thread between batches
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};
```

### CLS (Cumulative Layout Shift) - < 0.1

Visual stability - elements shouldn't shift unexpectedly.

**Solutions:**

```tsx
// ✅ Always specify dimensions for images
<Image
  src="/photo.jpg"
  alt="Photo"
  width={400}
  height={300}
/>

// ✅ Reserve space for dynamic content
<div className="min-h-[200px]">
  {isLoading ? <Skeleton /> : <Content />}
</div>

// ✅ Use aspect-ratio for responsive containers
<div className="aspect-video w-full">
  <video src="/video.mp4" className="w-full h-full object-cover" />
</div>
```

```css
/* Prevent font swap layout shift */
@font-face {
  font-family: "Inter";
  src: url("/fonts/inter.woff2") format("woff2");
  font-display: swap;
  /* Use size-adjust to minimize CLS */
  size-adjust: 100%;
  ascent-override: 95%;
  descent-override: 20%;
}
```

## Bundle Optimization

### Analyze Bundle Size

```bash
# Next.js bundle analyzer
npm install @next/bundle-analyzer

# Add to next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer({
  // your config
});

# Run analysis
ANALYZE=true npm run build
```

### Code Splitting

```tsx
// ✅ Dynamic imports for route-based splitting (automatic in Next.js)
// Each page is automatically a separate chunk

// ✅ Component-level code splitting
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("@/components/Chart"), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Don't render on server if not needed
});

// ✅ Conditional loading
const AdminPanel = dynamic(() => import("@/components/AdminPanel"), {
  loading: () => <div>Loading admin...</div>,
});

export function Dashboard({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div>
      <UserStats />
      {isAdmin && <AdminPanel />}
    </div>
  );
}
```

### Tree Shaking

```tsx
// ❌ Bad - imports entire library
import _ from "lodash";
const result = _.debounce(fn, 300);

// ✅ Good - imports only what's needed
import debounce from "lodash/debounce";
const result = debounce(fn, 300);

// ✅ Even better - use native or smaller alternatives
import { debounce } from "@/lib/utils";
```

### Optimize Dependencies

```bash
# Find large dependencies
npx bundle-phobia package-name

# Check for duplicates
npx depcheck

# Analyze import cost in VS Code
# Install "Import Cost" extension
```

## Image Optimization

### Next.js Image Component

```tsx
import Image from 'next/image';

// ✅ Responsive image
<Image
  src="/hero.jpg"
  alt="Hero image"
  fill
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  className="object-cover"
  priority  // For above-the-fold images
/>

// ✅ Fixed size with blur placeholder
<Image
  src="/product.jpg"
  alt="Product"
  width={400}
  height={400}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>
```

### Image Formats

```tsx
// next.config.js
module.exports = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};
```

### Lazy Loading

```tsx
// ✅ Native lazy loading for below-fold images
<Image
  src="/gallery-image.jpg"
  alt="Gallery"
  width={600}
  height={400}
  loading="lazy" // Default behavior
/>;

// ✅ Intersection Observer for custom lazy loading
("use client");

import { useInView } from "react-intersection-observer";

export function LazySection() {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  return <div ref={ref}>{inView ? <HeavyContent /> : <Placeholder />}</div>;
}
```

## Caching Strategies

### HTTP Caching Headers

```tsx
// Next.js Route Handler with caching
export async function GET() {
  const data = await fetchData();

  return Response.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
```

### Static Asset Caching

```tsx
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};
```

### Data Caching in Next.js

```tsx
// ✅ Cache with revalidation
async function getPosts() {
  const res = await fetch("https://api.example.com/posts", {
    next: { revalidate: 3600 }, // Revalidate every hour
  });
  return res.json();
}

// ✅ Cache with tags for on-demand revalidation
async function getProduct(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`, {
    next: { tags: [`product-${id}`] },
  });
  return res.json();
}

// Revalidate when product is updated
import { revalidateTag } from "next/cache";

export async function updateProduct(id: string) {
  await db.products.update(id);
  revalidateTag(`product-${id}`);
}
```

## Runtime Performance

### React Performance Patterns

```tsx
// ✅ Memoize expensive computations
import { useMemo } from "react";

function ProductList({ products, filter }: Props) {
  const filteredProducts = useMemo(
    () => products.filter((p) => p.category === filter),
    [products, filter],
  );

  return <List items={filteredProducts} />;
}

// ✅ Memoize callbacks for child components
import { useCallback } from "react";

function Parent() {
  const handleClick = useCallback((id: string) => {
    // handle click
  }, []);

  return <Child onClick={handleClick} />;
}

// ✅ Memoize components that render often
import { memo } from "react";

const ExpensiveComponent = memo(function ExpensiveComponent({ data }: Props) {
  // expensive render
  return <div>{/* ... */}</div>;
});
```

### Virtualization for Large Lists

```tsx
// Using @tanstack/react-virtual
import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualList({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[500px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ListItem item={items[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Performance Monitoring

### Web Vitals Tracking

```tsx
// app/layout.tsx
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
```

### Custom Performance Marks

```tsx
// Measure specific operations
performance.mark("data-fetch-start");

const data = await fetchData();

performance.mark("data-fetch-end");
performance.measure("data-fetch", "data-fetch-start", "data-fetch-end");

// Log measurements
const [measure] = performance.getEntriesByName("data-fetch");
console.log(`Data fetch took ${measure.duration}ms`);
```

## Quick Wins Checklist

- [ ] Enable gzip/brotli compression
- [ ] Use modern image formats (WebP/AVIF)
- [ ] Lazy load below-fold images
- [ ] Preload critical resources
- [ ] Remove unused CSS/JS
- [ ] Use font-display: swap
- [ ] Minimize third-party scripts
- [ ] Enable HTTP/2 or HTTP/3
- [ ] Use a CDN for static assets
- [ ] Implement proper caching headers

## Best Practices Summary

1. **Measure first** - Use Lighthouse, Web Vitals, before optimizing
2. **Optimize LCP** - Preload critical images and fonts
3. **Reduce INP** - Use transitions, debounce, break long tasks
4. **Prevent CLS** - Always specify dimensions, reserve space
5. **Code split** - Dynamic imports for large components
6. **Optimize images** - Use Next.js Image, modern formats
7. **Cache aggressively** - Static assets, API responses
8. **Virtualize lists** - For large data sets
9. **Monitor continuously** - Track Web Vitals in production
10. **Ship less JavaScript** - Prefer Server Components
