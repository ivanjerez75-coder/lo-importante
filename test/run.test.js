import { test } from "node:test";
import assert from "node:assert/strict";
import { rawPool } from "../collector/fallback.js";
import { buildEdition, mergeBreaking } from "../collector/run.js";
import { toNoticias, formatAyer, geminiProvider } from "../collector/ai.js";

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
  const provider = async () => { throw new Error("401"); };
  const out = await buildEdition({ mode: "edicion", fetchFn: fakeFetch, provider, feeds: [{ url: "u", source: "S", pillar: "global" }], log: () => {} });
  assert.equal(out.modo, "crudo");
  assert.ok(out.noticias.length >= 2);
  assert.ok(out.generado);
});

test("sin cliente (sin clave) también sale en modo crudo", async () => {
  const out = await buildEdition({ mode: "edicion", fetchFn: fakeFetch, provider: null, feeds: [{ url: "u", source: "S", pillar: "global" }], log: () => {} });
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

const salidaOk = { top3: [0], noticias: [{ ref: 0, titulo: "Ola de calor", resumen: "R", porQue: "P", pilar: "global", etiquetas: ["clima"], importancia: 8, ultimaHora: false, reaccion: "" }] };
const geminiRes = (obj, status = 200) => ({ ok: status === 200, status, text: async () => "err", json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }) });

test("geminiProvider devuelve la salida validada y usa la clave en cabecera", async () => {
  let seen;
  const p = geminiProvider("KEY", { fetchFn: async (url, init) => { seen = { url, init }; return geminiRes(salidaOk); } });
  const out = await p({ system: "s", user: "u" });
  assert.equal(out.noticias[0].titulo, "Ola de calor");
  assert.equal(seen.init.headers["x-goog-api-key"], "KEY");
  assert.ok(!seen.url.includes("KEY"));
});

test("geminiProvider pasa al siguiente modelo si el primero falla", async () => {
  const urls = [];
  const p = geminiProvider("K", { models: ["a", "b"], waits: [], fetchFn: async (url) => { urls.push(url); return url.includes("/a:") ? geminiRes(null, 429) : geminiRes(salidaOk); } });
  const out = await p({ system: "s", user: "u" });
  assert.equal(urls.length, 2);
  assert.equal(out.top3[0], 0);
});

test("geminiProvider lanza si el JSON no tiene el formato", async () => {
  const p = geminiProvider("K", { models: ["a"], fetchFn: async () => geminiRes({ hola: 1 }) });
  await assert.rejects(p({ system: "s", user: "u" }));
});

test("geminiProvider reintenta si Google está saturado (503) y luego funciona", async () => {
  let calls = 0;
  const waited = [];
  const p = geminiProvider("K", {
    models: ["a"], waits: [1, 2], sleep: async (ms) => waited.push(ms),
    fetchFn: async () => (++calls < 3 ? geminiRes(null, 503) : geminiRes(salidaOk)),
  });
  const out = await p({ system: "s", user: "u" });
  assert.equal(calls, 3);
  assert.deepEqual(waited, [1, 2]);
  assert.equal(out.noticias.length, 1);
});

// ── Groq + lotes + cadena de proveedores ──
import { groqProvider, summarize, strictSchema } from "../collector/ai.js";

const groqRes = (obj, status = 200, headers = {}) => ({
  ok: status === 200, status, headers: { get: (k) => headers[k] ?? null },
  text: async () => "err", json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
});

test("groqProvider usa Bearer, esquema estricto y procesa por lotes", async () => {
  let seen;
  const p = groqProvider("GK", { gapMs: 0, fetchFn: async (url, init) => { seen = { url, body: JSON.parse(init.body), auth: init.headers.authorization }; return groqRes(salidaOk); } });
  assert.ok(p.batchSize > 0 && p.batchSize <= 30);
  const out = await p({ system: "s", user: "u" });
  assert.equal(out.noticias[0].titulo, "Ola de calor");
  assert.equal(seen.auth, "Bearer GK");
  assert.match(seen.url, /api\.groq\.com\/openai\/v1\/chat\/completions$/);
  assert.equal(seen.body.response_format.type, "json_schema");
  assert.equal(seen.body.response_format.json_schema.strict, true);
});

test("groqProvider espera entre llamadas para no pasar el límite por minuto", async () => {
  const waits = [];
  const p = groqProvider("GK", { gapMs: 60000, sleep: async (ms) => waits.push(ms), fetchFn: async () => groqRes(salidaOk) });
  await p({ system: "s", user: "u" });
  await p({ system: "s", user: "u" });
  assert.equal(waits.length, 1);
  assert.ok(waits[0] > 50000);
});

test("groqProvider reintenta tras 429 respetando retry-after", async () => {
  let n = 0; const waits = [];
  const p = groqProvider("GK", { gapMs: 0, sleep: async (ms) => waits.push(ms), fetchFn: async () => (++n === 1 ? groqRes(null, 429, { "retry-after": "7" }) : groqRes(salidaOk)) });
  await p({ system: "s", user: "u" });
  assert.equal(n, 2);
  assert.deepEqual(waits, [7000]);
});

test("strictSchema quita $schema y límites numéricos, y exige todas las propiedades", () => {
  const s = strictSchema();
  assert.equal(s.$schema, undefined);
  const item = s.properties.noticias.items;
  assert.equal(item.additionalProperties, false);
  assert.deepEqual([...item.required].sort(), Object.keys(item.properties).sort());
  assert.equal(item.properties.importancia.maximum, undefined);
});

test("summarize por lotes: reparte, mapea refs de cada lote y elige top3 por importancia", async () => {
  const cl = ["A", "B", "C", "D", "E"].map((t) => cluster(t));
  const calls = [];
  const provider = async ({ user }) => {
    calls.push(user);
    // devuelve la primera noticia de cada lote, con importancia distinta por lote
    return { top3: [], noticias: [{ ref: 0, titulo: `T${calls.length}`, resumen: "", porQue: "", pilar: "global", etiquetas: [], importancia: calls.length * 2, ultimaHora: false, reaccion: "" }] };
  };
  provider.batchSize = 2;
  const out = await summarize(cl, provider);
  assert.equal(calls.length, 3);
  assert.deepEqual(out.noticias.map((n) => n.url).sort(), [cl[0].link, cl[2].link, cl[4].link].sort());
  assert.equal(out.top3[0], out.noticias.find((n) => n.url === cl[4].link).id);
});

test("buildEdition prueba el siguiente proveedor si el primero falla", async () => {
  const falla = async () => { throw new Error("503"); };
  const ok = async () => ({ top3: [0], noticias: Array.from({ length: 2 }, (_, i) => ({ ref: i, titulo: `T${i}`, resumen: "", porQue: "", pilar: "global", etiquetas: [], importancia: 6, ultimaHora: false, reaccion: "" })) });
  const out = await buildEdition({ mode: "breaking", fetchFn: fakeFetch, provider: [falla, ok], feeds: [{ url: "u", source: "S", pillar: "global" }], log: () => {} });
  assert.equal(out.modo, "ia");
});
