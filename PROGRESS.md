# Project Progress Ledger & Executive Summary

## 1. Project Information & Current Status

- **Project**: 山 / SHAN — Notes along the way
- **Repository**: Personal publishing journal
- **Current Milestone**: Phase 1 — Astro Foundation & Visual Implementation
- **Status**: Phase 1 Complete — Stop Condition Reached
- **Date**: 2026-11-18
- **Working Directory**:
  `/Users/foo/Library/Mobile Documents/com~apple~CloudDocs/RAMDisk/SHAN`

---

## 2. Progress Ledger

### 2.1 Completed Tasks (Phase 0: Planning & Audit)
- [x] **Task 0.1**: Reference Template & Prototype Probing
- [x] **Task 0.2**: Information Architecture & Visual Audit
- [x] **Task 0.3**: Interactive Behaviors & Modals Analysis
- [x] **Task 0.4**: Content Models & Media Pipeline Architecture
- [x] **Task 0.5**: Engineering Roadmap & Decision Records
- [x] **Task 0.6**: Phase 0 Planning Documentation Suite
- [x] **Task 0.7**: Architecture Revision: R2-First Media & Git Isolation

### 2.2 Completed Tasks (Phase 1: Foundation & Visual Implementation)
- [x] **Task 1.1: Project Initialization & Modern Toolchain**
  - Initialized Astro 5 SSG (`output: 'static'`) with Node 22/26.
  - Configured TypeScript strict mode (`tsconfig.json`).
  - Integrated Tailwind CSS v4 via `@tailwindcss/vite`.
- [x] **Task 1.2: Typography & Self-Hosted Font Assets**
  - Installed `@fontsource/dm-sans`, `@fontsource/noto-serif-tc`, and
    `@fontsource/noto-serif-jp`.
  - Configured self-hosted WOFF2 font stacks in `src/styles/global.css`.
- [x] **Task 1.3: Core Layout Shell & Navigation**
  - Created `src/layouts/BaseLayout.astro` with skip links and metadata.
  - Implemented `Header.astro` with character mark `山` and primary tabs.
  - Implemented `MobileDrawer.astro` (`#mobile-menu`) with accessibility.
  - Implemented `Footer.astro` with colophon and RSS/Tags links.
- [x] **Task 1.4: Static Route Scaffolding**
  - Scaffolded `/`, `/stories/`, `/moments/`, `/about/`, `/tags/`, `/404.html`.
- [x] **Task 1.5: Theme Switching & Mobile Navigation**
  - Implemented client theme switcher with `localStorage` (`shan-theme`) and
    FOUC prevention.
  - Implemented mobile drawer toggle with `aria-expanded` attributes.
- [x] **Task 1.6: Local Media Isolation & Git Protection Baseline**
  - Configured `.gitignore` allowing approved UI assets (e.g. `favicon.svg`)
    while strictly barring photographic binaries.
  - Configured out-of-public dev media serving from `.local-media/` via Vite
    middleware in `astro.config.mjs`, ensuring `dist/` is 100% clean.
  - Implemented strict production URL check in `src/lib/media.ts`.
- [x] **Task 1.7: Automated Verification Suite**
  - Created `scripts/verify-isolation.mjs` and `scripts/test-phase1.mjs`.
  - Verified 100% test pass on builds, isolation, and page rendering.

### 2.3 Current Milestone Status
- Phase 0: **100% Complete**.
- Phase 1: **100% Complete**.
- Phase 2: **Ready to commence upon explicit user authorization**.

---

## 3. Engineering Roadmap Schedule (Phases 1 - 3)

### Phase 1: Astro Foundation & Visual Implementation
- Status: **Completed & Verified**

### Phase 2: Content Collections & Media Pipeline
- Status: **Pending Phase 1 Approval**
- Target Tasks:
  - Implement Astro Content Layer schemas with Zod validation.
  - Port sample stories and moments into Markdown format.
  - Build Sharp media processing pipeline with EXIF orientation and scrubbing.
  - Implement Cloudflare R2 upload tool (`scripts/publish-media.ts`).
  - Implement decoupled media resolver (`src/lib/media.ts`).
  - Build native `<dialog>` Search modal and Lightbox Viewer.
  - Configure automated RSS feed generation via `@astrojs/rss`.

### Phase 3: Testing, Deployment & Documentation
- Status: **Planned**
- Target Tasks:
  - Implement automated Git isolation checks in CI workflow.
  - Configure GitHub Actions CI/CD deploying to GitHub Pages without media.
  - Author publishing guide (`AUTHORING_GUIDE.md`) with 13-step workflow.
  - Author R2 & custom domain setup guide (`R2_MIGRATION_GUIDE.md`).
  - Perform production domain and R2 verification (when authorized).

---

## 4. 繁體中文完成報告 (Phase 1 Completion Report)

### 4.1 實作完成元件與架構調整
1. **實作完成項目**：
   - Astro 5 SSG 核心專案初始化與 TypeScript Strict 嚴格型別校驗。
   - Tailwind CSS v4 整合（採用官方 `@tailwindcss/vite` 引擎）。
   - 全站字型本機自託管（DM Sans、思源宋體繁中與日文子集）。
   - 視覺設計系統 1:1 對齊原型 CSS 變數（雙色系紙質與深色模式）。
   - `BaseLayout.astro` 版面、`Header.astro`、`Footer.astro` 與
     `MobileDrawer.astro`。
   - 6 組靜態路由骨架（首頁、Stories、Moments、About、Tags、404）。
   - 主題切換按鈕（支援 `localStorage` 記憶與防閃爍腳本）。
   - 行動裝置漢堡選單抽屜（具備 `aria-expanded` 無障礙標籤）。

2. **三項審查要求之落實調整**：
   - **Git 隔離政策精緻化**：保留對攝影資產的嚴格阻擋，但明確允許經核准
     之非攝影 UI 資源（如 `public/favicon.svg`）；檔案門禁採實用原則，
     防範大檔與金鑰洩漏。
   - **本機媒體與建置輸出實體隔離**：本機開發預覽圖檔存放於專案根目錄外
     之 `.local-media/`，透過 `astro.config.mjs` 中的 Vite 中介軟體於
     `astro dev` 期間提供服務。`astro build` 編譯時完全不觸及該目錄，
     從根本杜絕 `dist/` 意外夾帶本地照片之風險。
   - **嚴格生產環境媒體網址**：`src/lib/media.ts` 在生產建置模式下，
     強制要求配置 `PUBLIC_MEDIA_BASE_URL`，若未配置即拋出錯誤中斷，
     嚴禁靜默降級至文檔佔位網域（`media.example.com`）。

### 4.2 檔案變動與測試結果
- **新建檔案**：`astro.config.mjs`、`tsconfig.json`、`.gitignore`、
  `package.json`、`public/favicon.svg`、`src/styles/global.css`、
  `src/layouts/BaseLayout.astro`、`src/components/Header.astro`、
  `src/components/Footer.astro`、`src/components/MobileDrawer.astro`、
  `src/pages/index.astro`、`src/pages/stories/index.astro`、
  `src/pages/moments/index.astro`、`src/pages/about.astro`、
  `src/pages/tags/index.astro`、`src/pages/404.astro`、`src/lib/media.ts`、
  `src/data/media-manifest.json`、`scripts/verify-isolation.mjs`、
  `scripts/test-phase1.mjs`。
- **測試驗證成果**：
  1. `npm run check`：通過（16 個 Astro 檔案，0 錯誤、0 警告）。
  2. `npm run build`：通過（6 個靜態 HTML 頁面於 650ms 內編譯完成）。
  3. `npm run verify:isolation`：通過（Git 零照片二進位、dist/ 零照片二
     進位）。
  4. `node scripts/test-phase1.mjs`：全數通過（頁面、版面、無障礙與字型
     檢查均通過）。

### 4.3 與原型之差異、已知限制與 Phase 2 就緒狀態
- **視覺差異**：Phase 1 僅包含靜態外框與各頁骨架，Stories 卡片與 Moments
  相簿網格之文章實體內容將於 Phase 2 載入。
- **已知限制**：Search 搜尋彈窗與 Lightbox 燈箱為 Phase 2 交付項目，目
  前按鈕已就位，將於下階段綁定事件。
- **Phase 2 就緒評估**：**完全就緒**。基礎工程穩定且通過全部防護測試。

**Stop Condition**: Phase 1 實作已全部完成並驗證通過。未開始 Phase 2，
停步等待專案負責人審閱與授權。
