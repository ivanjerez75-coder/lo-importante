import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  cdataPropName: false,
  processEntities: true,
  htmlEntities: true,
});

const MAX_AGE_MS = 48 * 3600e3;
const PER_FEED = 25;

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

function text(node) {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return text(node[0]);
  if (typeof node === "object") return text(node["#text"] ?? "");
  return "";
}

export function cleanText(s) {
  return String(s)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function atomLink(link) {
  const links = arr(link);
  const alt = links.find((l) => typeof l === "object" && (!l["@rel"] || l["@rel"] === "alternate"));
  const chosen = alt ?? links[0];
  if (typeof chosen === "string") return chosen;
  return chosen?.["@href"] ?? "";
}

function toIso(s) {
  const t = Date.parse(s);
  return Number.isNaN(t) ? new Date().toISOString() : new Date(t).toISOString();
}

/** Parse an RSS 2.0 or Atom document. Returns [] on any error. */
export function parseFeed(xml, meta) {
  if (!xml || typeof xml !== "string") return [];
  let doc;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  if (!doc || typeof doc !== "object") return [];

  const out = [];
  const rssItems = arr(doc.rss?.channel?.item ?? doc["rdf:RDF"]?.item);
  for (const it of rssItems) {
    out.push({
      title: cleanText(text(it.title)),
      link: text(it.link).trim() || text(it.guid).trim(),
      summary: cleanText(text(it.description ?? it["content:encoded"])),
      published: toIso(text(it.pubDate ?? it["dc:date"])),
      source: meta.source,
      pillar: meta.pillar,
    });
  }
  for (const it of arr(doc.feed?.entry)) {
    out.push({
      title: cleanText(text(it.title)),
      link: atomLink(it.link),
      summary: cleanText(text(it.summary ?? it.content)),
      published: toIso(text(it.updated ?? it.published)),
      source: meta.source,
      pillar: meta.pillar,
    });
  }
  return out.filter((i) => i.title && i.link);
}

/** Fetch every feed in parallel; a failing feed is skipped. Keeps items < 48h old. */
export async function fetchAll(feeds, fetchFn = fetch, { now = Date.now(), log = () => {} } = {}) {
  const results = await Promise.all(
    feeds.map(async (f) => {
      try {
        const res = await fetchFn(f.url, {
          signal: AbortSignal.timeout(15000),
          headers: { "user-agent": "Mozilla/5.0 (compatible; MisNoticiasBot/1.0)" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = parseFeed(await res.text(), f);
        if (!items.length) log(`(vacío) ${f.source} ${f.url}`);
        // max 25 recent items per feed so one big feed doesn't drown the rest
        return items
          .filter((i) => now - Date.parse(i.published) < MAX_AGE_MS)
          .sort((a, b) => b.published.localeCompare(a.published))
          .slice(0, PER_FEED);
      } catch (e) {
        log(`(falla) ${f.source}: ${e.message}`);
        return [];
      }
    })
  );
  return results.flat();
}
