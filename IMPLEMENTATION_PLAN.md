# Implementation Roadmap & Engineering Plan

## 1. Executive Summary

This roadmap defines the engineering plan for constructing the production
website "山 / SHAN — Notes along the way". The plan implements an
R2-First media architecture with strict Git isolation, transitioning through
three verifiable phases:
- **Phase 1**: Astro foundation, visual design tokens, self-hosted fonts,
  responsive layouts, static route scaffolding, and local media dev strategy.
- **Phase 2**: Content Layer schemas, media processing & EXIF stripping,
  Cloudflare R2 publishing interface, decoupled resolver, and interactive
  islands (Search & Lightbox).
- **Phase 3**: Automated Git isolation checks, CI/CD pipeline, GitHub Pages
  deployment, production R2 configuration, custom domain guide, and author docs.

---

## 2. Phase 1: Astro Foundation & Visual Implementation (COMPLETED)

### 2.1 Objectives
- Initialize the Astro 5 SSG workspace with TypeScript strict mode and Tailwind
  CSS.
- Establish 1:1 parity with the prototype's visual design system, CSS custom
  properties, and responsive breakpoints.
- Self-host Google Fonts via `@fontsource` packages to eliminate external CDN
  latency and third-party tracking.
- Build the core page layout components (Header, Footer, Mobile Drawer) and
  stub all static routes.
- Implement a local media development strategy that functions entirely without
  a custom domain, Cloudflare credentials, or external network access.

### 2.2 Engineering Tasks

1. **Task 1.1: Project Initialization & Configuration (COMPLETED)**
   - Initialize Astro 5 project with `output: 'static'`.
   - Configure `tsconfig.json` with strict type checking.
   - Configure `tailwind.config.mjs` with custom color tokens
     (`--bg`, `--paper`, `--text`, `--muted`, `--line`, `--accent`, `--soft`)
     and serif font definitions with `darkMode: 'class'`.
2. **Task 1.2: Typography & Self-Hosted Font Assets (COMPLETED)**
   - Install `@fontsource/dm-sans`, `@fontsource/noto-serif-tc`, and
     `@fontsource/noto-serif-jp`.
   - Import font packages in `src/styles/global.css` and configure CSS font
     stack fallbacks.
3. **Task 1.3: Core Layout Shell & Navigation (COMPLETED)**
   - Create `src/layouts/BaseLayout.astro` including metadata, skip links,
     theme initialization script, and responsive containers.
   - Implement `Header.astro` with character mark `山`, primary navigation tabs
     (`Stories`, `Moments`), and utility buttons.
   - Implement `MobileDrawer.astro` (`#mobile-menu`) with accessibility toggles.
   - Implement `Footer.astro` with author colophon and RSS/Tags links.
4. **Task 1.4: Static Route Scaffolding (COMPLETED)**
   - Scaffold static pages: `src/pages/index.astro`,
     `src/pages/stories/index.astro`, `src/pages/moments/index.astro`,
     `src/pages/about.astro`, `src/pages/tags/index.astro`, and
     `src/pages/404.astro`.
5. **Task 1.5: Theme Toggle & Responsive Polish (COMPLETED)**
   - Implement lightweight client script for theme switcher (`#theme`)
     supporting `localStorage` persistence and `body.dark` toggle.
   - Verify layout responsiveness across 1500px, 900px, and 600px breakpoints.
6. **Task 1.6: Local Media Dev Strategy & Git Isolation Baseline (COMPLETED)**
   - Configure `.gitignore` with strict photographic binary exclusion rules.
   - Configure local dev static serving for git-ignored local media directory
     `public/media/`.
   - Create initial baseline verification script ensuring zero binary files
     are tracked in Git.

### 2.3 Deliverables
- Fully functional Astro project compiling clean static HTML.
- Global stylesheet and Tailwind config with zero visual regressions against
  the prototype.
- Self-hosted typography rendering offline without external network requests.
- Navigable static shell for Stories, Moments, About, and Tags.
- Git-ignored local media directory structure ready for local photo preview.

### 2.4 Dependencies
- Completion of Phase 0 planning approval.
- Node.js >= 20.x runtime environment.
- *Note*: Does NOT require a custom domain or Cloudflare R2 credentials.

### 2.5 Acceptance Criteria
- `npm run build` succeeds with zero errors and outputs static files to `dist/`.
- No outbound requests to `fonts.googleapis.com` or `fonts.gstatic.com`.
- Dark mode toggle persists across page reloads via `localStorage`.
- Mobile navigation drawer opens and closes with correct `aria-expanded` states.
- 100% visual layout match against `shan-journal-source/dist/index.html`.
- Zero binary photographic assets committed or staged in Git.

### 2.6 Risks & Mitigations
- *Risk*: CJK serif font files (Noto Serif TC/JP) may cause large bundle sizes.
  *Mitigation*: Use subsetted WOFF2 fonts provided by `@fontsource` packages
  and apply `font-display: swap`.

---

## 3. Phase 2: Content Collections & Media Pipeline (COMPLETED)

### 3.1 Objectives
- Implement Astro Content Layer schemas with Zod validation for Stories and
  Moments.
- Migrate mock prototype content to Markdown format.
- Build the local media processing pipeline (`scripts/process-media.mjs`) with
  orientation correction, metadata extraction, and binary EXIF stripping.
- Implement the Cloudflare R2 upload interface (`scripts/publish-media.mjs`)
  with idempotent uploads and verification checks.
- Implement the decoupled media resolver (`src/lib/media.ts`) with dual local
  and production delivery modes.
- Build interactive islands: native `<dialog>` Search modal (`Cmd+K`) and
  fullscreen Lightbox Photo Viewer.

### 3.2 Engineering Tasks

1. **Task 2.1: Content Collections & Zod Schemas (COMPLETED)**
   - Define `src/content.config.ts` with `stories` and `moments` collections.
   - Port prototype sample data: 4 stories into `src/content/stories/*.md` and
     6 moments into `src/content/moments/*.md`.
   - Convert prototype `body` tuples into clean Markdown paragraphs, headings,
     and blockquotes.
2. **Task 2.2: Media Processing & EXIF Privacy Pipeline (COMPLETED)**
   - Create `media/originals/` directory for staging high-res master photos.
   - Implement `scripts/process-media.mjs` utilizing `sharp` and EXIF rotation.
   - Apply `.rotate()` to ensure orientation is permanently preserved before
     stripping tags.
   - Implement EXIF scrubbing: extract safe editorial attributes into
     `media-manifest.json`, while rigorously stripping GPS tags, serial
     numbers, and personal identity metadata.
   - Generate responsive WebP and AVIF variants (400w, 800w, 1600w) into
     git-ignored `.local-media/`.
3. **Task 2.3: Cloudflare R2 Publishing & Verification Tool (COMPLETED)**
   - Implement `scripts/publish-media.mjs` supporting dry-run, local mock, and
     production R2 upload modes.
   - Implement idempotent uploads using content-hashed keys.
   - Implement upload verification confirming remote objects before manifest
     commit.
4. **Task 2.4: Decoupled Media Resolver Integration (COMPLETED)**
   - Implement `src/lib/media.ts` resolving logical identifiers
     (`stories/forest-time/cover`) against `media-manifest.json`.
   - Resolve to local `/media/...` in development and `PUBLIC_MEDIA_BASE_URL`
     in production. Zero frontmatter edits needed when switching environments.
5. **Task 2.5: Story & Moment Component Rendering (COMPLETED)**
   - Implement `StoryCard.astro` (featured card and recent stories grid).
   - Implement `MomentCard.astro` (1:1 square photo card with album badge).
   - Implement dynamic routes `src/pages/stories/[...slug].astro` and
     `src/pages/moments/[...slug].astro`.
6. **Task 2.6: Interactive Islands: Search & Lightbox (COMPLETED)**
   - Build client search script with pre-indexed `search-data.json`.
   - Implement native `<dialog id="search-dialog">` with `Cmd+K` hotkey.
   - Implement native `<dialog id="viewer">` with cyclic arrow navigation.
7. **Task 2.7: Tag Directory & RSS Syndication (COMPLETED)**
   - Implement `src/pages/tags/index.astro` and `src/pages/tags/[tag].astro`.
   - Implement `src/pages/rss.xml.ts` and `src/pages/feed.xml.ts` feeds.

### 3.3 Deliverables
- Validated content collections compiling Markdown to HTML.
- Automated media processing script with verified GPS stripping.
- Cloudflare R2 upload script with upload verification.
- Generated `src/data/media-manifest.json` and responsive WebP/AVIF variants.
- Fully functional Search modal and Lightbox photo viewer.
- Auto-generated RSS 2.0 feed at `/rss.xml`.

### 3.4 Dependencies
- Phase 1 static layout and components.
- `sharp` native library installed.
- *Note*: R2 upload script can be developed and dry-run tested locally without
  requiring active R2 production credentials.

### 3.5 Acceptance Criteria
- Content validation passes with zero schema errors.
- Output images contain zero `GPSInfo` metadata tags.
- Lightbox viewer operates with keyboard arrows and closes with Escape key.
- Search dialog opens via `Cmd+K` / `Ctrl+K` and filters content accurately.
- Stories and Moments render with correct typography and responsive styles.
- Photographic binaries are completely excluded from Git staging.

### 3.6 Risks & Mitigations
- *Risk*: Sharp processing could slow down local builds with many photos.
  *Mitigation*: Implement SHA-256 hash cache in `media/cache/hashes.json` so
  unmodified images are processed only once.

---

## 4. Phase 3: Production Verification, Deployment & Documentation

### 4.1 Objectives
- Establish automated Git isolation checks ensuring zero photographic binary
  leaks in repository history.
- Configure GitHub Actions CI/CD pipeline deploying static pages to GitHub
  Pages without processing media in CI.
- Document the 13-step author publishing workflow and external backup
  responsibilities.
- Provide clear setup instructions for Cloudflare R2 and custom domains.
- Perform final production verification.

### 4.2 Engineering Tasks

1. **Task 3.1: Automated Git Isolation & Quality Scripts**
   - Implement `scripts/verify-git-isolation.ts`:
     - Fail if any tracked or staged file has photographic binary extension.
     - Fail if any tracked file exceeds 100KB (outside bundled font subsets).
     - Fail if private credentials (`.env`, API tokens) are detected.
     - Validate that every media ID referenced in Markdown exists in manifest.
   - Configure `npm run verify:isolation` and `npm run check`.
2. **Task 3.2: GitHub Actions CI/CD Pipeline**
   - Create `.github/workflows/deploy.yml` with Node.js 22, npm caching,
     isolation check, Astro build, and GitHub Pages deployment.
   - Confirm workflow runs with zero media processing and requires no cloud
     storage credentials.
3. **Task 3.3: Base Path & Deployment Verification**
   - Verify static asset links under both `base: '/'` and `base: '/SHAN'`.
   - Verify 404 page rendering and routing.
4. **Task 3.4: Author Publishing Guide & Demarcation**
   - Author `docs/AUTHORING_GUIDE.md`:
     - How to write new Stories in Markdown/MDX.
     - How to create Moments with photo sets.
     - Detailed 13-step media processing and R2 upload workflow.
     - Clear statement of external photo library backup responsibilities.
5. **Task 3.5: R2 Setup & Custom Domain Deployment Guide**
   - Author `docs/R2_MIGRATION_GUIDE.md`:
     - Instructions for provisioning Cloudflare R2 Standard Storage bucket.
     - Setting up custom media subdomain (`media.example.com`) and edge CDN.
     - Configuring GitHub Pages custom domain CNAME.
     - Disaster recovery procedures and bucket sync via `rclone`.
6. **Task 3.6: Production Domain & R2 Activation (When Authorized)**
   - *Prerequisite*: Domain purchased and R2 bucket created by owner.
   - Configure DNS records (apex CNAME and media CNAME).
   - Set GitHub repository secret `PUBLIC_MEDIA_BASE_URL`.
   - Perform end-to-end media delivery verification.

### 4.3 Task Readiness & Domain Dependency Matrix

| Task | Before Domain Purchase? | Needs Domain / R2? |
|---|---|---|
| Phase 1: All tasks | Completed (Verified) | No |
| Phase 2: All tasks | Yes (local dev mode) | No (dry-run upload) |
| Task 3.1: Git isolation checks | Yes | No |
| Task 3.2: GitHub Actions CI/CD | Yes (deploys to Pages) | No |
| Task 3.3: Base path verification | Yes | No |
| Task 3.4: Authoring documentation | Yes | No |
| Task 3.5: R2 & domain setup guide | Yes | No |
| Task 3.6: Production R2 activation | No (deferred to launch) | Yes |

### 4.4 Deliverables
- Automated Git isolation verification test suite.
- Working `.github/workflows/deploy.yml` CI/CD pipeline.
- Production website live on GitHub Pages.
- Complete documentation suite for authoring, media operations, and R2 setup.
- Verification test suite passing with 100% success.

### 4.5 Dependencies
- Phase 1 and Phase 2 implementations.
- GitHub repository with Pages permissions enabled.

### 4.6 Acceptance Criteria
- Pushing a commit to `main` triggers automated build and deploys to Pages.
- Zero photographic binary files tracked in Git history or working tree.
- Lighthouse scores exceed 95 across all categories.
- RSS feed passes W3C Feed Validation.
- Complete documentation enables author to publish posts independently.

### 4.7 Risks & Mitigations
- *Risk*: Author forgets to run R2 upload script before pushing content.
  *Mitigation*: CI isolation script validates that all referenced media IDs
  exist in `media-manifest.json`. Verification script can optionally perform
  HEAD check against `PUBLIC_MEDIA_BASE_URL`.
