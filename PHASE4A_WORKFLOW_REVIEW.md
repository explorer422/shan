# Phase 4A: Publishing Workflow Discovery & System Review

## 1. Executive Summary

This document reviews the existing publishing workflow of **山 / SHAN**,
evaluating how the author creates, edits, previews, and publishes Stories and
Moments under the current architecture.

The current system implements a decoupled, R2-First media architecture with
strict Git isolation. Git stores code, Markdown text, and metadata manifests;
Cloudflare R2 stores optimized photographic variants. Local preview functions
via an Astro Vite middleware proxy.

This investigation verified working behaviors, identified actual friction
points and risk areas, and formulated prioritized, minimal improvements for
Phase 4B rehearsal.

---

## 2. Architecture & File Inventory

### 2.1 Content Collections (`src/content.config.ts`)
- **Stories** (`src/content/stories/*.{md,mdx}`):
  - Required fields: `title`, `excerpt`, `date`, `coverMedia`.
  - Optional fields: `subtitle`, `updatedDate`, `tags` (default `[]`), `lang`
    (`'en' | 'zh-Hant' | 'ja'`, default `'en'`), `readingTime`, `featured`
    (default `false`), `draft` (default `false`), `relatedStories` (default
    `[]`).
  - Media binding: `coverMedia` strictly uses `mediaItemSchema` (`id`, `alt`,
    `caption`, `aspectRatio`). Body markdown does not currently support
    portable media ID resolution for inline photos.
- **Moments** (`src/content/moments/*.{md,mdx}`):
  - Required fields: `date`, `caption`, `media` (array of `mediaItemSchema`, min
    1 item).
  - Optional fields: `title`, `location`, `tags` (default `[]`), `weather`,
    `mood`, `draft` (default `false`).

### 2.2 Media Manifest (`src/data/media-manifest.json`)
- Version 2.0 JSON manifest committed to Git.
- Maps logical identifiers (`stories/<slug>/cover` or `moments/<slug>/<photo>`)
  to content-addressed variant keys (`<name>-<width>w-<sha256>.<format>`),
  dimensions, aspect ratios, and safe technical metadata.
- Enables complete decoupling between Markdown text and physical CDN URLs.

### 2.3 Media & Isolation Scripts
- `scripts/process-media.mjs`:
  - Scans `media/originals/` for master images (`.jpg`, `.jpeg`, `.png`, etc.).
  - Applies `sharp(buffer).rotate()` to normalize orientation.
  - Generates 4 variants into Git-ignored `.local-media/`:
    - Moments: `thumb400` (400x400 cover crop), `card800` (800w WebP),
      `full1600` (1600w WebP), `avif1600` (1600w AVIF).
    - Stories: `thumb400` (400w proportional), `card800` (800w WebP),
      `full1600` (1600w WebP), `avif1600` (1600w AVIF).
    - Calculates SHA-256 hashes per variant and updates `media-manifest.json`.
- `scripts/publish-media.mjs`:
  - Uploads variants from `.local-media/` to Cloudflare R2 Standard bucket.
  - Modes: `--dry-run` (default), `--mock` (`.mock-r2`), `--prod`,
    `--verify-only`.
  - Attaches `x-amz-meta-sha256` header, `Content-Type`, and immutable cache
    control (`public, max-age=31536000, immutable`).
  - Detects remote collisions and skips already-verified uploads.
- `scripts/verify-isolation.mjs`:
  - Scans git index (`git ls-files`) and staged changes for prohibited
    photographic binary extensions.
  - Audits `dist/` directory after build to ensure zero photo leaks.
  - Executes an automated negative leak test.

---

## 3. Current Publishing Workflow (Step-by-Step)

### 3.1 Publishing a New Story
1. **Stage Master Cover Image**:
   Copy the original master image from external library to:
   `media/originals/stories/<story-slug>/cover.jpg`
2. **Process Image Variants**:
   Run:
   ```bash
   node scripts/process-media.mjs
   ```
   *Result*: Generates 4 variants in `.local-media/stories/<story-slug>/` and
   registers `stories/<story-slug>/cover` in `src/data/media-manifest.json`.
3. **Author Content Markdown**:
   Create `src/content/stories/<story-slug>.md` with frontmatter:
   ```yaml
   ---
   title: "Story Title"
   excerpt: "Concise summary for previews and social cards."
   date: 2026-11-20
   lang: "zh-Hant"
   readingTime: "4 min read"
   featured: false
   draft: false
   tags:
     - "Nature"
   coverMedia:
     id: "stories/<story-slug>/cover"
     alt: "Descriptive alt text"
   ---

   Story body content in standard Markdown...
   ```
4. **Local Verification & Preview**:
   Run:
   ```bash
   npm run check
   npm run dev
   ```
   Open `http://localhost:4321/stories/<story-slug>/`.
5. **Upload Media to Cloudflare R2**:
   Run dry-run simulation, then execute production upload:
   ```bash
   node scripts/publish-media.mjs
   node scripts/publish-media.mjs --prod
   node scripts/publish-media.mjs --prod --verify-only
   ```
6. **Commit & Deploy**:
   ```bash
   npm run verify:isolation
   git add src/content/stories/<story-slug>.md src/data/media-manifest.json
   git commit -m "feat(stories): add <story-slug>"
   git push origin main
   ```
   Trigger GitHub Actions deployment via `workflow_dispatch` (GitHub UI or CLI).

### 3.2 Publishing a New Moment
1. **Stage Master Photos**:
   Copy original master images to:
   `media/originals/moments/<moment-slug>/photo-01.jpg`
   `media/originals/moments/<moment-slug>/photo-02.jpg`
2. **Process Image Variants**:
   Run:
   ```bash
   node scripts/process-media.mjs
   ```
3. **Author Content Markdown**:
   Create `src/content/moments/<moment-slug>.md`:
   ```yaml
   ---
   title: "Optional Moment Title"
   date: 2026-11-20
   location: "Mountain Trail"
   caption: "Short poetic caption describing the moment."
   tags:
     - "Travel"
   media:
     - id: "moments/<moment-slug>/photo-01"
       alt: "First photo description"
     - id: "moments/<moment-slug>/photo-02"
       alt: "Second photo description"
   ---
   ```
4. **Preview, Upload & Commit**:
   Identical sequence to Story publishing (Steps 4–6 above).

---

## 4. Operation Mechanics

### 4.1 Drafts
- Setting `draft: true` in frontmatter hides entries in production builds.
- Handled via `import.meta.env.PROD ? !data.draft : true` across:
  - Homepage (`src/pages/index.astro`)
  - Stories index & slugs (`src/pages/stories/*`)
  - Moments index & slugs (`src/pages/moments/*`)
  - Tag indexes (`src/pages/tags/*`)
  - RSS feed (`src/pages/rss.xml.ts`) and Sitemap (`src/pages/sitemap.xml.ts`)
- In local dev (`astro dev`), draft posts remain fully viewable.
- *Discrepancy noted*: Search endpoint (`src/pages/search-data.json.ts`) filters
  out drafts unconditionally even during development.

### 4.2 Content Updates (Text Only)
- Editing `.md` prose, titles, excerpts, or tags does not require re-running
  `process-media.mjs` or `publish-media.mjs`.
- Run `npm run check`, commit the markdown file, push to `main`, and dispatch
  deployment.

### 4.3 Image Replacements
- Replacing a file in `media/originals/` and re-running
  `node scripts/process-media.mjs` computes a new SHA-256 hash.
- Because variant filenames include the hash (e.g. `cover-800w-<hash>.webp`),
  the script deletes stale variants from `.local-media/` and creates new ones.
- `src/data/media-manifest.json` updates with the new keys and content hash.
- Running `node scripts/publish-media.mjs --prod` detects that the new keys do
  not exist remotely and uploads them.
- Existing remote files in R2 remain intact, avoiding broken links for cached
  clients.

### 4.4 Deployment Flow
- Static build output generated by Astro SSG to `dist/`.
- CI/CD workflow (`.github/workflows/deploy.yml`):
  - Runs on Node 22 with `npm ci`.
  - Executes `npm run check`.
  - Runs pre-build `verify-isolation.mjs`.
  - Runs `npm run build` with `PUBLIC_MEDIA_BASE_URL`.
  - Runs post-build `verify-isolation.mjs` ensuring `dist/` is free of photos.
  - Uploads artifact and deploys to GitHub Pages.
- Deployment trigger: Configured solely for manual `workflow_dispatch`.

---

## 5. Safeguards Analysis

### 5.1 Existing Safeguards (Verified Effective)
1. **Strict Binary Git Isolation**:
   `.gitignore` comprehensively blocks `media/originals/`, `.local-media/`,
   `*.jpg`, `*.webp`, `*.raw`, etc.
   `scripts/verify-isolation.mjs` audits git tracked/staged files and `dist/`,
   backed by a negative leak test.
2. **Idempotent R2 Publishing with Collision Guard**:
   `scripts/publish-media.mjs` verifies remote object SHA-256 headers before
   uploading. If a remote object exists with different content, it raises a
   collision error and refuses to overwrite.
3. **Decoupled URL Management**:
   Markdown files reference logical IDs only. Switching domain or storage
   backends requires zero markdown frontmatter edits.
4. **Production Build Enforcement**:
   `src/lib/media.ts` throws a compile-time error during production builds if
   `PUBLIC_MEDIA_BASE_URL` is omitted or if a referenced media ID is missing
   from `media-manifest.json`.

### 5.2 Observed Friction Points & Risks
1. **Local Preview Resolver Conflict with `.env` (High Impact)**:
   In `src/lib/media.ts`:
   ```ts
   if (isDev) {
     base = (configuredBase || '/media').replace(/\/$/, '');
   }
   ```
   Because `.env` defines `PUBLIC_MEDIA_BASE_URL=https://media.shan.page`, Astro
   loads this into `configuredBase`. In local development, newly processed
   photos point to the production CDN before being uploaded, yielding 404
   errors locally. The Vite `.local-media` dev middleware is bypassed unless
   the author manually unsets or overrides `PUBLIC_MEDIA_BASE_URL`.
2. **Missing Package Scripts (Ergonomics)**:
   `package.json` lacks scripts for media workflows. Authors must remember raw
   commands like `node scripts/process-media.mjs` and
   `node scripts/publish-media.mjs --prod`.
3. **No CI Check for Remote R2 Asset Existence (Risk of Broken Links)**:
   `verify-isolation.mjs` ensures zero binaries are committed, but neither CI
   nor local git checks confirm that media IDs in `media-manifest.json` actually
   exist on Cloudflare R2 before deployment. If the author forgets to run
   `publish-media.mjs --prod`, the site builds and deploys with broken image
   links.
4. **Orphaned Media Manifest Entries**:
   `process-media.mjs` merges new images into the existing manifest. If a source
   file is deleted or renamed in `media/originals/`, the obsolete entry remains
   in `media-manifest.json`. If `.local-media/` is pruned, `publish-media.mjs`
   subsequently fails because it expects local variant files for all manifest
   entries.
5. **Simulated EXIF Metadata**:
   `process-media.mjs` generates synthetic metadata (`Fujifilm X-T5`, `23mm`)
   for new items rather than parsing actual EXIF metadata from master photos.
6. **Manual GitHub Actions Dispatch**:
   `deploy.yml` requires manual execution via `workflow_dispatch`. Pushing
   commits to `main` does not automatically deploy.

---

## 6. Recommended Minimal Improvements (Prioritized)

In accordance with lazy senior dev principles, only minimal, high-value
improvements should be considered:

### Priority 1 (Immediate Friction Fixes)
1. **Fix Dev Media Resolver**:
   Update `src/lib/media.ts` so local development defaults to `/media` unless an
   explicit flag (e.g. `USE_REMOTE_MEDIA=true`) is passed, restoring instant
   local previews from `.local-media/`.
2. **Add Ergonomic NPM Scripts**:
   Add to `package.json`:
   ```json
   "media:process": "node scripts/process-media.mjs",
   "media:publish": "node scripts/publish-media.mjs --prod",
   "media:verify": "node scripts/publish-media.mjs --prod --verify-only"
   ```

### Priority 2 (Safeguards & Consistency)
3. **Pre-Deploy R2 Existence Check**:
   Provide an optional pre-publish verification check (`npm run media:verify`)
   ensuring all manifest keys exist on R2 before committing or deploying.
4. **Search Data Dev Alignment**:
   Update `src/pages/search-data.json.ts` to match standard pages:
   `import.meta.env.PROD ? !data.draft : true`.

### Priority 3 (Workflow Automation)
5. **Automate CI Deployment**:
   Re-enable `push: branches: [main]` in `.github/workflows/deploy.yml` once
   publishing stability is validated in Phase 4B rehearsal.

---

## 7. Recommended Phase 4B Rehearsal Plan

Before declaring authoring ready for everyday use, execute a dry, controlled
publishing rehearsal in Phase 4B:

1. **Rehearsal Scope**:
   - Create 1 test Story (`rehearsal-story`) with 1 cover image.
   - Create 1 test Moment (`rehearsal-moment`) with a 2-photo album.
2. **Rehearsal Verifications**:
   - Test image processing and orientation preservation.
   - Verify local dev preview resolves locally without external network calls.
   - Test `publish-media.mjs --dry-run` and `--prod` execution against R2.
   - Verify remote HEAD metadata and byte checksums.
   - Verify draft toggle behavior in dev vs build.
   - Verify Git isolation and successful GitHub Pages build.
   - Perform clean rollback or archive of rehearsal test entries.
