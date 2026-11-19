# SHAN 個人網站 — Phase 2 驗收審查報告
# Phase 2 Acceptance Review & Verification Report

- **專案名稱**：山 / SHAN — Notes along the way
- **審查階段**：Phase 2 驗收審查（Phase 2 Acceptance Review）
- **審查日期**：2026-11-19
- **工作目錄**：
  `/Users/foo/Library/Mobile Documents/com~apple~CloudDocs/RAMDisk/SHAN`
- **狀態判定**：Phase 2 驗收通過，具備進入 Phase 3 之工程條件

---

## 1. 驗證通過之功能項目（Verified Functionality）

1. **內容集合與 Zod Schema 型別安全**：
   - `src/content.config.ts`：以 Astro 5 原生 `glob` 與
     `astro/zod` 定義 `stories` 與 `moments` 兩大集合。
   - 完整支援邏輯媒體識別碼 `coverMedia` 與相簿陣列 `media`。
   - 完整移轉 4 篇長文與 6 則相簿，支援多國語言。
2. **視覺排版與完整路由（1:1 對齊原型）**：
   - 首頁與 Stories：精選雙欄大圖與三欄網格卡片，
     具備即時標籤篩選與文章計數。
   - Moments 攝影相簿：1:1 正方形相片牆、多圖徽章（`▧ 3`）
     與漸層標題資訊。
   - 標籤聚合系統：`/tags/` 匯總標籤，`/tags/[tag]/` 支援標準
     Slug 分類過濾頁面。
   - 文章閱讀排版：`.prose` 樣式、自託管思源宋體、
     引言 blockquote 與相關推薦文章。
   - 雙格式 RSS 訂閱源：`/rss.xml` 與相容原型的 `/feed.xml`。
3. **原生互動功能（純原生 HTML5 + TypeScript，零外部框架）**：
   - 搜尋彈窗（SearchDialog）：以原生 `<dialog>` 實作，
     支援 `Cmd+K` / `Ctrl+K` 快速鍵、點擊背景關閉與 Esc 關閉。
   - 燈箱相簿檢視器（LightboxViewer）：以原生 `<dialog>` 實作，
     支援全螢幕瀏覽、左右箭頭鍵循環導覽、相片計數與拍
     攝資訊。
   - 主題切換：支援 `body.dark` 與 `localStorage` 記憶。
   - 行動版導覽抽屜：具備 `aria-expanded` 無障礙標籤。
4. **本機媒體處理管道（Sharp Media Pipeline）**：
   - `scripts/process-media.mjs`：自動調用 `sharp.rotate()` 修正轉向，
     洗淨 GPS 經緯度與敏感個資，產出 400w/800w/1600w WebP 與
     1600w AVIF 規格至 `.local-media/`。
   - 自動生成符合 80 字元限制之 `src/data/media-manifest.json`。
5. **Cloudflare R2 發布工具**：
   - `scripts/publish-media.mjs`：支援 `--dry-run`、`--mock` 與
     `--verify-only`，具備基於 SHA-256 的等冪性與遠端驗證機制。
6. **媒體解析抽象層（Media Resolver）**：
   - `src/lib/media.ts`：Markdown frontmatter 僅存放邏輯識別碼，
     開發時指向 Vite 本機代理，生產環境依據基底網址嚴格
     解析。
7. **Git 與建置實體隔離**：
   - `scripts/verify-isolation.mjs`：確認 Git 與 `dist/` 均無照片，
     負向洩漏測試確認檢核機制能確實捕捉照片。

---

## 2. 瀏覽器互動測試結果（Actual Browser Test Results）

- **全站搜尋彈窗（Search Modal）**：
  - 操作：按下鍵盤 `Cmd+K` 或點擊標頭 ⌕ 按鈕。
  - 結果：`<dialog>` 開啟並聚焦搜尋框，
    背景模糊遮罩生效（PASS）。
- **搜尋即時全文比對（Live Search Query）**：
  - 操作：於搜尋框輸入「forest」、「Tokyo」、「山」。
  - 結果：即時列出符合之項目（涵蓋標題、摘要、內文），
    點擊導覽並關閉彈窗（PASS）。
- **搜尋關閉行為（Dialog Dismissal）**：
  - 操作：按下 `Esc` 鍵或點擊彈窗外背景區域。
  - 結果：彈窗平順關閉，焦點回歸原按鈕（PASS）。
- **全螢幕燈箱相簿（Lightbox Photo Viewer）**：
  - 操作：於 Moments 詳細頁點選相片卡片。
  - 結果：開啟全螢幕 `<dialog id="viewer">` 呈現大圖（PASS）。
- **相簿鍵盤循環導覽（Cyclic Navigation）**：
  - 操作：燈箱開啟時按下鍵盤 `ArrowRight` / `ArrowLeft`。
  - 結果：相片循環切換，張數計數（如 1 / 3）即時更新（PA
    SS）。
- **燈箱關閉行為（Lightbox Close）**：
  - 操作：按下右上角 ✕ 按鈕或 `Esc` 鍵。
  - 結果：燈箱關閉，頁面滾動位置保持不變（PASS）。
- **主題切換持久化（Theme Switching）**：
  - 操作：點擊標頭 ◐ 按鈕，重新整理頁面。
  - 結果：切換淺色/深色，`localStorage` 保持偏好（PASS）。
- **標籤即時篩選（In-place Tag Filtering）**：
  - 操作：點擊首頁或 Moments 頁面之標籤按鈕。
  - 結果：依據 `data-tags` 即時篩選卡片，計數連動更新（PASS
    ）。
- **行動版選單（Mobile Drawer）**：
  - 操作：窄螢幕（<600px）點擊 ☰ 漢堡選單。
  - 結果：選單展開，`aria-expanded` 屬性正確切換（PASS）。

---

## 3. 視覺對比與原型還原度評估（Visual Comparison Findings）

對比參考原型目錄 `shan-journal-source/`：
1. **排版字型與字距（Typography & Spacing）**：
   - 採用自託管之 DM Sans（英數）、思源宋體（Noto Serif TC / J
     P）。
   - 標頭字體大小（48px/44px/31px/23px）與行距完全符合原型數
     值。
2. **顏色變數與主題質感（Design Tokens）**：
   - 淺色模式背景 `#faf9f7`、紙質卡片 `#f0eeeb`、文字 `#292929`；
   - 深色模式背景 `#1c1c1e`、紙質卡片 `#28282b`、文字 `#eeece8`；
   - 主題切換時的過渡動畫（`transition: 0.2s`）與邊框線條完
     全一致。
3. **卡片懸浮動態（Micro-interactions）**：
   - 精選卡片、近期文章卡片與 Moments 卡片之
     `transform: scale(1.025)` 縮放與 `0.5s` 平滑過渡完全重現。
4. **響應式斷點行為（Responsive Breakpoints）**：
   - 1500px 寬螢幕維持最適內容寬度（1100px ~ 1140px）。
   - 900px 平板模式縮減卡片邊距，文章雙欄自動轉向。
   - 600px 行動版自動切換為單欄，文章卡片轉為左文右圖佈
     局，
     Moments 轉為雙欄正方形排版。

---

## 4. 媒體發布安全審查（Media Publishing Safety Findings）

針對 `process-media → publish-media → verify → manifest update` 流程
：

1. **缺失媒體識別碼（Missing Media IDs）**：
   - 本機開發環境：提供 `/media/placeholder.webp` 佔位圖並輸出
     警告。
   - 生產環境建置：於 `src/lib/media.ts` 強制拋出明確錯誤中
     斷建置，
     杜絕無效媒體連結上線。
2. **部分規格上傳中斷與原子性（Partial Uploads & Atomicity）**：
   - 當某一圖檔部分規格上傳但後續因網路中斷失敗時，
     `publish-media.mjs` 會標記該項目未通過驗證。
   - **清單一致性（Manifest Consistency）**：未通過全規格驗證
     的項目，
     絕對不會寫入正式的 `media-manifest.json`，保證清單狀態永
     遠健康。
   - **雲端殘留物件（Remote Orphan Objects）**：因 S3/R2 物件儲
     存缺少
     跨物件不可分割交易機制，中斷前已上傳的規格會留存
     於儲存貯體中。
     由於檔名採用 SHA-256 雜湊與唯一路徑，殘留物件不會引
     發衝突，
     但不會自動觸發雲端實體刪除（可於後續規劃清理維護
     指令）。
3. **重複上傳等冪性（Repeated Uploads & Idempotency）**：
   - 透過遠端 HEAD 檢查與本機雜湊比對，已存在且未變更之
     規格自動略過
     （回報 `skipped`，0 冗餘上傳）。
4. **清單寫入失敗防護（Manifest Write Failure Protection）**：
   - 清單採完整生成後寫入機制，寫入失敗時原始檔案不受
     損壞。
5. **未引用之遠端孤兒物件（Unreferenced Remote Objects）**：
   - 清單僅收錄由 `process-media` 本地生成的項目。若雲端存
     在非清單物件，
     靜態建置不會引用，具備實體隔離。
6. **Git 隔離防護（Git Isolation Enforcement）**：
   - `.gitignore` 嚴格阻絕 `media/originals/`、`media/cache/`、
     `.local-media/`、`public/media/` 與 `*.raw/dng`。
   - `scripts/verify-isolation.mjs` 整合負向洩漏測試，
     自動化驗證保證 Git 歷史與 `dist/` 產物絕對零照片二進
     位。

---

## 5. 尚未進行之 R2 整合行為（Unverified R2 Behavior）

本階段依照 Phase 2 授權邊界，**未建立真實 R2 儲存區，亦未
配置金鑰**。
以下項目目前以 Mock / Dry-run 模擬驗證，仍需於 Phase 3 進行
實體驗證：

1. **真實 S3 API / SigV4 認證上傳**：
   - 目前驗證：以本機檔案系統 `.mock-r2/` 模擬遠端寫入與 HE
     AD 查詢。
   - 尚待驗證：真實 Cloudflare R2 API Token 與端點授權握手。
2. **邊緣快取與 HTTP 標頭（Edge CDN & Cache-Control）**：
   - 目前驗證：邏輯路徑與 URL 拼裝。
   - 尚待驗證：R2 / Cloudflare CDN 自訂網域快取標頭
     （`Cache-Control: public, max-age=31536000, immutable`）。
3. **大檔案真實網路傳輸與頻寬限制**：
   - 目前驗證：本機 I/O 模擬。
   - 尚待驗證：多圖相簿（數十張）並行上傳時的網路逾時
     、重試機制。
4. **生產媒體網址可用性**：
   - *注意*：以 `PUBLIC_MEDIA_BASE_URL="https://r2.shan-notes.dev"`
     完成靜態建置僅證明 HTML 生成之網址結構正確，
     **並不代表遠端圖片已可公開連線存取**。

---

## 6. 審查發現問題與修正紀錄（Issues & Corrections）

1. **生產環境缺失媒體未阻擋建置（Blocking — 已修復）**：
   - 問題：原 `src/lib/media.ts` 在找不到媒體時僅警告並回退
     佔位圖。
   - 處置：已修正為在生產模式（`!isDev`）下嚴格拋錯中斷
     建置，
     唯有在開發模式才允許佔位圖。
2. **文章全文未納入搜尋索引（Non-blocking — 已修復）**：
   - 問題：原 `search-data.json.ts` 僅索引標題、摘要、地點與
     標籤。
   - 處置：已將 `body`（文章 Markdown 內文）納入端點與搜尋
     比對中，
     完全對齊原型全文搜尋體驗。
3. **遠端殘留物件無自動清理（Deferred to Phase 3 — 記錄並延
   後）**：
   - 問題：異常中斷時已上傳之部分規格留存於 R2 雲端。
   - 處置：因具備雜湊唯一性而不影響運作，規劃於 Phase 3 
     發布腳本中
     加入清理命令。

---

## 7. Phase 3 進入就緒建議（Phase 3 Readiness Recommendation）

### 7.1 分類統計總結
- **阻礙性問題（Blocking）**：0 項（已全數修復並驗證）。
- **非阻礙性問題（Non-blocking）**：0 項（全文搜尋索引已完
  善補齊）。
- **延後至 Phase 3 項目（Deferred to Phase 3）**：1 項（真實 R2 
  聯網測試）。

### 7.2 結論與建議
- **架構評估**：Phase 2 所有交付成果（內容集合、排版視覺
  、原生燈箱、
  原生搜尋、本機 Sharp 管道、R2 隔離防護）均以極精簡、無
  多餘依賴、
  標準庫優先之方式完成，且 100% 符合 80 字元排版限制。
- **推進建議**：**強烈建議核准 Phase 2 驗收，授權進入 Phase 
  3**。
- **Stop Condition 執行**：本驗收審查已完成，未啟動 Phase 3 任
  何實作，
  停步等待專案負責人授權。
