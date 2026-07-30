# 常見問題與故障診斷 (Troubleshooting & FAQs)

本章節收錄 Craft-Core Hosting 常見的運行診斷與排除建議。

---

## 1. 容器異常終止 (Exit Codes)

當您的容器狀態顯示為 `error` 或突發停止時，請至 **「日誌 (Logs)」** 頁面或呼叫 `GET /api/instances/:id/logs` 查看退出代碼：

| Exit Code | 故障原因 | 排除步驟與處置方法 |
| --- | --- | --- |
| **`Exit Code 1`** | 應用程式未捕獲的例外 Crash | 檢查語法錯誤、未定義變數或依賴包缺失 |
| **`Exit Code 137`** | **OOM 記憶體溢出** | 容器記憶體超過限額，請優化程式記憶體或至「設定」調整 RAM 配額上限。 |
| **`Exit Code 127`** | 啟動指令 (CMD) 找不到執行檔 | 檢查啟動指令拼寫或套件路徑不正確 |

---

## 2. Web 存取跳出 `ECONNREFUSED` 或 502 Bad Gateway

### 原因分析：
1. **內部 Port 設定不匹配**：您的應用程式內部監聽 Port，但機器設定的「內部 Port」填寫不對。
2. **監聽 IP 位址問題**：若只監聽 `127.0.0.1`，容器外反向代理將無法連入。

### 建議修正方式：
確保程式碼中監聽在 `0.0.0.0`：
```javascript
// Node.js Express 範例
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
```

```python
# Python Flask / FastAPI 範例
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

---

## 3. GitHub Webhook 自動部署回傳 401 / 403 錯誤

- **校驗 401 Unauthorized**：請檢查 GitHub 儲存庫 Webhook 設定中的 **Secret** 是否與專案「設定」頁籤中的 Webhook Secret 完全一致。
- **校驗 403 Forbidden**：確保 GitHub Webhook 的 Content-Type 選擇了 `application/json`。
