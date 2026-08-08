import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-6xl font-bold tracking-tight text-slate-200">404</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">頁面不存在</p>
      <p className="mt-2 text-slate-500">您要找的頁面可能已被移除或連結有誤。</p>
      <Link
        href="/mods"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
      >
        前往模組下載
      </Link>
    </div>
  );
}
