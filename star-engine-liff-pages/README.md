# 星級引擎 LIFF Pages

獨立部署的星級引擎 LIFF 表單與品牌頁面，包含：

- `index.html`：30 秒初檢四格表單與流程
- `about.html`：品牌介紹
- `sample-report.html`：示例報表預覽

所有靜態檔案可直接透過 GitHub Pages 發佈。

## 發佈流程建議

1. 完成文案或樣式調整後，執行 `node scripts/update_timestamp.js`。
   - 會自動產生新的 `ts=YYYYMMDDTHHMM` 快取參數並覆寫所有頁面、設定檔。
   - 會同步複製最新版檔案到 `releases/<timestamp>/`、寫入 `releases/latest.txt`，並自動清除舊版目錄（保留最近 2 筆）。
   - 若需自訂時間戳，可傳入參數，例如 `node scripts/update_timestamp.js 20251008T0000`。
2. 檢查 `git status` 確認只有預期檔案被修改後，再 `git push origin main`。
3. 等待 GitHub Pages 的 `pages-build-deployment` workflow 成功，即可在 LINE / 瀏覽器看到最新頁面。

> Tip: 可以把 `node scripts/update_timestamp.js` 納入個人流程（例如 pre-push hook 或別名指令），就能避免忘記替換快取參數或同步 release 檔案。

## ChatKit 驗證／部署流程

1. 於 `star-engine-liff-pages/` 執行 `node scripts/update_timestamp.js`（或帶入 `YYYYMMDDTHHMM` 參數）更新靜態頁面與 release 快照。
2. 回到專案根目錄，執行 `npm run build-chatkit-demo`，會將最新 release 及 `sites/entry-pass-site` 複製到 `tmp/chatkit-demo/`，供 LINE 驗證或 ChatKit POC 打包使用。
   - 已同步一份壓縮檔至 Google Drive：`Shared/ChatKit/chatkit-demo-<ts>.zip`（路徑由 `scripts/deploy_chatkit.py` 輸出，來源為 `tmp/chatkit-demo-<ts>.zip`）
3. 使用 GitHub Deploy MCP（`POST /timestamp` → `POST /deploy`）確認 200 回應後再進行 commit / push，確保 GitHub Pages 版本同步。
4. 本地產生的壓縮檔位於 `tmp/chatkit-demo-YYYYMMDDTHHMM.zip`，如需更新共享檔案可重新上傳至上述 Drive 位置。

> 完整規範請參考 `docs/deployment/chatkit_release_policy.md`，務必遵循同一套流程，避免部署後仍載入舊頁面的風險。
