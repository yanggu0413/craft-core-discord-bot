# GitHub Webhook 自動部署教學

綁定 Webhook 後，當您向 GitHub 提交代碼 (`git push`) 時，Craft-Core Hosting 會自動執行以下流程：

1. 自動校驗簽名
2. 執行代碼拉取 (`git pull`)
3. 自動執行套件安裝 (`npm install` / `pip install`)
4. 重啟 Docker 容器

---

## 設定指南

1. **複製 Webhook Payload URL**
   - 在專案頁面的「設定 (Settings)」分頁中複製該機器的專屬 Payload URL 與 Secret。

2. **至 GitHub 新增 Webhook**
   - 進入 GitHub 儲存庫 ➔ **Settings** ➔ **Webhooks** ➔ **Add webhook**。
   - **Payload URL**: 貼上複製的專屬 URL。
   - **Content type**: 選擇 `application/json`。
   - **Secret**: 貼上專案的 Webhook Secret 密鑰。
   - 點擊 **Add webhook** 保存。

3. **提交代碼驗證**
   - 在本地執行 `git push origin main` 即可自動觸發持續部署。
