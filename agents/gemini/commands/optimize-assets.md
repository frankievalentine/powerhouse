---
description: Optimize images and other assets for web performance
---

Analyze and optimize assets for better performance.

## Steps

1. Find large images:

```
find . -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | xargs ls -lh | sort -k5 -h -r | head -20
```

2. Check for non-optimized images:
   - Images larger than 200KB for web use
   - Images not using modern formats (WebP/AVIF)
   - Images without appropriate sizing

3. Recommendations:
   - Use Next.js `<Image>` component for automatic optimization
   - Convert large PNGs/JPGs to WebP
   - Add `priority` prop to LCP images
   - Use appropriate `sizes` attribute for responsive images

4. Update image usage:

```tsx
import Image from "next/image";

<Image
  src="/hero.jpg"
  alt="Description"
  width={800}
  height={600}
  priority // For above-the-fold images
  placeholder="blur"
/>;
```

5. Verify bundle size:

```
ANALYZE=true npm run build
```
