/*
 * The Steam achievement icons, drawn with the game's own sprites.
 *
 * Each one is a 32×32 picture painted at the game's pixel size and doubled to
 * Steam's 64×64, so it is the same pixel grid as the hill. Steam wants two of
 * each: the earned one in colour, and a locked one, which is the same
 * picture greyed and dimmed. The secret ones are locked behind a picture
 * that gives nothing away, the way the game hides them.
 *
 * Open icons.html on the dev server to look at them; capture.cjs saves them.
 */
import { Painter } from "../../src/render/painter";
import {
  C,
  KIT,
  drawDog,
  drawDogCurled,
  drawFox,
  drawSheep,
  drawShepherd,
  drawWolfBeast,
  drawWoolSacks,
  setSpriteState,
  shade,
} from "../../src/render/sprites";
import { drawHaystack } from "../../src/render/season";
import { drawMoonDisc } from "../../src/render/moon";
import { drawHearthFire, drawHerAtHome } from "../../src/render/art/glen";
import { ACHIEVEMENTS } from "../../src/sim/achievements";
import type { Sheep } from "../../src/sim/types";

const S = 32; // the picture, in game pixels
const OUT = 64; // what Steam takes
const T = 1000; // a fixed moment, so every run draws the same frame

/* ------------------------------------------------------------------ *
 * pieces
 * ------------------------------------------------------------------ */

type RGB = [number, number, number];
const hex = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** a sky in bands, the way the game's skies are drawn */
function sky(g: Painter, top: RGB, low: RGB, to = S) {
  const bands = 6;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const c: RGB = [0, 1, 2].map((k) => Math.round(top[k] + (low[k] - top[k]) * t)) as RGB;
    const y0 = Math.round((i * to) / bands);
    const y1 = Math.round(((i + 1) * to) / bands);
    g.px(0, y0, S, y1 - y0, hex(c));
  }
}
/** the near hill, with a lit edge and a few tufts */
function hill(g: Painter, y: number, col = "#55703f") {
  for (let x = 0; x < S; x += 2) {
    const yy = y + Math.round(Math.sin(x / 7) * 1.2);
    g.px(x, yy, 2, S - yy, col);
    g.px(x, yy, 2, 1, shade(col, 14));
    if ((x * 7) % 5 === 1) g.px(x, yy + 3 + (x % 3), 1, 2, shade(col, -12));
  }
}
/** a room with the fire's warmth on it */
function room(g: Painter, glow = 1) {
  g.px(0, 0, S, S, "#2a211a");
  g.px(0, 22, S, 10, "#3a2c1f");
  for (let y = 24; y < S; y += 3) g.px(0, y, S, 1, "#33271c");
  g.a(0, 0, S, S, 240, 170, 80, 0.06 * glow);
}
function night(g: Painter) {
  sky(g, [10, 14, 30], [28, 34, 58], 26);
  const stars = [[3, 3], [9, 7], [14, 2], [21, 5], [27, 3], [6, 12], [25, 10], [18, 9], [29, 14]];
  for (const [x, y] of stars) g.px(x, y, 1, 1, "#dfe3f0");
}
function disc(g: Painter, cx: number, cy: number, r: number, col: string) {
  for (let y = -r; y <= r; y++) {
    const h = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    g.px(cx - h, cy + y, h * 2, 1, col);
  }
}
function ring(g: Painter, cx: number, cy: number, r: number, w: number, col: string) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r && d > r - w) g.px(cx + x, cy + y, 1, 1, col);
    }
  }
}

/** a 3×5 figure font, for the counts */
const DIGITS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "011", "001", "111"],
  "5": ["111", "100", "111", "001", "111"],
};
function figures(g: Painter, text: string, x: number, y: number, col: string) {
  // a dark edge round them, so they read on any ground
  const draw = (ox: number, oy: number, c: string) => {
    let cx = x + ox;
    for (const ch of text) {
      const rows = DIGITS[ch];
      rows.forEach((row, r) => [...row].forEach((b, k) => b === "1" && g.px(cx + k, y + oy + r, 1, 1, c)));
      cx += 4;
    }
  };
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) draw(ox, oy, "#14170f");
  draw(0, 0, col);
}
const textW = (t: string) => t.length * 4 - 1;

function pound(g: Painter, x: number, y: number, col: string) {
  const rows = ["0110", "1001", "1000", "1110", "1000", "1000", "1111"];
  rows.forEach((row, r) => [...row].forEach((b, k) => b === "1" && g.px(x + k, y + r, 1, 1, col)));
}
function heart(g: Painter, x: number, y: number, col: string) {
  const rows = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
  rows.forEach((row, r) => [...row].forEach((b, k) => b === "1" && g.px(x + k * 2, y + r * 2, 2, 2, col)));
  g.px(x + 2, y + 2, 2, 2, shade(col, 30));
}

const ewe = (id: number, o: Partial<Sheep> = {}): Sheep =>
  ({ id, fleece: 6, breed: "blackface", age: 60, ...o }) as Sheep;

function croft(g: Painter, x: number, y: number, roof: "slate" | "thatch", lit = false) {
  g.px(x, y + 6, 22, 11, "#6a6a5c");
  for (let i = 0; i < 22; i += 4) g.px(x + i, y + 8 + ((i / 4) % 2 ? 2 : 0), 3, 2, "#5c5c50");
  const rc = roof === "slate" ? C.slate : C.thatch;
  for (let i = 0; i < 5; i++) g.px(x - 2 + i * 2, y + 6 - i, 26 - i * 4, 2, i % 2 ? rc : shade(rc, roof === "slate" ? 12 : -14));
  g.px(x + 16, y - 1, 4, 6, "#5c5c50");
  g.px(x + 3, y + 10, 4, 7, "#3a3122");
  g.px(x + 12, y + 9, 5, 4, lit ? "#f0c86a" : "#2a3038");
}

/* ------------------------------------------------------------------ *
 * the pictures, one per achievement
 * ------------------------------------------------------------------ */

const DAY: [RGB, RGB] = [[63, 106, 126], [150, 186, 186]];
const DUSK: [RGB, RGB] = [[52, 52, 84], [196, 132, 96]];

const ICONS: Record<string, (g: Painter) => void> = {
  "first-pound": (g) => {
    sky(g, ...DUSK);
    hill(g, 26, "#3f5230");
    disc(g, 16, 15, 10, "#7d8288");
    disc(g, 16, 15, 9, "#c3c8cc");
    disc(g, 15, 14, 7, "#d6dadd");
    ring(g, 16, 15, 9, 1, "#9aa0a6");
    pound(g, 14, 11, "#5d636a");
  },
  crook: (g) => {
    sky(g, ...DAY);
    hill(g, 24);
    // the crook: a hazel shank and a ram's-horn head
    g.px(15, 11, 2, 21, "#6a5238");
    g.px(15, 11, 1, 21, "#7d6446");
    for (const [x, y, w, h] of [[15, 7, 2, 4], [16, 5, 3, 2], [18, 4, 4, 2], [21, 5, 2, 2], [22, 7, 2, 4], [21, 11, 2, 2], [19, 12, 2, 1]])
      g.px(x, y, w, h, "#c9b48a");
    g.px(18, 4, 4, 1, "#dfcca0");
  },
  collie: (g) => {
    sky(g, ...DAY);
    hill(g, 22);
    drawDog(g, 5, 15, 0, 0, 1, 40);
  },
  "ten-strong": (g) => {
    sky(g, ...DAY);
    hill(g, 20);
    drawSheep(g, 2, 15, ewe(1), { graze: true });
    drawSheep(g, 13, 17, ewe(2, { breed: "cheviot" }), { flip: true });
    figures(g, "10", 16 - Math.floor(textW("10") / 2), 3, "#f2eee0");
  },
  "twenty-strong": (g) => {
    sky(g, ...DAY);
    hill(g, 14);
    drawSheep(g, 1, 9, ewe(1), { graze: true });
    drawSheep(g, 15, 8, ewe(2, { breed: "cheviot" }), { graze: true, flip: true });
    drawSheep(g, 8, 13, ewe(3, { breed: "hebridean" }));
    drawSheep(g, -2, 17, ewe(4));
    drawSheep(g, 17, 17, ewe(5, { breed: "shetland" }), { flip: true });
  },
  prime: (g) => {
    sky(g, ...DUSK);
    hill(g, 26, "#3f5230");
    drawWoolSacks(g, 7, 18, 48);
    g.px(4, 25, 24, 2, C.bark);
  },
  hundred: (g) => {
    sky(g, ...DUSK);
    hill(g, 27, "#3f5230");
    // a stack of sovereigns
    for (let i = 0; i < 5; i++) {
      g.px(9 + (i % 2), 25 - i * 3, 14, 3, "#a8812a");
      g.px(9 + (i % 2), 25 - i * 3, 14, 1, "#e6c35a");
    }
    // one on top, face up
    g.px(10, 10, 12, 1, "#f4dc8a");
    figures(g, "100", 16 - Math.floor(textW("100") / 2), 3, "#f2eee0");
  },
  roof: (g) => {
    sky(g, [58, 64, 70], [92, 97, 103]);
    hill(g, 26);
    croft(g, 5, 10, "slate");
    // the rain, running off it now and not through it
    for (const [x, y] of [[2, 3], [8, 1], [14, 4], [21, 2], [27, 5], [4, 9], [25, 9], [30, 1]]) g.px(x, y, 1, 3, "#9db1bd");
    g.px(2, 22, 2, 1, "#9db1bd");
    g.px(28, 22, 2, 1, "#9db1bd");
  },
  hearth: (g) => {
    room(g, 1.6);
    g.px(4, 6, 24, 20, "#6d6a5e"); // the stone of it
    for (let y = 8; y < 24; y += 4) for (let x = 5 + (y % 8 ? 2 : 0); x < 27; x += 5) g.px(x, y, 4, 3, "#7d7a6c");
    g.px(2, 4, 28, 3, "#5b4a30"); // the mantel
    g.px(9, 12, 14, 14, "#1d1712");
    drawHearthFire(g, 10, 15, 12, 11, T);
    g.a(4, 10, 24, 18, 255, 180, 90, 0.12);
  },
  byre: (g) => {
    sky(g, ...DAY);
    hill(g, 25);
    g.px(4, 13, 24, 13, "#5c6154");
    for (let i = 0; i < 24; i += 4) g.px(4 + i, 15 + ((i / 4) % 2 ? 4 : 0), 3, 3, "#6d7263");
    g.px(2, 9, 28, 5, C.slate);
    g.px(2, 9, 28, 1, shade(C.slate, 16));
    g.px(13, 17, 7, 9, "#2c2a22"); // the door
    // and one of them looking out of it
    g.px(14, 19, 5, 4, "#2a2622");
    g.px(15, 20, 1, 1, "#e8e4d8");
    g.px(17, 20, 1, 1, "#e8e4d8");
    g.px(13, 18, 2, 2, C.wool);
    g.px(18, 18, 2, 2, C.wool);
  },
  ring: (g) => {
    g.px(0, 0, S, S, "#1f2a2e");
    g.px(4, 20, 24, 8, "#5b3a2c"); // the lining of the box
    g.px(4, 20, 24, 1, "#6e4836");
    ring(g, 16, 16, 8, 3, "#b9bec4");
    ring(g, 16, 16, 8, 1, "#e6e9ec");
    g.px(14, 6, 4, 3, "#a9d6e6"); // the stone
    g.px(15, 6, 1, 1, "#ffffff");
  },
  local: (g) => {
    room(g, 1.3);
    // the gantry behind the bar, bottles catching the lamp
    g.px(0, 4, S, 2, "#4a3424");
    for (let x = 2; x < S; x += 5) {
      g.px(x, 0, 3, 4, ["#3d5a3a", "#6a3a24", "#5a4a2a"][(x / 5) % 3 | 0]);
      g.px(x + 1, 0, 1, 3, "#c8b48a");
    }
    g.px(0, 25, S, 7, "#4a3424"); // the bar top
    g.px(0, 25, S, 1, "#7a5a3c");
    // a pint of heavy in a nonic glass: the bulge near the top, the head on it
    const rows: [number, number][] = [[12, 9], [13, 9], [14, 10], [15, 10], [16, 9], [17, 9], [18, 9], [19, 8], [20, 8], [21, 8], [22, 8], [23, 8], [24, 8]];
    for (const [y, w] of rows) {
      const x = 16 - Math.floor(w / 2);
      g.px(x, y, w, 1, y < 16 ? "#c8862e" : "#a4621c");
      g.px(x, y, 1, 1, "#e8c890"); // the glass catching the lamp
      g.px(x + w - 1, y, 1, 1, "#6a3c14");
    }
    g.px(13, 17, 1, 6, "#d89a44"); // a run of light down it
    g.px(15, 20, 1, 1, "#e8b860"); // a bubble or two coming up
    g.px(18, 18, 1, 1, "#e8b860");
    g.px(11, 8, 10, 4, "#efe6cf"); // the head
    g.px(12, 7, 8, 1, "#f8f2e2");
    g.px(13, 9, 1, 1, "#d8ccb0");
    g.a(6, 4, 20, 24, 255, 200, 120, 0.07);
  },
  thirty: (g) => {
    night(g);
    hill(g, 25, "#2b3a26");
    drawMoonDisc(g, 16, 12, 8, 4, 1);
    figures(g, "30", 16 - Math.floor(textW("30") / 2), 25, "#f2eee0");
  },
  "hundred-days": (g) => {
    sky(g, ...DAY);
    hill(g, 26);
    // a cairn, a stone a day
    const stones = [[6, 23, 7], [13, 23, 7], [20, 23, 7], [9, 19, 6], [16, 19, 7], [12, 15, 7], [14, 11, 5]];
    for (const [x, y, w] of stones) {
      g.px(x, y, w, 4, "#7a7d74");
      g.px(x, y, w, 1, "#9a9d93");
      g.px(x, y + 3, w, 1, "#5d6058");
    }
    figures(g, "100", 16 - Math.floor(textW("100") / 2), 3, "#f2eee0");
  },
  "made-hay": (g) => {
    sky(g, [70, 120, 150], [200, 210, 180]);
    disc(g, 25, 7, 4, "#f4e0a0");
    hill(g, 25, "#7d8a45");
    drawHaystack(g, 15, 27, 120);
    for (let x = 1; x < 31; x += 4) g.px(x, 28 + (x % 3), 3, 1, "#c9a95a");
  },
  "first-winter": (g) => {
    sky(g, [96, 108, 120], [170, 178, 186]);
    hill(g, 22, "#dfe4e8");
    drawSheep(g, 7, 13, ewe(1));
    g.px(9, 12, 9, 1, "#f4f6f8"); // snow on her back
    for (const [x, y] of [[3, 4], [10, 2], [17, 6], [25, 3], [29, 9], [5, 11], [22, 12], [14, 9]]) g.px(x, y, 1, 1, "#ffffff");
  },
  "first-lamb": (g) => {
    sky(g, [80, 130, 140], [180, 206, 190]);
    hill(g, 21, "#6d8a4b");
    drawSheep(g, 1, 12, ewe(1), { graze: true });
    drawSheep(g, 18, 16, ewe(2, { lamb: true, age: 1, fleece: 1 }), { flip: true });
    // a primrose
    g.px(26, 27, 2, 2, "#f0dc6a");
    g.px(5, 29, 2, 2, "#f0dc6a");
  },
  "year-wed": (g) => {
    night(g);
    hill(g, 27, "#2b3a26");
    croft(g, 5, 11, "slate", true);
    g.a(14, 18, 9, 7, 240, 200, 106, 0.25);
    // smoke from the lum
    for (let i = 0; i < 3; i++) g.a(22 + i, 6 - i * 2, 2, 2, 200, 200, 190, 0.5 - i * 0.12);
  },
  dance: (g) => {
    room(g, 1.4);
    drawShepherd(g, 3, 4, { facing: 1 });
    drawHerAtHome(g, 22, 30, T);
    // the tune
    g.px(15, 5, 1, 4, "#f0c86a");
    g.px(13, 8, 2, 2, "#f0c86a");
    g.px(16, 5, 2, 1, "#f0c86a");
  },
  "fifty-lambs": (g) => {
    sky(g, [80, 130, 140], [180, 206, 190]);
    hill(g, 20, "#6d8a4b");
    drawSheep(g, 2, 17, ewe(1, { lamb: true, age: 1, fleece: 1 }));
    drawSheep(g, 17, 15, ewe(2, { lamb: true, age: 1, fleece: 1, breed: "cheviot" }), { flip: true });
    figures(g, "50", 16 - Math.floor(textW("50") / 2), 3, "#f2eee0");
  },
  rosette: (g) => {
    g.px(0, 0, S, S, "#26402e");
    // the ribbons
    g.px(11, 18, 4, 12, "#9c2424");
    g.px(17, 18, 4, 12, "#9c2424");
    g.px(11, 29, 2, 2, "#26402e");
    g.px(19, 29, 2, 2, "#26402e");
    // the frill, and the middle
    for (let a = 0; a < 16; a++) {
      const t = (a / 16) * Math.PI * 2;
      g.px(Math.round(16 + Math.cos(t) * 9) - 2, Math.round(13 + Math.sin(t) * 9) - 2, 4, 4, a % 2 ? "#c43434" : "#a82a2a");
    }
    disc(g, 16, 13, 7, "#c43434");
    disc(g, 16, 13, 4, "#e6c35a");
    disc(g, 15, 12, 2, "#f4dc8a");
  },
  neighbour: (g) => {
    sky(g, ...DAY);
    hill(g, 21, "#5d7a42");
    // the burn between you
    for (let y = 21; y < S; y++) g.px(4 + Math.round(Math.sin(y / 3) * 2) + Math.floor((y - 21) / 2), y, 3 + Math.floor((y - 21) / 4), 1, C.water);
    // what came over it: a basket with a loaf and eggs
    g.px(12, 18, 16, 9, "#8a6a3c");
    for (let x = 12; x < 28; x += 3) g.px(x, 18, 1, 9, "#6e5230");
    g.px(12, 21, 16, 1, "#6e5230");
    g.px(14, 13, 10, 6, "#c8944c");
    g.px(15, 13, 8, 2, "#dcae68");
    g.px(24, 15, 3, 4, "#f2eee0");
    g.px(11, 15, 3, 4, "#e8d8b8");
    g.px(13, 10, 1, 8, "#6e5230"); // the handle
    g.px(13, 10, 14, 1, "#6e5230");
    g.px(26, 10, 1, 8, "#6e5230");
  },
  "old-dog": (g) => {
    room(g, 1.5);
    g.px(0, 4, 12, 20, "#6d6a5e");
    g.px(2, 12, 8, 12, "#1d1712");
    drawHearthFire(g, 3, 15, 6, 9, T);
    g.a(0, 8, 24, 24, 255, 180, 90, 0.1);
    drawDogCurled(g, 9, 19, T, -1);
  },
  clean: (g) => {
    night(g);
    hill(g, 20, "#2b3a26");
    drawMoonDisc(g, 25, 6, 4, 4, 1);
    // the flock inside the fold
    drawSheep(g, 1, 6, ewe(1));
    drawSheep(g, 14, 5, ewe(2, { breed: "cheviot" }), { flip: true });
    // the fold dyke between them and the dark
    for (let x = 0; x < S; x += 4) {
      g.px(x, 18, 4, 3, (x / 4) % 2 ? "#6d7263" : "#5c6154");
      g.px(x - 2, 21, 4, 2, (x / 4) % 2 ? "#5c6154" : "#6d7263");
    }
    g.px(0, 18, S, 1, "#878b7c");
    // and the fox outside it, away with nothing
    drawFox(g, 2, 23, 0.3, 1);
  },
  aye: (g) => {
    sky(g, ...DUSK);
    hill(g, 27, "#3f5230");
    heart(g, 9, 6, "#c43434");
    ring(g, 25, 24, 3, 1, "#e6e9ec");
  },
  tippy: (g) => {
    KIT.collie = true;
    room(g, 1.6);
    // the fire she lies in front of, every time it is lit
    g.px(6, 2, 20, 18, "#6d6a5e");
    g.px(4, 1, 24, 2, "#5b4a30");
    g.px(11, 8, 10, 12, "#1d1712");
    drawHearthFire(g, 12, 11, 8, 9, T);
    g.px(0, 22, S, 10, "#7a3a2c"); // the hearthrug
    for (let x = 0; x < S; x += 4) g.px(x, 23, 2, 8, "#8a4634");
    g.a(0, 0, S, S, 255, 170, 80, 0.1);
    drawDogCurled(g, 5, 18, T, 1);
    KIT.collie = false;
  },
  arrow: (g) => {
    room(g, 1.3);
    // round and round
    for (let a = 0; a < 20; a++) {
      const t = (a / 20) * Math.PI * 2;
      if (a % 3 === 2) continue;
      g.px(Math.round(16 + Math.cos(t) * 14), Math.round(19 + Math.sin(t) * 7), 2, 1, "#f0c86a");
    }
    drawDog(g, 7, 13, 0, 0, 1, 60);
  },
  pelt: (g) => {
    night(g);
    drawMoonDisc(g, 25, 7, 5, 4, 1);
    hill(g, 26, "#2b3a26");
    drawWolfBeast(g, 3, 14, 0, 1, 1);
  },
  "only-one": (g) => {
    night(g);
    // the moon he came by, and the two of you under it on the top of the corrie
    drawMoonDisc(g, 16, 8, 6, 4, 1);
    for (let x = 0; x < S; x++) {
      const y = 25 - Math.round(Math.max(0, 4 - Math.abs(x - 16) * 0.4));
      g.px(x, y, 1, S - y, "#1b2418");
    }
    const ink = "#07090a";
    const rim = "#a8b0c4"; // the moon along the tops of them
    // him: bunnet, coat, legs
    g.px(10, 17, 5, 5, ink);
    g.px(11, 22, 1, 2, ink);
    g.px(13, 22, 1, 2, ink);
    g.px(11, 14, 3, 3, ink);
    g.px(10, 13, 5, 1, ink);
    g.px(10, 13, 5, 1, rim);
    // her: hair down her back, a long skirt
    g.px(18, 17, 4, 3, ink);
    g.px(17, 20, 6, 4, ink);
    g.px(18, 14, 3, 3, ink);
    g.px(17, 14, 1, 5, ink);
    g.px(21, 14, 1, 4, ink);
    g.px(18, 13, 3, 1, rim);
    g.px(15, 18, 3, 1, ink); // hand in hand
  },
  mauled: (g) => {
    sky(g, [24, 10, 12], [60, 20, 20]);
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 18; i++) {
        const x = 8 + k * 6 + Math.round(i * 0.45);
        g.px(x, 6 + i, 2, 1, i < 2 || i > 15 ? "#7a2020" : "#c43434");
      }
    }
  },
};

/** what a secret one shows until it is earned: the hill at night, and a question */
function mystery(g: Painter) {
  night(g);
  hill(g, 23, "#1f2a1c");
  const q = ["0111110", "1100011", "0000011", "0000110", "0001100", "0001100", "0000000", "0001100"];
  q.forEach((row, r) => [...row].forEach((b, k) => b === "1" && g.px(9 + k * 2, 3 + r * 2, 2, 2, "#8a8f98")));
}

/* ------------------------------------------------------------------ *
 * framing and output
 * ------------------------------------------------------------------ */

function frame(g: Painter, edge: string) {
  g.px(0, 0, S, 1, "#14170f");
  g.px(0, S - 1, S, 1, "#14170f");
  g.px(0, 0, 1, S, "#14170f");
  g.px(S - 1, 0, 1, S, "#14170f");
  g.px(1, 1, S - 2, 1, edge);
  g.px(1, S - 2, S - 2, 1, edge);
  g.px(1, 1, 1, S - 2, edge);
  g.px(S - 2, 1, 1, S - 2, edge);
}

function paint(draw: (g: Painter) => void, edge: string) {
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const cx = c.getContext("2d")!;
  const g = new Painter(cx, S, S);
  setSpriteState({ night: 0, kit: { pelt: false } });
  cx.save();
  cx.beginPath();
  cx.rect(0, 0, S, S);
  cx.clip();
  draw(g);
  cx.restore();
  frame(g, edge);
  return c;
}

/** doubled to Steam's size, pixel for pixel, and optionally greyed for the locked state */
function scaled(src: HTMLCanvasElement, locked: boolean) {
  const c = document.createElement("canvas");
  c.width = OUT;
  c.height = OUT;
  const cx = c.getContext("2d")!;
  cx.imageSmoothingEnabled = false;
  if (locked) cx.filter = "grayscale(1) brightness(0.55) contrast(0.9)";
  cx.drawImage(src, 0, 0, OUT, OUT);
  return c;
}

export const apiName = (id: string) => id.toUpperCase().replace(/[^A-Z0-9]+/g, "_");

const out: { api: string; name: string; earned: string; locked: string }[] = [];
const grid = document.getElementById("grid")!;
for (const a of ACHIEVEMENTS) {
  const draw = ICONS[a.id];
  if (!draw) throw new Error(`no icon for ${a.id}`);
  const earned = scaled(paint(draw, "#c9a83c"), false);
  const locked = a.secret ? scaled(paint(mystery, "#6a6a62"), false) : scaled(paint(draw, "#6a6a62"), true);
  out.push({ api: apiName(a.id), name: a.name, earned: earned.toDataURL("image/png"), locked: locked.toDataURL("image/png") });

  const fig = document.createElement("figure");
  for (const c of [earned, locked]) {
    c.style.width = "64px";
    fig.appendChild(c);
  }
  const cap = document.createElement("figcaption");
  cap.textContent = `${a.name}${a.secret ? " (secret)" : ""}`;
  fig.appendChild(cap);
  grid.appendChild(fig);
}
const missing = Object.keys(ICONS).filter((id) => !ACHIEVEMENTS.some((a) => a.id === id));
if (missing.length) throw new Error(`icons for achievements that no longer exist: ${missing.join(", ")}`);

(window as unknown as { icons: typeof out }).icons = out;
