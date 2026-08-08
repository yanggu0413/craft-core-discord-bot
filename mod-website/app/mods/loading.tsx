"use client";

import { Layers, Search } from "lucide-react";

export default function ModsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <span className="capsule bg-sky-50 text-sky-700 ring-sky-200">
          <Layers size={14} aria-hidden />
          模組化下載
        </span>
        <div className="mt-4 h-10 w-72 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-3 h-5 w-full max-w-lg animate-pulse rounded bg-slate-100" />
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
          <div className="h-11 w-full animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="flex flex-wrap gap-2">
          {["全部", "僅依賴 libs", "需要動態經濟", "需要傳送/回點"].map((label) => (
            <div key={label} className="h-9 w-20 animate-pulse rounded-full bg-slate-100" />
          ))}
        </div>
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-200" />
              <div className="min-w-0 flex-1">
                <div className="h-5 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-full rounded bg-slate-100" />
                <div className="mt-1 h-4 w-2/3 rounded bg-slate-100" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <div className="h-5 w-16 rounded-full bg-slate-100" />
              <div className="h-5 w-20 rounded-full bg-slate-100" />
              <div className="ml-auto h-4 w-10 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
