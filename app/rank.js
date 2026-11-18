// Motor de personalización. Puro (sin DOM): se usa en la app y en los tests.

export const PILARES = ["global", "ultima", "economia", "geopolitica", "tecnologia", "emprendimiento", "deporte"];

const DELTA = { like: 1, dislike: -1, open: 0.3 };
const HALF_LIFE_DAYS = 30;
const MUST_SHOW = 9;

export function defaultProfile() {
  return {
    pilares: Object.fromEntries(PILARES.map((p) => [p, 0])),
    etiquetas: {},
    fuentes: {},
    manual: Object.fromEntries(PILARES.map((p) => [p, 1])),
    votos: {},
    abiertas: {},
    actualizado: Date.now(),
  };
}

function decay(profile, now) {
  const days = (now - (profile.actualizado ?? now)) / 86400e3;
  if (days <= 0) return;
  const f = Math.pow(0.5, days / HALF_LIFE_DAYS);
  for (const bag of [profile.pilares, profile.etiquetas, profile.fuentes]) {
    for (const k in bag) bag[k] *= f;
  }
}

function bump(profile, noticia, d) {
  profile.pilares[noticia.pilar] = (profile.pilares[noticia.pilar] ?? 0) + d;
  for (const t of noticia.etiquetas ?? []) profile.etiquetas[t] = (profile.etiquetas[t] ?? 0) + d;
  profile.fuentes[noticia.fuente] = (profile.fuentes[noticia.fuente] ?? 0) + d * 0.5;
}

/** Devuelve un perfil nuevo. like/dislike repetido lo deshace; cambiar de voto lo invierte. */
export function applyFeedback(profile, noticia, tipo, now = Date.now()) {
  const p = structuredClone(profile);
  decay(p, now);
  p.actualizado = now;
  if (tipo === "open") {
    if (!p.abiertas[noticia.id]) {
      p.abiertas[noticia.id] = now;
      bump(p, noticia, DELTA.open);
    }
    return p;
  }
  const prev = p.votos[noticia.id];
  if (prev) bump(p, noticia, -DELTA[prev]);
  if (prev === tipo) delete p.votos[noticia.id];
  else {
    p.votos[noticia.id] = tipo;
    bump(p, noticia, DELTA[tipo]);
  }
  return p;
}

const tanh = Math.tanh;

export function score(noticia, profile) {
  const orden = PILARES.indexOf(noticia.pilar);
  const prioridad = orden < 0 ? 0 : (7 - orden) * 0.3;
  const tags = noticia.etiquetas ?? [];
  const tagPref = tags.length ? tags.reduce((s, t) => s + tanh(profile.etiquetas[t] ?? 0), 0) / tags.length : 0;
  const base =
    noticia.importancia +
    2 * tanh(profile.pilares[noticia.pilar] ?? 0) +
    1.5 * tagPref +
    0.5 * tanh(profile.fuentes[noticia.fuente] ?? 0) +
    prioridad;
  return base * (profile.manual[noticia.pilar] ?? 1);
}

/** ¿Es un tema poco conocido para el usuario? (ni le gusta ni le disgusta todavía) */
function novedad(noticia, profile) {
  const vals = [profile.pilares[noticia.pilar] ?? 0, ...(noticia.etiquetas ?? []).map((t) => profile.etiquetas[t] ?? 0)];
  if (vals.some((v) => v < -0.5)) return 0;
  return 1 - Math.max(...vals.map((v) => Math.abs(tanh(v))));
}

/**
 * Construye el feed del día.
 * @returns {{ultima: object[], top3: object[], paraTi: object[]}} paraTi lleva `explora: true` en las de prueba.
 */
export function buildFeed(noticias, top3Ids, profile, { n = 15, explorar = 0.2, rng = Math.random } = {}) {
  const ultima = noticias
    .filter((x) => x.ultimaHora)
    .sort((a, b) => b.importancia - a.importancia)
    .slice(0, 5);
  const used = new Set(ultima.map((x) => x.id));
  const top3 = top3Ids.map((id) => noticias.find((x) => x.id === id)).filter((x) => x && !used.has(x.id));
  top3.forEach((x) => used.add(x.id));

  const rest = noticias.filter((x) => !used.has(x.id) && profile.votos[x.id] !== "dislike");
  const visible = (x) => (profile.manual[x.pilar] ?? 1) > 0;
  const ranked = rest.filter(visible).sort((a, b) => score(b, profile) - score(a, profile));

  const must = rest.filter((x) => x.importancia >= MUST_SHOW);
  const nExplore = Math.min(Math.round(n * explorar), Math.max(0, n - must.length));
  const main = [...must];
  for (const x of ranked) {
    if (main.length >= n - nExplore) break;
    if (!main.includes(x)) main.push(x);
  }

  // Exploración: temas poco conocidos, elegidos al azar con peso por importancia.
  const pool = ranked
    .filter((x) => !main.includes(x))
    .map((x) => ({ x, w: novedad(x, profile) * x.importancia }))
    .filter((c) => c.w > 0);
  const explore = [];
  const pillarsUsed = new Set();
  while (explore.length < nExplore && pool.length) {
    // Prefiere pilares distintos entre sí
    const cands = pool.filter((c) => !pillarsUsed.has(c.x.pilar));
    const from = cands.length ? cands : pool;
    const total = from.reduce((s, c) => s + c.w, 0);
    let r = rng() * total;
    let pick = from[from.length - 1];
    for (const c of from) if ((r -= c.w) <= 0) { pick = c; break; }
    pool.splice(pool.indexOf(pick), 1);
    pillarsUsed.add(pick.x.pilar);
    explore.push({ ...pick.x, explora: true });
  }
  // Si no hay suficientes temas nuevos, rellena con lo mejor puntuado.
  for (const x of ranked) {
    if (main.length + explore.length >= n) break;
    if (!main.includes(x) && !explore.some((e) => e.id === x.id)) main.push(x);
  }

  // Intercala las de exploración cada ~4 posiciones.
  const paraTi = [...main];
  explore.forEach((e, i) => paraTi.splice(Math.min(paraTi.length, 3 + i * 5), 0, e));
  return { ultima, top3, paraTi };
}

/** Resumen legible de lo aprendido, para la pantalla de ajustes. */
export function aprendido(profile, k = 6) {
  const top = (bag, sign) =>
    Object.entries(bag)
      .filter(([, v]) => sign * v > 0.2)
      .sort((a, b) => sign * (b[1] - a[1]))
      .slice(0, k)
      .map(([name]) => name);
  return {
    gusta: [...top(profile.pilares, 1), ...top(profile.etiquetas, 1)].slice(0, k),
    noGusta: [...top(profile.pilares, -1), ...top(profile.etiquetas, -1)].slice(0, k),
  };
}
