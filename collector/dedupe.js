const STOP = new Set(
  "el la los las un una unos unas de del al a en y o que por para con sin se su sus es son lo como mas más the a an of to in on and for with at by from is are as its it be after over".split(" ")
);

export function words(title) {
  return new Set(
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Group near-duplicate headlines. Returns clusters sorted by #sources then recency. */
export function dedupe(items, threshold = 0.5) {
  const clusters = [];
  for (const item of items) {
    const w = words(item.title);
    const hit = clusters.find((c) => jaccard(c._w, w) >= threshold);
    if (hit) {
      if (!hit.sources.includes(item.source)) hit.sources.push(item.source);
      if (!hit.summary && item.summary) hit.summary = item.summary;
      if (item.published > hit.published) hit.published = item.published;
    } else {
      clusters.push({ ...item, sources: [item.source], _w: w });
    }
  }
  return clusters
    .map(({ _w, ...c }) => ({ ...c, sourceCount: c.sources.length }))
    .sort((a, b) => b.sourceCount - a.sourceCount || b.published.localeCompare(a.published));
}
