import { defaultProfile, PILARES } from "./rank.js";

const KEY = "lo-importante:perfil:v1";

export function loadProfile() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && p.pilares && p.manual) {
      // Asegura que existan todos los pilares (por si se añaden nuevos)
      const d = defaultProfile();
      for (const k of PILARES) {
        p.pilares[k] ??= 0;
        p.manual[k] ??= 1;
      }
      return { ...d, ...p };
    }
  } catch {}
  return defaultProfile();
}

export function saveProfile(p) {
  // Limita los votos guardados a los 500 más recientes
  const ids = Object.keys(p.votos);
  if (ids.length > 500) for (const id of ids.slice(0, ids.length - 500)) delete p.votos[id];
  const ab = Object.keys(p.abiertas ?? {});
  if (ab.length > 500) for (const id of ab.slice(0, ab.length - 500)) delete p.abiertas[id];
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function exportProfile(p) {
  const blob = new Blob([JSON.stringify(p, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lo-importante-gustos-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importProfile(file) {
  const p = JSON.parse(await file.text());
  if (!p || typeof p.pilares !== "object" || typeof p.manual !== "object") throw new Error("formato");
  saveProfile(p);
  return loadProfile();
}
