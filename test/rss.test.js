import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed, fetchAll } from "../collector/rss.js";

const meta = { source: "BBC", pillar: "global" };
const now = new Date().toUTCString();

test("parsea RSS 2.0", () => {
  const xml = `<?xml version="1.0"?><rss><channel><title>x</title>
    <item><title>Cumbre del clima termina sin acuerdo</title><link>https://a.com/1</link>
    <description><![CDATA[<p>Los países no logran <b>pactar</b>.</p>]]></description><pubDate>${now}</pubDate></item>
    <item><title>Otra</title><link>https://a.com/2</link><pubDate>${now}</pubDate></item>
  </channel></rss>`;
  const items = parseFeed(xml, meta);
  assert.equal(items.length, 2);
  assert.equal(items[0].title, "Cumbre del clima termina sin acuerdo");
  assert.equal(items[0].link, "https://a.com/1");
  assert.equal(items[0].summary, "Los países no logran pactar.");
  assert.equal(items[0].source, "BBC");
  assert.equal(items[0].pillar, "global");
  assert.ok(!Number.isNaN(Date.parse(items[0].published)));
});

test("parsea Atom", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Nueva IA</title>
    <link rel="alternate" href="https://b.com/x"/><summary>Texto</summary><updated>${new Date().toISOString()}</updated></entry></feed>`;
  const items = parseFeed(xml, meta);
  assert.equal(items.length, 1);
  assert.equal(items[0].link, "https://b.com/x");
  assert.equal(items[0].summary, "Texto");
});

test("XML basura devuelve []", () => {
  assert.deepEqual(parseFeed("<<<no es xml", meta), []);
  assert.deepEqual(parseFeed("", meta), []);
});

test("fetchAll ignora feeds caídos y noticias viejas", async () => {
  const old = new Date(Date.now() - 5 * 86400e3).toUTCString();
  const xml = `<rss><channel><item><title>Nueva</title><link>https://n</link><pubDate>${now}</pubDate></item>
    <item><title>Vieja</title><link>https://v</link><pubDate>${old}</pubDate></item></channel></rss>`;
  const fetchFn = async (url) => {
    if (url === "bad") throw new Error("down");
    return { ok: true, text: async () => xml };
  };
  const items = await fetchAll(
    [{ url: "bad", ...meta }, { url: "good", ...meta }],
    fetchFn
  );
  assert.deepEqual(items.map((i) => i.title), ["Nueva"]);
});
