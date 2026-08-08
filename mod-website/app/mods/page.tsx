"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownToLine,
  Check,
  Download,
  Layers,
  Loader2,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { MODULES, MODULES_BY_ID, MODULES_VERSION } from "@/lib/modules-data";
import {
  collectWithDeps,
  computeAutoDeps,
  removeWithMinimalImpact,
  sortedModuleList,
  getModule,
} from "@/lib/selection";
import type { ModuleInfo } from "@/lib/types";
import { BETA_NOTICE, BETA_LABEL, IS_BETA } from "@/lib/types";
import { buildModuleZip, triggerDownload } from "@/lib/download";
import BetaBadge from "@/components/BetaBadge";
import ModsLoading from "./loading";
import DependencyBadge from "@/components/DependencyBadge";
import ModuleIcon, { moduleKey } from "@/components/ModuleIcon";

type Filter = "all" | "libs-only" | "economy" | "teleport";

const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "libs-only", label: "僅依賴 libs" },
  { key: "economy", label: "需要動態經濟" },
  { key: "teleport", label: "需要傳送/回點" },
];

export default function ModsPageWrapper() {
  return (
    <Suspense fallback={<ModsLoading />}>
      <ModsPage />
    </Suspense>
  );
}

function ModsPage() {
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [showModal, setShowModal] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [zipMissing, setZipMissing] = useState<string[] | null>(null);

  useEffect(() => {
    const pre = searchParams.get("preselect");
    if (pre && MODULES_BY_ID[pre]) {
      setSelected(collectWithDeps(new Set([pre])));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closure = useMemo(() => collectWithDeps(selected), [selected]);
  const autoDeps = useMemo(() => computeAutoDeps(selected), [selected]);
  const selectedList = useMemo(
    () => sortedModuleList([...closure].map(getModule).filter((m): m is NonNullable<typeof m> => Boolean(m))),
    [closure]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortedModuleList(MODULES).filter((m) => {
      if (filter === "libs-only" && m.depends.length > 1) return false;
      if (filter === "economy" && !m.depends.includes("craft-core-economy") && m.id !== "craft-core-economy") return false;
      if (filter === "teleport" && !(m.depends.includes("craft-core-back") || m.depends.includes("craft-core-teleport"))) return false;
      if (q && !`${m.id} ${m.name} ${m.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [query, filter]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        return removeWithMinimalImpact(next, [id]);
      }
      next.add(id);
      return next;
    });
  }

  async function handleDownload() {
    setZipMissing(null);
    setShowModal(true);
  }

  async function confirmDownload() {
    setZipping(true);
    try {
      const { blob, missing } = await buildModuleZip(selectedList, MODULES_VERSION);
      setZipMissing(missing);
      if (blob.size > 0) {
        triggerDownload(blob, `craft-core-modules-${MODULES_VERSION}.zip`);
      }
    } catch {
      setZipMissing(selectedList.map((m) => `${m.id}.jar`));
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="max-w-2xl">
        <span className="capsule bg-sky-50 text-sky-700 ring-sky-200">
          <Layers size={14} aria-hidden />
          模組化下載
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          挑選模組，依賴自動勾選
        </h1>
        <p className="mt-3 text-slate-600">
          勾選需要的模組，系統會自動帶入其依賴（如 fabric-core-libs、economy 等），最後打包成單一 ZIP。
          <span className="text-amber-600"> {BETA_LABEL}</span>
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋模組名稱或功能…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3.5 py-2 text-sm font-medium ring-1 ring-inset transition ${
                filter === f.key
                  ? "bg-blue-700 text-white ring-blue-700"
                  : "bg-white text-slate-600 ring-slate-200 hover:bg-sky-50 hover:ring-sky-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((m) => {
          const isSel = closure.has(m.id);
          const isAuto = autoDeps.has(m.id);
          return (
            <label
              key={m.id}
              className={`group relative flex cursor-pointer flex-col rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${
                isSel ? "border-sky-300 ring-1 ring-sky-200" : "border-slate-200"
              }`}
            >
              <input
                type="checkbox"
                className="peer sr-only"
                checked={isSel}
                onChange={() => toggle(m.id)}
              />
              <div className="flex items-start gap-3">
                <ModuleIcon id={m.id} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/mods/${m.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="truncate text-base font-semibold text-slate-900 hover:text-blue-700"
                    >
                      {m.name}
                    </Link>
                    <BetaBadge />
                    {isAuto && (
                      <span className="text-[10px] font-medium text-violet-500">（依賴）</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{m.description || "（尚無描述）"}</p>
                </div>
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
                    isSel ? "border-sky-500 bg-sky-500 text-white" : "border-slate-300 text-transparent"
                  }`}
                >
                  <Check size={14} strokeWidth={3} aria-hidden />
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {m.depends.map((d) => (
                  <DependencyBadge key={d} id={d} auto={autoDeps.has(d)} />
                ))}
                {m.recommends.map((d) => (
                  <DependencyBadge key={d} id={d} />
                ))}
                <span className="ml-auto text-xs text-slate-400">v{m.version}</span>
              </div>

              <span
                className={`pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-inset transition ${
                  isSel ? "ring-sky-400" : "ring-transparent"
                }`}
                aria-hidden
              />
            </label>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <p className="mt-12 text-center text-slate-500">沒有符合條件的模組。</p>
      )}

      <DownloadBar
        count={selectedList.length}
        autoCount={autoDeps.size}
        beta={IS_BETA}
        onDownload={handleDownload}
      />

      {showModal && (
        <DisclaimerModal
          modules={selectedList}
          missing={zipMissing}
          zipping={zipping}
          onConfirm={confirmDownload}
          onClose={() => {
            setZipMissing(null);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function DownloadBar({
  count,
  autoCount,
  beta,
  onDownload,
}: {
  count: number;
  autoCount: number;
  beta: boolean;
  onDownload: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-4 z-30 mt-10">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white/90 px-5 py-4 shadow-lg backdrop-blur">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            已選 <span className="text-blue-700">{count}</span> 個模組
            {autoCount > 0 && (
              <span className="font-normal text-slate-500">（含自動帶入依賴 {autoCount}）</span>
            )}
          </p>
          {beta && (
            <p className="mt-0.5 text-xs font-medium text-amber-600">{BETA_LABEL} · 下載即表示同意免責聲明</p>
          )}
        </div>
        <button
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-sky-600 hover:to-blue-700"
        >
          <Download size={16} aria-hidden />
          下載 ZIP
        </button>
      </div>
    </div>
  );
}

function DisclaimerModal({
  modules,
  missing,
  zipping,
  onConfirm,
  onClose,
}: {
  modules: ModuleInfo[];
  missing: string[] | null;
  zipping: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <ShieldAlert size={18} className="text-amber-500" aria-hidden />
            確認下載
          </h3>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="關閉">
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[40vh] overflow-auto px-6 py-4">
          <p className="text-sm text-slate-600">將下載以下模組：</p>
          <ul className="mt-2 space-y-1.5">
            {modules.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="text-sky-500">
                  <ArrowDownToLine size={14} aria-hidden />
                </span>
                <span className="font-medium">{m.name}</span>
                <span className="text-slate-400">({moduleKey(m.id)} · v{m.version})</span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-800 ring-1 ring-inset ring-amber-200">
            <p className="font-semibold">{BETA_LABEL} 聲明</p>
            <p className="mt-1 text-xs">{BETA_NOTICE}</p>
          </div>
          {missing && missing.length > 0 && (
            <p className="mt-3 rounded-lg bg-slate-100 p-2 text-xs text-slate-600">
              以下檔案尚未釋出或被略過：{missing.join("、")}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={zipping}
            className="inline-flex items-center gap-2 rounded-full bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
          >
            {zipping && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {zipping ? "打包中…" : "確認下載 ZIP"}
          </button>
        </div>
      </div>
    </div>
  );
}
