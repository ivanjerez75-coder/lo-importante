// Uso: node collector/run.js            -> edición diaria
//      node collector/run.js breaking   -> actualiza sólo la última hora
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FEEDS } from "./feeds.js";
import { fetchAll } from "./rss.js";
import { dedupe } from "./dedupe.js";
import { rawPool } from "./fallback.js";
import { summarize, providerFromEnv } from "./ai.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "data", "noticias.json");
const BREAKING_WINDOW_H = 3;
const BREAKING_TTL_H = 6;
const EDITION_HOUR = 4; // a partir de las 4:00 (Barcelona) se prepara la edición del día

/** Mezcla noticias de última hora en la edición previa; caduca las de última hora viejas. */
export function mergeBreaking(prev, nuevas, now = Date.now()) {
  const byUrl = new Map();
  for (const n of prev.noticias ?? []) {
    const viva = n.ultimaHora && now - Date.parse(n.fecha) < BREAKING_TTL_H * 3600e3;
    byUrl.set(n.url, { ...n, ultimaHora: viva });
  }
  for (const n of nuevas) {
    const old = byUrl.get(n.url);
    byUrl.set(n.url, old ? { ...old, ...n, id: old.id, ultimaHora: true } : { ...n, ultimaHora: true });
  }
  return { ...prev, top3: prev.top3 ?? [], noticias: [...byUrl.values()] };
}

export async function buildEdition({ mode = "edicion", fetchFn = fetch, provider, feeds = FEEDS, prev = null, log = console.log }) {
  const items = await fetchAll(feeds, fetchFn, { log });
  let clusters = dedupe(items);
  log(`${items.length} noticias → ${clusters.length} tras agrupar`);

  if (mode === "breaking") {
    const cutoff = Date.now() - BREAKING_WINDOW_H * 3600e3;
    clusters = clusters.filter((c) => Date.parse(c.published) >= cutoff);
  }

  // provider puede ser una función o una lista; se prueban en orden hasta que uno funcione.
  const providers = [provider].flat().filter(Boolean);
  let result, modo, lastErr = new Error("sin clave de IA (GEMINI_API_KEY, GROQ_API_KEY o ANTHROPIC_API_KEY)");
  for (const p of providers) {
    try {
      const r = await summarize(clusters, p, { mode, prev, log });
      if (mode === "edicion" && r.noticias.length < 10) throw new Error(`devolvió sólo ${r.noticias.length}`);
      result = r;
      modo = "ia";
      log(`✔ IA: ${p.label ?? "ia"} (${r.noticias.length} noticias)`);
      break;
    } catch (e) {
      lastErr = e;
      log(`(${p.label ?? "ia"}) no disponible: ${e.message}`);
    }
  }
  if (!result) {
    log(`IA no disponible (${lastErr.message}) → modo crudo`);
    result = rawPool(clusters);
    modo = "crudo";
    if (mode === "breaking") result.noticias = result.noticias.filter((n) => n.ultimaHora);
  }

  const generado = new Date().toISOString();
  if (mode === "breaking" && prev) {
    return { ...mergeBreaking(prev, result.noticias.filter((n) => n.ultimaHora)), actualizado: generado };
  }
  return { generado, actualizado: generado, modo, top3: result.top3, noticias: result.noticias };
}

const madrid = (t) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(t)).map((x) => [x.type, x.value])
  );
  return { dia: `${p.year}-${p.month}-${p.day}`, hora: Number(p.hour) };
};

/**
 * Una pasada programada hace la edición completa cuando:
 * - no hay edición previa,
 * - la edición salió sin IA y ahora hay IA (Google saturado), o
 * - en Barcelona ya son más de las 4:00 y la edición no es de hoy (GitHub se saltó la de la madrugada).
 * Así la app se arregla sola en la siguiente pasada y está lista antes de las 6:30.
 */
export function needsFullEdition(prev, hasAI, now = Date.now()) {
  if (!prev?.generado) return true;
  if (prev.modo === "crudo" && hasAI) return true;
  const hoy = madrid(now);
  return hoy.hora >= EDITION_HOUR && madrid(Date.parse(prev.generado)).dia !== hoy.dia;
}

async function main() {
  const mode = process.argv[2] === "breaking" ? "breaking" : "edicion";
  const provider = await providerFromEnv();
  let prev = null;
  try {
    prev = JSON.parse(await readFile(OUT, "utf8"));
  } catch {}
  const effective = mode === "breaking" && needsFullEdition(prev, provider.length > 0) ? "edicion" : mode;
  const out = await buildEdition({ mode: effective, provider, prev });
  if (!out.noticias.length) {
    console.error("0 noticias: no sobrescribo el fichero anterior");
    process.exit(1);
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 1));
  console.log(`✔ ${out.noticias.length} noticias (${out.modo}, ${effective}) → ${OUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
