# Architecture Decision Records (ADRs) & Governance

## 1. Executive Summary

This document records the foundational architecture decisions for the
production publishing website "山 / SHAN — Notes along the way".
Each Architecture Decision Record (ADR) documents the context, chosen
solution, alternatives evaluated, and technical trade-offs. The final section
tracks operational choices and owner approvals.

---

## 2. Architecture Decision Records

### ADR-001: Astro SSG over SPA or SSR

#### Status
Accepted

#### Context
The existing reference prototype is a buildless Single Page Application (SPA)
mutating `document.body` and `main.innerHTML` via hash routing (`#stories`,
`#story/:id`). While simple for a demo, this architecture exhibits severe
drawbacks for a personal publication:
- Zero SEO discoverability without client JavaScript execution.
- Inability to generate per-post OpenGraph metadata cards for social sharing.
- Sub-optimal mobile performance due to client-side DOM reconstruction.
- Potential flicker or layout shift during initial page load.

Conversely, a Server-Side Rendered (SSR) application requires a 24/7 running
Node.js or serverless container, introducing hosting maintenance overhead,
cold starts, and infrastructure costs.

#### Decision
Adopt **Astro 5 in Static Site Generation mode (`output: 'static'`)**. Astro
compiles Markdown and MDX content collections directly into static HTML, CSS,
and pre-optimized assets at build time, with zero client-side JavaScript by
default.

#### Alternatives Considered
1. **Retain Buildless Plain-JS SPA**: Low complexity, but fails SEO, social
   sharing, accessibility, and content scalability requirements.
2. **Next.js / Nuxt SSR**: Over-engineered for a single-author journal.
   Introduces vendor lock-in (Vercel) and unnecessary operational complexity.
3. **Hugo / Zola**: Fast static generators, but lack native TypeScript
   component authoring and modern image optimization ergonomics.

#### Consequences & Trade-offs
- **Positive**: Blazing fast TTFB, zero server hosting costs on GitHub Pages,
  perfect SEO, and per-page social metadata.
- **Negative**: Content updates require running a static site build; dynamic
  features (search) must rely on client-side indexes or lightweight islands.

---

### ADR-002: Portable Media Abstraction over Direct URLs

#### Status
Accepted

#### Context
The prototype hardcodes third-party image URLs from `images.unsplash.com`. In
production, images must be authored by the journal owner. Hardcoding relative
filesystem paths (`../../assets/photos/pic.jpg`) creates tight coupling to the
Astro directory layout. Conversely, hardcoding external Cloudflare R2 bucket
URLs (`https://pub-xxx.r2.dev/...`) creates vendor lock-in and pollutes Markdown
frontmatter with ephemeral endpoints.

#### Decision
Implement a **Portable Media Abstraction** using normalized logical identifiers
(format: `<collection>/<entry-slug>/<asset-key>`, e.g.,
`stories/forest-time/cover`). Frontmatter references this logical ID only. An
automated build script parses originals into `media-manifest.json`, and a
lightweight runtime helper (`src/lib/media.ts`) resolves the ID to local static
assets or remote CDN URLs based on environment variables.

#### Alternatives Considered
1. **Direct Astro Image Imports in Frontmatter**: Frontmatter paths like
   `cover: "../../assets/cover.jpg"` are validated by Astro, but break if
   media is migrated to Cloudflare R2 or an external CDN.
2. **Hardcoded Cloudflare R2 URLs**: Requires every Markdown file to contain
   CDN endpoints, necessitating bulk regex replacements upon any domain or
   bucket change.

#### Consequences & Trade-offs
- **Positive**: 100% portable Markdown files; zero frontmatter changes when
  migrating storage backends; programmatic access to safe image metadata
  (dimensions, blur placeholder, capture date).
- **Negative**: Requires a pre-build media processing step to populate
  `media-manifest.json`.

---

### ADR-003: Native HTML Islands (<dialog>) over Heavy UI Frameworks

#### Status
Accepted

#### Context
The prototype features several interactive components:
- Search Modal with `Cmd+K` keyboard shortcut.
- Fullscreen Lightbox Photo Carousel with arrow navigation.
- Light/Dark theme switcher.
- Mobile navigation drawer.

Modern web teams frequently import React, Vue, or Svelte to handle such
components. However, shipping a 40KB-130KB framework runtime just to toggle
modals contradicts the minimalist, high-performance ethos of "山 / SHAN".

#### Decision
Implement interactive components using **Tailored Native HTML5 Islands**
powered by standard `<dialog>` elements and lightweight vanilla TypeScript
scripts (under 2KB combined).

#### Alternatives Considered
1. **React / Preact Islands (`@astrojs/preact`)**: Provides familiar component
   state handling, but incurs redundant runtime payload for simple modals.
2. **External Lightbox Library (PhotoSwipe, GLightbox)**: Adds 15KB-30KB of
   unnecessary third-party dependencies with custom CSS overrides.

#### Consequences & Trade-offs
- **Positive**: Zero framework overhead, zero third-party vulnerability alerts,
  native browser accessibility and focus trapping in `<dialog>`, 100/100
  Lighthouse performance scores.
- **Negative**: Modal interactions must be written using standard DOM APIs
  rather than reactive state frameworks.

---

### ADR-004: Self-Hosted Fonts (@fontsource) over Google Fonts CDN

#### Status
Accepted

#### Context
The prototype references Google Fonts via `@import` in CSS:
`DM Sans`, `Noto Serif TC`, and `Noto Serif JP`. External font CDNs introduce:
- Third-party tracking and GDPR/privacy compliance concerns.
- Render-blocking external DNS, TCP, and TLS handshakes.
- Fragility in offline or restricted intranet environments.

#### Decision
**Self-host all web fonts** using `@fontsource` npm packages
(`@fontsource/dm-sans`, `@fontsource/noto-serif-tc`,
`@fontsource/noto-serif-jp`). Pre-subsetted WOFF2 font files are bundled into
the static build with `font-display: swap`.

#### Alternatives Considered
1. **Retain Google Fonts CDN**: Zero build setup, but introduces latency,
   external network dependencies, and tracking.
2. **System Font Fallbacks Only**: Eliminates all font downloads, but breaks the
   refined bilingual editorial aesthetic established in the prototype.

#### Consequences & Trade-offs
- **Positive**: Offline resilience, zero external requests, faster subsequent
  loads via service worker or HTTP cache, privacy compliance.
- **Negative**: Increased repository and deployment build size (a few megabytes
  for CJK font subsets).

---

### ADR-005: Privacy-Sensitive EXIF Scrubbing in Build Pipeline

#### Status
Accepted

#### Context
Photographers shooting with digital cameras or modern smartphones capture rich
metadata embedded in JPEG/TIFF files. This includes:
- Highly sensitive private data: GPS latitude/longitude, home locations,
  camera serial numbers, and owner identifiers.
- Valuable artistic metadata: Capture timestamp, camera make/model, focal
  length, aperture, shutter speed, and ISO.

Exposing raw camera files on a public website poses severe privacy and security
risks. Conversely, stripping all metadata discards valuable context.

#### Decision
Implement **Automated Privacy-Sensitive EXIF Scrubbing** in the pre-build media
pipeline (`scripts/process-media.ts`):
1. Correct image orientation via Sharp `.rotate()` prior to stripping tags.
2. Extract safe photographic metadata into `media-manifest.json`.
3. Explicitly exclude GPS coordinates, serial numbers, and owner identifiers.
4. Sharp encodes output WebP/AVIF images with all binary metadata stripped by
   default, guaranteeing zero GPS leaks in deployed media binaries.

#### Alternatives Considered
1. **Manual Scrubbing (ExifTool CLI)**: Error-prone and reliant on author
   diligence before publishing.
2. **Strip 100% of Metadata**: Protects privacy, but prevents the journal from
   displaying capture dates and camera notes.

#### Consequences & Trade-offs
- **Positive**: Guaranteed privacy protection; automated safety; photographic
  storytelling enriched by safe technical parameters.
- **Negative**: Requires author to run media processing before publishing new
  camera master files.

---

### ADR-006: Staged Cloudflare R2 Migration Strategy

#### Status
Superseded by ADR-007

#### Context
Original planning proposed hosting optimized WebP/AVIF assets in `public/media/`
committed directly to Git for an initial GitHub Pages launch, deferring
Cloudflare R2 until repository storage reached 500MB.

#### Superseded Rationale
The project owner approved **Decision B (Media Storage)**: Cloudflare R2 will be
the primary production storage provider for photographic media. Under no
circumstances should photographic binaries enter Git history or be served
directly by GitHub Pages in production. Committing binary photographs to Git
even temporarily pollutes repository history permanently, degrades clone speeds,
and violates the core principle: "Git stores code, content and metadata. R2
stores published photographic assets."

---

### ADR-007: R2-First Media Storage Architecture & Git Isolation

#### Status
Accepted (Owner Approved Decision B)

#### Context
High-resolution photography is central to SHAN (Moments and Story covers).
Storing photographic binaries in Git causes rapid repository bloat, slow clone
and fetch operations, and risks hitting GitHub's repository limits. GitHub Pages
is designed for static website code, not media delivery. Furthermore, binary
bloat in Git history cannot be cleanly undone without destructive history
rewriting (`git filter-repo`).

#### Decision
Adopt an **R2-First Media Storage Architecture with Strict Git Isolation**:
1. **Core Separation of Concerns**:
   - **Git stores**: Source code, Markdown/MDX text, schemas, metadata, media
     manifests (`src/data/media-manifest.json`), UI vector icons, docs.
   - **R2 stores**: All published photographic binaries (WebP, AVIF, and
     thumbnails).
2. **Zero Photographic Binaries in Git**:
   - `media/originals/`, `media/cache/`, `public/media/`, and all photographic
     outputs are permanently excluded via `.gitignore`.
   - Automated pre-commit and CI verification scripts fail the build if any
     photographic binary or staged secret is detected.
3. **Local Development Parity**:
   - Local development processes photographs into a Git-ignored directory
     served locally by the Astro dev server.
   - The same logical media IDs resolve seamlessly in local dev without
     requiring Cloudflare credentials, bucket configuration, or network
     access.
4. **Production Delivery**:
   - Published photographic assets are uploaded to Cloudflare R2 Standard
     Storage behind a custom media subdomain (`https://media.example.com`).
   - The site uses a private-upload / public-read security model. R2 API
     credentials are never bundled in client code or CI web deploy workflows.

#### Alternatives Considered
1. **Staged Git Migration (Former ADR-006)**: Rejected because temporary binary
   commits permanently pollute Git history.
2. **Git LFS (Large File Storage)**: Rejected due to GitHub bandwidth billing
   quotas, LFS client setup friction, and vendor coupling.
3. **Third-Party Photo Hosts (Flickr, Unsplash)**: Rejected due to loss of
   editorial independence, unbranded domains, and link rot risks.

#### Consequences & Trade-offs
- **Positive**: Git repository stays permanently lean (<20MB); zero binary
  debt in Git history; instant `git clone`; global low-latency CDN media
  delivery via Cloudflare; zero code changes needed between local dev and
  production.
- **Negative**: Publishing photos requires a local processing and R2 upload
  step before publishing content changes.

---

### ADR-008: Deferred Custom Domain Strategy ("Plan Now, Purchase Later")

#### Status
Accepted (Owner Approved Decision A)

#### Context
A custom apex domain (e.g., `https://example.com`) and custom media subdomain
(e.g., `https://media.example.com`) provide professional branding and permanent
URL resilience. However, purchasing and configuring domain names during initial
engineering adds friction and premature recurring costs.

#### Decision
Adopt a **Deferred Custom Domain Strategy**:
1. **Development & Initial Staging**:
   - Local development runs against `http://localhost:4321` with local media.
   - Initial GitHub Pages testing uses default repository URLs
     (`https://<user>.github.io/<repo>/`) with dynamic base path handling.
2. **Production Architecture Readiness**:
   - Architecture, route generation, and media resolvers are designed from day
     one to support custom apex and media subdomains via environment
     variables (`ASTRO_SITE`, `ASTRO_BASE`, `PUBLIC_MEDIA_BASE_URL`).
   - Domain purchase and DNS record configuration (CNAME to GitHub Pages and
     Cloudflare R2 custom domain) are deferred until production launch.

#### Alternatives Considered
1. **Mandatory Upfront Domain Purchase**: Adds unnecessary costs and setup
   blockers before Phase 1 code is even written.
2. **Permanent GitHub Pages Subpath Domain**: Locks the site into a vendor
   domain without custom media domain branding.

#### Consequences & Trade-offs
- **Positive**: Zero cost during Phase 1-2 engineering; fully decoupled domain
  configuration; smooth transition to custom domain when ready.
- **Negative**: Final production DNS verification is deferred to Phase 3.

---

### ADR-009: External Photo Library Ownership & Backup Demarcation

#### Status
Accepted (Owner Approved Decision C)

#### Context
High-resolution camera master photographs require durable, long-term archival
protection. The journal owner already maintains an established local photo
library and external backup workflow. Introducing a redundant original-photo
backup system within SHAN would create operational complexity and storage waste.

#### Decision
Establish an explicit **Ownership & Backup Demarcation**:
1. **Original Photographs**:
   - Managed, curated, and backed up entirely outside SHAN by the owner's
     existing photo library and backup routines.
   - SHAN does NOT provide an original-photo cloud backup system.
2. **Published Derivative Media**:
   - WebP, AVIF, and thumbnail variants stored in Cloudflare R2 are
     reproducible build artifacts. They can be regenerated at any time from
     the master photos and processing configuration.
3. **Content and Metadata**:
   - Markdown articles, moments, and `media-manifest.json` are version-
     controlled in Git and protected by normal repository backup routines.

#### Alternatives Considered
1. **Automated Original Photo Archiving in Cloudflare R2 / AWS Glacier**:
   Rejected as redundant, costly, and outside the scope of a personal static
   journal.
2. **No Backup Demarcation**: Ambiguity leads to accidental deletion or
   unverified data recovery assumptions.

#### Consequences & Trade-offs
- **Positive**: Zero storage waste; no redundant backup infrastructure; clear
  operational boundaries for the journal author.
- **Negative**: If an original master photo is lost from the external library,
  it cannot be recovered from SHAN.

---


---

### ADR-010: Refined Git Isolation & Build Output Segregation

#### Status
Accepted (Phase 1 Review Corrections)

#### Context
Phase 0 review identified three critical edge cases:
1. Blank exclusion of all image formats inadvertently blocked legitimate
   UI assets (favicons, vector icons, small branding marks).
2. Placing local dev images in `public/media/` would cause Astro's production
   build (`astro build`) to copy all local images directly into `dist/media/`.
3. Defaulting production builds to `https://media.example.com` risked
   deploying broken links if the author forgot to configure the real CDN URL.

#### Decision
Implement three engineering refinements:
1. **Explicit UI Asset Allowlist**: Approved non-photographic UI assets
   (`public/favicon.svg`, `public/favicon.ico`, `public/apple-touch-icon.png`)
   are permitted in Git. Photographic formats (`.jpg`, `.webp`, `.avif`, etc.)
   remain strictly prohibited.
2. **Out-of-Public Local Media Serving**: Local development photos reside in
   `.local-media/` (outside `public/`). A Vite dev plugin serves `/media/*` on
   demand during `astro dev`. `astro build` ignores `.local-media/`,
   guaranteeing that `dist/` contains zero photographic binaries.
3. **Strict Production Media Base URL**: `src/lib/media.ts` throws a build error
   in production if `PUBLIC_MEDIA_BASE_URL` is omitted. Silent fallback to
   documentation placeholders (`media.example.com`) is strictly disallowed.

#### Consequences & Trade-offs
- **Positive**: Clean UI asset management; bulletproof `dist/` isolation;
  prevented deployment of broken placeholder URLs.
- **Negative**: Requires local Vite plugin in `astro.config.mjs` for dev media.

## 3. Operational Choices & Approvals Status

The following matrix records operational choices confirmed by the project
owner and choices remaining for Phase 1 execution:

### Choice 1: Production Domain Strategy
- **Status**: **Approved (Decision A)**
- **Selection**: "Plan now, purchase later." Develop with dynamic base path
  (`ASTRO_BASE`); configure custom domain (`https://example.com` and
  `https://media.example.com`) during Phase 3 production launch.

### Choice 2: Stories Authoring Format
- **Status**: **Approved**
- **Selection**: Support both Markdown (`.md`) and MDX (`.mdx`) in content
  collection schemas (`**/*.{md,mdx}`). Default to standard Markdown for
  editorial portability across standard editors.

### Choice 3: Cloudflare R2 Media Storage Strategy
- **Status**: **Approved (Decision B)**
- **Selection**: R2-First architecture with strict Git isolation (ADR-007).
  Photographic binaries never enter Git. Cloudflare R2 serves production media
  via a custom subdomain.

### Choice 4: Original Photograph Backup Demarcation
- **Status**: **Approved (Decision C)**
- **Selection**: Managed externally by owner's existing photo library and
  backup system (ADR-009). SHAN does not manage original photo cloud backups.

### Choice 5: Multilingual Story Translation Architecture
- **Status**: **Deferred to Future Phase**
- **Selection**: Retain autonomous posts with language tags (`lang: 'en' |
  'zh-Hant' | 'ja'`) for Phase 1-2, exactly matching prototype behavior.
  Linked translation switchers deferred as future enhancement.
