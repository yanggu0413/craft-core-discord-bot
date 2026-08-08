import Link from "next/link";

export default function DependencyBadge({
  id,
  auto = false,
}: {
  id: string;
  auto?: boolean;
}) {
  return (
    <Link
      href={`/mods/${id}`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition ${
        auto
          ? "bg-violet-100 text-violet-700 ring-violet-200 hover:bg-violet-200"
          : "bg-sky-100 text-sky-700 ring-sky-200 hover:bg-sky-200"
      }`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 7h9a4 4 0 0 1 0 8H4m0-8v8m0-8V4m0 16v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {id.replace("craft-core-", "")}
      {auto && <span className="opacity-70">(依賴)</span>}
    </Link>
  );
}
