import { createHash } from "node:crypto";

export const PILARES = ["global", "ultima", "economia", "geopolitica", "tecnologia", "emprendimiento", "deporte"];

export const idFor = (url) => createHash("sha1").update(url).digest("hex").slice(0, 12);

export const clampImp = (n) => Math.max(1, Math.min(10, Math.round(Number(n) || 1)));

export function normTags(tags) {
  const out = [];
  for (const t of tags ?? []) {
    const k = String(t).trim().toLowerCase();
    if (k && !out.includes(k)) out.push(k);
  }
  return out.slice(0, 4);
}

export function recortar(s, n = 240) {
  s = String(s ?? "").trim();
  if (s.length <= n) return s;
  return s.slice(0, n).replace(/\s+\S*$/, "") + "…";
}
