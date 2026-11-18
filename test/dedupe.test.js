import { test } from "node:test";
import assert from "node:assert/strict";
import { dedupe } from "../collector/dedupe.js";

const base = { summary: "", pillar: "economia", published: new Date().toISOString() };

test("agrupa títulos casi iguales de fuentes distintas", () => {
  const out = dedupe([
    { ...base, title: "El BCE sube los tipos de interés al 4%", link: "1", source: "El País" },
    { ...base, title: "El BCE sube los tipos de interés hasta el 4%", link: "2", source: "Expansión" },
    { ...base, title: "Apple presenta un nuevo iPhone", link: "3", source: "Xataka" },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].sourceCount, 2);
  assert.deepEqual(out[0].sources.sort(), ["El País", "Expansión"]);
  assert.equal(out[1].sourceCount, 1);
});

test("misma fuente repetida no cuenta doble", () => {
  const out = dedupe([
    { ...base, title: "Terremoto en Japón", link: "1", source: "BBC" },
    { ...base, title: "Terremoto en Japón", link: "1b", source: "BBC" },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].sourceCount, 1);
});
