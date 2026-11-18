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
    })
  ),
});

const SISTEMA = `Eres el editor jefe de un briefing diario de noticias en español para una persona que quiere saber lo que de verdad importa en el mundo, sin ruido.

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
- ultimaHora: true solo si es un hecho en desarrollo de las últimas horas y de gran impacto.`;

function formatInput(clusters) {
  return clusters
    .map((c, i) => {
      const fuentes = `${c.sourceCount} fuente${c.sourceCount > 1 ? "s" : ""}: ${c.sources.slice(0, 4).join(", ")}`;
      return `[${i}] (${c.pillar} · ${fuentes} · ${c.published.slice(0, 16)}) ${c.title}${c.summary ? " — " + recortar(c.summary, 220) : ""}`;
    })
    .join("\n");
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
    };
    byRef.set(n.ref, noticia.id);
    noticias.push(noticia);
  }
  const top3 = (parsed.top3 ?? []).map((r) => byRef.get(r)).filter(Boolean).slice(0, 3);
  return { top3, noticias };
}

/**
 * Pide a Claude que elija y resuma. mode "edicion": pool de 40-60; "breaking": sólo lo urgente.
 * Lanza si la API falla o rechaza, para que el llamador use el modo crudo.
 */
export async function summarize(clusters, client, { mode = "edicion" } = {}) {
  const input = clusters.slice(0, 120);
  const pedido =
    mode === "breaking"
      ? "Estas son las noticias de las últimas 3 horas. Elige SOLO las de última hora realmente relevantes (máximo 5, puede ser 0). Márcalas con ultimaHora: true. top3 vacío."
      : "Estas son las noticias de las últimas 48 horas. Elige entre 40 y 60 para el pool del día (las más importantes primero) y marca las 3 más importantes en top3.";
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SISTEMA,
    messages: [{ role: "user", content: `${pedido}\n\n${formatInput(input)}` }],
    output_config: { format: zodOutputFormat(Salida) },
  });
  if (res.stop_reason === "refusal") throw new Error("Claude rechazó la petición");
  if (!res.parsed_output) throw new Error(`Salida no válida (stop_reason: ${res.stop_reason})`);
  return toNoticias(res.parsed_output, input);
}
