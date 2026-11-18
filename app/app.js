import { buildFeed, applyFeedback, aprendido, defaultProfile, PILARES } from "./rank.js";
import { loadProfile, saveProfile, exportProfile, importProfile } from "./store.js";

const NOMBRE = {
  global: "Problemas globales",
  ultima: "Actualidad",
  economia: "Economía",
  geopolitica: "Geopolítica",
  tecnologia: "Tecnología",
  emprendimiento: "Emprendimiento",
  deporte: "Deporte",
};
const NIVELES = [
  [0, "Ocultar"],
  [0.5, "Menos"],
  [1, "Normal"],
  [1.5, "Más"],
  [2, "Mucho más"],
];

let profile = loadProfile();
let data = null;
const byId = new Map();

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : "#");

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 2200);
}

function hace(fecha) {
  const min = Math.round((Date.now() - Date.parse(fecha)) / 60000);
  if (min < 60) return `hace ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

function pilarTag(n) {
  return `<span class="pilar" style="--c: var(--${n.pilar})">${esc(NOMBRE[n.pilar] ?? n.pilar)}</span>`;
}

function pie(n) {
  const v = profile.votos[n.id];
  const fuentes = n.fuentes?.length > 1 ? ` y ${n.fuentes.length - 1} más` : "";
  return `<div class="pie">
    <span class="fuente">${esc(n.fuente)}${fuentes}, ${hace(n.fecha)}</span>
    <button type="button" class="like" data-id="${n.id}" data-voto="like" aria-pressed="${v === "like"}" aria-label="Me interesa">👍</button>
    <button type="button" class="dislike" data-id="${n.id}" data-voto="dislike" aria-pressed="${v === "dislike"}" aria-label="No me interesa">👎</button>
    <a class="abrir" href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener" data-id="${n.id}" aria-label="Leer en ${esc(n.fuente)}">Leer</a>
  </div>`;
}

function cuerpo(n, { conPilar = true } = {}) {
  return `${conPilar ? pilarTag(n) : ""}${n.explora ? `<span class="prueba">Probando un tema nuevo</span>` : ""}
    <h3><a href="${esc(safeUrl(n.url))}" target="_blank" rel="noopener" data-id="${n.id}">${esc(n.titulo)}</a></h3>
    ${n.resumen ? `<p class="resumen">${esc(n.resumen)}</p>` : ""}
    ${n.porQue ? `<p class="porque"><b>Por qué importa:</b> ${esc(n.porQue)}</p>` : ""}
    ${pie(n)}`;
}

function renderHoy() {
  const main = $("#hoy");
  if (!data) return;
  const feed = buildFeed(data.noticias, data.top3 ?? [], profile);
  const total = feed.ultima.length + feed.top3.length + feed.paraTi.length;
  const minutos = Math.max(2, Math.round(total * 0.3));
  const fecha = new Date();
  const diaSemana = fecha.toLocaleDateString("es-ES", { weekday: "long" });
  const diaMes = fecha.toLocaleDateString("es-ES", { day: "numeric", month: "long" });

  let html = `<header class="dia">
    <h1>${esc(diaSemana[0].toUpperCase() + diaSemana.slice(1))}<span>${esc(diaMes)}</span></h1>
    <p>${total} noticias, unos ${minutos} minutos de lectura. Actualizado ${hace(data.actualizado ?? data.generado)}.</p>
  </header>`;

  if (data.modo === "crudo") {
    html += `<p class="aviso">Hoy ves los titulares sin resumir porque el resumen automático no está activo. Las noticias son igual de recientes.</p>`;
  }

  if (feed.ultima.length) {
    html += `<section class="seccion"><h2 class="en-vivo">Última hora</h2>
      <div class="ultima-lista">${feed.ultima.map((n) => `<article class="noticia">${cuerpo(n)}</article>`).join("")}</div></section>`;
  }

  if (feed.top3.length) {
    html += `<section class="seccion"><h2>Las 3 del día</h2>
      <p class="sub">Lo más importante del mundo hoy, aunque no sea tu tema.</p>
      <ol class="top3">${feed.top3
        .map((n, i) => `<li style="--c: var(--${n.pilar})"><span class="num" aria-hidden="true">${i + 1}</span><article class="noticia">${cuerpo(n)}</article></li>`)
        .join("")}</ol></section>`;
  }

  if (feed.paraTi.length) {
    html += `<section class="seccion"><h2>Para ti</h2>
      <p class="sub">Ordenado según tus temas. Con 👍 y 👎 lo afinas para mañana.</p>
      <ul class="lista">${feed.paraTi
        .map((n) => `<li class="noticia${n.explora ? " explora" : ""}" style="--c: var(--${n.pilar})">${cuerpo(n)}</li>`)
        .join("")}</ul></section>`;
  }

  html += `<p class="fin"><strong>Ya estás al día.</strong>Vuelve mañana para la siguiente edición.</p>`;
  main.innerHTML = html;
}

function renderAjustes() {
  $("#sliders").innerHTML = PILARES.map((p) => {
    const v = profile.manual[p] ?? 1;
    const idx = NIVELES.findIndex(([x]) => x === v);
    return `<div class="slider" style="--c: var(--${p})">
      <label for="s-${p}">${pilarTag({ pilar: p })}</label>
      <span class="valor" id="v-${p}">${NIVELES[idx < 0 ? 2 : idx][1]}</span>
      <input id="s-${p}" type="range" min="0" max="4" step="1" value="${idx < 0 ? 2 : idx}" data-pilar="${p}" aria-describedby="v-${p}" />
    </div>`;
  }).join("");

  const a = aprendido(profile);
  const label = (k) => NOMBRE[k] ?? k;
  $("#aprendido").innerHTML =
    !a.gusta.length && !a.noGusta.length
      ? `<p class="sub">Todavía nada. Da 👍 o 👎 a unas cuantas noticias y aquí verás lo que la app va entendiendo.</p>`
      : `${a.gusta.length ? `<p class="sub">Te interesa</p><div class="chips">${a.gusta.map((k) => `<span>${esc(label(k))}</span>`).join("")}</div>` : ""}
         ${a.noGusta.length ? `<p class="sub">Te interesa menos</p><div class="chips no">${a.noGusta.map((k) => `<span>${esc(label(k))}</span>`).join("")}</div>` : ""}`;

  if (data) {
    const g = new Date(data.generado).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
    $("#info-edicion").textContent = `Edición del ${g}. ${data.noticias.length} noticias disponibles${data.modo === "ia" ? ", resumidas con IA" : ""}.`;
  }
}

function show(view) {
  for (const v of document.querySelectorAll(".view")) v.hidden = v.id !== view;
  for (const b of document.querySelectorAll(".tabbar button")) {
    if (b.dataset.view === view) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  }
  if (view === "ajustes") renderAjustes();
  else renderHoy();
  window.scrollTo(0, 0);
}

function feedback(id, tipo) {
  const n = byId.get(id);
  if (!n) return;
  profile = applyFeedback(profile, n, tipo);
  saveProfile(profile);
}

// Eventos
document.addEventListener("click", (e) => {
  const voto = e.target.closest("button[data-voto]");
  if (voto) {
    const { id, voto: tipo } = voto.dataset;
    feedback(id, tipo);
    const v = profile.votos[id];
    for (const b of document.querySelectorAll(`button[data-id="${id}"]`)) b.setAttribute("aria-pressed", String(b.dataset.voto === v));
    if (v === "like") toast("Anotado: más noticias como esta");
    else if (v === "dislike") toast("Anotado: menos noticias como esta");
    return;
  }
  const link = e.target.closest("a[data-id]");
  if (link) feedback(link.dataset.id, "open");
  const tab = e.target.closest(".tabbar button");
  if (tab) show(tab.dataset.view);
});

document.addEventListener("input", (e) => {
  const s = e.target.closest("input[data-pilar]");
  if (!s) return;
  const [val, nombre] = NIVELES[Number(s.value)];
  profile.manual[s.dataset.pilar] = val;
  saveProfile(profile);
  $(`#v-${s.dataset.pilar}`).textContent = nombre;
});

$("#exportar").addEventListener("click", () => exportProfile(profile));
$("#importar").addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    profile = await importProfile(f);
    renderAjustes();
    toast("Gustos importados");
  } catch {
    toast("Ese archivo no es una copia de tus gustos");
  }
  e.target.value = "";
});
$("#reiniciar").addEventListener("click", () => {
  if (!confirm("Se borrará todo lo que la app ha aprendido de ti. ¿Empezar de cero?")) return;
  profile = defaultProfile();
  saveProfile(profile);
  renderAjustes();
  toast("Gustos borrados");
});

async function cargar() {
  try {
    const res = await fetch(`data/noticias.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(res.status);
    data = await res.json();
  } catch {
    // Sin red: el service worker sirve la última copia; si tampoco hay, avisamos.
    try {
      const res = await fetch("data/noticias.json");
      data = await res.json();
    } catch {
      $("#hoy").innerHTML = `<p class="vacio">No hay conexión y aún no tienes noticias guardadas. Abre la app con internet una vez y después funcionará sin conexión.</p>`;
      return;
    }
  }
  byId.clear();
  for (const n of data.noticias) byId.set(n.id, n);
  renderHoy();
}

cargar();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
