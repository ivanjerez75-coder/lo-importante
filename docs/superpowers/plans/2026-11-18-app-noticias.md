# App de noticias personalizada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** PWA móvil con briefing diario de noticias por pilares, resumido con Claude y personalizado con likes en el dispositivo.

**Architecture:** Un script Node (`collector/`) que corre en GitHub Actions lee RSS, deduplica, pide a Claude Haiku un pool resumido y escribe `app/data/noticias.json`. La PWA estática (`app/`) lo descarga y lo ordena en el móvil con un motor de ranking puro (`app/rank.js`) que aprende de 👍/👎 guardados en localStorage.

**Tech Stack:** Node 24 (ESM, `node:test`), `fast-xml-parser`, `@anthropic-ai/sdk` + `zod` (structured outputs), JS vanilla + Service Worker, GitHub Actions + Pages.

**Spec:** `docs/2026-11-18-app-noticias-diseno.md`

## Global Constraints
- Modelo: `claude-haiku-5-5`. Clave solo en `ANTHROPIC_API_KEY` (secreto de GitHub), nunca en `app/`.
- Todo el texto de usuario en español.
- Pilares (id → orden): `global` 1, `ultima` 2, `economia` 3, `geopolitica` 4, `tecnologia` 5, `emprendimiento` 6, `deporte` 7.
- ~15 noticias por día, ~20 % exploración ("🧪 Probando"); importancia ≥ 9 siempre se muestra.
- Sin IA (sin clave o error) → modo crudo: titulares RSS con `importancia` derivada del nº de fuentes.
- Edición 07:00 Europe/Madrid (cron `0 5,6 * * *` + filtro de hora local), última hora cada 3 h.

## Review Focus
1. Un feed caído o XML inválido → se ignora ese feed, el resto sigue (test en Task 1).
2. Claude devuelve error/rechazo → fallback a modo crudo, nunca JSON vacío (test en Task 2).
3. Usuario nuevo sin likes → ranking por importancia + prioridad de pilar (test en Task 3).
4. Usuario que da 👎 a todo un pilar → noticias ≥ 9 de ese pilar siguen saliendo (test en Task 3).
5. Sin conexión → la app muestra el último `noticias.json` cacheado (verificación manual en Task 4).

---

### Task 1: Recolector RSS + deduplicado
**Files:** `collector/feeds.js`, `collector/rss.js`, `collector/dedupe.js`, `test/rss.test.js`, `test/dedupe.test.js`
**Produces:**
- `FEEDS: {url, source, pillar, lang}[]`
- `parseFeed(xml: string, meta) -> RawItem[]` con `{title, link, summary, published: ISO, source, pillar}`; devuelve `[]` si el XML es inválido. Soporta RSS 2.0 y Atom.
- `fetchAll(feeds, fetchFn) -> RawItem[]` (descarta los que fallan, timeout 15 s, items < 48 h).
- `dedupe(items) -> Cluster[]` `{...item, sources: string[], sourceCount}`; agrupa por similitud de título (Jaccard de palabras ≥ 0.5 tras normalizar), ordenado por `sourceCount` desc y fecha.
- [ ] Tests: RSS y Atom parsean; XML basura → `[]`; dos títulos casi iguales de fuentes distintas → 1 cluster con `sourceCount` 2.
- [ ] Implementar y pasar tests.

### Task 2: Paso IA + fallback + salida
**Files:** `collector/ai.js`, `collector/fallback.js`, `collector/run.js`, `test/fallback.test.js`, `test/run.test.js`
**Consumes:** Task 1. **Produces:** `noticias.json`:
`{generado: ISO, modo: "ia"|"crudo", top3: id[], noticias: Noticia[]}` con
`Noticia = {id, titulo, resumen, porQue, pilar, etiquetas: string[], importancia: 1..10, fuente, fuentes: string[], url, fecha, ultimaHora: bool}`.
- `summarize(clusters, client) -> {top3, noticias}` con `client.messages.parse` + `zodOutputFormat`, máx. 120 clusters de entrada, pide 40–60 salidas, pilar ∈ ids fijos.
- `rawPool(clusters) -> {top3, noticias}`: importancia = `min(10, 4 + sourceCount)`, resumen = summary recortado a 240 chars.
- `buildEdition({mode, fetchFn, client, prev}) -> json`: `mode="breaking"` conserva el pool previo y añade/actualiza `ultimaHora` con clusters de < 3 h.
- [ ] Tests: `rawPool` respeta el formato; `buildEdition` con client que lanza error → `modo: "crudo"` y noticias no vacías.
- [ ] Implementar y pasar tests; probar `node collector/run.js` real sin clave.

### Task 3: Motor de personalización
**Files:** `app/rank.js` (ESM puro, sin DOM), `test/rank.test.js`
**Produces:**
- `defaultProfile() -> {pilares:{[id]:0}, etiquetas:{}, fuentes:{}, manual:{[id]:1}, visto:{}, actualizado}`
- `applyFeedback(profile, noticia, tipo: "like"|"dislike"|"open", now) -> profile` (like +1, dislike −1, open +0.3 sobre pilar, cada etiqueta y fuente; antes, decay ×0.5 cada 30 días).
- `score(noticia, profile) -> number` = `importancia + 2*tanh(pilar) + Σ tanh(etiquetas)/n + 0.5*tanh(fuente) + (8 - ordenPilar)*0.3`, × `manual[pilar]`.
- `buildFeed(noticias, profile, {n=15, explorar=0.2, rng}) -> {ultima, top3, paraTi: (Noticia & {explora?: true})[]}`: obligatorias importancia ≥ 9; exploración = noticias con etiquetas poco vistas.
- [ ] Tests: like a `tecnologia` sube una noticia de tecnología por encima de una igual de deporte; dislikes masivos a `deporte` no quitan una de importancia 9; con n=15 hay 2–3 `explora`; sin likes el orden sigue importancia.
- [ ] Implementar y pasar tests.

### Task 4: PWA
**Files:** `app/index.html`, `app/styles.css`, `app/app.js`, `app/store.js`, `app/sw.js`, `app/manifest.webmanifest`, `app/icon.svg`, `app/icon-192.png`, `app/icon-512.png`
- Pantalla Hoy (fecha, ⚡ última hora, ★ las 3 del día, Para ti con 🧪), tarjeta con título/resumen/"Por qué importa"/fuente/👍👎/abrir.
- Ajustes: slider por pilar (0–2), "lo que he aprendido", reiniciar, exportar/importar perfil.
- SW: network-first para `data/noticias.json`, cache-first para el resto.
- [ ] Verificar en navegador en tamaño móvil con un `noticias.json` real.

### Task 5: GitHub Actions + Pages + README
**Files:** `.github/workflows/noticias.yml`, `README.md` (pasos en español para el usuario)
- Cron edición + breaking cada 3 h, `workflow_dispatch`; `npm ci && node collector/run.js`; commit de `app/data/noticias.json`; deploy de `app/` a Pages.
- [ ] Validar YAML; README con pasos: crear repo, añadir secreto, activar Pages, instalar en el móvil.
