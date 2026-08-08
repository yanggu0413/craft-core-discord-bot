"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GitBranch, Star, ArrowUpRight } from "lucide-react";

export function GitHubStars() {
  const [stars, setStars] = useState<string>("");
  useEffect(() => {
    fetch("https://api.github.com/repos/yanggu0413/craft-core-mod")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStars(String(d.stargazers_count ?? "")))
      .catch(() => {});
  }, []);
  return (
    <a
      href="https://github.com/yanggu0413/craft-core-mod"
      target="_blank"
      rel="noreferrer"
      className="hidden sm:inline-flex items-center gap-2 rounded-full bg-blue-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-900"
    >
      <GitBranch size={16} aria-hidden />
      <Star size={14} className="text-amber-300" aria-hidden />
      <span>GitHub{stars ? ` · ${stars}` : ""}</span>
    </a>
  );
}

export default function Navbar() {
  const [langMenu, setLangMenu] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-700 text-white shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 2 3 7v5c0 5 3.7 9.3 9 10 5.3-.7 9-5 9-10V7l-9-5Z"
                fill="currentColor"
                opacity="0.9"
              />
            </svg>
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            Craft-Core
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-blue-700">
            首頁
          </Link>
          <Link href="/mods" className="text-sm font-medium text-slate-600 hover:text-blue-700">
            模組下載
          </Link>
          <a
            href="https://github.com/yanggu0413/craft-core-mod"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-700"
          >
            GitHub
            <ArrowUpRight size={14} aria-hidden />
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <div className="relative hidden sm:block">
            <button
              onClick={() => setLangMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-200 hover:ring-blue-300"
            >
              繁體中文
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {langMenu && (
              <div className="absolute right-0 mt-2 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                <div className="px-4 py-2 text-sm text-slate-500">繁體中文</div>
                <div className="px-4 py-2 text-sm text-slate-300">English（敬請期待）</div>
                <div className="px-4 py-2 text-sm text-slate-300">简体中文（敬請期待）</div>
              </div>
            )}
          </div>
          <GitHubStars />
        </div>
      </div>
    </header>
  );
}
