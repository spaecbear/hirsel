/**
 * Writes the PWA PNG icons from the same 16×16 pixel design as icon.svg.
 * Hand-rolled PNG encoder so the project needs no image dependency.
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const P = {
  ".": [0x14, 0x17, 0x0f],
  g: [0x3c, 0x4a, 0x2e],
  G: [0x7d, 0x9a, 0x55],
  m: [0xe8, 0xec, 0xd6],
  w: [0xdd, 0xd9, 0xc8],
  W: [0xef, 0xea, 0xda],
  k: [0x2b, 0x2b, 0x26],
  o: [0xe0, 0xa3, 0x3c],
};

// 16×16, one char per pixel
const ART = [
  "................",
  "..........mmm...",
  ".........mmmmm..",
  ".........mmmmm..",
  "..........mmm...",
  "................",
  ".........kkk....",
  "....WWWWWkkk....",
  "...wwwwwwkok....",
  "...wwwwwww......",
  "GGGGGGGGGGGGGGGG",
  "gggggggggggggggg",
  "gggkggggkggggggg",
  "gggkggggkgggggg.",
  "gggggggggggggggg",
  "gggggggggggggggg",
];

function render(size) {
  const scale = size / 16;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const ch = ART[Math.floor(y / scale)][Math.floor(x / scale)];
      const [r, g, b] = P[ch] ?? P["."];
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
    }
  }
  return raw;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

let TABLE = null;
function crc32(buf) {
  if (!TABLE) {
    TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      TABLE[n] = c;
    }
  }
  let c = -1;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

function png(size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(render(size), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  const out = join(here, "..", "public", `icon-${size}.png`);
  writeFileSync(out, png(size));
  console.log(`wrote ${out}`);
}
