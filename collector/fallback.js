import { idFor, clampImp, recortar } from "./common.js";

/** Modo sin IA: titulares tal cual, importancia según cuántos medios lo cuentan. */
export function rawPool(clusters, { limit = 80, breakingHours = 3, now = Date.now() } = {}) {
  // Reparto equilibrado: hasta limit/7 por pilar (clusters ya vienen ordenados por importancia).
  const perPillar = Math.ceil(limit / 7);
  const count = {};
  const picked = clusters.filter((c) => (count[c.pillar] = (count[c.pillar] ?? 0) + 1) <= perPillar);
  const noticias = picked.slice(0, limit).map((c) => ({
    id: idFor(c.link),
    titulo: c.title,
    resumen: recortar(c.summary),
    porQue: "",
    pilar: c.pillar,
    etiquetas: [],
    importancia: clampImp(4 + c.sourceCount),
    fuente: c.source,
    fuentes: c.sources,
    url: c.link,
    fecha: c.published,
    reaccion: "",
    ultimaHora: c.sourceCount >= 3 && now - Date.parse(c.published) < breakingHours * 3600e3,
  }));
  return { top3: noticias.slice(0, 3).map((n) => n.id), noticias };
}
