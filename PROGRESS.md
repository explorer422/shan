# Project Progress Ledger & Executive Summary

## 1. Project Information & Current Status

- **Project**: 山 / SHAN — Notes along the way
- **Repository**: Personal publishing journal
- **Current Milestone**: Phase 2 — Content Collections & Media Pipeline
- **Status**: Phase 2 Complete — Stop Condition Reached
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
- [x] **Task 1.1**: Project Initialization & Modern Toolchain
- [x] **Task 1.2**: Typography & Self-Hosted Font Assets
- [x] **Task 1.3**: Core Layout Shell & Navigation
- [x] **Task 1.4**: Static Route Scaffolding
- [x] **Task 1.5**: Theme Switching & Mobile Navigation
- [x] **Task 1.6**: Local Media Isolation & Git Protection Baseline
- [x] **Task 1.7**: Automated Verification Suite (Phase 1)

### 2.3 Completed Tasks (Phase 2: Content Collections & Media Pipeline)
- [x] **Task 2.1: Content Collections & Zod Schemas**
  - Configured `src/content.config.ts` using Astro 5 Content Layer & Zod.
  - Implemented `stories` and `moments` collections with `mediaItemSchema`.
  - Migrated 4 stories and 6 moments from prototype to clean Markdown.
  - Formatted all frontmatter and markdown body to strictly <= 80 chars.
- [x] **Task 2.2: Media Processing & EXIF Privacy Pipeline**
  - Generated 16 sample photos in `media/originals/` (4 stories, 12 moments).
  - Implemented `scripts/process-media.mjs` using `sharp`.
  - Applied `.rotate()` auto-orientation and EXIF GPS scrubbing.
  - Generated responsive WebP/AVIF variants (400w, 800w, 1600w) in
    `.local-media/`.
  - Output clean `src/data/media-manifest.json` (all lines <= 80 chars).
- [x] **Task 2.3: Cloudflare R2 Publishing & Verification Tool**
  - Implemented `scripts/publish-media.mjs` supporting `--dry-run`, `--mock`,
    and `--verify-only`.
  - Implemented idempotent content-hashed key checks and remote verification.
- [x] **Task 2.4: Decoupled Media Resolver Integration**
  - Implemented `src/lib/media.ts` resolving logical identifiers
    (`stories/forest-time/cover`) to local dev proxy or production R2.
  - Enforced build error if `PUBLIC_MEDIA_BASE_URL` is omitted in production.
- [x] **Task 2.5: Visual Implementation: Stories, Moments, and Tags**
  - Built `StoryCard.astro` and `FeaturedStory.astro` with metadata.
  - Built `MomentCard.astro` with 1:1 aspect ratio, album count, and label.
  - Built dynamic detail routes `src/pages/stories/[...slug].astro` and
    `src/pages/moments/[...slug].astro`.
  - Built tag aggregation in `src/pages/tags/index.astro` and tag detail
    route `src/pages/tags/[tag].astro` with slugification.
  - Built RSS feeds in `src/pages/rss.xml.ts` and `src/pages/feed.xml.ts`.
- [x] **Task 2.6: Interactive Islands: Search Modal & Photo Lightbox**
  - Implemented native `<dialog id="search-dialog">` with `Cmd+K` shortcut,
    live query filtering, and static endpoint `src/pages/search-data.json.ts`.
  - Implemented native `<dialog id="viewer">` with cyclic arrow navigation,
    photo counter, caption display, and escape key closure.
- [x] **Task 2.7: Git Isolation Checks & 10-Scenario Test Suite**
  - Enhanced `scripts/verify-isolation.mjs` with negative leak test.
  - Implemented `scripts/test-phase2.mjs` testing all 10 failure/media
    scenarios with 100% pass rate.
- [x] **Task 2.8: Dynamic Soft Tag System (Phase 2.1 Refinement)**
  - Implemented `getActiveTags` in `src/lib/tag.ts` dynamically inferring
    tags from published content sorted by post frequency.
  - Eliminated static tag lists across Home, Stories, and Moments pages,
    ensuring zero-post tags are hidden and new tags automatically appear.

### 2.4 Current Milestone Status
- Phase 0: **100% Complete**.
- Phase 1: **100% Complete**.
- Phase 2: **100% Complete & Verified**.
- Phase 3: **Ready to commence upon explicit user authorization**.

---

## 3. Engineering Roadmap Schedule (Phases 1 - 3)

### Phase 1: Astro Foundation & Visual Implementation
- Status: **Completed & Verified**

### Phase 2: Content Collections & Media Pipeline
- Status: **Completed & Verified**

### Phase 3: Testing, Deployment & Documentation
- Status: **Pending Phase 2 Review & Authorization**
- Target Tasks:
  - Configure GitHub Actions CI/CD deploying to GitHub Pages without media.
  - Author publishing guide (`AUTHORING_GUIDE.md`) with 13-step workflow.
  - Author R2 & custom domain setup guide (`R2_MIGRATION_GUIDE.md`).
  - Perform production domain and R2 verification (when authorized).

---

## 4. 繁體中文完成報告 (Phase 2 Completion Report)

### 4.1 實作完成元件與架構功能
1. **內容集合與 Zod Schema 驗證**：
   - `src/content.config.ts`：以 Astro 5 原生 `glob` 與
     `astro/zod` 定義 `stories` 與 `moments` 兩大內容集合。
   - 完整支援邏輯媒體引用 `coverMedia` 與 `media` 陣列。
   - 移轉 4 篇長文（Stories）與 6 則相簿（Moments），
     完整保留原作。
2. **全站視覺 1:1 對齊與路由實作**：
   - 首頁與 Stories：精選大圖卡片（FeaturedStory）與
     網格卡片（StoryCard），支援即時標籤篩選。
   - Moments 攝影相簿：1:1 正方形相簿卡片（MomentCard）、
     多圖徽章、漸層標題與中文字體排版。
   - 標籤系統：`/tags/` 匯總標籤數量；`/tags/[tag]/`
     提供專屬標籤分類聚合頁面。
   - 內容排版：整合 `.prose` 與自託管思源宋體，
     支援首段粗體、引言 blockquote 與相關推薦文章。
   - RSS 訂閱源：提供 `/rss.xml` 與 `/feed.xml`。
3. **互動功能（純原生 HTML5 + TypeScript）**：
   - 搜尋彈窗（SearchDialog）：以原生 `<dialog>` 實作，
     支援 `Cmd+K` 快速鍵開啟、即時比對與 Esc 關閉。
   - 燈箱相簿檢視器（LightboxViewer）：以 `<dialog>` 實作，
     支援全螢幕瀏覽、左右鍵循環導覽、相片計數與
     拍攝資訊。
4. **本機媒體處理管道（Sharp Pipeline）**：
   - `scripts/process-media.mjs`：自動讀取 `media/originals/`，
     調用 `sharp.rotate()` 修正 EXIF 轉向，剔除 GPS 經緯度，
     產出 400w/800w/1600w WebP 與 1600w AVIF 規格至 `.local-media/`。
   - 自動生成符合 80 字元限制之 `src/data/media-manifest.json`。
5. **Cloudflare R2 發布工具**：
   - `scripts/publish-media.mjs`：支援 `--dry-run`、`--mock` 與
     `--verify-only`，具備基於內容雜湊的等冪性（Idempotent）
     與遠端物件驗證防護機制。
6. **媒體解析抽象層（Media Resolver）**：
   - `src/lib/media.ts`：Markdown frontmatter 僅存放邏輯識別碼
     （如 `stories/forest-time/cover`），開發時指向本機代理，
     生產建置時依據 `PUBLIC_MEDIA_BASE_URL` 解析至 R2 CDN，
     若缺少環境變數則嚴格拋錯中斷建置，杜絕靜默降級。

### 4.2 測試與隔離驗證成果
- `npm run check`：通過（35 個檔案，0 錯誤、0 警告、0 提示）。
- `npm run build`：通過（23 個靜態頁面於 1.17s 完成）。
- `npm test`：執行全部 3 組自動化測試套件，100% 通過：
  1. `scripts/verify-isolation.mjs`：Git 零照片、dist/ 零照片、
     負向洩漏測試（模擬暫存相片即刻被攔截）。
  2. `scripts/test-phase1.mjs`：版面骨架、無障礙標籤與字型。
  3. `scripts/test-phase2.mjs`：完成 10 項關鍵異常情境驗證：
     - 情境 1：有效媒體識別碼解析（含響應式 srcset）。
     - 情境 2：缺失媒體識別碼之降級（回退 placeholder）。
     - 情境 3：缺失影像規格之檢查與檔案完整性確認。
     - 情境 4：中斷上傳之狀態不變性（manifest 未遭污染）。
     - 情境 5：重複上傳等冪性驗證
       （略過已存物件，0 冗餘）。
     - 情境 6：部分規格上傳失敗之原子性回退。
     - 情境 7：Manifest 寫入失敗之保護（保留原始清單）。
     - 情境 8：EXIF 轉向校正（自動校正並重設 orientation）。
     - 情境 9：帶有 GPS 之照片處理（經緯度徹底洗淨剔除）。
     - 情境 10：生產環境缺少基底網址時嚴格阻擋建置。
- **80 字元硬性折行規範**：所有新建及修改之 `.astro`、`.ts`、
  `.mjs`、`.json`、`.md` 原始碼與文件均符合 80 字元以內限制。

### 4.3 Phase 2 交付檔案清單
- **內容集合配置與內容檔**：
  - `src/content.config.ts`
  - `src/content/stories/forest-time.md`
  - `src/content/stories/tokyo-walk.md`
  - `src/content/stories/digital-garden.md`
  - `src/content/stories/mountain-light.md`
  - `src/content/moments/cedar-morning.md`
  - `src/content/moments/tokyo-evening.md`
  - `src/content/moments/above-clouds.md`
  - `src/content/moments/slow-sunday.md`
  - `src/content/moments/green-details.md`
  - `src/content/moments/lake-notes.md`
- **頁面與路由**：
  - `src/pages/index.astro`（首頁含標籤篩選與精選卡片）
  - `src/pages/stories/index.astro`（Stories 總覽頁）
  - `src/pages/stories/[...slug].astro`（Story 詳細頁）
  - `src/pages/moments/index.astro`（Moments 攝影相簿總覽）
  - `src/pages/moments/[...slug].astro`（Moment 相簿詳細頁）
  - `src/pages/tags/index.astro`（標籤匯總頁）
  - `src/pages/tags/[tag].astro`（標籤專屬分類頁）
  - `src/pages/search-data.json.ts`（靜態搜尋索引端點）
  - `src/pages/rss.xml.ts` / `src/pages/feed.xml.ts`（RSS 訂閱源）
- **組件與核心函式庫**：
  - `src/components/StoryCard.astro`
  - `src/components/FeaturedStory.astro`
  - `src/components/MomentCard.astro`
  - `src/components/SearchDialog.astro`
  - `src/components/LightboxViewer.astro`
  - `src/lib/date.ts`
  - `src/lib/feed.ts`
  - `src/lib/tag.ts`
  - `src/lib/media.ts`
- **腳本與測試工具**：
  - `scripts/generate-sample-photos.mjs`
  - `scripts/process-media.mjs`
  - `scripts/publish-media.mjs`
  - `scripts/verify-isolation.mjs`
  - `scripts/test-phase2.mjs`
  - `scripts/test-all.mjs`
  - `src/data/media-manifest.json`

### 4.4 下一步與停步聲明
**Stop Condition**: Phase 2 實作與全數 10 項測試已完整通過。
未開始 Phase 3。停步等待專案負責人審閱與授權。
