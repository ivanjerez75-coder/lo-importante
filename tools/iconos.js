// Genera app/icon.svg, icon-192.png e icon-512.png (globo con las 7 capas de los pilares).
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = "#14263D";
const BANDS = ["#1F6F64", "#C2362B", "#A47A1F", "#3A4BA0", "#6B4FB0", "#A2386F", "#3C7F3A"];
const R = 0.34; // radio relativo (dentro de la zona segura "maskable")

const svgBands = BANDS.map((c, i) => {
  const y0 = 0.5 - R + (i * 2 * R) / BANDS.length;
  return `<rect x="0" y="${(y0 * 512).toFixed(2)}" width="512" height="${((2 * R * 512) / BANDS.length + 0.5).toFixed(2)}" fill="${c}"/>`;
}).join("");
writeFileSync("app/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="${BG}"/><clipPath id="g"><circle cx="256" cy="256" r="${R * 512}"/></clipPath><g clip-path="url(#g)">${svgBands}</g></svg>`);

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };

function png(S) {
  const raw = Buffer.alloc(S * (S * 3 + 1));
  const bg = hex(BG), cols = BANDS.map(hex), SS = 4;
  for (let y = 0; y < S; y++) {
    raw[y * (S * 3 + 1)] = 0;
    for (let x = 0; x < S; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const u = (x + (sx + 0.5) / SS) / S - 0.5, v = (y + (sy + 0.5) / SS) / S - 0.5;
        let c = bg;
        if (u * u + v * v <= R * R) c = cols[Math.min(BANDS.length - 1, Math.floor(((v + R) / (2 * R)) * BANDS.length))];
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      }
      const o = y * (S * 3 + 1) + 1 + x * 3;
      for (let k = 0; k < 3; k++) raw[o + k] = Math.round(acc[k] / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
for (const S of [192, 512]) writeFileSync(`app/icon-${S}.png`, png(S));
console.log("iconos generados");
