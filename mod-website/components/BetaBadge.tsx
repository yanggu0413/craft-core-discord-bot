import { BETA_LABEL } from "@/lib/types";

export default function BetaBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-gradient-to-r from-amber-100 to-orange-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 ${className}`}
      title="公測版本，可能含有錯誤或不完整功能。"
    >
      {BETA_LABEL}
    </span>
  );
}
