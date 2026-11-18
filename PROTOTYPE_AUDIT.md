# Phase 0 Prototype Audit & Inspection Report

## Executive Summary

This document presents a comprehensive audit of the interactive prototype and
reference codebase for "山 / SHAN — Notes along the way", a personal
publishing website for a single author. The audit establishes the baseline
information architecture, visual design system, interactive behaviors, and
technical specifications required to transition the publication from a
client-side buildless prototype to a modern static production architecture.

---

## 1. Inspection Environment & Limitations

The inspection was conducted against two reference sources:
1. Hosted Review URL: `https://shan-journal-review.land-3015.chatgpt.site/`
2. Local Reference Template: `shan-journal-source/` (workspace directory)

### 1.1 Environmental Network Sandbox
- **Command Executed**:
  `curl -I https://shan-journal-review.land-3015.chatgpt.site/`
- **Observed Result**:
  `curl: (6) Could not resolve host: shan-journal-review.land-3015.chatgpt.site`
- **Direct Finding**: The automated execution environment operates within a
  strict network sandbox without outbound public DNS resolution or external
  internet access. Unsandboxed commands timed out awaiting interactive user
  permission prompts.

### 1.2 Unindexed Private Review Domain
- **Search Probing**: A web search query for
  `site:shan-journal-review.land-3015.chatgpt.site` yielded 0 indexed results.
- **Direct Finding**: The remote review domain is an unindexed, private staging
  environment hosted on OpenAI's `.chatgpt.site` infrastructure.

### 1.3 Local Source Equivalence & Revision Lock
- Inspection of `shan-journal-source/README.md` confirmed:
  - Source Revision: `b851d4f12f18872018e2d9f3a98c75db4dfcb554`
  - Explicit Note: "The private access gate on the hosted review site is
    provided by the hosting service and is not part of this source code."
- **Audit Grounding Rule**: In accordance with project requirements, the local
  reference repository is treated as the single source of truth for all layout,
  typography, styling, interaction logic, and content schema details. Behaviors
  requiring live cloud infrastructure or external networks are strictly noted as
  unverified rather than fabricated or assumed.

---

## 2. Information Architecture, Pages & Routes

The prototype operates as a buildless single-page application (SPA) running
client-side routing driven by `location.hash` changes.

### 2.1 Route Mapping
The client routing table in `dist/app.js` maps hash tokens as follows:

- `#/` or `#stories` (Stories Index):
  Rendered by `renderStories()`. Displays featured story & recent stories grid.
- `#moments` (Moments Index):
  Rendered by `renderMoments()`. Displays 3-column square photo grid.
- `#story/:id` (Story Detail):
  Rendered by `renderStory(id)`. Long-form reading article with cover image.
- `#moment/:id` (Moment Detail):
  Rendered by `renderMoment(id)`. Photo note with stacked full images.
- `#about` (About Profile):
  Rendered statically. Author introduction & multilingual philosophy.
- `#tags` (Tags Directory):
  Rendered statically. Tag listing with cumulative post counters.
- `feed.xml` (RSS Feed):
  Static XML file serving RSS 2.0 feed channel.

### 2.2 Page Catalogs & Structures

#### 1. Stories Listing (`#stories`)
- **Page Header**: Main title ("Notes along the way.") and introspective aside
  note ("山 · SHAN / A personal journal / Words, photos, quiet corners.").
- **Tag Filter Bar**: Horizontal scrollable container containing pill buttons
  for each tag (`All`, `Forestry`, `Nature`, `Technology`, etc.).
- **Featured Story Card**: Prominent top card with a 2-column layout (1.35fr
  cover image, 1fr text container). Displays eyebrow tag, publication date,
  reading time, large serif title, excerpt, and language indicator.
- **Recent Stories Grid**: 3-column card grid displaying remaining stories with
  cover thumbnails, publication meta, headings, and excerpts.
- **Author Aside Card**: Final column card displaying author background note.

#### 2. Moments Listing (`#moments`)
- **Page Header**: Section title ("Life, in passing.") and subtitle.
- **Tag Filter Bar**: Filter chips identical to the Stories view.
- **Photo Grid**: 3-column grid of 1:1 aspect ratio square photo cards.
- **Card Elements**: Dark gradient scrim overlay at the bottom, moment title,
  location string, and an album indicator badge (`▧ N`) when containing more
  than one photograph.

#### 3. Story Detail Article (`#story/:id`)
- **Back Navigation**: Subtle link ("← All stories") returning to `#stories`.
- **Article Header**: Category eyebrow, 44px serif title, publication date, and
  estimated reading time.
- **Cover Image**: Full-width responsive photograph with rounded corners.
- **Article Body**: 720px centered reading column. Headings rendered as `<h2>`
  serif elements, leading text as larger introduction paragraphs, quotes as
  indented italic blockquotes with left border accent.
- **Tags & Related Content**: Footer chip list and bottom navigation links to
  adjacent stories.

#### 4. Moment Detail View (`#moment/:id`)
- **Back Navigation**: Text link ("← All moments") returning to `#moments`.
- **Header Meta**: Geographic location eyebrow, serif title, date, and caption.
- **Photo Stack**: Vertically stacked, full-resolution photographs. Clicking any
  photograph triggers the fullscreen lightbox viewer.
- **Interactive Hint**: Bottom caption badge reminding the reader that photos
  can be clicked to expand.

#### 5. About Page (`#about`)
- **Eyebrow & Heading**: "Behind the journal" / "Hello, I’m Shan."
- **Trilingual Narrative**: Three structured paragraphs written in English,
  Traditional Chinese (繁體中文), and Japanese (日本語), reflecting the
  author's multilingual voice and cross-cultural background.
- **Editorial Colophon**: Details on typography, static generation philosophy,
  and photographic camera equipment.

#### 6. Tags Directory (`#tags`)
- **Header**: "Follow a thread." and thematic description.
- **Tag Matrix**: Aggregated list of all unique tags across stories and
  moments. Each tag button displays the tag name and total combined count of
  associated entries. Clicking a tag directs the user to the filtered listing.

---

## 3. Navigation Hierarchy & Shell Components

### 3.1 Global Header
- **Desktop Layout**: Height 100px, max-width 1192px (1240px on >=1500px).
- **Brand Mark**: Left-aligned character `山` (34px, 300 weight serif) paired
  with two-line metadata (`SHAN` / `A PERSONAL JOURNAL`).
- **Primary Navigation**: Centered absolutely in desktop view:
  - `Stories` (points to `#/` or `#stories`)
  - `Moments` (points to `#moments`)
  - Active tab indicated by bold weight and bottom border rule.
- **Utility Actions**: Right-aligned utility group:
  - `About` (text link to `#about`)
  - Search Button (`⌕`, triggers `#search-dialog`)
  - Theme Switcher (`◐`, toggles light/dark mode)
  - Mobile Menu Toggle (`☰`, hidden on desktop, visible `<= 600px`)

### 3.2 Mobile Navigation Drawer
- **Drawer Element**: `#mobile-menu` container situated directly below header.
- **Responsive Behavior**: Activated via the hamburger button on screens
  `<= 600px`. Contains stacked links: `About`, `Explore tags`, `RSS feed`.
- **Dismissal**: Closes automatically whenever any navigation link is tapped.

### 3.3 Global Footer
- **Layout**: Two-column flex layout on desktop, stacked column on mobile.
- **Left Identity**: Character mark `山` and journal motto:
  *"Made of words, light, and a little wandering."*
- **Right Links**: Navigation for `About`, `Tags`, `RSS ↗`, and copyright
  notice (`© 2026 SHAN`).

---

## 4. Visual Design System

### 4.1 Typography System

#### Font Families
- **UI / Body Sans**: `'DM Sans', Arial, sans-serif`
  - Sourced in prototype via Google Fonts CDN (weights 400, 500, 600, 700).
  - Used for interface labels, navigation, metadata chips, excerpts, and forms.
- **Editorial Serif**: `Georgia, 'Noto Serif TC', 'Noto Serif JP', serif`
  - Defined in prototype CSS variable `--serif`.
  - Sourced in prototype via Google Fonts CDN (`Noto Serif TC` weights 400, 500,
    600; `Noto Serif JP` weights 400, 500).
  - Used for brand mark, article headings, blockquotes, and Chinese/Japanese
    editorial prose.

#### Type Scale & Hierarchy
- **Brand Title**: 34px / font-weight 300 (desktop), 28px (mobile).
- **Page Hero Heading**: 48px / -1.8px letter-spacing (desktop), 37px (mobile).
- **Article H1**: 44px / 1.25 line-height / -1px letter-spacing.
- **Featured Card Title**: 31px / 1.35 line-height / -0.8px letter-spacing.
- **Recent Card Title**: 23px / 1.4 line-height / serif.
- **Moment Card Title**: 21px / serif.
- **Body Prose**: 17px / 1.95 line-height (desktop), 16px / 1.85 (mobile).
- **Section Subheads / Eyebrows**: 10px - 11px / 1.8px - 2.2px letter-spacing /
  uppercase 600 weight.
- **Meta Chips / Badges**: 10px - 11px / sans-serif.

### 4.2 Color System & Design Tokens

The color system is built around high-contrast, warm, tactile paper tones
reminiscent of Japanese natural stationery.

- `--bg`:
  Light `#faf9f7` | Dark `#1c1c1e` (Main page canvas background)
- `--paper`:
  Light `#f0eeeb` | Dark `#28282b` (Card container, modal, drawer surface)
- `--text`:
  Light `#292929` | Dark `#eeece8` (Primary body copy and headings)
- `--muted`:
  Light `#706d69` | Dark `#b0ada8` (Secondary copy, metadata, timestamps)
- `--line`:
  Light `#dedbd6` | Dark `#404044` (Subtle borders, dividers, chip outlines)
- `--accent`:
  Light `#41464e` | Dark `#c2c9d3` (Active tab, focused element, pill fill)
- `--soft`:
  Light `#e9e7e3` | Dark `#333338` (Hover backgrounds, secondary buttons)

#### Overlay Tokens
- **Search Dialog Backdrop**: `#1119` (`rgba(17, 17, 17, 0.6)`) with
  `backdrop-filter: blur(5px)`.
- **Photo Viewer Backdrop**: `#141416` (full-viewport opaque darkroom surface).

### 4.3 Layout & Responsive Breakpoints

The responsive layout adapts across four distinct viewport tiers:

1. **Ultra-Wide Screens (`>= 1500px`)**:
   - Header and footer max-width: 1240px.
   - Main content container max-width: 1140px.
   - Featured story hero image height: 410px.
2. **Desktop Standard (`901px - 1499px`)**:
   - Header and footer max-width: 1192px.
   - Main content container max-width: 1100px.
   - Header height: 100px. Primary navigation centered.
   - Featured story card: 2 columns (`1.35fr 1fr`).
   - Recent stories: 3 columns (`repeat(3, 1fr)`).
   - Moments grid: 3 columns square.
3. **Medium Tablets (`<= 900px`)**:
   - Main container horizontal margins: 30px - 35px.
   - Card grid gap reduced from 32px to 20px.
   - Card image height reduced from 190px to 160px.
   - Aside intro box hidden from header view.
4. **Mobile Devices (`<= 600px`)**:
   - Header height reduced to 78px. Brand mark reduced to 28px.
   - Primary navigation links placed inline next to brand/icons.
   - Secondary text links hidden; hamburger toggle button displayed.
   - Featured card collapsed from 2 columns to single stacked column.
   - Recent cards converted from 3 vertical columns into a 1-column list of
     horizontal rows (`1fr 112px`) with excerpt text hidden.
   - Moments grid collapsed from 3 columns to 2 columns with 8px gap.
   - Footer converted to vertical flex column layout.

---

## 5. Interactive Behaviors & Modal Dialogs

### 5.1 Tag Filtering
- **Trigger**: Clicking any tag chip in Stories, Moments, or Tags directory.
- **State**: Tracks `activeTag`. Rerenders current view filtering items whose
  `tags` array includes the selected tag.
- **Feedback**: Updates active chip CSS class and adjusts matching count header
  (e.g., `3 STORIES` or `4 MOMENTS`).
- **Empty State**: Renders empty state message when zero items match:
  *"No stories found for this tag."*

### 5.2 Quick Search Dialog (`#search-dialog`)
- **Activation**: Click `#search-button` (`⌕`) or press keyboard shortcut
  `Cmd+K` (macOS) / `Ctrl+K` (Windows/Linux).
- **Implementation**: Native HTML5 `<dialog id="search-dialog">`.
- **Search Algorithm**: In-memory substring query against:
  - `title`
  - `excerpt`
  - `caption`
  - `location`
  - `tags` (joined)
  - `body` text paragraphs (joined)
- **Dismissal**: Pressing `Escape` key or clicking on the blurred backdrop
  outside the dialog's bounding client rectangle.

### 5.3 Fullscreen Lightbox Photo Viewer (`#viewer`)
- **Activation**: Clicking any photograph within a moment entry.
- **Implementation**: Native HTML5 `<dialog id="viewer">` styled to `100vw` by
  `100dvh` with `#141416` background.
- **Controls**:
  - Previous (`←`) and Next (`→`) navigation buttons.
  - Keyboard arrow navigation: `ArrowLeft` and `ArrowRight`.
  - Cyclic modulo indexing: allows continuous circular navigation.
  - Navigation controls are hidden/disabled when the entry has only 1 photo.
  - Header displays current counter `[i + 1] / [total]`, title, and location.
- **Dismissal**: Close button (`✕`) or pressing `Escape`. Backdrop clicks do
  not dismiss the viewer, preventing accidental loss of viewer state.

### 5.4 Theme Switching (`#theme`)
- **Storage**: Key `'shan-theme'` in browser `localStorage`.
- **Toggle Mechanism**: Toggles `.dark` class on `document.body`.
- **Accessibility**: Updates button `aria-label` dynamically between
  `Switch to dark theme` and `Switch to light theme`.

### 5.5 Mobile Navigation Drawer (`#mobile-menu`)
- **Toggle**: Clicking `#menu` button toggles `hidden` attribute and toggles
  `aria-expanded` between `"true"` and `"false"`.
- **Routing Integration**: Closes automatically upon any hash navigation.

### 5.6 Keyboard Accessibility & Focus
- **Skip Link**: `<a class="skip" href="#main">Skip to content</a>` positioned
  offscreen (`top: -100px`), shifting to `top: 5px` upon `:focus`.
- **Focus Rings**: `:focus-visible { outline: 2px solid var(--accent); }`.

---

## 6. Comprehensive Feature Classification Matrix

To ensure absolute fidelity during migration, all features identified across
the prototype and requirements are classified into three strict categories:
1. **Verified**: Directly observed and confirmed via local source code and
   runtime verification.
2. **Observed but not fully verified**: Inspected in code or styles, but full
   behavior depends on external networks or unverified cloud environments.
3. **Inferred / requiring confirmation**: Architectural requirement or
   operational workflow deduced from project context and user request.

### 6.1 Verified Features
- **Hash Routing Mechanism**: `dist/app.js:16` handles hash changes.
- **Stories Schema**: `dist/content.js:3-8` (id, title, date, lang, body).
- **Moments Schema**: `dist/content.js:9-14` (location, caption, photos).
- **Master Tags Taxonomy**: `dist/app.js:1` (8 master tags).
- **Header & Brand Layout**: `dist/style.css:2-4` (100px/78px heights).
- **Responsive Media Queries**: `dist/style.css:3-5` (1500px, 900px, 600px).
- **Mobile Horizontal Card**: `dist/style.css:5` (1fr + 112px grid row).
- **Light Theme Tokens**: `dist/style.css:2` (--bg, --paper, --text, etc.).
- **Dark Theme Tokens**: `dist/style.css:2` (body.dark overrides).
- **Font Stacks**: `dist/style.css:1-2` (DM Sans & Noto Serif stacks).
- **Tag Filtering Logic**: `dist/app.js:4-10` (activeTag filter & counters).
- **Native Dialog Search**: `dist/app.js:20-21` (Cmd+K & substring match).
- **Lightbox Photo Viewer**: `dist/app.js:13-15` (arrow keys & cyclic loop).
- **LocalStorage Theme Toggle**: `dist/app.js:18` (shan-theme persistence).
- **Mobile Menu Drawer**: `dist/app.js:19` (aria-expanded & hidden toggle).
- **Skip Link Accessibility**: `dist/style.css:2` (:focus top shift).
- **Static RSS Feed**: `dist/feed.xml` (RSS 2.0 XML channel structure).

### 6.2 Observed But Not Fully Verified Features
- **External Google Fonts Delivery**: `@import` observed in `dist/style.css:1`;
  live CDN delivery unverified due to sandbox network isolation.
- **Unsplash Image CDN Delivery**: `dist/content.js:1` helper observed; image
  fetching unverified due to sandbox network isolation.
- **Backdrop Filter Support**: `backdrop-filter: blur(5px)` declared; visual
  rendering varies across legacy mobile browsers.
- **Touch Swipe Gestures**: Keyboard and click handlers verified; touch swipe
  deltas are not implemented in the prototype source code.

### 6.3 Inferred / Requiring Confirmation
- **Clean Static Routes**: Migration from hash SPA (`#story/id`) to SSG static
  HTML routes (`/stories/id/`).
- **Markdown / MDX Collections**: Migration from raw JS objects in `content.js`
  to Astro Content Layer / Zod schemas.
- **Portable Media Identifiers**: Migration from Unsplash URLs to decoupled
  logical IDs (`stories/forest-time/cover`) via `media-manifest.json`.
- **Automated EXIF Scrubbing**: Implementation of pre-build Sharp pipeline to
  strip GPS tags while retaining safe capture timestamps.
- **Automated RSS Build**: Dynamic RSS generation via `@astrojs/rss`.
- **Hosting Access Gate**: Staging authentication mentioned in `README.md:25`
  is external to source code and not needed on public GitHub Pages.
- **GitHub Pages Deployment**: Production deployment using GitHub Actions.
- **Cloudflare R2 Migration**: Future storage transition without rewriting
  content markdown frontmatter.

---

## 7. Unresolved Questions & Technical Considerations

1. **Touch Swipe Support in Lightbox**:
   The prototype handles keyboard arrow events and mouse clicks, but does not
   implement mobile touch gestures (`touchstart`/`touchend` swipe delta). Should
   touch swipe gestures be added as an enhancement during Phase 2?
2. **Reading Time Calculation**:
   The prototype hardcodes reading times (e.g. `'7 min read'`). In Astro, should
   this be automatically computed from word count during compilation, or
   specified manually in frontmatter?
3. **Multilingual Story Model**:
   Stories declare a `lang` property (`en`, `ja`, `zh-Hant`), but there are no
   cross-language translation links between entries. Are stories independent
   posts written in distinct languages, or will future stories have direct
   translations?
4. **Search Scalability**:
   The prototype searches an in-memory array of 10 items. For production, a
   static pre-built JSON search index (`search-index.json`) is planned. Will
   article volume remain small (< 100 posts) allowing simple substring search,
   or will fuzzy search (e.g. Pagefind or MiniSearch) be required?
