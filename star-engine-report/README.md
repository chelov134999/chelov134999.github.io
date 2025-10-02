# 星級引擎｜衝擊力報表 LIFF（v1）

此目錄為新一代報表 LIFF 前端，對應 `Set - Secrets` 的 `report_url` 與 `report-data` webhook。報表載入流程：

1. n8n 在 `Function – Action Executor` 產生一次性 `reportToken`（5 分鐘有效），寫入 `diagnosis.reportToken` 並存入 `staticData.reportTokens`。
2. `Function – Reply Composer` 將 CTA 連結指向 `report_url?token=<token>`。
3. LIFF 透過 `docs/star-engine-report/app.js` 讀取 query token，呼叫 `reportEndpoint` 取得診斷 JSON，渲染報表。

## 頁面導覽

- `index.html`：固定模板，載入 hero 區、三大指標、評論燃點、競品壓力牆、行動藍圖、外部聲量與 CTA。
- `styles.css`：品牌深藍 / 暖橘配色、玻璃態卡片、動態席次提示。
- `app.js`：
  - 整合 LIFF init + token 驗證。
  - 製作評論危機卡「一鍵複製草稿」。
  - Seat ticker 每 6 秒在 `remaining` 與 `today` 間切換，營造稀缺感。
  - CTA 按鈕連結 `checkout_primary_url`、`checkout_secondary_url`。

若需調整價目或 CTA，更新 n8n `Set - Secrets` 對應欄位即可；不必改動前端程式碼。
