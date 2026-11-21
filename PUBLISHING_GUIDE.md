# 山 / SHAN 網站作者獨立發布手冊

這是一份專為《山 / SHAN》網站作者設計的發布手冊。依照本手冊的步驟，
你可以完全獨立建立、預覽、編修並正式發布文章（Stories）與生活速寫
（Moments），無需工程背景或依賴 AI 輔助。

---

## 1. 核心發布概念

在開始之前，了解網站的三個儲存位置有助於掌握整體流程：

1. **Git 倉庫（GitHub）**：
   - 存放文章純文字檔（`.md`）、網站程式碼與圖片索引清單
     （`src/data/media-manifest.json`）。
   - **嚴格禁止存放照片圖檔**，確保倉庫輕量與快速。

2. **本地原圖與暫存目錄（本機專用，已被 Git 忽略）**：
   - `media/originals/`：放置相機或手機輸出的原始照片。
   - `.local-media/`：電腦自動生成的壓縮與響應式圖檔，僅供本機預覽。

3. **Cloudflare R2 雲端儲存**：
   - 正式存放壓縮圖檔的雲端空間，網址為 `https://media.shan.page`。

4. **邏輯圖片代碼（Logical Media ID）**：
   - 文章中一律使用類似 `stories/forest-time/cover` 或
     `moments/above-clouds/photo-01` 的代碼，不直接填寫雲端網址。
   - 網站程式會自動依據環境（本機或線上）解析正確的圖片路徑。

---

## 2. 指令安全分級

在終端機執行指令前，請注意操作的安全等級：

### 🟢 綠燈：本機安全預覽指令（無破壞性、不上傳、不更動線上）

- `npm run dev`：啟動本機預覽伺服器（網址 `http://localhost:4321`）。
- `npm run check`：檢查所有文章欄位格式與語法是否正確。
- `npm run verify:isolation`：檢查 Git 是否意外包含了照片圖檔。
- `node scripts/process-media.mjs`：在本機壓縮照片並建立索引。
- `node scripts/publish-media.mjs --dry-run`：
  上傳模擬測試，僅顯示會上傳哪些檔案，不會產生任何網路傳輸。
- `npm run deploy -- --dry-run`：
  部署模擬測試，檢查 Git 工作區與 Keychain 金鑰，不發送任何部署請求。

### 🔴 紅燈：正式發布指令（會變更雲端或線上網站）

- `node scripts/publish-media.mjs --prod`：
  將壓縮後的圖檔正式上傳至 Cloudflare R2 雲端儲存桶。
- `git push origin main`：將文章與圖片索引推送到 GitHub。
- `npm run deploy`：觸發 GitHub Actions 部署工作流程，正式更新對外網站。
  *(亦可作為備用直接在 GitHub 網頁觸發 Deploy to GitHub Pages)*

---

## 3. 發布全新文章（Story）

文章（Story）以長篇圖文記錄為主，每篇文章具備一張代表性封面圖片。

### 步驟 1：準備封面照片原圖

將相機或相簿導出的原始封面照片，複製並存放於：
```
media/originals/stories/<文章英文代稱>/cover.jpg
```
> 例如文章代稱為 `autumn-leaves`，請建立資料夾
> `media/originals/stories/autumn-leaves/`，
> 並將照片命名為 `cover.jpg`（或 `.jpeg`、`.png`）。

### 步驟 2：本機壓縮處理照片

在專案根目錄開啟終端機，執行：
```bash
node scripts/process-media.mjs
```
- **執行結果**：系統會自動裁切並生成 4 種響應式圖檔至 `.local-media/`，
  並更新 `src/data/media-manifest.json` 索引檔。
- 對應的邏輯代碼為：`stories/<文章英文代稱>/cover`。

### 步驟 3：撰寫文章 Markdown 檔案

在 `src/content/stories/` 目錄下建立 `<文章英文代稱>.md`。
（例如：`src/content/stories/autumn-leaves.md`）

直接複製並填寫以下範本（開頭的 `---` 為必要欄位）：

```yaml
---
title: "山林深處的秋意"
subtitle: "一段靜心漫步的午後筆記"
excerpt: "走入深秋的山徑，紅葉與光影交錯，記錄下今年最平靜的午後時光。"
date: 2026-11-20
lang: "zh-Hant"
readingTime: "4 min read"
featured: false
draft: true
tags:
  - "Nature"
  - "Photography"
coverMedia:
  id: "stories/autumn-leaves/cover"
  alt: "陽光灑在紅黃交錯的槭樹葉片上"
  caption: "初秋午後的林道光影"
relatedStories:
  - "forest-time"
---

這裡是文章的正文內容。你可以使用標準 Markdown 語法書寫。

## 第一個小節標題

這是一段文字敘述。陽光穿過樹梢，微風拂面。

> 值得記住的風景，往往不需要太多言語。

正文結尾...
```

#### 欄位說明表
| 欄位名稱 | 必填 | 說明 |
| :--- | :--- | :--- |
| `title` | 是 | 文章標題 |
| `excerpt` | 是 | 摘要簡介（用於列表與社群預覽卡片） |
| `date` | 是 | 發布日期，格式為 `YYYY-MM-DD` |
| `coverMedia.id` | 是 | 封面照片代碼（必須與步驟 2 生成的代碼相符） |
| `coverMedia.alt` | 是 | 圖片替代文字（無障礙閱讀與 SEO） |
| `coverMedia.caption` | 否 | 圖片底部說明的簡短小字 |
| `subtitle` | 否 | 文章副標題 |
| `lang` | 否 | 語言：`zh-Hant`、`en`、`ja`（預設為 `en`） |
| `readingTime` | 否 | 預估閱讀時間（如 `"4 min read"`） |
| `featured` | 否 | 是否設為首頁推薦焦點（`true` 或 `false`） |
| `draft` | 否 | 草稿狀態（`true` 為草稿，`false` 為正式發布） |
| `tags` | 否 | 標籤清單（如 `["Nature", "Travel"]`） |
| `relatedStories` | 否 | 延伸推薦文章代稱清單 |

### 步驟 4：本機預覽與校對

1. 執行型別與內容格式檢查：
   ```bash
   npm run check
   ```
2. 啟動本機開發伺服器：
   ```bash
   npm run dev
   ```
3. 在瀏覽器打開 `http://localhost:4321/stories/autumn-leaves/`。
4. **確認事項**：
   - 封面照片是否能正常顯示。
   - 文章文字排版與標籤是否符合預期。
   - 即使標記為 `draft: true`，本機預覽依然看得到內容。

### 步驟 5：上傳照片至 R2 雲端儲存

確認照片與內文皆滿意後，將照片上傳至雲端空間：

1. **先進行安全乾跑（Dry-Run）**：
   ```bash
   node scripts/publish-media.mjs --dry-run \
     --item stories/autumn-leaves/cover
   ```
   確認終端機顯示 `Scope: 1 item(s)` 且預計處理 4 個圖檔變體。

2. **正式執行雲端上傳**：
   ```bash
   node scripts/publish-media.mjs --prod \
     --item stories/autumn-leaves/cover
   ```
   上傳成功後，每組圖檔皆會通過 SHA-256 驗證。

3. **線上存取狀態驗證**：
   ```bash
   node scripts/publish-media.mjs --prod --verify-only \
     --item stories/autumn-leaves/cover
   ```
   顯示驗證通過，代表照片已正確存在於線上 R2 空間。

### 步驟 6：Git 安全檢查與提交

1. 將草稿標記改為發布：
   開啟文章 `.md`，將 `draft: true` 修改為 `draft: false`。
2. 檢查是否有任何大圖誤入 Git 暫存：
   ```bash
   npm run verify:isolation
   ```
   *(如果出現警告，請不要進行下一步)*
3. 提交文章文字與圖片清單：
   ```bash
   git add src/content/stories/autumn-leaves.md src/data/media-manifest.json
   git commit -m "feat(stories): add autumn-leaves"
   git push origin main
   ```

### 步驟 7：正式發布至 GitHub Pages

在終端機直接執行部署指令：
```bash
npm run deploy
```
系統會自動完成以下防護檢查：
1. 確認本機 Git 工作區完全乾淨（無未提交修改）。
2. 確認本機 `main` 分支與遠端 `origin/main` 完全同步。
3. 自 macOS Keychain 安全讀取 GitHub PAT。
4. 透過 GitHub REST API 觸發 `deploy.yml` 部署流程。

指令完成後會印出工作流程追蹤網址，約 1 至 2 分鐘即可在
`https://shan.page` 看到新上線的內容！

*(備用手動方式：亦可在 GitHub 網頁 -> Actions -> Deploy to GitHub Pages*
*-> 點選 Run workflow)*

---

## 4. 新增生活速寫（Moment）多圖發布

生活速寫（Moment）著重在隨筆記錄與多張相片相簿。

### 步驟 1：準備相片原圖

將多張原圖複製到：
```
media/originals/moments/<速寫英文代稱>/photo-01.jpg
media/originals/moments/<速寫英文代稱>/photo-02.jpg
media/originals/moments/<速寫英文代稱>/photo-03.jpg
```
> 例如代稱為 `morning-mist`，放入 `photo-01.jpg` 與 `photo-02.jpg`。

### 步驟 2：本機壓縮處理照片

在終端機執行：
```bash
node scripts/process-media.mjs
```
系統會為每張照片生成正方形縮圖及高解析版本，並於索引清單註冊對應代碼：
- `moments/morning-mist/photo-01`
- `moments/morning-mist/photo-02`

### 步驟 3：撰寫速寫 Markdown 檔案

在 `src/content/moments/` 目錄建立 `<速寫英文代稱>.md`。
（例如：`src/content/moments/morning-mist.md`）

複製並填寫以下範本：

```yaml
---
title: "晨霧與露水"
date: 2026-11-20
location: "雪山東峰登山口"
caption: "清晨五點的冷空氣，水氣凝結在草梢上，整座山都在靜靜呼吸。"
weather: "霧雨 12°C"
mood: "靜謐"
draft: false
tags:
  - "Nature"
  - "Hiking"
media:
  - id: "moments/morning-mist/photo-01"
    alt: "清晨森林登山口籠罩在薄薄霧氣中"
  - id: "moments/morning-mist/photo-02"
    alt: "登山杖旁邊沾滿晨露的高山草葉"
---
```

#### Moment 專屬欄位說明
- `caption`（必填）：一段精練優美的核心短文或心情敘述。
- `media`（必填，至少 1 張）：照片清單，每張填寫對應的 `id` 與無障礙
  `alt` 說明。
- `location`、`weather`、`mood`（選填）：地點、天氣、心境情境標記。

### 步驟 4：本機預覽

執行：
```bash
npm run dev
```
打開 `http://localhost:4321/moments/` 瀏覽相簿與輪播展示效果。

### 步驟 5：批次上傳多張照片至 R2

使用重複的 `--item` 參數，即可一次上傳該組 Moments 的所有照片：

```bash
# 1. 乾跑模擬
node scripts/publish-media.mjs --dry-run \
  --item moments/morning-mist/photo-01 \
  --item moments/morning-mist/photo-02

# 2. 正式上傳至 R2
node scripts/publish-media.mjs --prod \
  --item moments/morning-mist/photo-01 \
  --item moments/morning-mist/photo-02

# 3. 驗證線上狀態
node scripts/publish-media.mjs --prod --verify-only \
  --item moments/morning-mist/photo-01 \
  --item moments/morning-mist/photo-02
```

### 步驟 6：Git 提交與部署

```bash
npm run verify:isolation
git add src/content/moments/morning-mist.md src/data/media-manifest.json
git commit -m "feat(moments): add morning-mist"
git push origin main
npm run deploy
```

---

## 5. 純文字修改（不更動照片）

若只是修正錯字、潤飾內文、修改標籤或更新日期，**不需要**重新處理照片，
也**不需要**執行任何 R2 上傳指令！

### 簡易 3 步驟：
1. **直接編輯**：
   開啟 `src/content/stories/<slug>.md` 或
   `src/content/moments/<slug>.md` 修改內文文字。
2. **本機校對**：
   ```bash
   npm run check
   npm run dev
   ```
3. **提交並推送**：
   ```bash
   git add src/content/stories/<slug>.md
   git commit -m "fix(stories): correct typo in <slug>"
   git push origin main
   ```
4. **一鍵正式發布**：
   ```bash
   npm run deploy
   ```

---

## 6. 更換既有照片

若欲替換某一篇文章的現存照片（例如更換 `stories/autumn-leaves/cover`）：

1. 將新的原圖覆蓋 `media/originals/stories/autumn-leaves/cover.jpg`。
2. 執行處理指令：
   ```bash
   node scripts/process-media.mjs
   ```
   *系統會自動計算新照片的 SHA-256 雜湊，產生新的變體檔案，*
   *清理本機舊變體，並自動更新 `media-manifest.json`。*
3. 本機預覽確認新圖片載入無誤：
   ```bash
   npm run dev
   ```
4. 上傳新圖檔至 R2：
   ```bash
   node scripts/publish-media.mjs --prod \
     --item stories/autumn-leaves/cover
   ```
5. 提交 manifest 變更並發布：
   ```bash
   git add src/data/media-manifest.json
   git commit -m "chore(media): update cover for autumn-leaves"
   git push origin main
   ```
6. 執行正式部署：
   ```bash
   npm run deploy
   ```
   *(注意：R2 上的舊檔案會安全保留，不會造成外連使用者破圖。)*

---

## 7. 草稿功能說明

- 在文章或速寫的頂部 Frontmatter 設定 `draft: true` 即為草稿。
- **本機開發環境（`npm run dev`）**：
  草稿文章在首頁、列表與獨立頁面中皆可直接點開瀏覽，方便校稿。
- **線上正式環境（GitHub Pages 產出時）**：
  草稿會自動被完全過濾排除，不會出現在文章列表、標籤頁、RSS 訂閱
  （`rss.xml`）以及網站地圖（`sitemap.xml`）中。
- 當校稿完畢準備上線時，只需將 `draft: true` 改為 `draft: false`，
  重新提交 Git 並部署即可。

---

## 8. 一鍵部署金鑰設定與 Token 輪換指南

`npm run deploy` 透過 GitHub REST API 自動觸發部署，金鑰嚴格保存在
macOS 系統層級的 Keychain（鑰匙圈）中，絕不落地存檔至 `.env` 或專案代碼。

### 初次設定：建立 GitHub Fine-grained PAT 並存入 Keychain

1. **前往 GitHub 建立 Token**：
   - 瀏覽器開啟：`GitHub` -> `Settings` -> `Developer settings`
     -> `Personal access tokens` -> `Fine-grained tokens`。
   - 點擊 **Generate new token**。
   - **Token name**：`shan-github-deploy`。
   - **Expiration**：建議設定 90 天（或自訂期限）。
   - **Repository access**：選擇 `Only select repositories`，選取
     `explorer422/shan`。
   - **Permissions**：在 `Repository permissions` 下找到 **Actions**，
     設定權限為 **Read and write**。
   - 點擊 **Generate token** 並複製生成的字串（`github_pat_...`）。

2. **存入 macOS Keychain**：
   在終端機執行下列指令（將 `-w` 置於最後且不接參數，系統會進入互動式
   密碼輸入提示，避免 Token 留存在 Shell 歷程或行程列表中）：
   ```bash
   security add-generic-password -s "shan-github-deploy" \
     -a "explorer422" -U -w
   ```
   終端機出現 `password: ` 提示時，貼上複製的 Token 並按 Enter。

3. **安全驗證**：
   執行部署模擬測試：
   ```bash
   npm run deploy -- --dry-run
   ```
   若終端機顯示 `Keychain check passed` 且無錯誤，即代表金鑰設定成功！

---

### Token 到期輪換（Token Rotation）

PAT 到期提醒目前已手動建立於 Apple Reminders（提醒事項）。當提醒觸發、
收到 GitHub 到期通知信，或需定期輪替安全性金鑰時：

1. 登入 GitHub，在同一 Token 頁面點擊 **Regenerate token**
   （或建立新的 Fine-grained PAT）。
2. 在終端機執行更新指令（以互動方式安全輸入新 Token，`-U` 會自動覆蓋舊
   紀錄）：
   ```bash
   security add-generic-password -s "shan-github-deploy" \
     -a "explorer422" -U -w
   ```
   終端機提示 `password: ` 時，貼上新 Token 並按 Enter。
3. 執行模擬確認：
   ```bash
   npm run deploy -- --dry-run
   ```
4. 確認更新成功後，即可在 GitHub 上刪除舊的 Token。

---

## 9. 常見問題與排錯指南（Troubleshooting）

### Q1: 本機預覽時照片顯示為空白或破損？
- 請確認是否已執行過 `node scripts/process-media.mjs`。
- 檢查 `.local-media/` 目錄內是否有對應生成的圖片檔案。
- 確認 Markdown 內的 `coverMedia.id` 或 `media[].id` 與
  `src/data/media-manifest.json` 中的代碼拼寫完全一致。

### Q2: 執行 `npm run verify:isolation` 出現錯誤？
- 這代表有未經許可的二進位圖檔（如 `.jpg`、`.png`）被意外放進了 Git 追蹤。
- 請檢查是否不小心將照片複製到了 `public/` 或 `src/` 目錄。
- 只有網站圖示（`favicon`、`apple-touch-icon.png`）允許進入 `public/`。
- 所有攝影照片原圖必須存放在 `media/originals/`。

### Q3: 上傳 R2 時出現 `COLLISION DETECTED` 警告？
- 這代表雲端已存在同名但內容雜湊不一致的檔案。
- 系統為了防範誤刪或覆蓋歷史圖檔會主動停止上傳。
- 請檢查原圖檔名或代碼是否重複，建議為每篇新文章使用唯一的 slug 資料夾。

### Q4: 執行 `node scripts/publish-media.mjs --prod` 提示憑證遺失？
- 請檢查專案根目錄下的 `.env` 檔案是否存在，並確認包含：
  `R2_ACCOUNT_ID`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`、`R2_BUCKET`。

### Q5: 執行 `npm run deploy` 出現金鑰或權限錯誤？
- **若提示 PAT not found**：代表 Keychain 尚未儲存金鑰，請參閱第 8 節
  的 `security add-generic-password` 指令。
- **若提示 401 Bad credentials**：代表 Token 已過期或失效，請參考第 8 節
  重新產生並輪換 Token。
- **若提示 403 Forbidden**：代表 Token 權限不足，請確認該 PAT 已被授予
  `explorer422/shan` 倉庫的 `Actions: Read and write` 權限。

---

## 10. 常用指令速查卡

| 常用情境 | 執行指令 |
| :--- | :--- |
| 本機開站預覽 | `npm run dev` |
| 格式型別檢查 | `npm run check` |
| 處理本機新照片 | `node scripts/process-media.mjs` |
| 模擬上傳單圖 | `node scripts/publish-media.mjs --dry-run --item <id>` |
| 正式上傳單圖 | `node scripts/publish-media.mjs --prod --item <id>` |
| 驗證單圖已在線上 | `node scripts/publish-media.mjs --prod --verify-only --item <id>` |
| 全站圖片雲端校驗 | `node scripts/publish-media.mjs --prod --verify-only` |
| Git 隔離安全檢查 | `npm run verify:isolation` |
| 模擬部署檢查 | `npm run deploy -- --dry-run` |
| 正式網站部署 | `npm run deploy` |
