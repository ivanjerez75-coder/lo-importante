import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultProfile, applyFeedback, score, buildFeed, PILARES } from "../app/rank.js";

let seq = 0;
const n = (pilar, importancia = 6, extra = {}) => ({
  id: `n${seq++}`, titulo: "t", resumen: "", porQue: "", pilar, etiquetas: [pilar + "-tag"],
  importancia, fuente: `src-${pilar}`, fuentes: [], url: `u${seq}`, fecha: new Date().toISOString(), ultimaHora: false, ...extra,
});
const rng = () => 0.42;

test("sin likes: manda la importancia y luego la prioridad del pilar", () => {
  const p = defaultProfile();
  assert.ok(score(n("deporte", 8), p) > score(n("global", 6), p));
  assert.ok(score(n("global", 6), p) > score(n("deporte", 6), p));
});

test("un like a tecnología la sube por encima de deporte con la misma importancia", () => {
  let p = defaultProfile();
  const tec = n("tecnologia"), dep = n("deporte");
  const before = score(tec, p) - score(dep, p);
  p = applyFeedback(p, n("tecnologia"), "like");
  assert.ok(score(tec, p) - score(dep, p) > before);
});

test("pulsar like dos veces lo deshace; cambiar a dislike resta", () => {
  const x = n("economia");
  let p = applyFeedback(defaultProfile(), x, "like");
  assert.equal(p.votos[x.id], "like");
  p = applyFeedback(p, x, "like");
  assert.equal(p.votos[x.id], undefined);
  assert.equal(p.pilares.economia, 0);
  p = applyFeedback(applyFeedback(p, x, "like"), x, "dislike");
  assert.equal(p.votos[x.id], "dislike");
  assert.equal(p.pilares.economia, -1);
});

test("los gustos se olvidan con el tiempo (mitad cada 30 días)", () => {
  const t0 = Date.parse("2026-01-01");
  let p = applyFeedback(defaultProfile(), n("global"), "like", t0);
  p = applyFeedback(p, n("deporte"), "open", t0 + 30 * 86400e3);
  assert.ok(Math.abs(p.pilares.global - 0.5) < 1e-9);
});

test("importancia ≥ 9 siempre sale aunque odies el pilar", () => {
  let p = defaultProfile();
  for (let i = 0; i < 20; i++) p = applyFeedback(p, n("deporte"), "dislike");
  const pool = [n("deporte", 9), ...Array.from({ length: 30 }, () => n("tecnologia", 7))];
  const feed = buildFeed(pool, [], p, { rng });
  const all = [...feed.ultima, ...feed.top3, ...feed.paraTi];
  assert.ok(all.some((x) => x.pilar === "deporte" && x.importancia === 9));
});

test("con n=15 hay entre 2 y 3 noticias de exploración, sin duplicados", () => {
  let p = defaultProfile();
  for (let i = 0; i < 5; i++) p = applyFeedback(p, n("tecnologia"), "like");
  const pool = PILARES.flatMap((pl) => Array.from({ length: 8 }, (_, i) => n(pl, 4 + (i % 4), { etiquetas: [`${pl}-${i}`] })));
  const feed = buildFeed(pool, [], p, { n: 15, rng });
  const ex = feed.paraTi.filter((x) => x.explora);
  assert.ok(ex.length >= 2 && ex.length <= 3, `explora=${ex.length}`);
  assert.equal(feed.paraTi.length, 15);
  const ids = [...feed.top3, ...feed.paraTi].map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("última hora y top3 van en sus secciones", () => {
  const a = n("ultima", 8, { ultimaHora: true }), b = n("global", 9), c = n("economia", 5);
  const feed = buildFeed([a, b, c], [b.id], defaultProfile(), { rng });
  assert.deepEqual(feed.ultima.map((x) => x.id), [a.id]);
  assert.deepEqual(feed.top3.map((x) => x.id), [b.id]);
  assert.deepEqual(feed.paraTi.map((x) => x.id), [c.id]);
});

test("peso manual 0 oculta un pilar (salvo importancia ≥ 9)", () => {
  const p = defaultProfile();
  p.manual.deporte = 0;
  const pool = [n("deporte", 8), ...Array.from({ length: 20 }, () => n("economia", 5))];
  const feed = buildFeed(pool, [], p, { n: 10, explorar: 0, rng });
  assert.ok(!feed.paraTi.some((x) => x.pilar === "deporte"));
});
