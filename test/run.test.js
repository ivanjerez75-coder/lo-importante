import { test } from "node:test";
import assert from "node:assert/strict";
import { rawPool } from "../collector/fallback.js";
import { buildEdition, mergeBreaking } from "../collector/run.js";
import { toNoticias, formatAyer } from "../collector/ai.js";

const now = Date.now();
const iso = (hAgo) => new Date(now - hAgo * 3600e3).toISOString();
const cluster = (title, extra = {}) => ({
  title, link: `https://x/${encodeURIComponent(title)}`, summary: "Resumen ".repeat(60),
  published: iso(1), source: "BBC", sources: ["BBC"], sourceCount: 1, pillar: "global", ...extra,
});

const KEYS = ["id", "titulo", "resumen", "porQue", "pilar", "etiquetas", "importancia", "fuente", "fuentes", "url", "fecha", "ultimaHora", "reaccion"];

test("rawPool produce noticias con el formato completo", () => {
  const out = rawPool([cluster("A", { sourceCount: 3, sources: ["a", "b", "c"] }), cluster("B")]);
  assert.equal(out.noticias.length, 2);
  for (const n of out.noticias) assert.deepEqual(Object.keys(n).sort(), [...KEYS].sort());
  assert.equal(out.noticias[0].importancia, 7);
  assert.ok(out.noticias[0].resumen.length <= 241);
  assert.equal(out.top3.length, 2);
});

test("toNoticias mapea refs, ignora refs inválidas y limita importancia", () => {
  const cl = [cluster("A"), cluster("B")];
  const out = toNoticias(
    { top3: [0, 9], noticias: [
      { ref: 0, titulo: "T", resumen: "R", porQue: "P", pilar: "economia", etiquetas: ["X ", "x"], importancia: 14, ultimaHora: false, reaccion: " Nvidia rebota un 3%. " },
      { ref: 7, titulo: "no existe", resumen: "", porQue: "", pilar: "global", etiquetas: [], importancia: 5, ultimaHora: false, reaccion: "" },
    ] },
    cl
  );
  assert.equal(out.noticias.length, 1);
  assert.equal(out.noticias[0].importancia, 10);
  assert.equal(out.noticias[0].url, cl[0].link);
  assert.deepEqual(out.noticias[0].etiquetas, ["x"]);
  assert.deepEqual(out.top3, [out.noticias[0].id]);
  assert.equal(out.noticias[0].reaccion, "Nvidia rebota un 3%.");
});

test("formatAyer lista sólo las noticias importantes de la edición anterior", () => {
  const txt = formatAyer({ noticias: [
    { titulo: "Nvidia se desploma", resumen: "Cae un 12%", importancia: 8 },
    { titulo: "Gol de Lamine", resumen: "", importancia: 4 },
  ] });
  assert.match(txt, /Nvidia se desploma/);
  assert.doesNotMatch(txt, /Lamine/);
  assert.equal(formatAyer(null), "");
});

const fakeFetch = async () => ({
  ok: true,
  text: async () => `<rss><channel>
    <item><title>Ola de calor récord en Europa</title><link>https://n/1</link><pubDate>${new Date().toUTCString()}</pubDate></item>
    <item><title>Startup española levanta 20 millones</title><link>https://n/2</link><pubDate>${new Date().toUTCString()}</pubDate></item>
  </channel></rss>`,
});

test("si la IA falla, la edición sale en modo crudo y no vacía", async () => {
  const client = { messages: { parse: async () => { throw new Error("401"); } } };
  const out = await buildEdition({ mode: "edicion", fetchFn: fakeFetch, client, feeds: [{ url: "u", source: "S", pillar: "global" }], log: () => {} });
  assert.equal(out.modo, "crudo");
  assert.ok(out.noticias.length >= 2);
  assert.ok(out.generado);
});

test("sin cliente (sin clave) también sale en modo crudo", async () => {
  const out = await buildEdition({ mode: "edicion", fetchFn: fakeFetch, client: null, feeds: [{ url: "u", source: "S", pillar: "global" }], log: () => {} });
  assert.equal(out.modo, "crudo");
});

test("mergeBreaking añade última hora y conserva el resto de la edición", () => {
  const prev = { generado: iso(5), modo: "ia", top3: ["a"], noticias: [
    { id: "a", url: "u1", ultimaHora: false, fecha: iso(5) },
    { id: "b", url: "u2", ultimaHora: true, fecha: iso(10) },
  ] };
  const out = mergeBreaking(prev, [{ id: "c", url: "u3", ultimaHora: true, fecha: iso(1) }, { id: "a2", url: "u1", ultimaHora: true, fecha: iso(1) }]);
  assert.deepEqual(out.top3, ["a"]);
  const byUrl = Object.fromEntries(out.noticias.map((n) => [n.url, n]));
  assert.equal(byUrl.u3.ultimaHora, true);
  assert.equal(byUrl.u1.ultimaHora, true); // actualizada
  assert.equal(byUrl.u2.ultimaHora, false); // caducada (>6h)
  assert.equal(out.noticias.length, 3);
});
