/**
 * Every sprite in the game, and the palette they are drawn from.
 *
 * Shared by both interfaces: the full-screen `glen` scene and the older
 * panelled `retro` one. They lay the world out very differently, but a sheep
 * is a sheep — keeping one copy means a fix to the dog's ears or the pelt
 * lands in both places rather than one of them drifting.
 *
 * Sprite state that changes per frame rather than per call (the TOD cheat,
 * what kit he owns, how dark it is) is set once a frame via `setSpriteState`
 * instead of threaded through every signature.
 */
import type { Painter } from "./painter";
import { BREEDS } from "../sim/config";
import { grade } from "../sim/rules";
import type { Sheep, WeatherId } from "../sim/types";

/* ---------- palette ---------- */
export const C = {
  ink: "#0b0d08",
  peat: "#14170f",
  turf: ["#5d7a42", "#6d8a4b", "#7d9a55"],
  turfDry: ["#565a36", "#666a3e", "#767a49"],
  turfDark: "#3f5230",
  rock: "#6d7263",
  rockDark: "#4d5247",
  rockLit: "#878b7c",
  heather: "#8a6a9c",
  heatherDim: "#6a5079",
  gorse: "#e0a33c",
  wool: "#ddd9c8",
  bark: "#5b4a30",
  slate: "#4a5058",
  thatch: "#8a7443",
  fire: "#e0a33c",
  night: "#0a0d18",
  water: "#43606e",
  waterLit: "#5d7d8a",
  fox: "#b4472c",
};

/** sky gradient per weather: [high, low] */
export const SKY: Record<WeatherId, [string, string]> = {
  sun: ["#3f6a7e", "#87b0b4"],
  overcast: ["#3a4046", "#5c6167"],
  rain: ["#252c33", "#3c464e"],
  mist: ["#454b4a", "#697070"],
};

/* ---------- helpers ---------- */
export const br = (s: Sheep) => BREEDS[s.breed] ?? BREEDS.blackface;

/** deterministic scatter, so the hillside doesn't crawl between frames */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ---------- per-frame sprite state ---------- */
let INV = false;
let NIGHT = 0;

/**
 * What he owns, refreshed each frame. Every tool that can be seen is drawn:
 * buying something should change the picture, not just a line in a menu.
 * The broadsword is the deliberate exception — it stays out of sight.
 */
export const KIT = {
  crook: false,
  boots: false,
  shears: false,
  lamp: false,
  cart: false,
  watch: false,
  oilskin: false,
  saltlick: false,
  pelt: false,
};

export function setSpriteState(o: { inverse?: boolean; night?: number; kit?: Partial<typeof KIT> }) {
  if (o.inverse !== undefined) INV = o.inverse;
  if (o.night !== undefined) NIGHT = o.night;
  if (o.kit) Object.assign(KIT, o.kit);
}

export const isInverse = () => INV;
export const nightLevel = () => NIGHT;

/* ---------- the flock ---------- */

/** the inverse flock: a fox whose brush thickens the way a fleece would */
function drawFoxBeast(g: Painter, x: number, y: number, s: Sheep, o: { shorn?: boolean; run?: number; flip?: boolean }) {
  const gr = grade(o.shorn ? 0 : s.fleece);
  const bulk = Math.round(Math.min(5, gr.v * 0.5));
  const b = br(s);
  // breed colour still reads, just on a fox
  const coat = s.breed === "hebridean" ? "#7a3a24" : s.breed === "shetland" ? "#c06a34" : C.fox;
  const dir = o.flip ? -1 : 1;
  const leg = o.run ? (Math.sin(o.run * Math.PI * 14) > 0 ? 0 : 2) : 0;
  g.a(x, y + 11, 14, 2, 0, 0, 0, 0.22);
  g.px(x + 2, y + 7, 2, 4, "#2b201a");
  g.px(x + 8, y + 7 - leg, 2, 4, "#2b201a");
  g.px(x + 5, y + 7 + leg, 2, 4, "#2b201a");
  g.px(x + 10, y + 7, 2, 4, "#2b201a");
  g.px(x + 1, y + 3, 12, 5, coat);
  g.px(x + 1, y + 3, 12, 1, shade(coat, 18));
  const hx = dir > 0 ? x + 12 : x - 4;
  g.px(hx, y + 1, 6, 5, coat);
  g.px(hx + (dir > 0 ? 4 : -1), y + 3, 3, 2, "#2b201a");
  g.px(hx + (dir > 0 ? 1 : 4), y + 2, 1, 1, "#e8d27a");
  g.px(hx, y - 2, 2, 3, shade(coat, -30));
  g.px(hx + 3, y - 2, 2, 3, shade(coat, -30));
  // the brush, which is what you are farming now
  const bw = 7 + bulk * 2;
  g.px(dir > 0 ? x - bw : x + 13, y + 2, bw, 4 + bulk, gr.label === "matted" ? "#8a6a52" : coat);
  g.px(dir > 0 ? x - bw - 2 : x + 13 + bw, y + 2, 3, 3, b.wool);
}

/** the inverse raider: a ram off the hill, horns and all */
export function drawRam(g: Painter, x: number, y: number, run: number) {
  const leg = Math.sin(run * Math.PI * 14) > 0 ? 0 : 2;
  g.px(x + 2, y + 8, 3, 5, "#3a352c");
  g.px(x + 9, y + 8 - leg, 3, 5, "#3a352c");
  g.px(x + 6, y + 8 + leg, 3, 5, "#2e2a22");
  g.px(x + 13, y + 8, 3, 5, "#2e2a22");
  g.px(x, y, 18, 9, "#ddd9c8");
  g.px(x + 1, y - 1, 16, 2, "#efeada");
  g.px(x + 17, y + 1, 7, 6, "#2b2b26");
  g.px(x + 22, y + 3, 1, 1, "#e8d27a");
  g.px(x + 17, y - 3, 7, 2, "#b8a878"); // horns
  g.px(x + 23, y - 2, 2, 4, "#b8a878");
  g.px(x + 15, y - 2, 2, 3, "#b8a878");
}

export interface SheepOpts {
  shorn?: boolean;
  graze?: boolean;
  run?: number;
  flip?: boolean;
}

export function drawSheep(g: Painter, x: number, y: number, s: Sheep, o: SheepOpts = {}) {
  if (INV) return drawFoxBeast(g, x, y, s, o);
  const gr = grade(o.shorn ? 0 : s.fleece);
  const b = br(s);
  const bulk = Math.round(Math.min(6, gr.v * 0.55));
  const w = 11 + bulk;
  const h = 7 + Math.round(bulk * 0.5);
  const wool = gr.label === "matted" ? "#a49b80" : b.wool;
  const dir = o.flip ? -1 : 1;
  const legPhase = o.run ? (Math.sin(o.run * Math.PI * 12) > 0 ? 1 : -1) : 0;

  g.a(x, y + h + 3, w, 2, 0, 0, 0, 0.22); // shadow
  g.px(x + 2, y + h, 2, 4 - Math.abs(legPhase), "#3a352c"); // legs
  g.px(x + w - 5, y + h, 2, 4 - Math.abs(legPhase), "#3a352c");
  g.px(x + 4, y + h, 2, 4 + legPhase, "#2e2a22");
  g.px(x + w - 7, y + h, 2, 4 - legPhase, "#2e2a22");
  g.px(x, y + 1, w, h - 1, wool); // fleece, lit along the top
  g.px(x + 1, y, w - 2, 2, shade(wool, 12));
  g.px(x, y + h - 1, w, 1, shade(wool, -26));
  for (let i = 1; i < w - 1; i += 3) g.px(x + i, y + 2 + ((i / 3) % 2), 2, 1, shade(wool, -14)); // curls
  const hx = dir > 0 ? x + w - 2 : x - 4;
  const hy = o.graze ? y + h - 2 : y - 3;
  g.px(hx, hy, 6, 5, b.face);
  g.px(hx + (dir > 0 ? 4 : 0), hy + 2, 2, 2, shade(b.face, 24));
  g.px(hx + (dir > 0 ? 1 : 3), hy + 1, 1, 1, "#0d0d0b");
  g.px(hx + (dir > 0 ? 0 : 4), hy - 2, 2, 2, b.face); // ear
  g.px(dir > 0 ? x - 2 : x + w, y + 2, 2, 3, wool); // tail
}

/* ---------- the shepherd ---------- */

/** the wolf skin: hood with the ears still on it, mantle over the shoulders */
function drawPelt(g: Painter, x: number, y: number) {
  g.px(x - 2, y + 5, 16, 7, "#3a3d47");
  g.px(x - 2, y + 5, 16, 2, "#4a4e5a"); // moonlit along the top
  g.px(x - 2, y + 11, 16, 1, "#2a2d36");
  g.px(x - 4, y + 10, 4, 8, "#3a3d47"); // the brush, down his back
  g.px(x - 4, y + 17, 4, 3, "#8f939c");
  g.px(x + 1, y - 5, 11, 5, "#3a3d47"); // the head worn as a hood
  g.px(x + 1, y - 5, 11, 1, "#4a4e5a");
  g.px(x + 1, y - 8, 3, 4, "#3a3d47");
  g.px(x + 8, y - 8, 3, 4, "#3a3d47");
  g.px(x + 2, y - 7, 1, 2, "#22252f"); // where the ears fold
  g.px(x + 9, y - 7, 1, 2, "#22252f");
}

export interface ShepherdOpts {
  crook?: boolean;
  arm?: number;
  walk?: number;
  sit?: boolean;
  /** seen from behind — for walking away from the camera */
  back?: boolean;
}

/** 12 wide, 26 tall from `y` (the top of his head) to the soles */
export const SHEPHERD_W = 12;
export const SHEPHERD_H = 26;

export function drawShepherd(g: Painter, x: number, y: number, o: ShepherdOpts = {}) {
  const step = o.walk ? (Math.sin(o.walk * Math.PI * 8) > 0 ? 1 : 0) : 0;
  g.a(x - 1, y + 26, 14, 2, 0, 0, 0, 0.25);
  // boots: tackety ones once he has bought a pair, taller and nailed
  if (KIT.boots) {
    g.px(x, y + 20, 5, 6, "#2a2118");
    g.px(x + 6, y + 20 - step, 5, 6, "#2a2118");
    g.px(x, y + 25, 5, 1, "#6b5a44");
    g.px(x + 6, y + 25 - step, 5, 1, "#6b5a44");
  } else {
    g.px(x + 1, y + 22, 4, 4, "#33291f");
    g.px(x + 7, y + 22 - step, 4, 4, "#33291f");
  }
  g.px(x + 1, y + 15, 10, 8, "#4b4632"); // breeks
  // coat — the waxed oilskin is longer, darker and has a sheen on it
  if (KIT.oilskin) {
    g.px(x, y + 6, 12, 15, "#2f3a35");
    g.px(x, y + 6, 12, 2, "#43524a");
    g.px(x + 11, y + 8, 1, 11, "#54655c"); // wax catching the light
    g.px(x + 5, y + 8, 2, 12, "#26302c");
    g.px(x, y + 5, 12, 2, "#3a4a42"); // collar up
  } else {
    g.px(x, y + 6, 12, 11, "#4a5540");
    g.px(x, y + 6, 12, 2, "#5a6650");
    g.px(x + 5, y + 8, 2, 9, "#3b4433"); // buttoned seam
    g.px(x + 1, y + 5, 10, 2, "#8a4a3c"); // scarf
  }
  if (KIT.shears && o.arm === undefined) {
    g.px(x - 2, y + 15, 4, 2, "#b9bcae"); // shears on the belt
    g.px(x - 3, y + 16, 2, 3, "#6b5433");
  }
  if (KIT.watch) {
    g.px(x + 2, y + 11, 5, 1, "#c9a83c"); // watch chain
    g.px(x + 7, y + 10, 1, 2, "#e0c34c");
  }
  if (o.back) {
    // the back of his head: no face, and the bunnet's peak points away from
    // us rather than off to one side
    g.px(x + 2, y, 8, 6, "#8a6b4c"); // hair
    g.px(x + 3, y + 4, 6, 2, "#c9a583"); // his neck below it
    g.px(x + 2, y - 3, 9, 4, "#2f3327");
    g.px(x + 3, y - 4, 7, 1, "#3a3f31");
  } else {
    g.px(x + 2, y, 8, 6, "#c9a583"); // head
    g.px(x + 3, y + 2, 1, 1, "#26201a");
    g.px(x + 7, y + 2, 1, 1, "#26201a");
    g.px(x + 2, y - 3, 9, 4, "#2f3327"); // bunnet
    g.px(x + 9, y - 2, 3, 2, "#2f3327");
  }
  if (KIT.pelt) drawPelt(g, x, y);
  if (o.arm !== undefined) g.px(x + 10, y + 8 + o.arm, 4, 3, "#c9a583");
  if (KIT.lamp) {
    // storm lantern in the free hand, burning brighter the darker it gets
    const lx = x - 7;
    const ly = y + 12;
    const glow = 0.35 + NIGHT * 0.55;
    g.a(lx - 5, ly - 5, 14, 15, 240, 190, 90, 0.05 + NIGHT * 0.26);
    g.a(lx - 2, ly - 2, 8, 9, 240, 200, 110, 0.08 + NIGHT * 0.34);
    g.px(lx + 1, ly - 4, 2, 3, "#6d7263"); // bail
    g.px(lx, ly - 1, 5, 6, "#8a8f88"); // body
    g.a(lx + 1, ly, 3, 4, 255, 214, 120, glow); // the flame
    g.px(lx, ly + 5, 5, 1, "#5a5f58");
  }
  if (o.crook && KIT.crook) {
    for (let i = 0; i < 11; i++) g.px(x + 13, y + 1 + i * 2, 2, 2, "#6b5433");
    g.px(x + 11, y - 1, 4, 2, "#6b5433");
  }
}

/* ---------- the animals ---------- */

/** tricolour sheltie — must stay readable at night */
export function drawDog(g: Painter, x: number, y: number, run: number) {
  const leg = run ? (Math.sin(run * Math.PI * 12) > 0 ? 0 : 2) : 0;
  g.a(x - 2, y + 11, 18, 2, 0, 0, 0, 0.22);
  g.px(x + 1, y + 7, 2, 4, "#f2eee2");
  g.px(x + 8, y + 7 - leg, 2, 4, "#f2eee2");
  g.px(x + 4, y + 7 + leg, 2, 4, "#f2eee2");
  g.px(x + 11, y + 7, 2, 4, "#f2eee2");
  g.px(x + 1, y + 2, 13, 6, "#2a2320");
  g.px(x + 1, y + 6, 13, 2, "#b07a3e");
  g.px(x + 1, y + 1, 5, 4, "#f2eee2"); // ruff
  g.px(x + 13, y - 1, 6, 7, "#2a2320");
  g.px(x + 15, y + 3, 5, 3, "#b07a3e");
  g.px(x + 16, y, 2, 4, "#f2eee2"); // blaze
  g.px(x + 18, y + 3, 1, 1, "#0d0d0b");
  g.px(x + 13, y - 4, 2, 3, "#2a2320");
  g.px(x + 17, y - 4, 2, 3, "#2a2320");
  const tail = run ? Math.sin(run * Math.PI * 8) * 3 : Math.sin(Date.now() / 500) * 1;
  g.px(x - 4, y + tail, 5, 3, "#2a2320");
  g.px(x - 7, y + 1 + tail, 3, 3, "#f2eee2");
}

/**
 * The fox, which walks off the hill one way and back the other — so it needs
 * to turn round. Local coordinates run 0 (tail tip) to 29 (snout) and are
 * mirrored when it heads left; `x` is the trailing edge either way.
 */
export function drawFox(g: Painter, x: number, y: number, run: number, facing: 1 | -1 = 1) {
  const SPAN = 29;
  const leg = Math.sin(run * Math.PI * 16) > 0 ? 0 : 2;
  const p = (dx: number, dy: number, w: number, h: number, c: string) =>
    g.px(facing > 0 ? x + dx : x + SPAN - dx - w, y + dy, w, h, c);

  p(2, 1, 8, 4, C.fox); // brush
  p(0, 1, 3, 3, "#f0ece0"); // white tip
  p(11, 6, 2, 4, "#2b201a"); // legs
  p(17, 6 - leg, 2, 4, "#2b201a");
  p(14, 6 + leg, 2, 4, "#2b201a");
  p(19, 6, 2, 4, "#2b201a");
  p(10, 2, 12, 5, C.fox); // body
  p(10, 2, 12, 1, "#c85a38"); // sunlit back
  p(21, 0, 6, 5, C.fox); // head
  p(26, 2, 3, 2, "#2b201a"); // snout
  p(25, 1, 1, 1, "#e8d27a"); // eye
  p(21, -2, 2, 3, "#8f3623"); // ears
  p(24, -2, 2, 3, "#8f3623");
}

/**
 * The wolf, facing LEFT. He comes down off the skyline towards the shepherd,
 * so his head has to be on the leading edge — drawn facing right he walked
 * backwards down the hill.
 *
 * Local coordinates run from the nose at 0 to the tail tip at 49, and `x` is
 * the nose. Everything takes an alpha so he can fade up out of the dark
 * behind his own eyes: eyes first, then the shape of him.
 */
const WOLF_BODY: [number, number, number] = [37, 41, 53];
const WOLF_SPINE: [number, number, number] = [51, 56, 73];
const WOLF_DARK: [number, number, number] = [13, 15, 22];
const WOLF_LEG: [number, number, number] = [18, 20, 28];
const WOLF_EYE: [number, number, number] = [232, 178, 60];

export function drawWolfBeast(g: Painter, x: number, y: number, run: number, body = 1, eyeGlow = 1) {
  const leg = Math.sin(run * Math.PI * 14) > 0 ? 0 : 3;
  const p = (dx: number, dy: number, w: number, h: number, c: [number, number, number], a = body) =>
    g.a(x + dx, y + dy, w, h, c[0], c[1], c[2], a);

  if (body > 0.02) {
    p(37, -1, 12, 5, WOLF_BODY); // brush
    p(11, 1, 26, 11, WOLF_BODY); // barrel
    p(11, 1, 26, 2, WOLF_SPINE); // moonlight along the back
    p(13, 11, 4, 9, WOLF_DARK); // fore legs under the head
    p(19, 11 - leg, 4, 9, WOLF_DARK);
    p(27, 11 + leg, 4, 12, WOLF_LEG); // hind legs under the tail
    p(33, 11, 4, 9, WOLF_LEG);
    p(4, -4, 11, 10, WOLF_BODY); // head
    p(0, 1, 5, 4, WOLF_DARK); // muzzle
    p(5, -9, 4, 6, WOLF_BODY); // ears
    p(11, -9, 4, 6, WOLF_BODY);
  }

  if (eyeGlow > 0.01) {
    // the halo goes down first, so the eyes read before the shape does
    p(3, -3, 14, 5, WOLF_EYE, eyeGlow * 0.12);
    p(5, -2, 11, 3, WOLF_EYE, eyeGlow * 0.22);
    p(6, -1, 3, 2, WOLF_EYE, eyeGlow);
    p(11, -1, 3, 2, WOLF_EYE, eyeGlow);
  }
}

/* ---------- things on the ground ---------- */

export function drawSaltLick(g: Painter, x: number, y: number) {
  g.a(x - 1, y + 7, 12, 2, 0, 0, 0, 0.2);
  g.px(x, y + 2, 10, 5, "#b9b6a4"); // the block
  g.px(x, y + 2, 10, 1, "#d8d5c4");
  g.px(x, y + 7, 10, 1, "#8d8a7c");
  g.px(x - 1, y + 6, 12, 2, "#5b4a30"); // the trough it sits in
}

/** the pony and cart, standing by the croft on a day you don't go to market */
export function drawParkedCart(g: Painter, x: number, y: number, time: number) {
  g.px(x, y, 26, 9, C.bark);
  g.px(x, y, 26, 2, "#6d5a3c");
  g.px(x + 2, y + 9, 7, 7, "#3f3527"); // wheels
  g.px(x + 17, y + 9, 7, 7, "#3f3527");
  g.px(x + 4, y + 12, 3, 1, "#7a6a4a");
  g.px(x + 19, y + 12, 3, 1, "#7a6a4a");
  g.px(x + 26, y + 2, 8, 2, C.bark); // shafts
  // the pony, dozing, with the odd flick of the tail
  const px0 = x + 34;
  g.px(px0, y - 2, 20, 9, "#6a4f33");
  g.px(px0 + 18, y - 8, 8, 7, "#6a4f33");
  g.px(px0 + 24, y - 4, 4, 3, "#4a3624");
  g.px(px0 + 18, y - 11, 3, 4, "#6a4f33");
  g.px(px0 + 23, y - 11, 3, 4, "#6a4f33");
  g.px(px0 + 2, y + 7, 3, 6, "#4a3624");
  g.px(px0 + 15, y + 7, 3, 6, "#4a3624");
  const flick = Math.sin(time / 800) > 0 ? 0 : 1;
  g.px(px0 - 3, y - 1 + flick, 4, 7, "#4a3624");
}

export function drawDyke(g: Painter, x0: number, y: number, len: number) {
  for (let x = x0; x < x0 + len; x += 5) {
    g.px(x, y, 5, 4, C.rock);
    g.px(x, y, 5, 1, C.rockLit);
    g.px(x + 2, y + 4, 4, 4, C.rockDark);
    g.px(x, y + 4, 2, 4, C.rock);
  }
}

/** wool sacks, stacked by the cart — how much is waiting to go to market */
export function drawWoolSacks(g: Painter, x: number, y: number, stone: number) {
  const n = Math.min(4, Math.ceil(stone / 12));
  for (let i = 0; i < n; i++) {
    const sx = x + (i % 2) * 9;
    const sy = y - Math.floor(i / 2) * 8;
    g.px(sx, sy, 8, 7, C.wool);
    g.px(sx, sy, 8, 2, shade(C.wool, 10));
    g.px(sx + 2, sy - 1, 4, 2, "#b8b4a2"); // the tied neck
  }
}
