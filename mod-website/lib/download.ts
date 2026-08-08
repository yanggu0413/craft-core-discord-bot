import JSZip from "jszip";
import type { ModuleInfo } from "./types";
import { BETA_NOTICE, BETA_LABEL, IS_BETA } from "./types";

const DEFAULT_DOWNLOAD_BASE = "/downloads";

function resolveDownloadBase(): string {
  if (
    typeof process !== "undefined" &&
    process.env &&
    typeof (process.env as Record<string, string | undefined>)
      .NEXT_PUBLIC_MODULES_DOWNLOAD_BASE === "string"
  ) {
    return (process.env as Record<string, string>).NEXT_PUBLIC_MODULES_DOWNLOAD_BASE.replace(
      /\/$/,
      ""
    );
  }
  return DEFAULT_DOWNLOAD_BASE;
}

export function jarUrl(m: ModuleInfo): string {
  return `${resolveDownloadBase()}/${m.id}/${m.id}-${m.version}.jar`;
}

function manifestText(modules: ModuleInfo[], version: string, missing: string[]): string {
  const lines: string[] = [];
  lines.push(`Craft-Core module set`);
  lines.push(`Version: ${version}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  if (IS_BETA) {
    lines.push(`Status: ${BETA_LABEL}`);
    lines.push(`Disclaimer: ${BETA_NOTICE}`);
  }
  lines.push("");
  lines.push("Included modules:");
  for (const m of modules) {
    lines.push(`  - ${m.id} (${m.name}) v${m.version}`);
  }
  if (missing.length) {
    lines.push("");
    lines.push("NOT released yet / download failed (not included):");
    for (const f of missing) lines.push(`  - ${f}`);
  }
  lines.push("");
  lines.push(BETA_NOTICE);
  return lines.join("\n");
}

/**
 * Packs the given modules into a single ZIP (client side). Jars that fail to
 * fetch (not released yet) are skipped and reported.
 */
export async function buildModuleZip(
  modules: ModuleInfo[],
  version: string
): Promise<{ blob: Blob; missing: string[] }> {
  const zip = new JSZip();
  const missing: string[] = [];
  for (const m of modules) {
    const url = jarUrl(m);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      zip.file(`${m.id}.jar`, await res.blob());
    } catch {
      missing.push(`${m.id}.jar`);
    }
  }
  zip.file("MANIFEST.txt", manifestText(modules, version, missing));
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, missing };
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
