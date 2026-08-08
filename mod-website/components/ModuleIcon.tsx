const GRADIENTS = [
  "from-sky-400 to-blue-600",
  "from-cyan-400 to-sky-600",
  "from-blue-400 to-indigo-600",
  "from-indigo-400 to-violet-600",
  "from-violet-400 to-purple-600",
  "from-sky-300 to-blue-500",
];

export function moduleKey(id: string): string {
  return id.replace("craft-core-", "");
}

export function moduleLetter(id: string): string {
  const key = moduleKey(id);
  if (!key) return "C";
  return key.slice(0, 2).toUpperCase();
}

export function moduleGradient(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return GRADIENTS[Math.abs(h) % GRADIENTS.length];
}

export default function ModuleIcon({ id, size = 40 }: { id: string; size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`grid shrink-0 select-none place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm ${moduleGradient(id)}`}
      aria-hidden
    >
      <span style={{ fontSize: size * 0.36 }} className="font-bold tracking-wide">
        {moduleLetter(id)}
      </span>
    </span>
  );
}
