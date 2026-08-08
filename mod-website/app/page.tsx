import Link from "next/link";
import {
  ArrowRight,
  Check,
  Cpu,
  Download,
  GitBranch,
  Layers,
  Package,
  Search,
  ServerCog,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { MODULES, MODULES_VERSION } from "@/lib/modules-data";
import { BETA_LABEL } from "@/lib/types";

const features = [
  {
    icon: <Layers className="text-sky-500" size={22} />,
    title: "依賴自動勾選",
    desc: "勾選任一模組，其依賴（如 libs、economy、back/teleport）會自動帶入，絕不漏裝。",
  },
  {
    icon: <Package className="text-sky-500" size={22} />,
    title: "一個 ZIP 帶走",
    desc: "把所有勾選模組與依賴打包成單一壓縮檔，放進 mods 資料夾即可。",
  },
  {
    icon: <ShieldAlert className="text-amber-500" size={22} />,
    title: "公測版本",
    desc: "目前為公測階段，持續迭代，請留意版本更新與變更說明。",
  },
  {
    icon: <ServerCog className="text-sky-500" size={22} />,
    title: "自由組合",
    desc: "經濟、領地、商店、傳送、任務…挑選你需要的功能，輕量化伺服器。",
  },
];

const highlights = [
  { icon: <Cpu className="text-sky-600" size={16} />, label: "現代 Fabric 26.2" },
  { icon: <Sparkles className="text-violet-500" size={16} />, label: "自動依賴解析" },
  { icon: <Search className="text-sky-600" size={16} />, label: "模組搜尋" },
  { icon: <Download className="text-emerald-600" size={16} />, label: "單一 ZIP" },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-hero-gradient">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-20 text-center sm:px-6 sm:pt-28">
          <span className="capsule bg-white text-slate-700 ring-slate-200 shadow-sm">
            <Layers size={14} aria-hidden />
            Minecraft Fabric 26.2 · 模組化生態系統
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            為你的伺服器
            <br className="hidden sm:block" />
            挑選稱手的模組
            <span aria-hidden className="ml-1 inline-block h-8 w-1 animate-cursor-blink rounded-sm bg-blue-700 align-middle" />
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            勾選需要的功能，依賴自動帶入，一個 ZIP 打包帶走。
            目前為 <span className="font-semibold text-amber-600">{BETA_LABEL}</span>。
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/mods"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:from-sky-600 hover:to-blue-700"
            >
              開始挑選模組
              <ArrowRight size={18} aria-hidden />
            </Link>
            <a
              href="https://github.com/yanggu0413/craft-core-mod"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-blue-700"
            >
              <GitBranch size={18} aria-hidden />
              GitHub 原始碼
            </a>
          </div>

          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            {highlights.map((h) => (
              <span
                key={h.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
              >
                {h.icon}
                {h.label}
              </span>
            ))}
          </div>
        </div>

        {/* Mock picker preview */}
        <div className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl shadow-sky-100/60 backdrop-blur">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
              <span className="ml-3 text-xs text-slate-400">craft-core / mods</span>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                { letter: "EC", name: "Craft-Core Economy", band: "bg-gradient-to-r from-sky-400 to-blue-600" },
                { letter: "SH", name: "Craft-Core Shop", band: "bg-gradient-to-r from-cyan-400 to-sky-600" },
                { letter: "CL", name: "Craft-Core Claims", band: "bg-gradient-to-r from-blue-400 to-indigo-600" },
              ].map((s, i) => (
                <div key={s.name} className="flex items-center gap-3 px-4 py-3">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg text-sm font-bold text-white ${s.band}`}>
                    {s.letter}
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-800">{s.name}</span>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-700">依賴自動帶入</span>
                  <span className={`grid h-5 w-5 place-items-center rounded-full ${i === 0 ? "bg-sky-500 text-white" : "border border-slate-300 text-transparent"}`}>
                    <Check size={12} strokeWidth={3} />
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between bg-gradient-to-r from-sky-50 to-blue-50 px-4 py-3">
              <span className="text-xs font-medium text-slate-500">已選 1 個（含 2 個依賴）= 下載 ZIP</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white">
                <Download size={13} /> 下載 ZIP
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">
            為什麼模組化？
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
            只加入需要的功能，讓效能與體驗都保持輕盈、乾淨。
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:border-sky-200 hover:shadow-md"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-50">
                  {f.icon}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 雙欄交錯 */}
      <section className="bg-gradient-to-b from-white to-sky-50/60 py-16">
        <div className="mx-auto max-w-6xl space-y-16 px-4 sm:px-6">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <span className="capsule bg-sky-50 text-sky-700 ring-sky-200">
                <Zap size={14} aria-hidden />
                依賴自動解析
              </span>
              <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                勾選即帶依賴，不會漏裝
              </h3>
              <p className="mt-3 leading-7 text-slate-600">
                例如勾選「Home」會自動帶入 craft-core-libs、craft-core-back 與 craft-core-teleport。
                取消勾選時也只會移除不再被需要的依賴，組合乾淨不暴走。
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-md">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">craft-core-home</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">公測</span>
              </div>
              <div className="mt-4 space-y-2">
                {["craft-core-libs", "craft-core-back", "craft-core-teleport"].map((d) => (
                  <div key={d} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">{d}（依賴）</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid items-center gap-10 md:grid-cols-2">
            <div className="order-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-md md:order-1">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Download size={15} className="text-sky-500" />
                craft-core-modules-{MODULES_VERSION}.zip
              </div>
              <div className="mt-3 rounded-lg bg-slate-50 p-3 font-mono text-xs leading-6 text-slate-600">
                craft-core-libs-{MODULES_VERSION}.jar
                <br />
                craft-core-economy-{MODULES_VERSION}.jar
                <br />
                craft-core-shop-{MODULES_VERSION}.jar
                <br />
                MANIFEST.txt
              </div>
            </div>
            <div className="order-1 md:order-2">
              <span className="capsule bg-violet-50 text-violet-700 ring-violet-200">
                <Package size={14} aria-hidden />
                單一 ZIP
              </span>
              <h3 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">
                一次打包，放入 mods 即可
              </h3>
              <p className="mt-3 leading-7 text-slate-600">
                一個壓縮檔包含所有勾選的模組 jar 與一併的依賴，附帶 MANIFEST 清單；
                放進伺服器的 mods 資料夾就能啟用。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats / CTA */}
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-4 rounded-3xl border border-sky-100 bg-gradient-to-br from-white to-sky-50 p-8 text-center sm:grid-cols-3">
            <div>
              <p className="text-3xl font-bold text-blue-700">{MODULES.length}</p>
              <p className="mt-1 text-sm text-slate-500">個模組</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-700">{MODULES_VERSION}</p>
              <p className="mt-1 text-sm text-slate-500">目前版本</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-3xl font-bold text-amber-500">{BETA_LABEL}</p>
              <p className="mt-1 text-sm text-slate-500">持續迭代中</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
