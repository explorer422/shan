# Technical Architecture & System Specification

## 1. Executive Summary

This document specifies the target production architecture for "山 / SHAN —
Notes along the way", a personal publishing website for one author. The
architecture transitions the publication from a client-side prototype to a
robust Static Site Generation (SSG) system powered by Astro 5, TypeScript
strict mode, Tailwind CSS, Astro Content Collections, and an R2-First media
architecture with strict Git isolation.

Core Principle:
"Git stores code, content, and metadata. R2 stores published photographic
assets."

---

## 2. Target Technology Stack

### 2.1 Core Framework & Compiler
- **Framework**: Astro 5.x
- **Build Mode**: Pure SSG (`output: 'static'`)
- **Compilation Output**: Zero client-side JavaScript for content reading.
  Pre-rendered static HTML, scoped CSS, and semantic markup in `dist/`.
- **Island Architecture**: Client-side JavaScript is strictly confined to
  lightweight interactive islands (Search Modal, Lightbox Photo Viewer, and
  Theme Switcher).

### 2.2 Language & Type Safety
- **Language**: TypeScript 5.x
- **Configuration**: Strict type checking enabled (`"strict": true` in
  `tsconfig.json`).
- **Validation**: Runtime frontmatter validation via Zod schemas embedded in
  the Astro Content Layer.

### 2.3 Styling & Design System Parity
- **CSS Architecture**: Tailwind CSS with custom theme extensions mirroring
  the prototype's CSS variables (`--bg`, `--paper`, `--text`, etc.).
- **Typography Integration**: `@tailwindcss/typography` configured for prose
  layout, styled to match editorial serif typography.
- **Dark Mode**: Class-based strategy (`darkMode: 'class'`), matching
  `body.dark` in the prototype.
- **Font Hosting**: Self-hosted WOFF2 font files via `@fontsource` packages
  (`@fontsource/dm-sans`, `@fontsource/noto-serif-tc`,
  `@fontsource/noto-serif-jp`), eliminating external font CDNs and tracking.

### 2.4 Media Processing Engine & Storage
- **Processing Engine**: Node.js + `sharp` + `exif-reader`
- **Output Formats**: Responsive WebP and AVIF variants (400w, 800w, 1600w),
  plus 1:1 square thumbnails and blurred LQIP placeholders.
- **Privacy Enforcement**: Automated orientation correction before stripping
  GPS coordinates, camera serial numbers, and owner identifiers.
- **Production Media Store**: Cloudflare R2 Standard Storage (S3-compatible).
- **Media Delivery**: Custom media subdomain (`https://media.example.com`)
  with edge CDN caching.

### 2.5 Hosting & Delivery
- **Website Hosting**: GitHub Pages with global CDN edge delivery.
- **Automation**: GitHub Actions CI/CD workflow building and deploying on push
  to the `main` branch.
- **Domain Strategy**: Deferred custom domain ("Plan now, purchase later").
  Dynamic base path configuration supporting either GitHub project URLs
  (`<user>.github.io/<repo>/`) or future custom apex domains.

---

## 3. Content Models & Zod Schemas

Content is managed via the Astro 5 Content Layer API (`src/content.config.ts`),
dividing entries into two primary collections: `stories` and `moments`.

### 3.1 Portable Media Item Schema
Every media asset referenced within frontmatter uses a normalized portable
schema rather than an ad-hoc string URL:

```typescript
import { z } from 'astro:content';

export const mediaItemSchema = z.object({
  // Logical identifier matching media-manifest.json
  // Example: "stories/forest-time/cover" or "moments/cedar/photo-01"
  id: z.string().describe('Logical portable media ID'),
  alt: z.string().default(''),
  caption: z.string().optional(),
  aspectRatio: z.string().optional(), // e.g. "3:2", "1:1", "16:9"
});

export type MediaItemRef = z.infer<typeof mediaItemSchema>;
```

### 3.2 Stories Collection Schema
Long-form editorial essays and stories authored in Markdown or MDX
(`src/content/stories/*.{md,mdx}`).

```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

export const storiesCollection = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/stories',
  }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    excerpt: z.string(),
    date: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    coverMedia: mediaItemSchema,
    tags: z.array(z.string()).default([]),
    lang: z.enum(['en', 'zh-Hant', 'ja']).default('en'),
    readingTime: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    relatedStories: z.array(z.string()).default([]),
  }),
});
```

### 3.3 Moments Collection Schema
Micro-journal notes and photo albums authored in Markdown
(`src/content/moments/*.{md,mdx}`).

```typescript
export const momentsCollection = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/moments',
  }),
  schema: z.object({
    title: z.string().optional(),
    date: z.coerce.date(),
    location: z.string().optional(),
    caption: z.string(),
    media: z.array(mediaItemSchema).min(1),
    tags: z.array(z.string()).default([]),
    weather: z.string().optional(),
    mood: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  stories: storiesCollection,
  moments: momentsCollection,
};
```

---

## 4. Portable Media Abstraction & Decoupled Resolver

### 4.1 Abstraction Architecture
To prevent lock-in to external URLs or specific cloud storage providers, content
frontmatter references only a logical identifier. An intermediary manifest
(`media-manifest.json`) bridges logical IDs to physical files.

```
+-------------------------------------------------------------+
| Markdown Frontmatter (in Git)                               |
| id: "stories/forest-time/cover"                             |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| Runtime Resolver: src/lib/media.ts                          |
| Checks: import.meta.env.DEV vs import.meta.env.PROD         |
| Base: PUBLIC_MEDIA_BASE_URL || '/media'                     |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
| media-manifest.json (in Git)                                |
| Maps ID -> storageKey, variants, dimensions, safe metadata  |
+------------------------------+------------------------------+
                               |
        +----------------------+----------------------+
        |                                             |
        v (Local Dev Mode)                            v (Production Mode)
+-------------------------------+             +-------------------------------+
| Local Dev Web Server          |             | Cloudflare R2 Standard Bucket |
| /media/stories/...            |             | https://media.example.com/... |
| (Files in Git-ignored dir)    |             | (Public Read via Custom CDN)  |
+-------------------------------+             +-------------------------------+
```

### 4.2 Media Manifest Schema
File: `src/data/media-manifest.json` (Committed to Git)

```json
{
  "version": "2.0",
  "generatedAt": "2026-11-18T12:00:00Z",
  "items": {
    "stories/forest-time/cover": {
      "id": "stories/forest-time/cover",
      "storageKeyPrefix": "stories/forest-time/cover",
      "format": "webp",
      "width": 1600,
      "height": 1067,
      "aspectRatio": 1.5,
      "contentHash": "sha256-e3b0c44298fc1c149afbf4c8996fb92427ae41e",
      "blurDataURL": "data:image/webp;base64,UklGRm...",
      "variants": {
        "thumb400": {
          "key": "stories/forest-time/cover-400w.webp",
          "w": 400,
          "h": 267
        },
        "card800": {
          "key": "stories/forest-time/cover-800w.webp",
          "w": 800,
          "h": 533
        },
        "full1600": {
          "key": "stories/forest-time/cover-1600w.webp",
          "w": 1600,
          "h": 1067
        },
        "avif1600": {
          "key": "stories/forest-time/cover-1600w.avif",
          "w": 1600,
          "h": 1067
        }
      },
      "metadata": {
        "captureDate": "2026-11-12T07:15:00Z",
        "cameraModel": "Fujifilm X-T5",
        "lens": "XF 23mm F1.4",
        "focalLength": "23mm",
        "aperture": "f/2.8",
        "shutterSpeed": "1/250s",
        "iso": 160
      }
    }
  }
}
```

### 4.3 Runtime Resolver Implementation
File: `src/lib/media.ts`

```typescript
import manifestData from '../data/media-manifest.json';

export interface MediaVariant {
  key: string;
  w: number;
  h: number;
}

export interface MediaItem {
  id: string;
  storageKeyPrefix: string;
  format: string;
  width: number;
  height: number;
  aspectRatio: number;
  contentHash: string;
  blurDataURL?: string;
  variants: {
    thumb400: MediaVariant;
    card800: MediaVariant;
    full1600: MediaVariant;
    avif1600?: MediaVariant;
  };
  metadata?: {
    captureDate?: string;
    cameraModel?: string;
    lens?: string;
    focalLength?: string;
    aperture?: string;
    shutterSpeed?: string;
    iso?: number;
  };
}

export interface ResolvedMedia {
  src: string;
  srcSet: string;
  avifSrcSet: string;
  thumbnailSrc: string;
  width: number;
  height: number;
  aspectRatio: number;
  blurDataURL?: string;
  metadata?: MediaItem['metadata'];
}

export function resolveMedia(mediaId: string): ResolvedMedia {
  // Determine base URL:
  // In development, serve from local Git-ignored directory.
  // In production, serve from Cloudflare R2 custom domain.
  const isDev = import.meta.env.DEV;
  const configuredBase = import.meta.env.PUBLIC_MEDIA_BASE_URL;

  let base: string;
  if (isDev) {
    base = (configuredBase || '/media').replace(/\/$/, '');
  } else {
    // Review Finding 3: Do not silently fallback to placeholder domain
    if (!configuredBase) {
      throw new Error(
        '[media-resolver] Production build requires PUBLIC_MEDIA_BASE_URL ' +
        'to be explicitly configured when resolving published media.'
      );
    }
    base = configuredBase.replace(/\/$/, '');
  }

  const cleanId = mediaId.replace(/^media:/, '');
  const items = manifestData.items as Record<string, MediaItem>;
  const item = items[cleanId];

  if (!item) {
    console.warn(`[media-resolver] Missing manifest entry: ${mediaId}`);
    return {
      src: `${base}/placeholder.webp`,
      srcSet: `${base}/placeholder.webp 1x`,
      avifSrcSet: '',
      thumbnailSrc: `${base}/placeholder.webp`,
      width: 1200,
      height: 800,
      aspectRatio: 1.5,
    };
  }

  const v = item.variants;
  return {
    src: `${base}/${v.card800.key}`,
    srcSet: [
      `${base}/${v.thumb400.key} 400w`,
      `${base}/${v.card800.key} 800w`,
      `${base}/${v.full1600.key} 1600w`,
    ].join(', '),
    avifSrcSet: v.avif1600 ? `${base}/${v.avif1600.key} 1600w` : '',
    thumbnailSrc: `${base}/${v.thumb400.key}`,
    width: item.width,
    height: item.height,
    aspectRatio: item.aspectRatio,
    blurDataURL: item.blurDataURL,
    metadata: item.metadata,
  };
}
```

---

## 5. Media Pipeline, Git Isolation & Publishing Workflow

### 5.1 Storage Layout & Separation of Concerns

```
Workspace & Repository Layout:
-------------------------------------------------------------------------------
project-root/
├── media/
│   ├── originals/              # Staging of master photos (GIT-IGNORED)
│   │   ├── stories/
│   │   │   └── forest-time/
│   │   │       └── cover.jpg
│   │   └── moments/
│   │       └── cedar-morning/
│   │           ├── photo-01.jpg
│   │           └── photo-02.jpg
│   └── cache/                  # Build cache & hashes (GIT-IGNORED)
├── .local-media/               # Dev preview outputs (GIT-IGNORED)
├── public/                     # Static root (NO photographic media)
│   └── favicon.svg             # Approved non-photographic UI asset
├── src/
│   └── data/
│       └── media-manifest.json # Media metadata (COMMITTED TO GIT)
├── scripts/
│   ├── process-media.ts        # Image processing & EXIF stripping
│   ├── publish-media.ts        # R2 idempotent upload & verification
│   └── verify-git-isolation.ts # CI & pre-commit leak prevention check
└── .gitignore                  # Explicit binary exclusion rules
-------------------------------------------------------------------------------
Outside Workspace:
└── Author's Local Photo Library & Backups (Primary master store)
-------------------------------------------------------------------------------
Cloud Storage:
└── Cloudflare R2 Bucket (Production store for WebP/AVIF binaries)
```

### 5.2 13-Step Media Processing and Publishing Workflow

The publication workflow is strictly segmented into local processing, cloud
upload, manifest registration, and static site deployment:

1. **Select Local Source Photographs**: Author copies high-resolution master
   photos from external photo library to local working staging
   `media/originals/`.
2. **Correct EXIF Orientation**: Pipeline applies `.rotate()` via Sharp to
   permanently fix orientation before metadata extraction.
3. **Extract Permitted Editorial Metadata**: Pipeline reads EXIF tags and
   extracts approved technical fields (timestamp, camera, lens, exposure).
4. **Remove Embedded Metadata**: Sharp encodes images with binary metadata
   stripped by default. All GPS, serial numbers, and personal info are deleted.
5. **Generate Responsive Variants**: Produces optimized WebP (85% quality) and
   AVIF (75% quality) variants at 400w, 800w, and 1600w.
6. **Generate Gallery Thumbnails**: Produces lightweight 1:1 square thumbnails
   for Moments photo grid.
7. **Assign Stable Logical Media Identifiers**: Normalizes IDs
   (`<collection>/<slug>/<asset-name>`) independent of cloud URLs.
8. **Upload Processed Media Assets to R2**: Uploads processed WebP/AVIF files to
   Cloudflare R2 Standard Storage using authenticated API credentials. Uploads
   are idempotent and use immutable content hashes.
9. **Verify Uploaded Object Existence & Integrity**: Verification step issues
   HTTP HEAD or S3 `headObject` requests confirming every asset exists and
   matches expected byte sizes and hashes.
10. **Generate or Update Media Manifest**: Only after upload verification
    succeeds, `src/data/media-manifest.json` is updated with new entries.
11. **Validate All Media References**: Local validation script checks that every
    `mediaItemSchema` reference in Markdown files exists in the manifest.
12. **Commit Markdown and Manifest Changes to Git**: Author stages and commits
    `.md` files and `media-manifest.json`. Zero photographic binaries are
    staged.
13. **Build and Deploy Static Website**: GitHub Actions triggers on push,
    validates the manifest, builds static HTML, and deploys to GitHub Pages.

### 5.3 EXIF Policy & Privacy Boundaries

The privacy boundary is enforced at the binary encoding level:
- **Stripped Binary Tags**: Output image files contain zero embedded EXIF,
  IPTC, or XMP metadata blocks.
- **Prohibited Metadata in Manifest**: GPS latitude/longitude, altitude, home
  location, camera serial numbers, lens serial numbers, and author identity
  fields are never copied into the public manifest.
- **Permitted Metadata in Manifest**:
  - `captureDate` (`DateTimeOriginal` formatted to ISO 8601).
  - `cameraModel` (e.g., "Fujifilm X-T5").
  - `lens` (e.g., "XF 23mm F1.4").
  - `focalLength`, `aperture`, `shutterSpeed`, `iso`.

### 5.4 Git Isolation & Automated Protection

#### 5.4.1 `.gitignore` Rules
```gitignore
# Media processing & binary isolation
media/originals/
media/cache/
public/media/
*.jpg
*.jpeg
*.png
*.webp
*.avif
*.tiff
*.heic
*.dng
*.raw

# Local secrets & credentials
.env
.env.*
!.env.example
*.pem
*.key
```

#### 5.4.2 Automated Leak Prevention Script (`scripts/verify-git-isolation.ts`)
A lightweight TypeScript script executed locally and in CI:
- **Check 1: Staged & Tracked Binaries**: Scans `git ls-files` and staged files
  for prohibited photographic extensions (`.jpg`, `.jpeg`, `.png`, `.webp`,
  `.avif`, `.tiff`, `.heic`). Fails with non-zero exit code if found.
- **Check 2: Binary Size Gate**: Fails if any tracked file exceeds 100KB (except
  legitimate bundled font subsets in `@fontsource`).
- **Check 3: Secret Detection**: Checks for committed Cloudflare API tokens,
  R2 keys, or private environment files.
- **Check 4: Manifest Integrity**: Validates that all entries in
  `media-manifest.json` have valid schemas and non-empty variants.

---

## 6. Route Structure & SSG Mapping

All dynamic hash routes from the prototype are mapped to clean, static URLs:

| Prototype Hash Route | Production Astro SSG Route | Page Component File |
|---|---|---|
| `#/` or `#stories` | `/` | `src/pages/index.astro` |
| `#stories` (explicit) | `/stories/` | `src/pages/stories/index.astro` |
| `#story/:id` | `/stories/[...slug]/` | `src/pages/stories/[...slug].astro` |
| `#moments` | `/moments/` | `src/pages/moments/index.astro` |
| `#moment/:id` | `/moments/[...slug]/` | `src/pages/moments/[...slug].astro` |
| `#about` | `/about/` | `src/pages/about.astro` |
| `#tags` | `/tags/` | `src/pages/tags/index.astro` |
| `#tags/:tag` | `/tags/[tag]/` | `src/pages/tags/[tag].astro` |
| `feed.xml` | `/feed.xml` or `/rss.xml` | `src/pages/rss.xml.ts` |
| N/A | `/404.html` | `src/pages/404.astro` |

---

## 7. Deployment Strategy & CI/CD

### 7.1 Astro Configuration (`astro.config.mjs`)
The Astro configuration handles base path resolution dynamically:

```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

export default defineConfig({
  output: 'static',
  site: process.env.ASTRO_SITE || 'https://username.github.io',
  base: process.env.ASTRO_BASE || '/',
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    mdx(),
  ],
});
```

### 7.2 GitHub Actions Workflow (`.github/workflows/deploy.yml`)

The production CI/CD build does NOT require local original photos and does NOT
process media in the cloud. It builds directly from committed Markdown content
and `media-manifest.json`:

```yaml
name: Deploy Astro SSG to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Verify Git isolation & manifest
        run: npm run verify:isolation

      - name: Build static site
        run: npm run build
        env:
          ASTRO_SITE: "https://username.github.io"
          ASTRO_BASE: "/SHAN"
          PUBLIC_MEDIA_BASE_URL: "https://media.example.com"

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## 8. Cloudflare R2 Production Architecture & Custom Domain Strategy

### 8.1 Private-Upload / Public-Read Architecture
- **Upload Security**: Media uploads occur from the author's local workstation
  via authenticated Cloudflare API tokens (scoped strictly to `Object:Write` on
  the specific R2 bucket).
- **Public Delivery**: Visitors access photographs via public HTTP GET requests.
  Visitors have zero write, delete, or list permissions.
- **Credential Isolation**: Cloudflare API keys and tokens are stored in local
  `~/.config/` or local `.env` files. No credentials exist in client JavaScript,
  Git history, or GitHub Actions deployment secrets.

### 8.2 Custom Media Subdomain vs `r2.dev`
Production delivery requires a custom media subdomain
(`https://media.example.com`) rather than the default `pub-xxx.r2.dev`:
- **Branding & Longevity**: Avoids vendor lock-in to Cloudflare subdomains.
- **Edge Caching**: Cloudflare CDN provides global edge caching and HTTP/3.
- **Custom Headers**: Enables strict CORS, cache headers (`max-age=31536000`),
  and security headers.
- **Rate Limits**: `r2.dev` endpoints have strict OpenAI/Cloudflare default
  rate limits not intended for production public websites.

### 8.3 DNS & CNAME Architecture
- **Website Domain**: `https://example.com` -> CNAME to `<user>.github.io`
- **Media Domain**: `https://media.example.com` -> Cloudflare R2 Custom Domain
- **Storage Portability**: Because media references use logical IDs resolved
  through `PUBLIC_MEDIA_BASE_URL`, switching storage providers (e.g., to AWS
  S3, Wasabi, or MinIO) requires only updating DNS and the base URL. Zero
  Markdown content files need to be modified.

---

## 9. Backup & Disaster Recovery Responsibilities

### 9.1 Boundary Demarcation
- **Original Master Photographs**: Stored and backed up exclusively within the
  author's existing external photo library system. SHAN does not manage or
  backup raw camera master files.
- **Published Image Binaries**: Stored in Cloudflare R2. These are reproducible
  derivatives that can be regenerated from originals at any time.
- **Website Content & Code**: Stored in Git and backed up via standard Git
  remotes.

### 9.2 Minimum Recovery Procedures
1. **Accidental Deletion of R2 Image**:
   - Re-run local media processing and upload script:
     `npm run media:process && npm run media:publish`.
   - The script restores missing files from local originals.
2. **Corrupted or Lost Media Manifest**:
   - Restore `src/data/media-manifest.json` from Git commit history.
3. **R2 Outage or Provider Migration**:
   - Sync bucket contents to alternative S3 provider using `rclone`.
   - Update `PUBLIC_MEDIA_BASE_URL` in environment configuration.
   - Rebuild and deploy static site. Zero Markdown frontmatter edits.
4. **Remote Object Retention Policy**:
   - Publishing operations never automatically delete remote R2 objects.
   - Obsolete assets remain in storage to preserve legacy links and avoid
     accidental 404s.
