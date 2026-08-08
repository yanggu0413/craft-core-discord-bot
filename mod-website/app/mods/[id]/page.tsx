import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download, TerminalSquare, ExternalLink } from "lucide-react";
import { MODULES, MODULES_BY_ID, MODULES_VERSION } from "@/lib/modules-data";
import { BETA_LABEL, BETA_NOTICE, IS_BETA } from "@/lib/types";
import BetaBadge from "@/components/BetaBadge";
import DependencyBadge from "@/components/DependencyBadge";
import ModuleIcon from "@/components/ModuleIcon";

export function generateStaticParams() {
  return MODULES.map((m) => ({ id: m.id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const mod = MODULES_BY_ID[params.id];
  return {
    title: mod ? `${mod.name} 模組` : "找不到模組",
    description: mod?.description || undefined,
  };
}

export default function ModuleDetailPage({ params }: { params: { id: string } }) {
  const mod = MODULES_BY_ID[params.id];

  if (!mod) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-slate-600">找不到此模組。</p>
        <Link href="/mods" className="mt-4 inline-block text-blue-700 hover:underline">
          ← 回到模組下載
        </Link>
      </div>
    );
  }

  const deps = mod.depends.map((d) => MODULES_BY_ID[d]).filter(Boolean);
  const recs = mod.recommends.map((d) => MODULES_BY_ID[d]).filter(Boolean);
  const dependents = MODULES.filter((m) => m.id !== mod.id && m.depends.includes(mod.id));

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        href="/mods"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-700"
      >
        <ArrowLeft size={16} aria-hidden />
        回到模組下載
      </Link>

      <div className="mt-6 flex flex-wrap items-start gap-5">
        <ModuleIcon id={mod.id} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{mod.name}</h1>
            {IS_BETA && <BetaBadge />}
          </div>
          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            {mod.description || "（尚無描述）"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs">{mod.id}</span>
            <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs text-sky-700 ring-1 ring-inset ring-sky-200">
              v{mod.version}
            </span>
          </div>
        </div>
      </div>

      {IS_BETA && (
        <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-800 ring-1 ring-inset ring-amber-200">
          <p className="font-semibold">{BETA_LABEL} 聲明</p>
          <p className="mt-1">{BETA_NOTICE}</p>
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">強制依賴</h2>
          {deps.length > 0 ? (
            <div className="mt-3 space-y-2">
              {deps.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                  <ModuleIcon id={d.id} size={34} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/mods/${d.id}`} className="text-sm font-semibold text-slate-800 hover:text-blue-700">
                      {d.name}
                    </Link>
                    <p className="truncate text-xs text-slate-400">v{d.version}</p>
                  </div>
                  <ExternalLink size={14} className="text-slate-300" aria-hidden />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">此模組無其它 Craft-Core 依賴。</p>
          )}

          {recs.length > 0 && (
            <>
              <h3 className="mt-6 text-sm font-semibold text-slate-700">建議搭配</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recs.map((r) => (
                  <DependencyBadge key={r.id} id={r.id} />
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">被誰依賴</h2>
          {dependents.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {dependents.map((d) => (
                <DependencyBadge key={d.id} id={d.id} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">目前沒有其它模組依賴它。</p>
          )}

          <h3 className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <TerminalSquare size={15} className="text-sky-500" aria-hidden />
            Entrypoint
          </h3>
          <p className="mt-2 rounded-lg bg-slate-50 p-2.5 font-mono text-xs text-slate-600">
            {mod.entrypoint || "（無）"}
          </p>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href={`/mods?preselect=${mod.id}`}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:from-sky-600 hover:to-blue-700"
        >
          <Download size={16} aria-hidden />
          一鍵下載此模組（含依賴）
        </Link>
        <Link
          href="/mods"
          className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-blue-700"
        >
          全部模組瀏覽
        </Link>
      </div>

      <p className="mt-4 text-xs text-slate-400">整體模組版本：v{MODULES_VERSION}</p>
    </div>
  );
}
