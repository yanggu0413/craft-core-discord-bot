"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <html lang="zh-Hant">
      <body
        style={{
          background: "#ffffff",
          color: "#0b1220",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "6rem 1.5rem", textAlign: "center" }}>
          <p style={{ fontSize: "2.5rem", fontWeight: 700, margin: 0 }}>發生錯誤</p>
          <p style={{ marginTop: "0.75rem", color: "#64748b" }}>
            頁面載入時發生問題，請重新整理後再試。
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: "1.5rem",
              borderRadius: 9999,
              background: "#1d4ed8",
              color: "#fff",
              padding: "0.65rem 1.25rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            重新嘗試
          </button>
        </div>
      </body>
    </html>
  );
}
