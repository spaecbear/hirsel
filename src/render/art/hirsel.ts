/**
 * "Hirsel" art pack — the default look.
 *
 * Ideas the original scene didn't have, and the reasons for them:
 *  - the croft is *in* the picture, and it gets built. Roof, hearth-smoke, byre
 *    and lit window all appear as you buy them, so the long goal is visible from
 *    the very first day instead of living in a shop list
 *  - each pasture is its own place: the low field has the loch and dykes, the
 *    hill slope has bracken and gorse, the corrie is scree and crag
 *  - sheep graze, lift their heads, and cast shadows; fleece changes their
 *    silhouette, so a matted flock reads at a glance
 *  - dithered skies and a proper dusk/dawn ramp, still strictly integer pixels
 */
import { clamp01, ease, type Painter } from "../painter";
import { drawMoonDisc, moonPos } from "../moon";
import { BREEDS } from "../../sim/config";
import { grade, isFullMoon, moonPhase, owns } from "../../sim/rules";
import type { GameState, Sheep, WeatherId } from "../../sim/types";
import type { ArtPack, Scene } from "./types";

const W = 480;
const H = 180;
const GROUND = 120;
const SHEP_X = 236;

/* ---------- palette ---------- */
const C = {
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

const SKY: Record<WeatherId, [string, string]> = {
  sun: ["#5f86923", "#8fb3b0"] as unknown as [string, string], // replaced below
  overcast: ["#3a4046", "#5c6167"],
  rain: ["#252c33", "#3c464e"],
  mist: ["#454b4a", "#697070"],
};
SKY.sun = ["#3f6a7e", "#87b0b4"];

/* ---------- helpers ---------- */
const wxOf = (st: GameState) => st.forecast[0];
const br = (s: Sheep) => BREEDS[s.breed] ?? BREEDS.blackface;
/** deterministic scatter, so the hillside doesn't crawl between frames */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ---------- sky and land ---------- */
function drawSky(g: Painter, st: GameState) {
  const [top, low] = SKY[wxOf(st)];
  // per-row dither, so the ramp reads as one sky rather than nine stripes
  for (let y = 0; y < 80; y++) {
    const mix = Math.pow(y / 79, 1.4);
    for (let x = 0; x < W; x += 2) {
      const t = ((x >> 1) & 1) + ((y & 1) << 1);
      g.px(x, y, 2, 1, t / 4 < mix ? low : top);
    }
  }
  if (wxOf(st) === "sun") {
    // low sun behind the ben, and a scatter of birds
    g.px(392, 22, 10, 10, "#f0d79a");
    g.px(390, 24, 14, 6, "#f0d79a");
    for (let i = 0; i < 5; i++) {
      const x = 60 + i * 37 + Math.round(Math.sin(i * 2.1) * 8);
      const y = 20 + Math.round(hash(i * 9) * 16);
      g.px(x, y, 3, 1, "#2c3a3a");
      g.px(x + 3, y - 1, 3, 1, "#2c3a3a");
    }
  }
}

/** the far ben: one big ridge with snow in the gullies */
function drawBen(g: Painter) {
  for (let x = 0; x < W; x += 2) {
    const y = 56 + Math.round(Math.sin(x / 96) * 16 + Math.sin(x / 23) * 3);
    g.px(x, y, 2, H - y, "#39434a");
    g.px(x, y, 2, 2, "#4a555c");
    if (hash(x) > 0.86 && y < 52) g.px(x, y + 2, 2, 3, "#8e9aa0");
  }
}

/** the near hills, coloured by the pasture you are standing on */
function drawHills(g: Painter, st: GameState) {
  const at = st.at;
  const base = at === 2 ? "#3d4438" : at === 1 ? "#3a4a30" : "#38492f";
  for (let x = 0; x < W; x += 2) {
    const y = 72 + Math.round(Math.sin(x / 61 + at) * 11 + Math.sin(x / 17) * 2);
    g.px(x, y, 2, H - y, base);
    g.px(x, y, 2, 1, shade(base, 14));
    // heather and bracken flecks on the slope
    const h = hash(x + at * 100);
    if (h > 0.93) g.px(x, y + 4 + Math.round(h * 10), 2, 2, C.heatherDim);
    else if (h > 0.88) g.px(x, y + 6 + Math.round(h * 12), 2, 2, "#6a6534");
  }
}

function drawGround(g: Painter, st: GameState, time: number) {
  const p = st.pastures[st.at];
  const lush = p.grass / p.cap;
  const pal = lush > 0.45 ? C.turf : C.turfDry;
  const mix = clamp01((lush - 0.15) / 0.7);

  g.dither(0, GROUND - 6, W, 8, pal[0], pal[1], mix);
  g.px(0, GROUND + 2, W, H - GROUND - 2, pal[1]);
  // turf texture: tufts thicker where the grass is thicker
  for (let x = 0; x < W; x += 3) {
    const h = hash(x * 1.7 + st.at * 31);
    if (h < 0.25 + mix * 0.4) {
      const y = GROUND + 2 + Math.round(hash(x) * (H - GROUND - 8));
      g.px(x, y, 2, 2, pal[2]);
      if (h > 0.62) g.px(x, y - 2, 1, 2, shade(pal[2], 12));
    }
  }
  g.px(0, GROUND - 7, W, 1, C.turfDark);

  if (st.at === 0) {
    // the low field: the loch behind the dyke, and a stone wall along the march
    g.px(0, 96, 172, 14, C.water);
    for (let x = 0; x < 172; x += 4) {
      const t = Math.sin(x / 9 + time / 900) > 0.3 ? 1 : 0;
      if (t) g.px(x, 99 + ((x / 4) % 3), 3, 1, C.waterLit);
    }
    drawDyke(g, 0, 104, 480);
  } else if (st.at === 1) {
    drawDyke(g, 0, 100, 300);
    // gorse bushes along the slope
    for (let i = 0; i < 5; i++) {
      const x = 24 + i * 96;
      g.px(x, 104, 14, 8, "#3f5a2e");
      g.px(x + 2, 102, 10, 4, "#4a6a35");
      for (let j = 0; j < 4; j++) g.px(x + 2 + j * 3, 103 + ((j % 2) * 3), 2, 2, C.gorse);
    }
  } else {
    // the corrie: scree, boulders and a crag lip
    for (let x = 0; x < W; x += 4) {
      const y = 96 + Math.round(Math.sin(x / 33) * 4);
      g.px(x, y, 4, GROUND - 6 - y, C.rockDark);
      if (hash(x * 3) > 0.7) g.px(x, y, 3, 2, C.rock);
    }
    for (let i = 0; i < 9; i++) {
      const x = 12 + i * 52 + Math.round(hash(i) * 14);
      const y = GROUND + 4 + Math.round(hash(i * 5) * 22);
      const w = 6 + Math.round(hash(i * 7) * 6);
      g.px(x, y, w, 5, C.rock);
      g.px(x, y, w, 2, C.rockLit);
      g.px(x, y + 5, w, 1, C.rockDark);
    }
  }
}

function drawDyke(g: Painter, x0: number, y: number, len: number) {
  for (let x = x0; x < x0 + len; x += 5) {
    g.px(x, y, 5, 4, C.rock);
    g.px(x, y, 5, 1, C.rockLit);
    g.px(x + 2, y + 4, 4, 4, C.rockDark);
    g.px(x, y + 4, 2, 4, C.rock);
  }
}

/* ---------- the croft, which you build ---------- */
function drawCroft(g: Painter, st: GameState, night: number, time: number) {
  const x = 16;
  const y = 74;
  const roofed = owns(st, "roof");
  const hearth = owns(st, "hearth");
  const byre = owns(st, "byre");

  if (byre) {
    // stone byre alongside
    g.px(x + 60, y + 18, 34, 22, "#5c6154");
    for (let i = 0; i < 34; i += 4) g.px(x + 60 + i, y + 18 + ((i / 4) % 2 ? 4 : 0), 3, 3, "#6d7263");
    g.px(x + 58, y + 14, 38, 5, C.slate);
    g.px(x + 72, y + 28, 9, 12, "#2c2a22");
  }

  // walls
  g.px(x, y + 10, 56, 30, "#6a6a5c");
  for (let i = 0; i < 56; i += 5) {
    g.px(x + i, y + 12 + ((i / 5) % 2 ? 3 : 0), 4, 3, "#5c5c50");
  }
  // roof: thatch until slated
  if (roofed) {
    for (let i = 0; i < 9; i++) {
      g.px(x - 3 + i * 3, y + 10 - i, 62 - i * 6 + 6, 2, i % 2 ? C.slate : shade(C.slate, 10));
    }
    g.px(x - 4, y + 9, 64, 2, "#39404a");
  } else {
    for (let i = 0; i < 9; i++) {
      g.px(x - 2 + i * 3, y + 10 - i, 60 - i * 6 + 4, 2, i % 2 ? C.thatch : shade(C.thatch, -14));
    }
    // it has been letting water in since before you came
    g.px(x + 22, y + 3, 8, 6, "#4a4028");
  }
  // chimney
  g.px(x + 40, y - 4, 8, 14, "#5c5c50");
  g.px(x + 40, y - 5, 8, 2, C.rockLit);
  // door and window
  g.px(x + 8, y + 26, 10, 14, "#3a3122");
  const lit = hearth && night > 0.25;
  g.px(x + 30, y + 20, 10, 9, lit ? "#f0c86a" : "#2a3038");
  g.px(x + 34, y + 20, 2, 9, lit ? "#c98a2e" : "#20262d");
  if (lit) g.a(x + 26, y + 18, 18, 14, 240, 200, 106, 0.14 * night);

  if (hearth) {
    // peat smoke, always going
    for (let i = 0; i < 7; i++) {
      const t = ((time / 2600) + i / 7) % 1;
      const sway = Math.sin(t * 6 + i) * 5;
      g.a(x + 42 + sway, y - 6 - t * 34, 2 + t * 4, 2 + t * 4, 198, 200, 190, 0.4 * (1 - t));
    }
  }
}

/* ---------- sprites ---------- */
/** TOD cheat — set once per frame, read by the sprite routines */
let INV = false;

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
function drawRam(g: Painter, x: number, y: number, run: number) {
  const leg = Math.sin(run * Math.PI * 14) > 0 ? 0 : 2;
  g.px(x + 2, y + 8, 3, 5, "#3a352c");
  g.px(x + 9, y + 8 - leg, 3, 5, "#3a352c");
  g.px(x + 6, y + 8 + leg, 3, 5, "#2e2a22");
  g.px(x + 13, y + 8, 3, 5, "#2e2a22");
  g.px(x, y, 18, 9, "#ddd9c8");
  g.px(x + 1, y - 1, 16, 2, "#efeada");
  g.px(x + 17, y + 1, 7, 6, "#2b2b26");
  g.px(x + 22, y + 3, 1, 1, "#e8d27a");
  // horns
  g.px(x + 17, y - 3, 7, 2, "#b8a878");
  g.px(x + 23, y - 2, 2, 4, "#b8a878");
  g.px(x + 15, y - 2, 2, 3, "#b8a878");
}

function drawSheep(g: Painter, x: number, y: number, s: Sheep, o: { shorn?: boolean; graze?: boolean; run?: number; flip?: boolean } = {}) {
  if (INV) return drawFoxBeast(g, x, y, s, o);
  const gr = grade(o.shorn ? 0 : s.fleece);
  const b = br(s);
  const bulk = Math.round(Math.min(6, gr.v * 0.55));
  const w = 11 + bulk;
  const h = 7 + Math.round(bulk * 0.5);
  const wool = gr.label === "matted" ? "#a49b80" : b.wool;
  const dir = o.flip ? -1 : 1;
  const legPhase = o.run ? (Math.sin(o.run * Math.PI * 12) > 0 ? 1 : -1) : 0;

  // shadow
  g.a(x, y + h + 3, w, 2, 0, 0, 0, 0.22);
  // legs
  g.px(x + 2, y + h, 2, 4 - Math.abs(legPhase), "#3a352c");
  g.px(x + w - 5, y + h, 2, 4 - Math.abs(legPhase), "#3a352c");
  g.px(x + 4, y + h, 2, 4 + legPhase, "#2e2a22");
  g.px(x + w - 7, y + h, 2, 4 - legPhase, "#2e2a22");
  // fleece body, lit along the top
  g.px(x, y + 1, w, h - 1, wool);
  g.px(x + 1, y, w - 2, 2, shade(wool, 12));
  g.px(x, y + h - 1, w, 1, shade(wool, -26));
  // curls
  for (let i = 1; i < w - 1; i += 3) g.px(x + i, y + 2 + ((i / 3) % 2), 2, 1, shade(wool, -14));
  // head
  const hx = dir > 0 ? x + w - 2 : x - 4;
  const hy = o.graze ? y + h - 2 : y - 3;
  g.px(hx, hy, 6, 5, b.face);
  g.px(hx + (dir > 0 ? 4 : 0), hy + 2, 2, 2, shade(b.face, 24));
  g.px(hx + (dir > 0 ? 1 : 3), hy + 1, 1, 1, "#0d0d0b");
  g.px(hx + (dir > 0 ? 0 : 4), hy - 2, 2, 2, b.face); // ear
  // tail
  g.px(dir > 0 ? x - 2 : x + w, y + 2, 2, 3, wool);
}

/**
 * Set from the state each frame: once the pelt is taken he wears it, in every
 * scene, for the rest of the run. It is the one permanent visible reward in
 * the game — the croft is a building, this is on his back.
 */
let PELT = false;

/** likewise: he has no crook in his hand until he has bought one */
let HAS_CROOK = false;

/** the wolf skin: hood with the ears still on it, mantle over the shoulders, brush down the back */
function drawPelt(g: Painter, x: number, y: number) {
  // mantle across the shoulders, over the coat
  g.px(x - 2, y + 5, 16, 7, "#3a3d47");
  g.px(x - 2, y + 5, 16, 2, "#4a4e5a"); // moonlit along the top
  g.px(x - 2, y + 11, 16, 1, "#2a2d36");
  // the brush, hanging down his back
  g.px(x - 4, y + 10, 4, 8, "#3a3d47");
  g.px(x - 4, y + 17, 4, 3, "#8f939c");
  // the head worn as a hood, ears still on it
  g.px(x + 1, y - 5, 11, 5, "#3a3d47");
  g.px(x + 1, y - 5, 11, 1, "#4a4e5a");
  g.px(x + 1, y - 8, 3, 4, "#3a3d47");
  g.px(x + 8, y - 8, 3, 4, "#3a3d47");
  g.px(x + 2, y - 7, 1, 2, "#22252f"); // the hollows where the ears fold
  g.px(x + 9, y - 7, 1, 2, "#22252f");
}

function drawShepherd(g: Painter, x: number, y: number, o: { crook?: boolean; arm?: number; walk?: number; sit?: boolean } = {}) {
  const step = o.walk ? (Math.sin(o.walk * Math.PI * 8) > 0 ? 1 : 0) : 0;
  g.a(x - 1, y + 26, 14, 2, 0, 0, 0, 0.25);
  // boots
  g.px(x + 1, y + 22, 4, 4, "#33291f");
  g.px(x + 7, y + 22 - step, 4, 4, "#33291f");
  // breeks
  g.px(x + 1, y + 15, 10, 8, "#4b4632");
  // coat
  g.px(x, y + 6, 12, 11, "#4a5540");
  g.px(x, y + 6, 12, 2, "#5a6650");
  g.px(x + 5, y + 8, 2, 9, "#3b4433"); // buttoned seam
  // scarf
  g.px(x + 1, y + 5, 10, 2, "#8a4a3c");
  // head
  g.px(x + 2, y, 8, 6, "#c9a583");
  g.px(x + 3, y + 2, 1, 1, "#26201a");
  g.px(x + 7, y + 2, 1, 1, "#26201a");
  g.px(x + 2, y - 3, 9, 4, "#2f3327"); // bunnet
  g.px(x + 9, y - 2, 3, 2, "#2f3327");
  // the pelt goes on over the coat and the bunnet, under the arm and crook
  if (PELT) drawPelt(g, x, y);
  // arm
  if (o.arm !== undefined) g.px(x + 10, y + 8 + o.arm, 4, 3, "#c9a583");
  if (o.crook && HAS_CROOK) {
    for (let i = 0; i < 11; i++) g.px(x + 13, y + 1 + i * 2, 2, 2, "#6b5433");
    g.px(x + 11, y - 1, 4, 2, "#6b5433");
  }
}

/** tricolour sheltie — must stay readable at night */
function drawDog(g: Painter, x: number, y: number, run: number) {
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
function drawFox(g: Painter, x: number, y: number, run: number, facing: 1 | -1 = 1) {
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

function drawWolfBeast(g: Painter, x: number, y: number, run: number, body = 1, eyeGlow = 1) {
  const leg = Math.sin(run * Math.PI * 14) > 0 ? 0 : 3;
  const p = (dx: number, dy: number, w: number, h: number, c: [number, number, number], a = body) =>
    g.a(x + dx, y + dy, w, h, c[0], c[1], c[2], a);

  if (body > 0.02) {
    p(37, -1, 12, 5, WOLF_BODY); // brush
    p(11, 1, 26, 11, WOLF_BODY); // barrel
    p(11, 1, 26, 2, WOLF_SPINE); // moonlight along the back
    // fore legs under the head, hind legs under the tail
    p(13, 11, 4, 9, WOLF_DARK);
    p(19, 11 - leg, 4, 9, WOLF_DARK);
    p(27, 11 + leg, 4, 12, WOLF_LEG);
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

/* ---------- weather overlays ---------- */
function drawWeather(g: Painter, st: GameState, time: number) {
  const w = wxOf(st);
  if (w === "rain") {
    g.cx.fillStyle = "rgba(158,186,204,.34)";
    for (let i = 0; i < 150; i++) {
      const x = (i * 37 + time * 0.3) % W;
      const y = (i * 53 + time * 0.75) % H;
      g.cx.fillRect(x | 0, y | 0, 1, 6);
    }
    // splashes on the turf
    for (let i = 0; i < 22; i++) {
      const x = (i * 71 + Math.floor(time / 120) * 53) % W;
      g.a(x, GROUND + 4 + ((i * 13) % 40), 2, 1, 190, 210, 220, 0.3);
    }
  }
  if (w === "mist") {
    for (let b = 0; b < 4; b++) {
      const y = 58 + b * 22 + Math.sin(time / (900 + b * 200)) * 3;
      g.a(0, y, W, 14 + b * 3, 206, 210, 205, 0.13 + b * 0.03);
    }
  }
  if (w === "overcast") g.a(0, 0, W, H, 90, 96, 104, 0.08);
  if (w === "sun") g.a(0, 0, W, H, 240, 214, 150, 0.05);
}

/** dusk → night → dawn, with the moon at its true phase on its arc */
function drawNight(g: Painter, st: GameState, amount: number, time: number, dayOffset = 0) {
  if (amount <= 0) return;
  g.a(0, 0, W, H, 10, 13, 24, amount * 0.88);
  if (amount < 0.3) return;
  const a = (amount - 0.3) / 0.7;
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % W;
    const y = (i * 41) % 62;
    const tw = Math.sin(time / 340 + i) > 0 ? 1 : 0.45;
    g.a(x, y, 2, 2, 220, 225, 240, a * tw * 0.9);
  }
  const day = st.day + dayOffset;
  const idx = moonPhase(day);
  const pos = moonPos(idx, W);
  drawMoonDisc(g, pos.x | 0, pos.y | 0, isFullMoon(day) ? 10 : 8, idx, a);
}

/* ---------- flock layout ---------- */
function sheepHome(i: number) {
  const row = i % 3;
  const col = Math.floor(i / 3);
  return {
    x: 22 + col * 74 + row * 21,
    y: GROUND + 6 + row * 15,
  };
}

/* ---------- set pieces ---------- */
function setSheep(g: Painter, st: GameState, s: Scene, shepDrawn: { dog: boolean }) {
  const k = s.anim;
  const p = s.p;
  st.flock.slice(0, 15).forEach((sh, i) => {
    const h = sheepHome(i);
    let x = h.x;
    let y = h.y;
    let shorn = false;
    let run = 0;
    let graze = Math.sin(s.time / 1400 + i * 2) > 0;
    if (k === "gather") {
      const e = ease(clamp01(p * 1.3));
      x = h.x + (SHEP_X - 40 + (i % 5) * 16 - h.x) * e;
      y = h.y + (GROUND + 18 - h.y) * e;
      run = p;
      graze = false;
    }
    if (k === "move") {
      x = h.x - (1 - ease(p)) * 170;
      run = p;
      graze = false;
    }
    if (k === "shear") {
      const turn = i / Math.max(1, st.flock.length);
      shorn = sh.fleece === 0 && p > turn * 0.7;
      if (Math.abs(p - turn * 0.7) < 0.08) y = h.y - 2;
      graze = false;
    }
    if (k === "music") {
      y = h.y - Math.abs(Math.sin(p * Math.PI * 3 + i)) * 3;
      graze = false;
    }
    if (k === "tend") graze = false;
    drawSheep(g, x, y, sh, { shorn, graze, run, flip: i % 4 === 0 });
  });
  if (shepDrawn.dog) drawDog(g, SHEP_X - 34, GROUND + 6 + (Math.sin(s.time / 700) > 0 ? 0 : 1), 0);
}

function shearScene(g: Painter, p: number) {
  const y = GROUND - 26;
  drawShepherd(g, SHEP_X, y, { arm: Math.sin(p * Math.PI * 10) > 0 ? 0 : 2 });
  const open = Math.sin(p * Math.PI * 12) > 0 ? 2 : 0;
  g.px(SHEP_X + 14, y + 8 - open, 7, 2, "#b9bcae");
  g.px(SHEP_X + 14, y + 12 + open, 7, 2, "#cdd0c2");
  for (let i = 0; i < 16; i++) {
    const t = (p * 1.5 + i / 16) % 1;
    g.a(SHEP_X + 16 + i * 8 - t * 12, GROUND - 4 - t * 40, 3, 3, 221, 217, 200, 1 - t);
  }
}

function marketScene(g: Painter, p: number) {
  const x = -80 + p * (W + 160);
  const y = GROUND - 26;
  drawShepherd(g, SHEP_X, y, { crook: true, walk: p });
  // pony
  g.px(x, GROUND - 4, 22, 10, "#6a4f33");
  g.px(x + 20, GROUND - 10, 9, 8, "#6a4f33");
  g.px(x + 27, GROUND - 6, 4, 3, "#4a3624");
  g.px(x + 20, GROUND - 13, 3, 4, "#6a4f33");
  g.px(x + 25, GROUND - 13, 3, 4, "#6a4f33");
  const step = Math.sin(p * 26) > 0 ? 0 : 2;
  g.px(x + 2, GROUND + 6, 3, 6 - step, "#4a3624");
  g.px(x + 16, GROUND + 6, 3, 4 + step, "#4a3624");
  // cart of sacks
  g.px(x - 34, GROUND - 6, 32, 12, C.bark);
  g.px(x - 30, GROUND - 14, 11, 9, C.wool);
  g.px(x - 17, GROUND - 16, 12, 11, C.wool);
  const spin = Math.sin(p * 22) > 0;
  g.px(x - 30, GROUND + 6, 8, 8, "#3f3527");
  g.px(x - 12, GROUND + 6, 8, 8, "#3f3527");
  g.px(x - 28 + (spin ? 0 : 3), GROUND + 9, 4, 1, "#7a6a4a");
  g.px(x - 10 + (spin ? 0 : 3), GROUND + 9, 4, 1, "#7a6a4a");
  if (p > 0.55) {
    for (let i = 0; i < 8; i++) {
      const t = (p - 0.55) / 0.45;
      g.px(SHEP_X - 34 + i * 11, GROUND + 4 - Math.sin(t * Math.PI) * (28 + i * 3), 4, 4, C.gorse);
    }
  }
}

function pipeScene(g: Painter, p: number, time: number) {
  const y = GROUND - 22;
  // sat on the dyke
  drawDyke(g, SHEP_X - 14, GROUND + 4, 40);
  drawShepherd(g, SHEP_X, y, {});
  g.px(SHEP_X + 10, y + 5, 4, 2, "#6b5433");
  g.px(SHEP_X + 14, y + 3, 3, 4, "#4a3a24");
  g.px(SHEP_X + 15, y + 2, 2, 1, "#e0a33c");
  for (let i = 0; i < 12; i++) {
    const t = (p * 1.1 + i / 12) % 1;
    const sway = Math.sin(t * 7 + i + time / 900) * 8;
    g.a(SHEP_X + 16 + sway, y - t * 52, 2 + t * 5, 2 + t * 5, 214, 214, 204, 0.5 * (1 - t));
  }
}

function musicScene(g: Painter, p: number) {
  const y = GROUND - 26;
  drawShepherd(g, SHEP_X, y, { arm: 0 });
  g.px(SHEP_X + 10, y + 8, 10, 9, "#7d4a4a");
  g.px(SHEP_X + 12, y - 4, 2, 13, "#6b5433");
  g.px(SHEP_X + 16, y - 8, 2, 17, "#6b5433");
  g.px(SHEP_X + 20, y - 2, 2, 11, "#6b5433");
  g.px(SHEP_X + 12, y - 6, 2, 2, "#c9c3ae");
  g.px(SHEP_X + 16, y - 10, 2, 2, "#c9c3ae");
  for (let i = 0; i < 6; i++) {
    const t = (p * 1.4 + i / 6) % 1;
    const r = t * 150;
    const al = 0.5 * (1 - t);
    g.a(SHEP_X + 6 - r, y + 4, 3, 3, 138, 106, 156, al);
    g.a(SHEP_X + 22 + r, y + 4, 3, 3, 138, 106, 156, al);
    g.a(SHEP_X + 14, y + 4 - r * 0.4, 3, 3, 138, 106, 156, al);
  }
}

function tendScene(g: Painter, p: number) {
  const y = GROUND - 20;
  drawShepherd(g, SHEP_X, y, { arm: 4 });
  g.px(SHEP_X + 12, y + 13, 5, 3, "#c9a583");
  for (let i = 0; i < 6; i++) {
    const t = (p * 1.6 + i / 6) % 1;
    g.a(SHEP_X + 4 + i * 7, y + 8 - t * 26, 2, 2, 125, 154, 85, 0.7 * (1 - t));
  }
}

function muckScene(g: Painter, p: number) {
  const x = 24 + ease(p) * (W - 110);
  drawShepherd(g, SHEP_X, GROUND - 26, { walk: p });
  g.px(x, GROUND - 2, 24, 10, "#5b4a30");
  g.px(x + 3, GROUND - 9, 17, 8, "#3f3324");
  g.px(x + 2, GROUND + 8, 7, 7, "#3f3527");
  for (let i = 0; i < 18; i++) {
    const t = (p * 2 + i / 18) % 1;
    g.px(x - t * 44 + i * 3, GROUND - Math.sin(t * Math.PI) * 15, 3, 3, t < 0.5 ? "#4a3a24" : "#6d8a4b");
  }
  for (let i = 0; i < Math.floor(p * 16); i++) g.px(26 + i * 28, GROUND + 14, 3, 6, "#8fae5f");
}

function buySheepScene(g: Painter, st: GameState, p: number, breed?: string) {
  const x = -24 + ease(clamp01(p * 1.2)) * (SHEP_X - 50);
  drawShepherd(g, SHEP_X, GROUND - 26, { crook: true });
  // she is not in the flock yet, so her breed rides along with the animation
  const last = st.flock[st.flock.length - 1];
  const s: Sheep = { id: -1, fleece: 1, breed: (breed as Sheep["breed"]) ?? last?.breed ?? "blackface", age: 0 };
  drawSheep(g, x, GROUND + 8 - Math.abs(Math.sin(p * Math.PI * 7)) * 2, s, { run: p });
  if (p > 0.7) {
    for (let i = 0; i < 5; i++) {
      const t = (p - 0.7) / 0.3;
      g.a(x + 4 + i * 6, GROUND - t * 20, 2, 2, 224, 163, 60, 0.6 * (1 - t));
    }
  }
}

function gatherScene(g: Painter, st: GameState, p: number) {
  drawShepherd(g, SHEP_X, GROUND - 26 + (Math.sin(p * Math.PI * 4) > 0 ? 0 : 1), { crook: true, walk: p });
  if (owns(st, "dog")) drawDog(g, SHEP_X - 70 + ease(p) * 80, GROUND + 10, p);
}

function foxRaidScene(g: Painter, st: GameState, p: number, time: number) {
  drawNight(g, st, 0.95, time);
  const dog = owns(st, "dog");
  const outbound = p < 0.55;
  const fx = outbound ? -34 + (p / 0.55) * (W * 0.55) : W * 0.55 - ((p - 0.55) / 0.45) * (W * 0.8);
  const fy = GROUND + 4 + Math.sin(p * Math.PI * 6) * 2;

  st.flock.slice(0, 12).forEach((s, i) => {
    const h = sheepHome(i);
    const flee = Math.max(0, 1 - Math.abs(h.x - fx) / 130) * ease(clamp01(p * 1.6));
    drawSheep(g, h.x + (h.x < fx ? -1 : 1) * flee * 40, h.y - flee * 4, s, { run: flee, flip: h.x > fx });
  });

  // it turns round when it heads back up the hill, carrying one
  if (INV) drawRam(g, fx, fy - 2, p);
  else drawFox(g, fx, fy, p, outbound ? 1 : -1);
  if (!outbound) g.px(fx + 1, fy + 1, 8, 5, INV ? "#b4472c" : "#cfcab8");

  if (dog) {
    const dx = 44 + ease(clamp01(p * 1.1)) * (W * 0.45);
    drawDog(g, dx, GROUND + 8, p);
    if (p > 0.6) {
      for (let i = 0; i < 5; i++) {
        const t = (p - 0.6) / 0.4;
        g.a(dx + 22 + i * 8, GROUND - t * 16, 2, 2, 240, 236, 224, 0.5 * (1 - t));
      }
    }
  }
  drawShepherd(g, SHEP_X, GROUND - 24, { crook: true });
}

/** six-second set piece: moon, skyline, gold eyes, raised blade, white clash, the pelt */
function wolfScene(g: Painter, st: GameState, p: number, armed: boolean) {
  g.px(0, 0, W, H, "#070a12");
  for (let i = 0; i < 55; i++) g.a((i * 83) % W, (i * 29) % 70, 2, 2, 215, 220, 240, 0.65);
  // huge low moon
  drawMoonDisc(g, 300, 40, 26, 4, 1);
  for (let x = 0; x < W; x += 2) {
    const y = 66 + Math.round(Math.sin((x / W) * 3.2) * 15 + Math.sin(x / 19) * 2);
    g.px(x, y, 2, H - y, "#0f1320");
    g.px(x, y, 2, 1, "#1b2233");
  }
  g.px(0, GROUND - 2, W, H - GROUND + 2, "#141a26");

  const sx = 120;
  const sy = GROUND - 28;

  /*
   * The entrance. Nothing is on the skyline but two gold eyes, which open,
   * hold, and blink once. Only then does the rest of him fade up around them
   * and start moving. He waits where he is while the eyes are all there is —
   * a shape that slid downhill invisibly would give the game away.
   */
  const EYES_OPEN = 0.1; // eyes up
  const EYES_HOLD = 0.2; // ...and held, before the body arrives
  const BODY_IN = 0.34; // fully resolved
  const eyeGlow = clamp01(p / EYES_OPEN) * (Math.abs(p - 0.17) < 0.012 ? 0.15 : 1); // one blink
  const bodyAlpha = clamp01((p - EYES_HOLD) / (BODY_IN - EYES_HOLD));
  /** 0 until the eyes have had their moment, then he moves */
  const march = (end: number) => ease(clamp01((p - EYES_HOLD) / (end - EYES_HOLD)));

  if (!armed) {
    const wolfX = 330 - march(0.62) * 220;
    for (let i = 0; i < 9; i++) {
      if (p > 0.45 + i * 0.05) continue;
      const hx = 30 + i * 48;
      const run = ease(clamp01((p - EYES_HOLD) * 1.8)) * 80;
      drawSheep(g, hx - (hx < wolfX ? run : -run), GROUND + 8 - Math.abs(Math.sin(p * 9 + i)) * 3, { id: -1, fleece: 6, breed: "blackface", age: 0 }, { run: p, flip: hx > wolfX });
    }
    if (p > 0.6) drawSheep(g, 96, GROUND + 12, { id: -1, fleece: 6, breed: "blackface", age: 0 }, { graze: false });
    drawWolfBeast(g, wolfX, GROUND - 20, p, bodyAlpha, eyeGlow);
    drawShepherd(g, sx - 40 + Math.sin(p * Math.PI * 6) * 2, sy, { crook: true });
    if (p > 0.75) g.a(0, 0, W, H, 180, 71, 44, 0.22 * Math.sin(((p - 0.75) / 0.25) * Math.PI));
    return;
  }

  const stage = p < 0.34 ? 0 : p < 0.5 ? 1 : p < 0.62 ? 2 : 3;
  const wolfX = 330 - march(0.42) * 150;
  if (stage < 3) drawWolfBeast(g, wolfX, GROUND - 20, p, bodyAlpha, eyeGlow);

  drawShepherd(g, sx, sy, {});
  if (stage < 2) {
    // blade raised, catching the moon
    g.px(sx + 13, sy - 18, 3, 24, "#cdd3d8");
    g.px(sx + 13, sy - 18, 1, 24, "#f0f4f6");
    g.px(sx + 10, sy + 5, 9, 3, "#8a6a3c");
    if (stage === 1) for (let i = 0; i < 7; i++) g.a(sx + 13, sy - 20 - i * 3, 3, 2, 232, 236, 214, 0.6 - i * 0.08);
  } else {
    g.px(sx + 13, sy + 4, 26, 3, "#cdd3d8");
    g.px(sx + 10, sy + 2, 4, 8, "#8a6a3c");
  }

  if (stage === 2) {
    const t = (p - 0.5) / 0.12;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const d = t * 36;
      g.a(wolfX + 8 + Math.cos(a) * d, GROUND - 12 + Math.sin(a) * d, 3, 3, 232, 236, 214, 0.9 * (1 - t));
    }
    g.a(0, 0, W, H, 255, 255, 240, 0.6 * (1 - t));
  }

  if (stage === 3) {
    const t = (p - 0.62) / 0.38;
    // he puts it on here, and it is the same pelt he wears from now on
    PELT = true;
    drawShepherd(g, sx, sy, {});
    PELT = false;
    for (let i = 0; i < 12; i++) {
      const q = (t + i / 12) % 1;
      g.a(sx - 16 + i * 7, sy + 4 - q * 34, 3, 3, 138, 106, 156, 0.55 * (1 - q));
    }
  }
  void st;
}

/** the pub leaves the glen entirely — that is what makes £8 feel like an event */
function pubScene(g: Painter, p: number, time: number) {
  const inRoom = clamp01(p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1);
  g.a(0, 0, W, H, 20, 23, 15, inRoom);
  if (inRoom < 0.92) return;

  g.px(0, 0, W, H, "#2a2018");
  for (let x = 0; x < W; x += 28) g.px(x, 0, 3, H, "#221a13");
  for (let y = 0; y < H; y += 34) g.a(0, y, W, 1, 0, 0, 0, 0.16);
  // hearth
  g.px(26, 74, 62, 60, "#3a2c1e");
  g.px(32, 82, 50, 8, "#241a12");
  const flick = Math.sin(time / 130) * 3;
  g.px(38, 100, 40, 30, "#c07a24");
  g.px(44, 106 + flick, 28, 22, C.fire);
  g.px(50, 112 + flick, 16, 14, "#f0c86a");
  g.a(20, 66, 78, 74, 240, 180, 80, 0.12 + Math.sin(time / 200) * 0.03);
  // bar
  g.px(140, 92, W - 176, 11, "#4a3826");
  g.px(140, 92, W - 176, 2, "#5f4a32");
  g.px(140, 103, W - 176, 44, "#33261a");
  // bottles on a shelf
  for (let i = 0; i < 7; i++) g.px(300 + i * 14, 54, 5, 14, i % 2 ? "#3d5a4a" : "#5a4a2c");
  g.px(292, 68, 112, 3, "#4a3826");
  // the shepherd at the bar, back to us
  g.px(210, 58, 16, 38, "#4a5540");
  g.px(212, 50, 12, 8, "#2f3327");
  g.px(226, 70, 5, 12, "#c9a583");
  // the pint, filling
  const fill = clamp01((p - 0.3) / 0.4);
  g.px(244, 66, 16, 28, "#9aa3a5");
  g.px(246, 92 - fill * 24, 12, fill * 24, "#c98a2e");
  if (fill > 0.9) {
    g.px(246, 66, 12, 5, "#f2eddb");
    g.px(248, 64, 8, 3, "#f2eddb");
  }
  // blether from the corner
  for (let i = 0; i < 5; i++) {
    const t = (p * 1.3 + i / 5) % 1;
    g.a(330 + i * 15, 84 - t * 34, 3, 3, 224, 163, 60, 0.4 * (1 - t));
  }
}

/* ---------- the pack ---------- */
export const HIRSEL_ART: ArtPack = {
  id: "hirsel",
  name: "Hirsel",
  width: W,
  height: H,
  draw(g, s: Scene) {
    const st = s.state;
    const k = s.anim;
    const p = s.p;
    INV = s.inverse;
    // he is not wearing it during the fight — the set piece hands it to him
    PELT = owns(st, "pelt") && k !== "wolf";
    HAS_CROOK = owns(st, "crook");

    if (k === "pub") {
      // still draw the glen underneath so the fade has something to leave
      drawLand(g, s, 0);
      pubScene(g, p, s.time);
      return;
    }
    if (k === "fox") {
      drawLand(g, s, 0);
      foxRaidScene(g, st, p, s.time);
      return;
    }
    if (k === "wolf") return wolfScene(g, st, p, true);
    if (k === "wolflost") return wolfScene(g, st, p, false);

    const night = k === "sleep" ? Math.sin(p * Math.PI) : 0;
    drawLand(g, s, night);

    setSheep(g, st, s, { dog: owns(st, "dog") && k !== "sleep" && k !== "gather" && k !== "move" });

    const sy = GROUND - 26;
    if (k === "shear") shearScene(g, p);
    else if (k === "market") marketScene(g, p);
    else if (k === "pipe") pipeScene(g, p, s.time);
    else if (k === "music") musicScene(g, p);
    else if (k === "tend") tendScene(g, p);
    else if (k === "muck") muckScene(g, p);
    else if (k === "buysheep") buySheepScene(g, st, p, s.payload?.breed);
    else if (k === "gather") gatherScene(g, st, p);
    else if (k === "move") {
      drawShepherd(g, SHEP_X, sy, { crook: true, walk: p });
      if (owns(st, "dog")) drawDog(g, SHEP_X - 36 + Math.sin(p * Math.PI * 4) * 8, GROUND + 8, p);
    } else if (k === "sleep") {
      drawShepherd(g, SHEP_X, sy, {});
      // she stays visible through the night
      if (owns(st, "dog")) drawDog(g, SHEP_X - 32, GROUND + 6, 0);
    } else {
      drawShepherd(g, SHEP_X, sy + (Math.sin(s.time / 1600) > 0 ? 0 : 1), { crook: true });
    }

    drawWeather(g, st, s.time);
    if (night > 0) drawNight(g, st, night, s.time, 0);
  },
};

/** everything that is not a moving actor */
function drawLand(g: Painter, s: Scene, night: number) {
  const st = s.state;
  drawSky(g, st);
  drawBen(g);
  drawHills(g, st);
  drawGround(g, st, s.time);
  drawCroft(g, st, Math.max(night, 0), s.time);
}
