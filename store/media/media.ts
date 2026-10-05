/*
 * The Steam store and library art, drawn by the game itself.
 *
 * Every picture here is the real renderer: the glen is GLEN_ART drawing a
 * made-up but legal run (a finished croft in summer, a flock with lambs, the
 * dog working), at the game's own pixel size, then scaled up by a whole
 * number so the pixels stay square. The name is a pixel wordmark in the
 * title's gorse yellow, built on the same grid.
 *
 * Open media.html on the dev server to look at them; capture.cjs saves them.
 */
import { Painter } from "../../src/render/painter";
import { layoutWorld } from "../../src/render/layout";
import { pixelText, textSize } from "./pixelfont";
import { drawSheep, setSpriteState } from "../../src/render/sprites";
import type { GameState, Sheep } from "../../src/sim/types";
import { glen, run } from "./scene";

/** the wordmark: HIRSEL in the shared pixel lettering */
export const wordSize = (k: number) => textSize("HIRSEL", k);
const wordmark = (g: Painter, x: number, y: number, k: number) => pixelText(g, "HIRSEL", x, y, k);

/* ------------------------------------------------------------------ *
 * composing
 * ------------------------------------------------------------------ */

interface Shot {
  name: string;
  /** the size Steam asks for */
  w: number;
  h: number;
  /** device pixels per game pixel */
  scale: number;
  draw: (g: Painter, W: number, H: number) => void;
  /** transparent background (the library logo) */
  clear?: boolean;
  note: string;
}

/**
 * The glen into the logical canvas, and the wordmark in the sky: below the
 * sun (high on the right, at 0.28 of the horizon) and above the bens, at
 * fraction `fy` of the way down to the horizon. The outline and shadow carry
 * it; a shaded band behind it showed as a stripe across the sky.
 */
function capsule(st: GameState, logo: { fy: number; width?: number } | null, darkenSky = 0) {
  return (g: Painter, W: number, H: number) => {
    g.cx.drawImage(glen(W, H, st), 0, 0);
    if (darkenSky) g.a(0, 0, W, H, 10, 13, 24, darkenSky);
    if (!logo) return;
    const horizon = layoutWorld(W, H, st, { time: 4200 }).horizonY;
    const k = Math.max(1, Math.floor((W * (logo.width ?? 0.7)) / wordSize(1).w));
    const { w, h } = wordSize(k);
    const x = Math.round((W - w) / 2);
    const y = Math.max(k, Math.round(horizon * logo.fy - h / 2));
    wordmark(g, x, y, k);
  };
}

const SUMMER = run({ day: 30, at: 0 });
const SPRING = run({ day: 6, at: 0, lambs: 4, seed: 5 });

export const SHOTS: Shot[] = [
  { name: "store_header_capsule", w: 920, h: 430, scale: 3, draw: capsule(SUMMER, { fy: 0.5, width: 0.62 }), note: "Header capsule: the top of the store page and most lists" },
  { name: "store_small_capsule", w: 462, h: 174, scale: 2, draw: smallCapsule, note: "Small capsule: search results and lists; the name must read at this size" },
  { name: "store_main_capsule", w: 1232, h: 706, scale: 4, draw: capsule(SUMMER, { fy: 0.5, width: 0.62 }), note: "Main capsule: the front-page carousel" },
  { name: "store_vertical_capsule", w: 748, h: 896, scale: 4, draw: capsule(SPRING, { fy: 0.62, width: 0.8 }), note: "Vertical capsule: sales pages" },
  { name: "page_background", w: 1438, h: 810, scale: 4, draw: capsule(SUMMER, null, 0.2), note: "Page background: optional, behind the store page; no text" },
  { name: "library_capsule", w: 600, h: 900, scale: 3, draw: capsule(SPRING, { fy: 0.62, width: 0.8 }), note: "Library capsule: the game's tile in a player's library" },
  { name: "library_header", w: 920, h: 430, scale: 3, draw: capsule(SUMMER, { fy: 0.5, width: 0.62 }), note: "Library header: same as the header capsule" },
  { name: "library_hero", w: 3840, h: 1240, scale: 8, draw: capsule(SUMMER, null), note: "Library hero: the banner over the game's library page; no text, the logo goes on top of it" },
  { name: "library_logo", w: 1280, h: 720, scale: 8, draw: libraryLogo, clear: true, note: "Library logo: transparent, set over the hero" },
];

/** at 462×174 the name is the whole job: a strip of hill, and the name as big as it goes */
function smallCapsule(g: Painter, W: number, H: number) {
  g.cx.drawImage(glen(W, Math.round(W * 0.52), SUMMER), 0, H - Math.round(W * 0.52));
  const k = Math.floor((W * 0.86) / wordSize(1).w);
  const { w, h } = wordSize(k);
  g.a(0, 0, W, H, 10, 13, 20, 0.5); // the background steps back; the name is the picture
  wordmark(g, Math.round((W - w) / 2), Math.round((H - h) / 2) - 2, k);
}

function libraryLogo(g: Painter, W: number, H: number) {
  const k = Math.floor((W * 0.86) / wordSize(1).w);
  const { w, h } = wordSize(k);
  wordmark(g, Math.round((W - w) / 2), Math.round((H - h) / 2), k);
}

/* ------------------------------------------------------------------ *
 * the icon: a blackface ewe on the hill under the moon, at 32×32
 * ------------------------------------------------------------------ */

function icon(g: Painter) {
  const S = 32;
  // the evening sky, banded
  const bands: [number, string][] = [[0, "#1f2b3a"], [5, "#2a3a4a"], [10, "#36495a"], [15, "#45596a"]];
  for (const [y, c] of bands) g.px(0, y, S, S - y, c);
  // the moon
  for (let y = -4; y <= 4; y++) {
    const h = Math.round(Math.sqrt(16 - y * y));
    g.px(8 - h, 7 + y, h * 2, 1, "#e8ecd6");
  }
  g.px(6, 5, 2, 2, "#cfd4bc"); // the moon up on the left, clear of her head
  // the hill
  for (let x = 0; x < S; x++) {
    const y = 20 + Math.round(Math.sin(x / 6) * 1.5);
    g.px(x, y, 1, S - y, "#3c4a2e");
    g.px(x, y, 1, 1, "#7d9a55");
  }
  setSpriteState({ night: 0 });
  drawSheep(g, 5, 12, { id: 1, fleece: 7, breed: "blackface", age: 60 } as Sheep);
  // a frame of ink, so it holds its edge on any taskbar
  g.px(0, 0, S, 1, "#14170f");
  g.px(0, S - 1, S, 1, "#14170f");
  g.px(0, 0, 1, S, "#14170f");
  g.px(S - 1, 0, 1, S, "#14170f");
}

export const ICONS = [
  { name: "icon_256", size: 256 },
  { name: "icon_512", size: 512 },
  { name: "community_icon_184", size: 184 },
  { name: "icon_192", size: 192 },
  { name: "icon_48", size: 48 },
  { name: "icon_32", size: 32 },
  { name: "icon_16", size: 16 },
];

/* ------------------------------------------------------------------ *
 * render everything
 * ------------------------------------------------------------------ */

function render(s: Shot): HTMLCanvasElement {
  const W = Math.ceil(s.w / s.scale);
  const H = Math.ceil(s.h / s.scale);
  const small = document.createElement("canvas");
  small.width = W;
  small.height = H;
  const g = new Painter(small.getContext("2d")!, W, H);
  if (!s.clear) g.px(0, 0, W, H, "#14170f");
  s.draw(g, W, H);
  const out = document.createElement("canvas");
  out.width = s.w;
  out.height = s.h;
  const cx = out.getContext("2d")!;
  cx.imageSmoothingEnabled = false;
  // whole-number scale, cropped to the exact size, centred
  const ox = Math.floor((W * s.scale - s.w) / 2);
  const oy = Math.floor((H * s.scale - s.h) / 2);
  cx.drawImage(small, -ox, -oy, W * s.scale, H * s.scale);
  return out;
}

function renderIcon(size: number): HTMLCanvasElement {
  const small = document.createElement("canvas");
  small.width = 32;
  small.height = 32;
  icon(new Painter(small.getContext("2d")!, 32, 32));
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const cx = out.getContext("2d")!;
  // whole multiples of 32 are pixel-perfect; the odd sizes (184, 48) take the nearest and smooth the rest
  cx.imageSmoothingEnabled = size % 32 !== 0 && size < 32 ? true : size % 32 !== 0;
  cx.drawImage(small, 0, 0, size, size);
  return out;
}

const results: { name: string; png: string }[] = [];
const root = document.getElementById("out")!;
const show = (name: string, note: string, c: HTMLCanvasElement) => {
  const f = document.createElement("figure");
  f.innerHTML = `<figcaption>${name} · ${c.width}×${c.height} · ${note}</figcaption>`;
  f.appendChild(c);
  root.appendChild(f);
  results.push({ name, png: c.toDataURL("image/png") });
};
for (const s of SHOTS) show(s.name, s.note, render(s));
for (const i of ICONS) show(i.name, "app icon", renderIcon(i.size));
(window as unknown as { media: typeof results }).media = results;
