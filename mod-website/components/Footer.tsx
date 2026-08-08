import Link from "next/link";
import { BETA_NOTICE, IS_BETA } from "@/lib/types";

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "資源",
    links: [
      { label: "模組下載", href: "/mods" },
      { label: "依賴說明", href: "/mods/craft-core-libs" },
      { label: "GitHub", href: "https://github.com/yanggu0413/craft-core-mod" },
    ],
  },
  {
    title: "社區",
    links: [
      { label: "Discord", href: "#" },
      { label: "語言切換", href: "#" },
      { label: "意見回饋", href: "#" },
    ],
  },
  {
    title: "支持",
    links: [
      { label: "安裝教學", href: "/mods" },
      { label: "FAQ", href: "#" },
      { label: "贊助", href: "#" },
    ],
  },
  {
    title: "友情鏈接",
    links: [
      { label: "Fabric", href: "https://fabricmc.net" },
      { label: "AstrBot", href: "https://astrbot.app" },
      { label: "Minecraft", href: "https://www.minecraft.net" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-700 text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M12 2 3 7v5c0 5 3.7 9.3 9 10 5.3-.7 9-5 9-10V7l-9-5Z" fill="currentColor" />
                </svg>
              </span>
              <span className="font-semibold text-slate-900">Craft-Core</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
              Minecraft Fabric 模組化伺服器生態系統。{IS_BETA ? "目前為公測階段。" : ""}
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-slate-900">{col.title}</h4>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-slate-500 transition hover:text-blue-700"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-slate-100 pt-6 text-xs leading-5 text-slate-400">
          {IS_BETA ? BETA_NOTICE : ""}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          © {new Date().getFullYear()} Craft-Core. 非官方 Minecraft 產品，與 Mojang 或 Microsoft 無關。
        </p>
      </div>
    </footer>
  );
}
