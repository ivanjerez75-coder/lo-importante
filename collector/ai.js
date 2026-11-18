import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { PILARES, idFor, clampImp, normTags, recortar } from "./common.js";

export const MODEL = "claude-haiku-5-5";

const Salida = z.object({
  top3: z.array(z.number().int()).describe("refs de las 3 noticias más importantes del día"),
  noticias: z.array(
    z.object({
      ref: z.number().int().describe("número [n] de la noticia de entrada"),
      titulo: z.string(),
      resumen: z.string(),
      porQue: z.string(),
      pilar: z.enum(PILARES),
      etiquetas: z.array(z.string()),
      importancia: z.number().int(),
      ultimaHora: z.boolean(),
      reaccion: z.string().describe("vacío salvo que continúe una noticia importante de ayer"),
    })
  ),
});

const SISTEMA = `Eres el editor jefe de un briefing diario de noticias en español para una persona que quiere saber lo que de verdad importa en el mundo, sin ruido.

Vive en Barcelona (España). Las noticias importantes de España y Cataluña le interesan aunque no sean globales: huelgas o caos en los trenes, elecciones, vivienda, economía española, decisiones del Gobierno o la Generalitat. No le interesan sucesos locales menores.

Sus pilares, por prioridad:
1. global: grandes problemas del mundo (cambio climático, crisis humanitarias, pandemias, hambre, migraciones, riesgos que vienen). Es lo más importante para él.
2. ultima: lo que está pasando ahora mismo y tiene impacto.
3. economia
4. geopolitica
5. tecnologia (sobre todo IA y cambios grandes)
6. emprendimiento (startups, financiación, negocio; es su mundo)
7. deporte (ligero)

Cómo elegir:
- Prioriza impacto real en mucha gente y a largo plazo. Descarta cotilleos, clickbait, sucesos locales sin trascendencia, opinión sin hechos y noticias repetidas.
- Que una noticia aparezca en varias fuentes es señal de importancia.
- Incluye variedad: algo de cada pilar si hay material decente, también noticias interesantes de temas que no son el centro (ciencia, salud, cultura) para que pueda descubrir cosas nuevas.

Para cada noticia elegida:
- titulo: en español, claro y neutral, máximo 90 caracteres. Traduce si viene en inglés.
- resumen: 2-3 frases en español con los hechos clave (qué, quién, dónde, cifras).
- porQue: 1 frase que explique por qué importa o qué consecuencias tiene. Directa, sin "Esta noticia es importante porque".
- pilar: uno de los ids indicados. Reasigna si la fuente lo clasificó mal.
- etiquetas: 2-4 etiquetas cortas en minúsculas y en español que describan el tema concreto (ej. "clima", "ia", "china", "startups", "fútbol", "petróleo", "ucrania", "bce").
- importancia: 1-10 a escala mundial. 9-10 solo para hechos históricos o de impacto global inmediato (guerras que estallan, catástrofes masivas, crisis financieras). La mayoría estará entre 4 y 8.
- ultimaHora: true solo si es un hecho en desarrollo de las últimas horas y de gran impacto.
- reaccion: casi siempre cadena vacía. Rellénalo SOLO si la noticia continúa una de las noticias importantes de la edición anterior (te las paso aparte) y hay novedades reales: 1-2 frases sobre qué está pasando ahora (cómo reacciona el mercado, si las acciones siguen cayendo o rebotan, qué dicen gobiernos, analistas o afectados). No repitas el resumen.

Si una noticia importante de ayer tiene novedades hoy en las noticias de entrada, inclúyela en el pool con su reaccion, aunque hoy haya menos fuentes hablando de ella.`;

function formatInput(clusters) {
  return clusters
    .map((c, i) => {
      const fuentes = `${c.sourceCount} fuente${c.sourceCount > 1 ? "s" : ""}: ${c.sources.slice(0, 4).join(", ")}`;
      return `[${i}] (${c.pillar} · ${fuentes} · ${c.published.slice(0, 16)}) ${c.title}${c.summary ? " — " + recortar(c.summary, 220) : ""}`;
    })
    .join("\n");
}

/** Lista breve de las noticias importantes de la edición anterior, para detectar continuaciones. */
export function formatAyer(prev, minImp = 7) {
  const lista = (prev?.noticias ?? []).filter((n) => n.importancia >= minImp).slice(0, 25);
  if (!lista.length) return "";
  return lista.map((n) => `- ${n.titulo}${n.resumen ? " — " + recortar(n.resumen, 160) : ""}`).join("\n");
}

/** Convierte la salida del modelo en noticias completas, enlazando con los clusters de entrada. */
export function toNoticias(parsed, clusters) {
  const seen = new Set();
  const byRef = new Map();
  const noticias = [];
  for (const n of parsed.noticias ?? []) {
    const c = clusters[n.ref];
    if (!c || seen.has(n.ref)) continue;
    seen.add(n.ref);
    const noticia = {
      id: idFor(c.link),
      titulo: n.titulo.trim() || c.title,
      resumen: n.resumen.trim(),
      porQue: n.porQue.trim(),
      pilar: PILARES.includes(n.pilar) ? n.pilar : c.pillar,
      etiquetas: normTags(n.etiquetas),
      importancia: clampImp(n.importancia),
      fuente: c.source,
      fuentes: c.sources,
      url: c.link,
      fecha: c.published,
      ultimaHora: Boolean(n.ultimaHora),
      reaccion: (n.reaccion ?? "").trim(),
    };
    byRef.set(n.ref, noticia.id);
    noticias.push(noticia);
  }
  const top3 = (parsed.top3 ?? []).map((r) => byRef.get(r)).filter(Boolean).slice(0, 3);
  return { top3, noticias };
}

// ── Proveedores de IA ────────────────────────────────────────────────
// Un proveedor es: async ({ system, user }) => objeto con la forma de `Salida`.

/** Claude (de pago, céntimos al día). */
export function claudeProvider(client) {
  return async ({ system, user }) => {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(Salida) },
    });
    if (res.stop_reason === "refusal") throw new Error("Claude rechazó la petición");
    if (!res.parsed_output) throw new Error(`Salida no válida (stop_reason: ${res.stop_reason})`);
    return res.parsed_output;
  };
}

export const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"];

const FORMATO_JSON = `

Responde SOLO con un objeto JSON con esta forma exacta:
{"top3": [ref, ref, ref], "noticias": [{"ref": 0, "titulo": "", "resumen": "", "porQue": "", "pilar": "global|ultima|economia|geopolitica|tecnologia|emprendimiento|deporte", "etiquetas": [""], "importancia": 1, "ultimaHora": false, "reaccion": ""}]}`;

/** Google Gemini (capa gratuita). Prueba varios modelos por si uno no está disponible o agotó su cupo. */
const RETRY_STATUS = new Set([429, 500, 503]);
const RETRY_WAITS_MS = [20000, 60000]; // reintentos si Google está saturado

export function geminiProvider(
  apiKey,
  { fetchFn = fetch, models = GEMINI_MODELS, log = () => {}, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), waits = RETRY_WAITS_MS } = {}
) {
  // fetch con reintentos ante saturación temporal
  const call = async (url, init) => {
    for (let i = 0; ; i++) {
      const res = await fetchFn(url, init);
      if (res.ok || !RETRY_STATUS.has(res.status) || i >= waits.length) return res;
      log(`(gemini) HTTP ${res.status}, reintento en ${waits[i] / 1000}s`);
      await sleep(waits[i]);
    }
  };
  return async ({ system, user }) => {
    let lastErr;
    for (const model of models) {
      try {
        const res = await call(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system + FORMATO_JSON }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { responseMimeType: "application/json", maxOutputTokens: 32000 },
          }),
          signal: AbortSignal.timeout(300000),
        });
        if (!res.ok) throw new Error(`${model}: HTTP ${res.status} ${(await res.text()).replace(/\s+/g, " ").slice(0, 200)}`);
        const body = await res.json();
        const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
        const parsed = Salida.safeParse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")));
        if (!parsed.success) throw new Error(`${model}: JSON con formato inesperado`);
        log(`IA: ${model}`);
        return parsed.data;
      } catch (e) {
        lastErr = e;
        log(`(gemini) ${e.message}`);
      }
    }
    throw lastErr ?? new Error("Gemini no disponible");
  };
}

/** Elige proveedor según las claves disponibles. null = sin IA. */
export async function providerFromEnv(env = process.env, log = console.log) {
  if (env.GEMINI_API_KEY) return geminiProvider(env.GEMINI_API_KEY, { log });
  if (env.ANTHROPIC_API_KEY) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    return claudeProvider(new Anthropic());
  }
  return null;
}

/**
 * Pide a la IA que elija y resuma. mode "edicion": pool de 40-60; "breaking": sólo lo urgente.
 * Lanza si la IA falla, para que el llamador use el modo crudo.
 */
export async function summarize(clusters, provider, { mode = "edicion", prev = null } = {}) {
  const ayer = mode === "edicion" ? formatAyer(prev) : "";
  const contexto = ayer ? `\n\nNoticias importantes de la edición anterior (para el campo reaccion):\n${ayer}` : "";
  const input = clusters.slice(0, 100);
  const pedido =
    mode === "breaking"
      ? "Estas son las noticias de las últimas 3 horas. Elige SOLO las de última hora realmente relevantes (máximo 5, puede ser 0). Márcalas con ultimaHora: true. top3 vacío."
      : "Estas son las noticias de las últimas 48 horas. Elige entre 30 y 40 para el pool del día (las más importantes primero) y marca las 3 más importantes en top3.";
  const parsed = await provider({ system: SISTEMA, user: `${pedido}\n\n${formatInput(input)}${contexto}` });
  return toNoticias(parsed, input);
}
