"use client";

import { useEffect } from "react";

export default function ErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-5xl font-bold tracking-tight text-slate-900">發生錯誤</p>
      <p className="mt-3 text-slate-600">頁面載入時發生問題，請重新整理後再試。</p>
      <button
        onClick={() => reset()}
        className="mt-6 rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
      >
        重新嘗試
      </button>
    </div>
  );
}
