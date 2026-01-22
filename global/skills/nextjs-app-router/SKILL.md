---
name: nextjs-app-router
description: Next.js App Router expertise including Server Components, Server Actions, data fetching strategies, caching, routing patterns, and performance optimization for production applications.
---

# Next.js App Router Expert

You are a Next.js App Router expert providing guidance on building production-ready full-stack web applications with React Server Components, Server Actions, and modern data fetching patterns.

## Core Concepts

### Server vs Client Components

```tsx
// Server Component (default) - runs on server only
// ✅ Can: fetch data, access backend, use secrets, reduce bundle size
// ❌ Cannot: use hooks, browser APIs, event handlers
export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await getProduct(params.id); // Direct data access

  return (
    <div>
      <h1>{product.name}</h1>
      <AddToCartButton productId={product.id} /> {/* Client component */}
    </div>
  );
}
```

```tsx
// Client Component - add 'use client' directive
"use client";

import { useState } from "react";

export function AddToCartButton({ productId }: { productId: string }) {
  const [isAdding, setIsAdding] = useState(false);

  const handleClick = async () => {
    setIsAdding(true);
    await addToCart(productId);
    setIsAdding(false);
  };

  return (
    <button onClick={handleClick} disabled={isAdding}>
      {isAdding ? "Adding..." : "Add to Cart"}
    </button>
  );
}
```

### When to Use Client Components

Use `'use client'` when you need:

- React hooks (`useState`, `useEffect`, `useContext`, etc.)
- Browser APIs (`window`, `document`, `localStorage`)
- Event handlers (`onClick`, `onChange`, etc.)
- Class components
- Libraries that use any of the above

## Data Fetching Patterns

### Static Data (Cached Until Revalidation)

```tsx
// Default behavior - cached until manually invalidated
async function getProduct(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`);
  // Equivalent to: { cache: 'force-cache' }
  return res.json();
}
```

### Dynamic Data (No Caching)

```tsx
// Fresh data on every request
async function getCurrentUser() {
  const res = await fetch("https://api.example.com/user", {
    cache: "no-store",
  });
  return res.json();
}
```

### Time-Based Revalidation

```tsx
// Revalidate every 60 seconds
async function getPosts() {
  const res = await fetch("https://api.example.com/posts", {
    next: { revalidate: 60 },
  });
  return res.json();
}
```

### Tag-Based Revalidation

```tsx
// Fetch with tags
async function getProduct(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`, {
    next: { tags: [`product-${id}`, "products"] },
  });
  return res.json();
}

// Revalidate by tag (in Server Action)
import { revalidateTag } from "next/cache";

export async function updateProduct(id: string, data: FormData) {
  await db.products.update(id, data);
  revalidateTag(`product-${id}`);
}
```

## Server Actions

### Form Handling

```tsx
// app/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createPost(formData: FormData) {
  const title = formData.get("title") as string;
  const content = formData.get("content") as string;

  // Validate
  if (!title || title.length < 3) {
    return { error: "Title must be at least 3 characters" };
  }

  // Create in database
  const post = await db.posts.create({ title, content });

  // Revalidate and redirect
  revalidatePath("/posts");
  redirect(`/posts/${post.id}`);
}
```

```tsx
// app/posts/new/page.tsx
import { createPost } from "@/app/actions";

export default function NewPostPage() {
  return (
    <form action={createPost}>
      <input name="title" placeholder="Title" required />
      <textarea name="content" placeholder="Content" />
      <button type="submit">Create Post</button>
    </form>
  );
}
```

### Progressive Enhancement with useActionState

```tsx
"use client";

import { useActionState } from "react";
import { createPost } from "@/app/actions";

export function CreatePostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null);

  return (
    <form action={formAction}>
      <input name="title" placeholder="Title" required />
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Post"}
      </button>
    </form>
  );
}
```

## Route Handlers (API Routes)

```tsx
// app/api/posts/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const page = searchParams.get("page") ?? "1";

  const posts = await db.posts.findMany({
    skip: (parseInt(page) - 1) * 10,
    take: 10,
  });

  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const post = await db.posts.create(body);

  return NextResponse.json(post, { status: 201 });
}
```

### Dynamic Route Handlers

```tsx
// app/api/posts/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const post = await db.posts.findUnique({ where: { id: params.id } });

  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(post);
}
```

## Routing Patterns

### Parallel Routes

```
app/
├── @modal/
│   └── (.)photo/[id]/
│       └── page.tsx      # Intercepted route for modal
├── @sidebar/
│   └── default.tsx       # Sidebar content
├── layout.tsx            # Renders both slots
└── page.tsx
```

```tsx
// app/layout.tsx
export default function Layout({
  children,
  modal,
  sidebar,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="flex">
      <aside>{sidebar}</aside>
      <main>{children}</main>
      {modal}
    </div>
  );
}
```

### Route Groups

```
app/
├── (marketing)/
│   ├── layout.tsx        # Marketing layout
│   ├── page.tsx          # Home page
│   └── about/
│       └── page.tsx
├── (dashboard)/
│   ├── layout.tsx        # Dashboard layout (with auth)
│   └── dashboard/
│       └── page.tsx
```

### Loading and Error States

```tsx
// app/posts/loading.tsx
export default function Loading() {
  return <PostsSkeleton />;
}

// app/posts/error.tsx
("use client");

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}

// app/posts/not-found.tsx
export default function NotFound() {
  return <div>Post not found</div>;
}
```

## Metadata and SEO

### Static Metadata

```tsx
// app/about/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn more about our company",
  openGraph: {
    title: "About Us",
    description: "Learn more about our company",
    images: ["/og-about.png"],
  },
};
```

### Dynamic Metadata

```tsx
// app/posts/[slug]/page.tsx
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
    },
  };
}
```

## Performance Optimization

### Image Optimization

```tsx
import Image from "next/image";

export function ProductImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={600}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,..."
      priority={false} // Set true for LCP images
    />
  );
}
```

### Font Optimization

```tsx
// app/layout.tsx
import { Inter, Roboto_Mono } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto-mono",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

### Streaming with Suspense

```tsx
import { Suspense } from "react";

export default function Page() {
  return (
    <div>
      <h1>Dashboard</h1>

      {/* Shows loading state while Reviews loads */}
      <Suspense fallback={<ReviewsSkeleton />}>
        <Reviews />
      </Suspense>

      {/* These can load in parallel */}
      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>
    </div>
  );
}
```

## Best Practices Summary

1. **Default to Server Components** - Only use `'use client'` when necessary
2. **Colocate data fetching** - Fetch data in the component that needs it
3. **Use Server Actions for mutations** - Avoid API routes for form submissions
4. **Leverage caching** - Use appropriate cache strategies for your data
5. **Stream long responses** - Use Suspense to show content progressively
6. **Optimize images** - Always use next/image for automatic optimization
7. **Handle errors gracefully** - Implement error.tsx and not-found.tsx
8. **Use metadata API** - For SEO and social sharing
9. **Parallel data fetching** - Initiate fetches in parallel when possible
10. **Route segments** - Use loading.tsx for instant loading states
