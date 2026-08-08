import { MODULES, MODULES_BY_ID, MODULES_VERSION } from "./modules-data";
import type { ModuleInfo } from "./types";

export function getModule(id: string): ModuleInfo | undefined {
  return MODULES_BY_ID[id];
}

export function getDependencies(m: ModuleInfo): ModuleInfo[] {
  return m.depends
    .map((d) => MODULES_BY_ID[d])
    .filter((d): d is ModuleInfo => Boolean(d));
}

/**
 * Returns the transitive closure of selected ids (selected modules + their craft-core deps),
 * as a Set. Pure function — never mutates input.
 */
export function collectWithDeps(selected: Set<string>): Set<string> {
  const result = new Set<string>();
  const stack = [...selected];
  while (stack.length) {
    const id = stack.pop()!;
    if (result.has(id)) continue;
    const mod = MODULES_BY_ID[id];
    if (!mod) continue;
    result.add(id);
    for (const dep of mod.depends) {
      if (MODULES_BY_ID[dep] && !result.has(dep)) stack.push(dep);
    }
  }
  return result;
}

/**
 * Dependencies auto-added by the closure (not directly user-selected).
 */
export function computeAutoDeps(selected: Set<string>): Set<string> {
  const closure = collectWithDeps(selected);
  const auto = new Set<string>();
  for (const id of closure) {
    if (!selected.has(id)) auto.add(id);
  }
  return auto;
}

/**
 * When unchecking candidates, keep them selected if another selected module still
 * depends on them (directly or transitively) — returns the new selected set.
 */
export function removeWithMinimalImpact(
  selected: Set<string>,
  candidates: string[]
): Set<string> {
  const remaining = new Set(selected);
  for (const id of candidates) remaining.delete(id);

  const depsOfOthers = new Set<string>();
  const stack = [...remaining];
  while (stack.length) {
    const cur = stack.pop()!;
    const mod = MODULES_BY_ID[cur];
    if (!mod) continue;
    for (const dep of mod.depends) {
      if (!depsOfOthers.has(dep)) {
        depsOfOthers.add(dep);
        stack.push(dep);
      }
    }
  }
  for (const id of candidates) {
    if (depsOfOthers.has(id)) remaining.add(id);
  }
  return remaining;
}

export function sortedModuleList(mods: ModuleInfo[]): ModuleInfo[] {
  return [...mods].sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
}

export function hasDependents(id: string): boolean {
  return MODULES.some((m) => m.id !== id && m.depends.includes(id));
}

export { MODULES, MODULES_VERSION };
