// Uso: node collector/run.js            -> edición diaria
//      node collector/run.js breaking   -> actualiza sólo la última hora
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { FEEDS } from "./feeds.js";
import { fetchAll } from "./rss.js";
import { dedupe } from "./dedupe.js";
import { rawPool } from "./fallback.js";
import { summarize } from "./ai.js";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "app", "data", "noticias.json");
const BREAKING_WINDOW_H = 3;
const BREAKING_TTL_H = 6;

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

export async function buildEdition({ mode = "edicion", fetchFn = fetch, client, feeds = FEEDS, prev = null, log = console.log }) {
  const items = await fetchAll(feeds, fetchFn, { log });
  let clusters = dedupe(items);
  log(`${items.length} noticias → ${clusters.length} tras agrupar`);

  if (mode === "breaking") {
    const cutoff = Date.now() - BREAKING_WINDOW_H * 3600e3;
    clusters = clusters.filter((c) => Date.parse(c.published) >= cutoff);
  }

  let result, modo;
  try {
    if (!client) throw new Error("sin ANTHROPIC_API_KEY");
    result = await summarize(clusters, client, { mode, prev });
    modo = "ia";
    if (mode === "edicion" && result.noticias.length < 10) throw new Error(`la IA devolvió sólo ${result.noticias.length}`);
  } catch (e) {
    log(`IA no disponible (${e.message}) → modo crudo`);
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

async function main() {
  const mode = process.argv[2] === "breaking" ? "breaking" : "edicion";
  let client = null;
  if (process.env.ANTHROPIC_API_KEY) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    client = new Anthropic();
  }
  let prev = null;
  try {
    prev = JSON.parse(await readFile(OUT, "utf8"));
  } catch {}
  // Sin edición previa, "breaking" hace una edición completa.
  const effective = mode === "breaking" && !prev ? "edicion" : mode;
  const out = await buildEdition({ mode: effective, client, prev });
  if (!out.noticias.length) {
    console.error("0 noticias: no sobrescribo el fichero anterior");
    process.exit(1);
  }
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out, null, 1));
  console.log(`✔ ${out.noticias.length} noticias (${out.modo}, ${effective}) → ${OUT}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
