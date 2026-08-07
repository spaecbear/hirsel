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
import {
  C,
  SKY,
  drawDog,
  drawDyke,
  drawFox,
  drawParkedCart,
  drawRam,
  drawSaltLick,
  drawSheep,
  drawShepherd,
  drawWolfBeast,
  hash,
  isInverse,
  setSpriteState,
  shade,
} from "../sprites";
import { hasDog, isFullMoon, moonPhase, owns } from "../../sim/rules";
import type { GameState, Sheep } from "../../sim/types";
import type { ArtPack, Scene } from "./types";

const W = 480;
const H = 180;
const GROUND = 120;
const SHEP_X = 236;

/* ---------- palette ---------- */


/* ---------- helpers ---------- */
const wxOf = (st: GameState) => st.forecast[0];


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

/** the salt lick: a block set out on the turf for them to work at */



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
  if (hasDog(st)) drawDog(g, SHEP_X - 70 + ease(p) * 80, GROUND + 10, p);
}

function foxRaidScene(g: Painter, st: GameState, p: number, time: number) {
  drawNight(g, st, 0.95, time);
  const dog = hasDog(st);
  const outbound = p < 0.55;
  const fx = outbound ? -34 + (p / 0.55) * (W * 0.55) : W * 0.55 - ((p - 0.55) / 0.45) * (W * 0.8);
  const fy = GROUND + 4 + Math.sin(p * Math.PI * 6) * 2;

  st.flock.slice(0, 12).forEach((s, i) => {
    const h = sheepHome(i);
    const flee = Math.max(0, 1 - Math.abs(h.x - fx) / 130) * ease(clamp01(p * 1.6));
    drawSheep(g, h.x + (h.x < fx ? -1 : 1) * flee * 40, h.y - flee * 4, s, { run: flee, flip: h.x > fx });
  });

  // it turns round when it heads back up the hill, carrying one — which the
  // fox always did and the ram never did, since it took no facing at all
  const facing = outbound ? 1 : -1;
  if (isInverse()) drawRam(g, fx, fy - 2, p, facing);
  else drawFox(g, fx, fy, p, facing);
  if (!outbound) g.px(fx + 1, fy + 1, 8, 5, isInverse() ? "#b4472c" : "#cfcab8");

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
    setSpriteState({ kit: { pelt: true } });
    drawShepherd(g, sx, sy, {});
    setSpriteState({ kit: { pelt: false } });
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
  id: "retro",
  name: "Retro",
  width: W,
  height: H,
  draw(g, s: Scene) {
    const st = s.state;
    const k = s.anim;
    const p = s.p;
    setSpriteState({
      inverse: s.inverse,
      night: k === "sleep" ? ease(clamp01(p)) : k === "dawn" ? 1 - ease(clamp01(p)) : 0,
      kit: {
        // he is not wearing it during the fight — the set piece hands it to him
        pelt: owns(st, "pelt") && k !== "wolf",
        crook: owns(st, "crook"),
        boots: owns(st, "boots"),
        shears: owns(st, "shears"),
        lamp: owns(st, "lamp"),
        cart: owns(st, "cart"),
        collie: owns(st, "collie"),
        watch: owns(st, "watch"),
        oilskin: owns(st, "oilskin"),
        saltlick: owns(st, "saltlick"),
      },
    });

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

    // sleep takes the light down and leaves it down; dawn brings it back
    const night = k === "sleep" ? ease(clamp01(p)) : k === "dawn" ? 1 - ease(clamp01(p)) : 0;
    drawLand(g, s, night);

    setSheep(g, st, s, { dog: hasDog(st) && k !== "sleep" && k !== "gather" && k !== "move" });

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
      if (hasDog(st)) drawDog(g, SHEP_X - 36 + Math.sin(p * Math.PI * 4) * 8, GROUND + 8, p);
    } else if (k === "sleep" || k === "dawn") {
      drawShepherd(g, SHEP_X, sy, {});
      // she stays visible through the night
      if (hasDog(st)) drawDog(g, SHEP_X - 32, GROUND + 6, 0);
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
  // the cart is parked unless it is out on the road to market
  if (owns(st, "cart") && s.anim !== "market") drawParkedCart(g, 118, GROUND - 12, s.time);
  if (owns(st, "saltlick")) drawSaltLick(g, 350, GROUND + 20);
}
