/**
 * The glen: the full-screen scene you actually play in.
 *
 * Everything here is laid out from `layoutWorld` rather than fixed
 * coordinates, because the logical canvas is whatever shape the viewport is.
 * The same rectangles the art draws into are the ones the world UI hit-tests,
 * so the house you can see is exactly the house you can tap.
 *
 * The old build put the narration in a panel. Here it belongs to the sky:
 * lines drift up over the hill and fade, so the word of the glen is felt in
 * the place it is about instead of being read in a list.
 */
import { clamp01, ease, type Painter } from "../painter";
import { drawMoonDisc, moonPos } from "../moon";
import { boundsOf, layoutInterior, layoutWorld, type InteriorLayout, type WorldLayout } from "../layout";
import { driftFor, idleTick } from "../wander";
import { spinNow } from "../dog-spin";
import {
  TERRAIN,
  mix,
  drawBurn,
  drawCloudCap,
  drawBareGround,
  drawMottle,
  drawPools,
  drawHeather,
  drawLayeredRidges,
  drawScree,
  drawTerraces,
  drawTussocks,
} from "../terrain";
import {
  C,
  SKY,
  drawDog,
  drawDyke,
  drawFox,
  drawRam,
  drawSaltLick,
  drawSheep,
  drawShepherd,
  SHEPHERD_H,
  drawWolfBeast,
  drawWoolSacks,
  hash,
  isInverse,
  setSpriteState,
  shade,
} from "../sprites";
import { hasDog, isFullMoon, moonPhase, owns } from "../../sim/rules";
import type { GameState, Sheep } from "../../sim/types";
import type { ArtPack, Scene } from "./types";

const wxOf = (st: GameState) => st.forecast[0];

/* ================================================================== *
 * sky
 * ================================================================== */

/**
 * Flat bands with a dithered seam at each join. Shared by the glen and the
 * intro — the intro had its own copy of the old row-by-row dither, so the
 * sky the game opens on did not match the sky it then plays in.
 */
function paintSkyBands(g: Painter, W: number, height: number, top: string, low: string, bands = 6) {
  const bandH = height / bands;
  const tone = (i: number) => mix(top, low, i / (bands - 1));
  for (let i = 0; i < bands; i++) {
    const y0 = Math.round(i * bandH);
    const y1 = Math.round((i + 1) * bandH);
    g.px(0, y0, W, y1 - y0, tone(i));
  }
  for (let i = 1; i < bands; i++) {
    const y = Math.round(i * bandH);
    for (let x = 0; x < W; x++) {
      if ((x & 1) === 0) g.px(x, y - 1, 1, 1, tone(i));
      else g.px(x, y, 1, 1, tone(i - 1));
    }
  }
}

function drawSky(g: Painter, L: WorldLayout, st: GameState, night: number, time: number) {
  const [top, low] = SKY[wxOf(st)];
  const h = L.horizonY + 8;
  const wx = wxOf(st);

  /*
   * Solid bands with a dithered seam between them, rather than dithering the
   * whole sky. Mixing every row produced a field of horizontal dashes that
   * read as scan lines across the entire top of the screen — the noise was
   * louder than the picture, and it made the sky messages unreadable. Ordered
   * dither belongs at the joins, where it blends two flat colours; everywhere
   * else the colour should just be flat.
   */
  paintSkyBands(g, L.W, h, top, low);

  // cloud as shapes, not as texture laid over everything
  if (wx === "overcast" || wx === "rain") {
    const heavy = wx === "rain";
    for (let i = 0; i < 9; i++) {
      const drift = (time / (heavy ? 9000 : 14000) + i * 0.37) % 1.4;
      const cx = Math.round((1.4 - drift) * (L.W + 60)) - 30;
      const cy = Math.round(h * (0.12 + hash(i * 3) * 0.5));
      const cw = 26 + Math.round(hash(i * 5) * 44);
      const ch = 5 + Math.round(hash(i * 7) * 6);
      const body = mix(top, low, heavy ? 0.15 : 0.62);
      const lit = mix(body, "#c9cfd2", heavy ? 0.2 : 0.42);
      g.px(cx, cy, cw, ch, body);
      g.px(cx + 4, cy - 2, cw - 12, 2, body);
      g.px(cx + 4, cy - 2, cw - 16, 1, lit); // the lit top edge
      for (let x = 0; x < cw; x += 2) if (hash(x + i * 13) > 0.4) g.px(cx + x, cy + ch, 2, 1, body);
    }
  }

  if (wx === "sun" && night < 0.4) {
    const sx = Math.round(L.W * 0.76);
    const sy = Math.round(L.horizonY * 0.28);
    g.a(sx - 6, sy - 5, 21, 19, 240, 215, 154, 0.13);
    g.px(sx, sy, 9, 9, "#f5e3b4");
    g.px(sx - 2, sy + 2, 13, 5, "#f5e3b4");
    g.px(sx + 2, sy - 2, 5, 13, "#f5e3b4");
    for (let i = 0; i < 3; i++) {
      const wisp = Math.round(((time / 16000 + i * 0.4) % 1.3) * (L.W + 40)) - 20;
      const wy = Math.round(h * (0.2 + hash(i * 11) * 0.3));
      g.a(L.W - wisp, wy, 30 + i * 8, 2, 230, 236, 238, 0.16);
    }
  }

  if (wx === "mist") {
    // haar: flat and featureless, which is the character of it
    for (let b = 0; b < 3; b++) {
      const y = Math.round(h * (0.4 + b * 0.2) + Math.sin(time / (1400 + b * 400)) * 2);
      g.a(0, y, L.W, 8, 206, 210, 205, 0.1);
    }
  }

  if ((wx === "sun" || wx === "overcast") && night < 0.3) {
    for (let i = 0; i < 4; i++) {
      const drift = (time / 90 + i * 60) % (L.W + 40);
      const x = Math.round(L.W - drift);
      const y = Math.round(L.horizonY * (0.22 + hash(i * 7) * 0.4) + Math.sin(time / 700 + i) * 2);
      g.px(x, y, 3, 1, "#2c3a3a");
      g.px(x + 3, y - 1, 3, 1, "#2c3a3a");
    }
  }
}

/**
 * The far tops, which are a different distance in each place: the moor is
 * closed in by cloud-capped hills, the slope opens into ridge behind ridge,
 * and from the corrie the land has dropped away below you.
 */
function drawBen(g: Painter, L: WorldLayout, st: GameState, time: number) {
  const t = TERRAIN[st.at] ?? TERRAIN[1];
  const [, skyLow] = SKY[wxOf(st)];

  if (st.at === 1) {
    // ridge behind ridge, each one further into the haze
    drawLayeredRidges(g, L.W, L.horizonY, t.far, skyLow, 4);
    return;
  }

  const base = L.horizonY;
  const bulk = st.at === 2 ? 8 : 14; // from up high they are lower than you
  for (let x = 0; x < L.W; x += 2) {
    const y = base - Math.round(Math.sin(x / 61) * (bulk * 0.9) + Math.sin(x / 17) * 3 + bulk);
    g.px(x, y, 2, base - y + 2, t.far);
    g.px(x, y, 2, 2, shade(t.far, 16));
    if (hash(x) > 0.86) g.px(x, y + 2, 2, 3, "#8e9aa0");
  }

  // over the moor the cloud sits right down on the tops
  if (st.at === 0) drawCloudCap(g, L.W, base - bulk - 4, time);
}

/** the near band between skyline and field */
function drawHills(g: Painter, L: WorldLayout, st: GameState) {
  const at = st.at;
  const t = TERRAIN[at] ?? TERRAIN[1];

  if (at === 2) {
    // the corrie is stepped rock, not a grass slope
    drawTerraces(g, L.W, L.horizonY, L.groundY, t.hill);
    return;
  }

  for (let x = 0; x < L.W; x += 2) {
    const y = L.horizonY + Math.round(Math.sin(x / 47 + at) * 6 + Math.sin(x / 13) * 2);
    g.px(x, y, 2, L.groundY - y + 2, t.hill);
    g.px(x, y, 2, 1, shade(t.hill, 14));
    const h = hash(x + at * 100);
    // heather runs right up the slope; the moor is bracken and bog myrtle
    if (at === 1) {
      if (h > 0.86) g.px(x, y + 2 + Math.round(h * 10), 2, 2, h > 0.94 ? C.heather : C.heatherDim);
    } else if (h > 0.93) g.px(x, y + 3 + Math.round(h * 8), 2, 2, "#5d5a34");
  }
}

/* ================================================================== *
 * ground
 * ================================================================== */

function drawGround(g: Painter, L: WorldLayout, st: GameState, time: number) {
  const p = st.pastures[st.at];
  const t = TERRAIN[st.at] ?? TERRAIN[1];
  const lush = p.grass / p.cap;
  const pal = lush > 0.45 ? t.grass : t.dry;
  const mixAmt = clamp01((lush - 0.15) / 0.7);
  const h = L.H - L.groundY;

  g.dither(0, L.groundY, L.W, 6, pal[0], pal[1], mixAmt);
  g.px(0, L.groundY + 6, L.W, h, pal[1]);
  g.px(0, L.groundY - 1, L.W, 1, shade(pal[0], -20));

  drawMottle(g, L.W, L.groundY, L.H, pal);
  // the ground shows its bones as it is eaten down — the clearest signal
  // there is that a pasture needs mucking or leaving alone
  drawBareGround(g, L.W, L.groundY, L.H, lush);

  // the general scatter of the turf, before anything specific to the place
  for (let x = 0; x < L.W; x += 3) {
    const v = hash(x * 1.7 + st.at * 31);
    if (v < 0.22 + mixAmt * 0.4) {
      const y = L.groundY + 6 + Math.round(hash(x) * (h - 8));
      g.px(x, y, 2, 2, pal[2]);
      if (v > 0.62) g.px(x, y - 2, 1, 2, shade(pal[2], 12));
    }
  }

  if (st.at === 0) {
    // Rannoch Moor: a burn winding through tussocks and rushes
    drawBurn(g, L.W, L.groundY, L.H, time);
    drawTussocks(g, L.W, L.groundY, L.H, pal);
    drawPools(g, L.W, L.groundY, L.H);
  } else if (st.at === 1) {
    // the slope: heather banks, and a dyke running along the contour
    drawHeather(g, L.W, L.groundY, L.H, 1);
    drawDyke(g, 0, L.groundY + Math.round(h * 0.18), Math.round(L.W * 0.72));
  } else {
    // the corrie: gold grass over broken rock, with the crag lip behind
    drawScree(g, L.W, L.groundY, L.H);
    for (let i = 0; i < 5; i++) {
      const x = Math.round(hash(i * 31) * L.W);
      const y = L.groundY + 4 + Math.round(hash(i * 37) * (h - 10));
      g.px(x, y, 9, 2, shade(pal[2], 14)); // wind-combed tufts
      g.px(x + 2, y - 2, 5, 2, pal[2]);
    }
  }
}

/* ================================================================== *
 * the croft, which you build
 * ================================================================== */

function drawCroft(g: Painter, L: WorldLayout, st: GameState, night: number, time: number) {
  const { x, y } = L.croft;
  const roofed = owns(st, "roof");
  const hearth = owns(st, "hearth");
  const byre = owns(st, "byre");

  if (byre) {
    const b = L.byre;
    g.px(b.x, b.y + 8, b.w, b.h - 8, "#5c6154");
    for (let i = 0; i < b.w; i += 4) g.px(b.x + i, b.y + 10 + ((i / 4) % 2 ? 4 : 0), 3, 3, "#6d7263");
    g.px(b.x - 2, b.y + 4, b.w + 4, 5, C.slate);
    g.px(b.x + 13, b.y + 18, 9, b.h - 18, "#2c2a22");
  }

  // walls
  g.px(x, y + 12, 52, 32, "#6a6a5c");
  for (let i = 0; i < 52; i += 5) g.px(x + i, y + 14 + ((i / 5) % 2 ? 3 : 0), 4, 3, "#5c5c50");

  // roof: thatch until slated
  const roofC = roofed ? C.slate : C.thatch;
  for (let i = 0; i < 9; i++) {
    const w = 58 - i * 6;
    g.px(x - 3 + i * 3, y + 12 - i, Math.max(2, w), 2, i % 2 ? roofC : shade(roofC, roofed ? 10 : -14));
  }
  if (roofed) g.px(x - 4, y + 11, 60, 2, "#39404a");
  else g.px(x + 20, y + 5, 8, 6, "#4a4028"); // where it lets the water in

  // chimney
  g.px(x + 38, y - 2, 8, 14, "#5c5c50");
  g.px(x + 38, y - 3, 8, 2, C.rockLit);

  // door, and a window that is lit once there is a fire to light it
  g.px(x + 7, y + 30, 10, 14, "#3a3122");
  const lit = hearth && night > 0.2;
  g.px(x + 28, y + 24, 10, 9, lit ? "#f0c86a" : "#2a3038");
  g.px(x + 32, y + 24, 2, 9, lit ? "#c98a2e" : "#20262d");
  if (lit) g.a(x + 23, y + 21, 20, 16, 240, 200, 106, 0.16 * night);

  if (hearth) {
    for (let i = 0; i < 7; i++) {
      const t = (time / 2600 + i / 7) % 1;
      const sway = Math.sin(t * 6 + i) * 5;
      g.a(x + 40 + sway, y - 4 - t * 30, 2 + t * 4, 2 + t * 4, 198, 200, 190, 0.4 * (1 - t));
    }
  }

  // the ring, once bought: a lit lamp in the window on the road down
  if (owns(st, "ring") && night > 0.2) g.a(x + 46, y + 30, 3, 3, 232, 200, 120, 0.5 * night);
}

/* ================================================================== *
 * the market cart
 * ================================================================== */

function drawCart(g: Painter, L: WorldLayout, st: GameState, time: number) {
  const { x, y } = L.cart;
  // the cart bed and wheels
  g.px(x, y + 6, 30, 10, C.bark);
  g.px(x, y + 6, 30, 2, "#6d5a3c");
  g.px(x + 3, y + 16, 8, 8, "#3f3527");
  g.px(x + 20, y + 16, 8, 8, "#3f3527");
  g.px(x + 5, y + 19, 4, 2, "#7a6a4a");
  g.px(x + 22, y + 19, 4, 2, "#7a6a4a");
  // a canopy, so it reads as a stall you can trade at
  g.px(x - 2, y - 4, 34, 3, "#7d4a4a");
  for (let i = 0; i < 34; i += 6) g.px(x - 2 + i, y - 4, 3, 3, "#8f5a5a");
  g.px(x - 1, y - 4, 2, 10, C.bark);
  g.px(x + 29, y - 4, 2, 10, C.bark);
  // whatever wool is waiting to go
  if (st.wool > 0) drawWoolSacks(g, x + 4, y - 2, st.wool);
  // the pony, if he owns one, dozing in the shafts
  if (owns(st, "cart")) {
    const px0 = x + 34;
    g.px(px0, y + 2, 18, 8, "#6a4f33");
    g.px(px0 + 16, y - 3, 7, 6, "#6a4f33");
    g.px(px0 + 21, y + 1, 4, 3, "#4a3624");
    g.px(px0 + 16, y - 6, 3, 4, "#6a4f33");
    g.px(px0 + 20, y - 6, 3, 4, "#6a4f33");
    g.px(px0 + 2, y + 10, 3, 6, "#4a3624");
    g.px(px0 + 13, y + 10, 3, 6, "#4a3624");
    const flick = Math.sin(time / 800) > 0 ? 0 : 1;
    g.px(px0 - 3, y + 3 + flick, 4, 7, "#4a3624");
  }
}

/* ================================================================== *
 * weather and night
 * ================================================================== */

function drawWeather(g: Painter, L: WorldLayout, st: GameState, time: number) {
  const w = wxOf(st);
  if (w === "rain") {
    g.cx.fillStyle = "rgba(158,186,204,.32)";
    for (let i = 0; i < 120; i++) {
      const x = (i * 37 + time * 0.3) % L.W;
      const y = (i * 53 + time * 0.75) % L.H;
      g.cx.fillRect(x | 0, y | 0, 1, 5);
    }
    for (let i = 0; i < 18; i++) {
      const x = (i * 71 + Math.floor(time / 120) * 53) % L.W;
      g.a(x, L.groundY + 4 + ((i * 13) % Math.max(8, L.H - L.groundY - 6)), 2, 1, 190, 210, 220, 0.3);
    }
  }
  if (w === "mist") {
    for (let b = 0; b < 4; b++) {
      const y = L.horizonY - 10 + b * 14 + Math.sin(time / (900 + b * 200)) * 3;
      g.a(0, y, L.W, 12 + b * 3, 206, 210, 205, 0.12 + b * 0.03);
    }
  }
  if (w === "overcast") g.a(0, 0, L.W, L.H, 90, 96, 104, 0.07);
  if (w === "sun") g.a(0, 0, L.W, L.H, 240, 214, 150, 0.045);
}

function drawNight(g: Painter, L: WorldLayout, st: GameState, amount: number, time: number) {
  if (amount <= 0) return;
  g.a(0, 0, L.W, L.H, 10, 13, 24, amount * 0.86);
  if (amount < 0.28) return;
  const a = (amount - 0.28) / 0.72;
  for (let i = 0; i < 46; i++) {
    const x = (i * 97) % L.W;
    const y = (i * 41) % Math.max(20, L.horizonY);
    const tw = Math.sin(time / 340 + i) > 0 ? 1 : 0.45;
    g.a(x, y, 2, 2, 220, 225, 240, a * tw * 0.9);
  }
  const idx = moonPhase(st.day);
  const pos = moonPos(idx, L.W);
  drawMoonDisc(g, pos.x | 0, Math.round(pos.y * (L.horizonY / 70) + 6), isFullMoon(st.day) ? 10 : 8, idx, a);
}

/* ================================================================== *
 * the word of the glen, in the sky
 * ================================================================== */

/* ================================================================== *
 * the HUD
 * ================================================================== */

/** outline the thing you are about to act on */
function drawHighlight(g: Painter, L: WorldLayout, id: string, pulse: number) {
  const spot = L.hotspots.find((h) => h.id === id);
  if (!spot) return;
  const { x, y, w, h } = boundsOf(spot);
  const a = 0.25 + Math.sin(pulse / 200) * 0.12;
  for (let i = 0; i < w; i += 4) {
    g.a(x + i, y, 2, 1, 224, 163, 60, a);
    g.a(x + i, y + h - 1, 2, 1, 224, 163, 60, a);
  }
  for (let i = 0; i < h; i += 4) {
    g.a(x, y + i, 1, 2, 224, 163, 60, a);
    g.a(x + w - 1, y + i, 1, 2, 224, 163, 60, a);
  }
}

/* ================================================================== *
 * actors
 * ================================================================== */

function drawFlock(g: Painter, L: WorldLayout, s: Scene) {
  const st = s.state;
  const k = s.anim;
  const p = s.p;
  st.flock.slice(0, 24).forEach((sh, i) => {
    const home = L.flock[i];
    if (!home) return;
    /*
     * A standing flock read as furniture. Each beast wanders round its own
     * mark, and drifts a little towards him when he is near — they know who
     * brings the feed. It is presentation only: the sim never sees it.
     */
    const drift = driftFor(sh.id + 1, s.time, {
      dx: L.shepherd.x - home.x,
      dy: L.shepherd.y + 10 - home.y,
    });
    let x = home.x + drift.dx;
    let y = home.y + drift.dy;
    let shorn = false;
    let run = drift.moving ? s.time / 320 : 0;
    let graze = !drift.moving && Math.sin(s.time / 1400 + i * 2) > 0;
    let flip = drift.flip;

    /*
     * In a set piece they face the way the piece moves them. This used to be
     * `flip = i % 4 === 0` for every animation, so a flock being driven in
     * had a quarter of its number walking backwards.
     */
    if (k === "gather") {
      const e = ease(clamp01(p * 1.3));
      const target = L.shepherd.x - 20 + (i % 5) * 9;
      x = home.x + (target - home.x) * e;
      y = home.y + (L.shepherd.y + 14 - home.y) * e;
      run = p;
      graze = false;
      flip = target < home.x; // in towards him, from whichever side they were
    }
    if (k === "move") {
      x = home.x - (1 - ease(p)) * (L.W * 0.9);
      run = p;
      graze = false;
      flip = false; // driven up the hill, left to right
    }
    if (k === "shear") {
      const turn = i / Math.max(1, st.flock.length);
      shorn = sh.fleece === 0 && p > turn * 0.7;
      if (Math.abs(p - turn * 0.7) < 0.08) y -= 2;
      graze = false;
    }
    if (k === "music") {
      y -= Math.abs(Math.sin(p * Math.PI * 3 + i)) * 3;
      graze = false;
    }
    if (k === "tend") graze = false;
    // standing still in a set piece: stagger which way they look so the flock
    // does not read as a row of identical cut-outs
    if (k !== null && k !== "gather" && k !== "move") flip = i % 4 === 0;
    drawSheep(g, x, y, sh, { shorn, graze, run, flip });
  });
}

function drawActors(g: Painter, L: WorldLayout, s: Scene) {
  const st = s.state;
  const k = s.anim;
  const p = s.p;
  const sx = L.shepherd.x;
  const sy = L.shepherd.y;

  if (owns(st, "saltlick")) drawSaltLick(g, L.saltlick.x, L.saltlick.y);

  drawFlock(g, L, s);

  // the dog works the ground when there is work on
  if (hasDog(st)) {
    if (k === "gather") {
      // she goes out and round them, well ahead of him
      const dp = ease(clamp01(p * 1.35));
      drawDog(g, sx - 50 + dp * 74, sy + 16 + Math.sin(p * Math.PI * 2) * 4, p * 1.6, 0, 1);
    } else if (k === "move") {
      /*
       * She covers the ground twice over while he walks it once: out ahead,
       * back to chivvy the stragglers, out again. She was moving at exactly
       * his pace before, which made her look tied to his heel rather than
       * working.
       */
      const swing = Math.sin(p * Math.PI * 6);
      drawDog(g, sx - 30 + swing * 26, sy + 16, p * 2, 0, Math.cos(p * Math.PI * 6) < 0 ? -1 : 1);
    } else {
      // off the clock: she works the outside of the flock, laps and holds.
      // The layout works out where she is, so she can be tapped where she is
      // drawn — and only a sheltie turns, and only when you tap her.
      const spin = owns(st, "collie") ? 0 : spinNow(s.time);
      drawDog(g, L.dogAt.x, L.dogAt.y, L.dogAt.running && !spin ? s.time / 200 : 0, spin, L.dogAt.facing);
    }
  }

  switch (k) {
    case "shear": {
      drawShepherd(g, sx, sy, { arm: Math.sin(p * Math.PI * 10) > 0 ? 0 : 2 });
      const open = Math.sin(p * Math.PI * 12) > 0 ? 2 : 0;
      g.px(sx + 14, sy + 8 - open, 7, 2, "#b9bcae");
      g.px(sx + 14, sy + 12 + open, 7, 2, "#cdd0c2");
      for (let i = 0; i < 14; i++) {
        const t = (p * 1.5 + i / 14) % 1;
        g.a(sx + 12 + i * 6 - t * 10, sy - t * 30, 3, 3, 221, 217, 200, 1 - t);
      }
      break;
    }
    case "tend": {
      /*
       * One of them comes over and he goes down on his knees to her: feet,
       * fleece, eyes. It used to be him waving an arm at the middle distance,
       * which is a poor picture of the most careful thing you do all day.
       */
      const come = ease(clamp01(p / 0.32)); // she walks up
      const kneel = ease(clamp01((p - 0.2) / 0.2)); // he goes down to her
      const rise = ease(clamp01((p - 0.86) / 0.14)); // and back up at the end
      const down = Math.round((kneel - rise) * 9);
      const ewe = st.flock[0] ?? { id: -1, fleece: 6, breed: "blackface" as const, age: 0 };
      const ex = sx + 26 - come * 16;

      drawShepherd(g, sx, sy + down, { facing: 1, arm: 6 - down });
      // his hand out on her, checking her over
      const hand = Math.sin(p * Math.PI * 7) > 0 ? 0 : 1;
      g.px(sx + 15, sy + down + 12 + hand, 4, 3, "#c9a583");
      drawSheep(g, ex, L.shepherd.y + 12, ewe, { graze: false, flip: true, run: come < 1 ? p : 0 });
      // she is standing still for it once she is there
      if (come >= 1) {
        for (let i = 0; i < 4; i++) {
          const t = (p * 1.4 + i / 4) % 1;
          g.a(ex + 4 + i * 4, L.shepherd.y + 6 - t * 16, 2, 2, 125, 154, 85, 0.55 * (1 - t));
        }
      }
      break;
    }
    case "pipe": {
      drawShepherd(g, sx, sy, {});
      g.px(sx + 10, sy + 5, 4, 2, "#6b5433");
      g.px(sx + 14, sy + 3, 3, 4, "#4a3a24");
      g.px(sx + 15, sy + 2, 2, 1, C.gorse);
      for (let i = 0; i < 12; i++) {
        const t = (p * 1.1 + i / 12) % 1;
        const sway = Math.sin(t * 7 + i + s.time / 900) * 8;
        g.a(sx + 16 + sway, sy - t * 46, 2 + t * 5, 2 + t * 5, 214, 214, 204, 0.5 * (1 - t));
      }
      break;
    }
    case "music": {
      drawShepherd(g, sx, sy, { arm: 0 });
      if (owns(st, "fiddle")) {
        // under his chin, and the bow going
        const bow = Math.sin(p * Math.PI * 9) * 4;
        g.px(sx + 11, sy + 2, 9, 4, "#7a4a2c"); // the body of it
        g.px(sx + 11, sy + 2, 9, 1, "#94603c");
        g.px(sx + 19, sy + 3, 5, 2, "#6b4326"); // the neck
        g.px(sx + 23, sy + 2, 2, 3, "#4a2f1c"); // the scroll
        g.px(sx + 12, sy + 3, 7, 1, "#c9c3ae"); // strings
        g.px(sx + 10 + bow, sy, 14, 1, "#d8d3c2"); // the bow, sawing
        g.px(sx + 10 + bow, sy + 1, 14, 1, "#8a7a5c");
      } else {
        g.px(sx + 10, sy + 8, 10, 9, "#7d4a4a");
        g.px(sx + 12, sy - 4, 2, 13, "#6b5433");
        g.px(sx + 16, sy - 8, 2, 17, "#6b5433");
        g.px(sx + 12, sy - 6, 2, 2, "#c9c3ae");
        g.px(sx + 16, sy - 10, 2, 2, "#c9c3ae");
      }
      for (let i = 0; i < 6; i++) {
        const t = (p * 1.4 + i / 6) % 1;
        const r = t * (L.W * 0.5);
        const al = 0.5 * (1 - t);
        g.a(sx + 6 - r, sy + 4, 3, 3, 138, 106, 156, al);
        g.a(sx + 22 + r, sy + 4, 3, 3, 138, 106, 156, al);
        g.a(sx + 14, sy + 4 - r * 0.4, 3, 3, 138, 106, 156, al);
      }
      break;
    }
    case "build": {
      /*
       * Working on the croft: he stands at the house with his back to us,
       * and what he is putting up rises a course at a time. Drawn at the
       * croft rather than at his mark, because that is where the work is.
       */
      const bx = L.croft.x + L.croft.w + 2;
      const by = L.croft.y + 10;
      drawShepherd(g, bx, by, { arm: Math.sin(p * Math.PI * 12) > 0 ? 0 : 3, facing: -1 });
      // the hammer, and the stone or slate going on
      const swing = Math.sin(p * Math.PI * 12) > 0 ? 0 : 3;
      g.px(bx - 5, by + 6 + swing, 5, 2, "#6b5433");
      g.px(bx - 7, by + 5 + swing, 3, 4, "#8a8f88");
      const courses = Math.min(4, Math.floor(p * 5));
      for (let i = 0; i < courses; i++) {
        g.px(L.croft.x + 6, L.croft.y + 8 - i * 3, L.croft.w - 12, 2, i % 2 ? "#6d7263" : "#5c6154");
      }
      for (let i = 0; i < 5; i++) {
        const t = (p * 1.4 + i / 5) % 1;
        g.a(bx - 2 + i * 3, by + 4 - t * 14, 2, 2, 198, 190, 170, 0.5 * (1 - t)); // stone dust
      }
      break;
    }
    case "muck": {
      const x = L.W * 0.1 + ease(p) * (L.W * 0.7);
      drawShepherd(g, sx, sy, { walk: p, facing: 1 });
      g.px(x, sy + 10, 22, 9, "#5b4a30");
      g.px(x + 3, sy + 3, 16, 8, "#3f3324");
      g.px(x + 2, sy + 19, 7, 7, "#3f3527");
      for (let i = 0; i < 16; i++) {
        const t = (p * 2 + i / 16) % 1;
        g.px(x - t * 40 + i * 3, sy + 12 - Math.sin(t * Math.PI) * 14, 3, 3, t < 0.5 ? "#4a3a24" : "#6d8a4b");
      }
      break;
    }
    case "market": {
      // the cart rolls off to town and comes back heavier in the purse
      const away = Math.sin(p * Math.PI);
      const cx = L.cart.x + away * (L.W * 0.8);
      g.px(cx, L.cart.y + 6, 30, 10, C.bark);
      g.px(cx + 3, L.cart.y + 16, 8, 8, "#3f3527");
      g.px(cx + 20, L.cart.y + 16, 8, 8, "#3f3527");
      drawWoolSacks(g, cx + 4, L.cart.y - 2, p < 0.5 ? 40 : 0);
      // away to town, then back again
      drawShepherd(g, sx, sy, { crook: true, walk: p, facing: p < 0.5 ? 1 : -1 });
      if (p > 0.6) {
        for (let i = 0; i < 8; i++) {
          const t = (p - 0.6) / 0.4;
          g.px(sx - 20 + i * 9, sy + 4 - Math.sin(t * Math.PI) * (24 + i * 3), 4, 4, C.gorse);
        }
      }
      break;
    }
    case "buysheep": {
      // she comes off the cart and walks in
      const last = st.flock[st.flock.length - 1];
      const breed = (s.payload?.breed as Sheep["breed"]) ?? last?.breed ?? "blackface";
      const from = L.cart.x;
      const x = from - ease(clamp01(p * 1.2)) * (from - L.shepherd.x - 24);
      drawShepherd(g, sx, sy, { crook: true });
      drawSheep(g, x, L.shepherd.y + 12 - Math.abs(Math.sin(p * Math.PI * 7)) * 2, { id: -1, fleece: 1, breed, age: 0 }, { run: p });
      break;
    }
    case "gather":
      drawShepherd(g, sx, sy + (Math.sin(p * Math.PI * 4) > 0 ? 0 : 1), { crook: true, walk: p });
      break;
    case "move":
      // driving them onto new ground: he comes in behind the flock
      drawShepherd(g, sx, sy, { crook: true, walk: p, facing: -1 });
      break;
    case "sleep":
      drawShepherd(g, sx, sy, {});
      break;
    default: {
      // walking to a spot he was sent to, or standing at his mark
      if (s.walking) {
        drawShepherd(g, sx, sy, { crook: true, walk: s.time / 90, facing: s.facing ?? 1 });
        break;
      }
      // and between chores, the small things a person does with their hands
      const tick = idleTick(s.time);
      drawShepherd(g, sx, sy + (Math.sin(s.time / 1600) > 0 ? 0 : 1), {
        crook: true,
        tick: tick ? { kind: tick.kind, t: tick.t } : undefined,
        facing: tick?.kind === "look" ? tick.facing : 0,
      });
      break;
    }
  }
}

/* ================================================================== *
 * set pieces that take the whole screen
 * ================================================================== */

function foxRaid(g: Painter, L: WorldLayout, s: Scene) {
  const st = s.state;
  const p = s.p;
  drawNight(g, L, st, 0.95, s.time);
  const outbound = p < 0.55;
  const fx = outbound ? -30 + (p / 0.55) * (L.W * 0.6) : L.W * 0.6 - ((p - 0.55) / 0.45) * (L.W * 0.85);
  const fy = L.shepherd.y + 14 + Math.sin(p * Math.PI * 6) * 2;

  st.flock.slice(0, 14).forEach((sh, i) => {
    const home = L.flock[i];
    if (!home) return;
    const flee = Math.max(0, 1 - Math.abs(home.x - fx) / (L.W * 0.35)) * ease(clamp01(p * 1.6));
    drawSheep(g, home.x + (home.x < fx ? -1 : 1) * flee * 30, home.y - flee * 4, sh, { run: flee, flip: home.x > fx });
  });

  // both raiders face the way they are running: out to the flock, then back
  // off the hill with what they took
  const facing = outbound ? 1 : -1;
  if (isInverse()) drawRam(g, fx, fy - 2, p, facing);
  else drawFox(g, fx, fy, p, facing);
  if (!outbound) g.px(fx + 1, fy + 1, 8, 5, isInverse() ? "#b4472c" : "#cfcab8");

  if (hasDog(st)) {
    const dx = L.W * 0.1 + ease(clamp01(p * 1.1)) * (L.W * 0.45);
    drawDog(g, dx, L.shepherd.y + 16, p);
  }
  drawShepherd(g, L.shepherd.x, L.shepherd.y, { crook: true });
}

function wolfScene(g: Painter, L: WorldLayout, s: Scene, armed: boolean) {
  const p = s.p;
  g.px(0, 0, L.W, L.H, "#070a12");
  for (let i = 0; i < 60; i++) g.a((i * 83) % L.W, (i * 29) % Math.max(30, L.horizonY), 2, 2, 215, 220, 240, 0.6);
  drawMoonDisc(g, Math.round(L.W * 0.68), Math.round(L.horizonY * 0.5), 24, 4, 1);

  for (let x = 0; x < L.W; x += 2) {
    const y = L.horizonY + Math.round(Math.sin((x / L.W) * 3.2) * 10);
    g.px(x, y, 2, L.H - y, "#0f1320");
    g.px(x, y, 2, 1, "#1b2233");
  }
  g.px(0, L.groundY + 6, L.W, L.H - L.groundY, "#141a26");

  const sx = Math.round(L.W * 0.26);
  const sy = L.shepherd.y;

  // eyes first, then the shape of him around them
  const EYES_OPEN = 0.1;
  const EYES_HOLD = 0.2;
  const BODY_IN = 0.34;
  const eyeGlow = clamp01(p / EYES_OPEN) * (Math.abs(p - 0.17) < 0.012 ? 0.15 : 1);
  const bodyAlpha = clamp01((p - EYES_HOLD) / (BODY_IN - EYES_HOLD));
  const march = (end: number) => ease(clamp01((p - EYES_HOLD) / (end - EYES_HOLD)));

  if (!armed) {
    const wolfX = L.W * 0.9 - march(0.62) * (L.W * 0.55);
    for (let i = 0; i < 9; i++) {
      if (p > 0.45 + i * 0.05) continue;
      const hx = L.W * 0.1 + i * (L.W * 0.09);
      const run = ease(clamp01((p - EYES_HOLD) * 1.8)) * (L.W * 0.2);
      drawSheep(g, hx - (hx < wolfX ? run : -run), sy + 12 - Math.abs(Math.sin(p * 9 + i)) * 3, { id: -1, fleece: 6, breed: "blackface", age: 0 }, { run: p, flip: hx > wolfX });
    }
    if (p > 0.6) drawSheep(g, L.W * 0.2, sy + 16, { id: -1, fleece: 6, breed: "blackface", age: 0 }, {});
    drawWolfBeast(g, wolfX, sy + 4, p, bodyAlpha, eyeGlow);
    drawShepherd(g, sx + Math.sin(p * Math.PI * 6) * 2, sy, { crook: true, facing: 1 });
    if (p > 0.75) g.a(0, 0, L.W, L.H, 180, 71, 44, 0.22 * Math.sin(((p - 0.75) / 0.25) * Math.PI));
    return;
  }

  const stage = p < 0.34 ? 0 : p < 0.5 ? 1 : p < 0.62 ? 2 : 3;
  const wolfX = L.W * 0.9 - march(0.42) * (L.W * 0.45);
  if (stage < 3) drawWolfBeast(g, wolfX, sy + 4, p, bodyAlpha, eyeGlow);

  if (stage === 3) {
    setSpriteState({ kit: { pelt: true } });
    drawShepherd(g, sx, sy, { facing: 1 });
    setSpriteState({ kit: { pelt: false } });
    const t = (p - 0.62) / 0.38;
    for (let i = 0; i < 12; i++) {
      const q = (t + i / 12) % 1;
      g.a(sx - 16 + i * 7, sy + 4 - q * 34, 3, 3, 138, 106, 156, 0.55 * (1 - q));
    }
  } else {
    drawShepherd(g, sx, sy, { facing: 1 }); // turned to face him, not the camera
    if (stage < 2) {
      g.px(sx + 13, sy - 18, 3, 24, "#cdd3d8");
      g.px(sx + 13, sy - 18, 1, 24, "#f0f4f6");
      g.px(sx + 10, sy + 5, 9, 3, "#8a6a3c");
      if (stage === 1) for (let i = 0; i < 7; i++) g.a(sx + 13, sy - 20 - i * 3, 3, 2, 232, 236, 214, 0.6 - i * 0.08);
    } else {
      g.px(sx + 13, sy + 4, 26, 3, "#cdd3d8");
      g.px(sx + 10, sy + 2, 4, 8, "#8a6a3c");
      const t = (p - 0.5) / 0.12;
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const d = t * 36;
        g.a(wolfX + 8 + Math.cos(a) * d, sy + Math.sin(a) * d, 3, 3, 232, 236, 214, 0.9 * (1 - t));
      }
      g.a(0, 0, L.W, L.H, 255, 255, 240, 0.6 * (1 - t));
    }
  }
}

/**
 * The inn.
 *
 * The pub leaves the glen entirely, which is what makes an £8 pint feel like
 * an event rather than a line item. It is also the only room in the game with
 * other people in it: the landlord behind the bar, and the lass carrying a
 * tray — the one the croft is quietly being built for. She is drawn to be
 * recognised, since by the sixth pint the writing assumes you know exactly
 * who is being talked about.
 *
 * Everybody in here is drawn to a height derived from the room rather than a
 * fixed sprite. The canvas has no fixed resolution, and a figure sized for a
 * desktop's short interior stood chest-deep in the floor on a phone.
 */
function drawBackFigure(
  g: Painter,
  cx: number,
  headTop: number,
  footY: number,
  o: { coat: string; coatLit: string; hair: string; hat?: string; skirt?: string; apron?: string; step?: number },
) {
  /*
   * Proportioned rather than blocked out. The first version was three solid
   * rectangles at nearly half its own height wide, which at this scale read
   * as a wardrobe standing at the bar. A person is mostly leg and the head
   * is small: roughly 18% head, 42% body, 40% leg, and never more than about
   * a third as wide as they are tall.
   */
  const h = Math.max(20, footY - headTop);
  /*
   * Matched to the shepherd's own proportions rather than to life. His head
   * is about a fifth of him and nearly as wide as his shoulders; drawn to
   * realistic ratios the pub folk had small heads on wide bodies and looked
   * like a different game's art standing in the same room.
   */
  const headH = Math.round(h * 0.22);
  const bodyH = Math.round(h * 0.4);
  const legH = h - headH - bodyH;
  const headW = Math.max(5, Math.round(h * 0.26));
  const bodyW = Math.max(6, Math.round(h * 0.32));
  const legW = Math.max(2, Math.round(h * 0.11));
  const bodyX = Math.round(cx - bodyW / 2);
  const headX = Math.round(cx - headW / 2);
  const step = o.step ?? 0;

  // legs, or a skirt to the floor
  if (o.skirt) {
    g.px(bodyX, headTop + headH + bodyH, bodyW, legH, o.skirt);
    g.px(bodyX - 1, footY - Math.round(legH * 0.25), bodyW + 2, Math.round(legH * 0.25), o.skirt);
  } else {
    g.px(bodyX + 1, headTop + headH + bodyH, legW, legH, "#3a3226");
    g.px(bodyX + bodyW - legW - 1, headTop + headH + bodyH - step, legW, legH, "#3a3226");
  }
  // body
  g.px(bodyX, headTop + headH, bodyW, bodyH, o.coat);
  g.px(bodyX, headTop + headH, bodyW, Math.max(1, Math.round(h * 0.04)), o.coatLit); // shoulders
  if (o.apron) g.px(bodyX + 1, headTop + headH + Math.round(bodyH * 0.45), bodyW - 2, Math.round(bodyH * 0.55), o.apron);
  // head
  g.px(headX, headTop, headW, headH, o.hair);
  if (o.hat) g.px(headX - 1, headTop - 1, headW + 2, Math.max(2, Math.round(headH * 0.55)), o.hat);
  return { bodyX, bodyW, headX, headW, headH, bodyH };
}

function pubScene(g: Painter, L: WorldLayout, p: number, time: number) {
  const inRoom = clamp01(p < 0.12 ? p / 0.12 : p > 0.88 ? (1 - p) / 0.12 : 1);
  g.a(0, 0, L.W, L.H, 20, 23, 15, inRoom);
  if (inRoom < 0.92) return;

  const W = L.W;
  const H = L.H;
  const flick = Math.sin(time / 130) * 2;

  /* ---- the room ---- */
  g.px(0, 0, W, H, "#2f2418");
  for (let y = 0; y < H; y += 3) {
    const lit = 1 - Math.min(1, y / (H * 0.8));
    g.a(0, y, W, 1, 90, 66, 40, 0.08 + lit * 0.12);
  }
  for (let x = 0; x < W; x += 22) g.px(x, 0, 2, H, "#241b12");
  g.px(0, 0, W, 5, "#241b12"); // a low beamed ceiling
  for (let x = 6; x < W; x += 34) g.px(x, 0, 5, 7, "#3a2c1e");

  /*
   * The floor and the people come first, and the counter is derived from
   * them — a bar is about chest height on a standing man. Fixing the counter
   * at a fraction of the screen made it exactly as tall as the figures, so
   * the landlord behind it had to be drawn floating at head height to be
   * seen at all, and looked like he was standing on the bar.
   */
  const floorY = Math.round(H * 0.84);
  const figH = Math.max(24, Math.min(46, Math.round(H * 0.2)));
  const barY = floorY - Math.round(figH * 0.58);
  const barX = Math.round(W * 0.26);
  const barW = W - barX;

  g.px(0, floorY, W, H - floorY, "#4a3826"); // flagstones
  for (let x = 0; x < W; x += 13) {
    for (let y = floorY; y < H; y += 7) {
      if (((x / 13 + y / 7) | 0) % 2) g.a(x, y, 12, 6, 0, 0, 0, 0.12);
    }
  }
  g.px(0, floorY, W, 1, "#5b4a30");

  /* ---- the hearth: wide and low, a fire you could dry a coat at ---- */
  const fw = Math.max(44, Math.round(W * 0.22));
  const fx = Math.round(W * 0.02);
  const fy = floorY - Math.max(26, Math.round(H * 0.19)); // wide and low, not a slot
  g.px(fx - 4, fy - 6, fw + 8, 6, "#6d7263"); // the mantel, with a lamp on it
  g.px(fx - 4, fy - 6, fw + 8, 2, "#8a8f88");
  g.px(fx + fw - 14, fy - 11, 5, 5, "#8a8f88");
  g.a(fx + fw - 13, fy - 10, 3, 3, 255, 214, 120, 0.7);
  g.px(fx, fy, fw, floorY - fy, "#3a2c1e"); // the surround
  // an arched opening
  for (let i = 0; i < 4; i++) g.px(fx + 4 + i * 2, fy + 4 - i, fw - 8 - i * 4, 3, "#1d1610");
  g.px(fx + 4, fy + 6, fw - 8, floorY - fy - 6, "#1d1610");
  // a fire burning down in a grate, rather than a lit panel
  const fireH = Math.max(8, Math.round((floorY - fy) * 0.4));
  g.px(fx + 6, floorY - 5, fw - 12, 5, "#4a3a2a"); // logs
  g.px(fx + 9, floorY - 8, fw - 18, 3, "#3a2c20");
  for (let i = 0; i < 5; i++) {
    // tongues of it, each its own height
    const tw = Math.round((fw - 20) / 5);
    const th = fireH - Math.round(hash(i * 5) * 4) + (i % 2 ? Math.round(flick) : 0);
    g.px(fx + 10 + i * tw, floorY - 6 - th, tw - 1, th, "#c07a24");
    g.px(fx + 11 + i * tw, floorY - 6 - th + 2, tw - 3, th - 3, C.fire);
    if (th > 6) g.px(fx + 12 + i * tw, floorY - 6 - th + 5, tw - 5, th - 8, "#f6d98a");
  }
  g.a(fx - 14, fy - 14, fw + 34, floorY - fy + 30, 240, 176, 80, 0.13 + Math.sin(time / 200) * 0.025);

  /* ---- the back-bar ---- */
  const shelfY = Math.round(H * 0.14);
  g.px(barX + 6, shelfY + 13, barW - 12, 2, "#4a3826");
  g.px(barX + 6, shelfY + 29, barW - 12, 2, "#4a3826");
  for (let i = 0; i < Math.floor((barW - 20) / 7); i++) {
    const bx = barX + 10 + i * 7;
    const tall = hash(i * 3) > 0.5;
    const col = ["#3d5a4a", "#5a4a2c", "#6a3a2c", "#4a4a5a"][Math.floor(hash(i * 5) * 4)];
    g.px(bx, shelfY + (tall ? 3 : 5), 4, tall ? 10 : 8, col);
    g.px(bx + 1, shelfY + (tall ? 1 : 3), 2, 2, col);
    if (hash(i * 7) > 0.7) g.px(bx, shelfY + 21, 4, 8, col);
  }
  const caskX = barX + Math.round(barW * 0.6);
  g.px(caskX, shelfY + 33, 22, 13, "#6b5433");
  g.px(caskX, shelfY + 35, 22, 2, "#4a3a24");
  g.px(caskX, shelfY + 42, 22, 2, "#4a3a24");
  g.px(caskX + 20, shelfY + 39, 3, 3, "#c9a83c"); // its tap

  /* ---- the landlord, behind the bar, cut off at the counter ---- */
  // the two on the near side are taller because they are nearer: the
  // landlord stands further back, behind the counter
  const nearH = Math.round(figH * 1.4);
  const lx = barX + Math.round(barW * 0.13);
  const lTop = barY + 8 - figH;
  const lm = drawBackFigure(g, lx, lTop, barY + 8, {
    coat: "#6a5a44",
    coatLit: "#7b6a52",
    hair: "#4a4038",
    apron: "#d8d3c2",
  });
  // he is facing the room, so his face goes over the head block
  g.px(lm.headX, lTop + 1, lm.headW, lm.headH - 1, "#c9a583");
  g.px(lm.headX, lTop, lm.headW, 2, "#4a4038"); // hair
  // eyes only. A mouth line at this size reads as a scowl, and the shepherd
  // has never had one — two different faces in the same game
  // eyes scaled off the head. Single pixels vanished at this size, and the
  // shepherd's own eyes are a far bigger share of his face than that.
  const le = Math.max(1, Math.round(lm.headH * 0.22));
  g.px(lm.headX + 1, lTop + Math.round(lm.headH * 0.35), le, le, "#26201a");
  g.px(lm.headX + lm.headW - 1 - le, lTop + Math.round(lm.headH * 0.35), le, le, "#26201a");
  const polish = Math.sin(time / 260) > 0 ? 0 : 1;
  g.px(lm.bodyX + lm.bodyW, barY - 9 + polish, 4, 6, "#9aa3a5"); // the glass he is drying
  g.a(lm.bodyX + lm.bodyW, barY - 9 + polish, 4, 2, 240, 240, 230, 0.4);

  /* ---- the bar itself, drawn over him ---- */
  g.px(barX, barY + 6, barW, floorY - barY - 6, "#33261a");
  for (let x = barX; x < W; x += 11) g.px(x, barY + 10, 9, floorY - barY - 14, "#3b2d1f");
  g.px(barX, barY, barW, 6, "#5b4530");
  g.px(barX, barY, barW, 2, "#7a6242");

  /* ---- him, at the near side of it, back to us ---- */
  const mx = Math.round(W * 0.52); // clear of the landlord behind the bar
  const mm = drawBackFigure(g, mx, floorY - 1 - nearH, floorY - 1, {
    coat: "#4a5540",
    coatLit: "#5a6650",
    hair: "#8a6b4c",
    hat: "#2f3327",
  });
  g.px(mm.bodyX + mm.bodyW, barY - 5, 4, 3, "#c9a583"); // a hand up on the counter

  /*
   * One glass size for the room. His pint was 14 tall against a 46-tall man
   * — nearly a third of him — while the ones on her tray were 4, so the same
   * drink came in two sizes depending on who was holding it.
   */
  const glassH = Math.max(6, Math.round(figH * 0.2));
  const glassW = Math.max(4, Math.round(glassH * 0.62));
  const fill = clamp01((p - 0.28) / 0.36);
  const gx0 = mm.bodyX + mm.bodyW + 5;
  g.px(gx0, barY - glassH, glassW, glassH, "#9aa3a5");
  g.a(gx0, barY - glassH, glassW, glassH, 255, 255, 255, 0.12);
  const beerH = Math.round(fill * (glassH - 2));
  g.px(gx0 + 1, barY - 1 - beerH, glassW - 2, beerH, "#c98a2e");
  if (fill > 0.85) {
    g.px(gx0 + 1, barY - glassH, glassW - 2, 2, "#f2eddb"); // the head on it
    g.px(gx0 + 2, barY - glassH - 1, glassW - 4, 1, "#f2eddb");
  }

  /* ---- the lass, come over with a tray ---- */
  const walk = clamp01((p - 0.18) / 0.32);
  const gxs = Math.round(W * 0.86 - walk * (W * 0.19));
  const gTop = floorY - 1 - nearH;
  const gm = drawBackFigure(g, gxs, gTop, floorY - 1, {
    coat: "#e8e3d2", // her blouse
    coatLit: "#f2eee0",
    hair: "#7a3a24",
    skirt: "#3d5a4a",
    apron: "#c9c3ae",
  });
  // she is facing him, so she gets a face and hair down past her shoulders
  g.px(gm.headX, gTop + 1, gm.headW, gm.headH - 1, "#c9a583");
  g.px(gm.headX, gTop, gm.headW, 2, "#7a3a24");
  g.px(gm.headX - 1, gTop + 1, 1, gm.headH + 2, "#7a3a24");
  g.px(gm.headX + gm.headW, gTop + 1, 1, gm.headH + 2, "#7a3a24");
  const ge = Math.max(1, Math.round(gm.headH * 0.22));
  g.px(gm.headX + 1, gTop + Math.round(gm.headH * 0.35), ge, ge, "#26201a");
  g.px(gm.headX + gm.headW - 1 - ge, gTop + Math.round(gm.headH * 0.35), ge, ge, "#26201a");
  // the tray she is carrying, with the same glasses on it
  const trayY = gTop + gm.headH + Math.round(gm.bodyH * 0.55);
  const trayW = glassW * 2 + 5;
  g.px(gm.bodyX - trayW - 1, trayY, trayW, 2, "#6b5433");
  g.px(gm.bodyX - trayW - 1, trayY, trayW, 1, "#7c6242");
  for (let i = 0; i < 2; i++) {
    const bx = gm.bodyX - trayW + 1 + i * (glassW + 2);
    g.px(bx, trayY - glassH, glassW, glassH, "#9aa3a5");
    g.px(bx + 1, trayY - glassH + 2, glassW - 2, glassH - 3, "#c98a2e");
    g.px(bx + 1, trayY - glassH, glassW - 2, 2, "#f2eddb"); // heads on them
  }
  g.px(gm.bodyX - 3, trayY + 1, 3, 3, "#c9a583"); // her hand under it

  /* ---- the rest of the room ---- */
  const tx = Math.round(W * 0.86);
  g.px(tx, floorY - 14, 18, 3, "#6b5433");
  g.px(tx + 7, floorY - 11, 4, 11, "#54452c");
  g.px(tx + 5, floorY - 18, 4, 4, "#9aa3a5");

  for (let i = 0; i < 2; i++) {
    const hx = Math.round(W * (0.36 + i * 0.34));
    g.px(hx, 5, 1, 6, "#3a2c1e");
    g.px(hx - 3, 11, 7, 5, "#8a8f88");
    g.a(hx - 2, 13, 5, 3, 255, 214, 120, 0.75);
    g.a(hx - 12, 8, 25, 24, 240, 190, 90, 0.07);
  }

  g.a(0, 0, W, H, 240, 170, 80, 0.05);
  for (let i = 0; i < 4; i++) {
    const t = (p * 1.1 + i / 4) % 1;
    g.a(W * 0.9 + i * 4, floorY - 22 - t * 24, 3, 3, 224, 163, 60, 0.35 * (1 - t));
  }
}

/**
 * The day you walked out. Runs once, at the start of a run.
 *
 * Three beats: the desk you are leaving, the door, and the hill you are
 * walking up. It is the only time the game shows you anywhere but the glen,
 * which is the point — everything after this is the hill.
 */
function quitScene(g: Painter, L: WorldLayout, p: number, time: number) {
  const beat = p < 0.42 ? 0 : p < 0.62 ? 1 : 2;

  if (beat === 0) {
    // a room with no daylight in it
    g.px(0, 0, L.W, L.H, "#2b2c28");
    for (let x = 0; x < L.W; x += 34) g.a(x, 0, 1, L.H, 0, 0, 0, 0.18);
    const deskY = Math.round(L.H * 0.58);
    g.px(0, deskY, L.W, 4, "#4a4034");
    g.px(Math.round(L.W * 0.1), deskY + 4, Math.round(L.W * 0.8), Math.max(6, L.H - deskY - 4), "#3a332a");
    // ledgers stacked, and the notice laid on top of them
    g.px(Math.round(L.W * 0.2), deskY - 8, 22, 8, "#6b5433");
    g.px(Math.round(L.W * 0.2), deskY - 12, 22, 5, "#7a6242");
    const slide = ease(clamp01((p - 0.16) / 0.2));
    g.px(Math.round(L.W * 0.52 + slide * 12), deskY - 6, 16, 6, "#e8e4d4");
    g.px(Math.round(L.W * 0.54 + slide * 12), deskY - 4, 10, 1, "#8a8578");
    // him, standing up from it
    const rise = ease(clamp01((p - 0.24) / 0.16));
    drawShepherd(g, Math.round(L.W * 0.34), deskY - 26 - rise * 4, {});
    // the lamp overhead, and the window that is not his yet
    g.a(Math.round(L.W * 0.34) - 10, deskY - 46, 32, 26, 240, 214, 150, 0.08);
    return; // the line itself is DOM text — see updateCaption in main.ts
  }

  if (beat === 1) {
    // the door: a rectangle of daylight getting bigger
    const t = ease(clamp01((p - 0.42) / 0.2));
    g.px(0, 0, L.W, L.H, "#2b2c28");
    const dw = Math.round(10 + t * L.W);
    const dh = Math.round(16 + t * L.H);
    const dx = Math.round(L.W / 2 - dw / 2);
    const dy = Math.round(L.H / 2 - dh / 2);
    g.px(dx, dy, dw, dh, "#87b0b4");
    g.a(dx, dy, dw, dh, 240, 230, 190, 0.3 * t);
    if (t < 0.85) drawShepherd(g, Math.round(L.W / 2 - 6), Math.round(L.H * 0.52), { walk: p * 3 });
    return;
  }

  // the hill, from below, walking up
  const t = ease(clamp01((p - 0.62) / 0.38));
  const [top, low] = SKY.sun;
  paintSkyBands(g, L.W, L.H, top, low, 7);
  // the hill rising to the right, him climbing it
  const baseY = Math.round(L.H * 0.94);
  for (let x = 0; x < L.W; x += 2) {
    const y = baseY - Math.round((x / L.W) * L.H * 0.55) - Math.round(Math.sin(x / 23) * 3);
    g.px(x, y, 2, L.H - y, "#3a4a30");
    g.px(x, y, 2, 1, "#4a5a3c");
  }
  const wx = L.W * 0.1 + t * L.W * 0.6;
  const wy = baseY - (wx / L.W) * L.H * 0.55 - 26;
  // seen from behind: he is walking away up it. Front-facing, he looked like
  // he was shuffling sideways up the slope with his face to the camera.
  drawShepherd(g, Math.round(wx), Math.round(wy), { crook: true, walk: time / 90, back: true });
}


/* ================================================================== *
 * inside the croft
 * ================================================================== */

/**
 * The room you sleep in. Everything bought is on the wall or by the fire, so
 * the croft you are paying for is somewhere you actually stand rather than a
 * row of ticks in a shop. The bed is how the day ends.
 */
function drawInterior(g: Painter, I: InteriorLayout, st: GameState, time: number, isNight: boolean, spotlightBed: boolean) {
  const hearthBuilt = owns(st, "hearth");

  // walls: rough stone, and floorboards below
  g.px(0, 0, I.W, I.H, "#2b2419");
  for (let x = 0; x < I.W; x += 9) {
    for (let y = 0; y < I.floorY; y += 6) {
      const v = hash(x * 0.7 + y * 3.1);
      g.px(x + (y / 6) % 2 ? 4 : 0, y, 8, 5, v > 0.5 ? "#3a3226" : "#332c21");
    }
  }
  g.px(0, I.floorY, I.W, I.H - I.floorY, "#4a3a26");
  for (let y = I.floorY; y < I.H; y += 7) g.a(0, y, I.W, 1, 0, 0, 0, 0.2);
  g.px(0, I.floorY, I.W, 1, "#5b4a30");

  // the hearth, which is only a hole in the wall until it is built up
  const hx = I.hearth.x;
  const hy = I.hearth.y;
  g.px(hx, hy, I.hearth.w, I.hearth.h, "#241d14");
  g.px(hx - 2, hy - 3, I.hearth.w + 4, 4, hearthBuilt ? "#6d7263" : "#3a3226");
  if (hearthBuilt) {
    // a proper fire, and light thrown across the room
    const flick = Math.sin(time / 130) * 2;
    g.px(hx + 8, hy + I.hearth.h - 18, I.hearth.w - 16, 16, "#c07a24");
    g.px(hx + 12, hy + I.hearth.h - 14 + flick, I.hearth.w - 24, 12, C.fire);
    g.px(hx + 16, hy + I.hearth.h - 9 + flick, I.hearth.w - 32, 7, "#f0c86a");
    g.a(hx - 12, hy - 10, I.hearth.w + 40, I.hearth.h + 30, 240, 180, 80, 0.1 + Math.sin(time / 200) * 0.02);
    // the sword goes above the fire, exactly as its description says.
    // A Highland broadsword is a basket hilt: the guard is the whole point
    // of it, and a plain bar with a gold block on it read as a shelf.
    if (owns(st, "sword")) {
      const bl = Math.max(26, I.hearth.w - 6);
      const bx = hx + 3;
      const by = hy - 13;
      g.px(bx, by, bl - 12, 3, "#b9c0c6"); // the blade
      g.px(bx, by, bl - 12, 1, "#eef2f4"); // light along its edge
      g.px(bx, by + 1, bl - 12, 1, "#8e979e"); // the fuller down the middle
      g.px(bx - 3, by, 3, 3, "#9aa3a9"); // the point
      const gx0 = bx + bl - 12;
      g.px(gx0, by - 3, 2, 9, "#7a5c30"); // the guard
      g.px(gx0 + 1, by - 4, 6, 2, "#8a6a3c"); // the basket, over his hand
      g.px(gx0 + 1, by + 5, 6, 2, "#8a6a3c");
      g.px(gx0 + 6, by - 3, 2, 9, "#8a6a3c");
      g.px(gx0 + 2, by, 5, 3, "#3a3226"); // the grip inside it
      g.px(gx0 + 8, by, 3, 3, "#c9a83c"); // the pommel
      g.px(bx - 4, by + 4, bl + 14, 1, "#2a2118"); // the pegs it rests on
    }
  } else {
    g.px(hx + 6, hy + I.hearth.h - 8, I.hearth.w - 12, 6, "#1a1610");
  }

  // the bed
  const b = I.bed;
  g.px(b.x, b.y + 8, b.w, b.h - 8, "#5b4a30");
  g.px(b.x, b.y + 4, b.w, 7, "#8a8a7a"); // the ticking
  g.px(b.x, b.y + 4, b.w, 2, "#a2a292");
  g.px(b.x + b.w - 14, b.y, 14, 8, "#ddd9c8"); // a pillow
  g.px(b.x - 2, b.y + 2, 3, b.h - 2, "#4a3a26"); // bedposts
  g.px(b.x + b.w - 1, b.y + 2, 3, b.h - 2, "#4a3a26");
  /*
   * Where the dog lies.
   *
   * A border collie, once there is a fire to lie in front of, lies in front
   * of the fire — right in front of it, every time it is lit, and she will
   * not be moved. The sheltie keeps her own place further into the room.
   */
  if (hasDog(st)) {
    const collieAtFire = owns(st, "collie") && hearthBuilt;
    if (collieAtFire) {
      /*
       * On the floorboards hard up against the hearth, nose to the fire.
       * Centred on the hearth she was inside the firebox, lying on the
       * flames and hiding them.
       */
      drawDog(g, hx + I.hearth.w + 1, I.floorY - 11, 0, 0, -1);
    } else {
      drawDog(g, hx + I.hearth.w + 8, I.floorY - 12, 0, 0, 1);
    }
  }


  // a window on the back wall: daylight, or the dark and a star
  const win = { x: Math.round(I.W * 0.3), y: Math.round(I.floorY - 78), w: 26, h: 22 };
  if (win.y > 12) {
    g.px(win.x - 3, win.y - 3, win.w + 6, win.h + 6, "#3a3226");
    g.px(win.x, win.y, win.w, win.h, isNight ? "#141a26" : "#87b0b4");
    if (!isNight) g.a(win.x, win.y, win.w, win.h, 240, 230, 190, 0.2);
    else g.a(win.x + 6, win.y + 5, 2, 2, 220, 225, 240, 0.8);
    g.px(win.x + win.w / 2 - 1, win.y, 2, win.h, "#3a3226");
    g.px(win.x, win.y + win.h / 2 - 1, win.w, 2, "#3a3226");
    if (!isNight) g.a(win.x - 6, win.y + win.h, win.w + 12, 20, 200, 214, 190, 0.06);
  }

  // a table and a stool, because a room with only a bed is a cell
  const tx = Math.round(I.W * 0.26);
  const ty = I.floorY - 16;
  g.px(tx, ty, 34, 4, "#6b5433");
  g.px(tx, ty, 34, 1, "#7c6242");
  g.px(tx + 2, ty + 4, 3, 12, "#54452c");
  g.px(tx + 29, ty + 4, 3, 12, "#54452c");
  g.px(tx + 12, ty - 5, 5, 5, "#9aa3a5"); // a cup on it
  g.px(tx - 12, ty + 6, 9, 3, "#5b4a30"); // the stool
  g.px(tx - 11, ty + 9, 2, 7, "#4a3a26");
  g.px(tx - 5, ty + 9, 2, 7, "#4a3a26");

  // the door back out to the hill, with daylight round it
  const d = I.door;
  g.px(d.x - 2, d.y - 2, d.w + 4, d.h + 2, "#2a2318");
  g.px(d.x, d.y, d.w, d.h, "#5b4a30");
  for (let i = 0; i < d.w; i += 5) g.px(d.x + i, d.y, 4, d.h, i % 10 ? "#54452c" : "#5b4a30");
  g.px(d.x + d.w - 6, d.y + d.h / 2, 3, 3, "#c9a83c"); // the latch
  g.a(d.x - 3, d.y - 3, d.w + 6, d.h + 4, 200, 214, 190, 0.1);

  // the shelf of everything bought
  const sh = I.shelf;
  g.px(sh.x - 4, sh.y + sh.h, sh.w + 8, 3, "#5b4a30");
  let kx = sh.x;
  const step = Math.max(14, Math.floor(sh.w / 7));
  const put = (draw: () => void) => {
    draw();
    kx += step;
  };
  /*
   * Each thing on the wall is drawn to be recognised at a glance, since the
   * point of the room is seeing what you have bought. They were flat blocks
   * of one colour before, which needed the label to tell them apart.
   */
  if (owns(st, "crook")) {
    put(() => {
      for (let i = 0; i < 9; i++) g.px(kx + 5, sh.y + 4 + i * 2, 2, 2, "#6b5433"); // the shaft
      g.px(kx + 2, sh.y + 1, 5, 2, "#7c6242"); // and the crook of it, turning over
      g.px(kx + 1, sh.y + 2, 2, 4, "#7c6242");
      g.px(kx + 3, sh.y + 5, 2, 2, "#6b5433");
      g.px(kx + 5, sh.y + 21, 2, 2, "#5a4526"); // the worn ferrule
    });
  }
  if (owns(st, "shears")) {
    put(() => {
      g.px(kx + 1, sh.y + 8, 9, 2, "#c6cabc"); // one blade
      g.px(kx + 1, sh.y + 12, 9, 2, "#b9bcae"); // and the other
      g.px(kx + 9, sh.y + 9, 2, 4, "#8e9186"); // the rivet
      g.px(kx, sh.y + 7, 2, 8, "#6b5433"); // the bow that springs them
      g.px(kx - 1, sh.y + 9, 1, 4, "#6b5433");
    });
  }
  if (owns(st, "boots")) {
    put(() => {
      /*
       * Tackety boots in oiled leather rather than near-black. They were dark
       * on dark panelling and the easiest thing on the wall to miss, which is
       * poor for the purchase that buys a whole extra tap.
       */
      for (let i = 0; i < 2; i++) {
        const bx = kx + i * 7;
        const by = sh.y + 8 + i; // the back one stands a little higher
        g.px(bx + 1, by, 5, 2, "#7a5f3e"); // the turned-over cuff
        g.px(bx, by + 1, 1, 2, "#6a5236");
        g.px(bx + 6, by + 1, 1, 2, "#6a5236");
        g.px(bx + 1, by + 2, 5, 7, "#5e4a2f"); // the leg of it
        g.px(bx + 1, by + 2, 2, 7, "#6d5738"); // lit down one side
        g.px(bx + 2, by + 4, 3, 1, "#3a2f1e"); // laces
        g.px(bx + 2, by + 6, 3, 1, "#3a2f1e");
        g.px(bx + 1, by + 9, 7, 3, "#4a3a24"); // the foot, toe forward
        g.px(bx + 1, by + 9, 7, 1, "#6d5738");
        g.px(bx, by + 12, 9, 2, "#33291b"); // the sole
        for (let t = 0; t < 4; t++) g.px(bx + 1 + t * 2, by + 13, 1, 1, "#8a7a5c"); // tackets
      }
    });
  }
  if (owns(st, "lamp")) {
    put(() => {
      g.px(kx + 3, sh.y + 2, 2, 3, "#6d7263"); // the bail
      g.px(kx + 1, sh.y + 4, 7, 2, "#8a8f88"); // the cap
      g.px(kx + 1, sh.y + 6, 1, 8, "#8a8f88"); // the frame
      g.px(kx + 7, sh.y + 6, 1, 8, "#8a8f88");
      g.px(kx + 2, sh.y + 6, 5, 8, "#3a3f3c"); // the glass
      g.a(kx + 2, sh.y + 8, 5, 5, 255, 214, 120, 0.55); // the wick, turned low
      g.px(kx + 1, sh.y + 14, 7, 2, "#6d7263"); // the oil font
    });
  }
  if (owns(st, "oilskin")) {
    put(() => {
      g.px(kx + 4, sh.y + 2, 3, 2, "#5a5f58"); // the peg
      g.px(kx + 2, sh.y + 4, 7, 3, "#3a4a42"); // shoulders
      g.px(kx + 1, sh.y + 7, 9, 13, "#2f3a35"); // the coat hanging
      g.px(kx + 5, sh.y + 7, 1, 13, "#26302c"); // where it falls open
      g.px(kx + 9, sh.y + 8, 1, 10, "#54655c"); // wax catching the light
      g.px(kx + 1, sh.y + 19, 9, 1, "#26302c"); // its hem
    });
  }
  if (owns(st, "watch")) {
    put(() => {
      for (let i = 0; i < 5; i++) g.px(kx + 3 + (i % 2), sh.y + 2 + i * 2, 1, 2, "#c9a83c"); // the chain
      g.px(kx + 2, sh.y + 12, 7, 7, "#c9a83c"); // the case
      g.px(kx + 3, sh.y + 13, 5, 5, "#e8e3d2"); // its face
      g.px(kx + 5, sh.y + 14, 1, 3, "#3a3226"); // the hands
      g.px(kx + 5, sh.y + 16, 2, 1, "#3a3226");
      g.px(kx + 4, sh.y + 11, 3, 1, "#e0c34c"); // the bow
    });
  }
  if (owns(st, "fiddle")) {
    put(() => {
      g.px(kx + 2, sh.y + 4, 7, 5, "#7a4a2c"); // the body, hung by its scroll
      g.px(kx + 2, sh.y + 4, 7, 1, "#94603c");
      g.px(kx + 3, sh.y + 9, 5, 3, "#6b4326"); // the waist of it
      g.px(kx + 2, sh.y + 12, 7, 4, "#7a4a2c");
      g.px(kx + 4, sh.y + 16, 3, 4, "#6b4326"); // the neck
      g.px(kx + 4, sh.y + 20, 3, 2, "#4a2f1c"); // the scroll
      g.px(kx + 5, sh.y + 5, 1, 11, "#c9c3ae"); // strings
      g.px(kx + 9, sh.y + 6, 1, 14, "#8a7a5c"); // the bow, beside it
    });
  }
  if (owns(st, "saltlick")) {
    put(() => {
      g.px(kx, sh.y + 13, 11, 7, "#c6c3b2"); // the block
      g.px(kx, sh.y + 13, 11, 2, "#dedbca"); // lit on top
      g.px(kx + 2, sh.y + 15, 3, 2, "#b0ad9c"); // licked hollow
      g.px(kx + 6, sh.y + 16, 2, 2, "#b0ad9c");
      g.px(kx - 1, sh.y + 20, 13, 2, "#5b4a30"); // the tray it sits in
    });
  }
  if (owns(st, "pelt")) {
    put(() => {
      g.px(kx + 1, sh.y + 3, 10, 4, "#3a3d47"); // the head, up on the wall
      g.px(kx + 1, sh.y + 1, 3, 3, "#3a3d47"); // ears
      g.px(kx + 8, sh.y + 1, 3, 3, "#3a3d47");
      g.px(kx + 3, sh.y + 4, 2, 1, "#e8b23c"); // the eyes still in it
      g.px(kx + 7, sh.y + 4, 2, 1, "#e8b23c");
      g.px(kx - 1, sh.y + 7, 14, 11, "#3a3d47"); // the skin, spread wide
      g.px(kx - 1, sh.y + 7, 14, 1, "#4a4e5a");
      g.px(kx + 4, sh.y + 18, 4, 5, "#4a4e5a"); // the brush hanging down
      g.px(kx + 5, sh.y + 22, 3, 2, "#8f939c");
    });
  }
  // the ring sits on the mantel, not on a peg with the tools
  if (owns(st, "ring")) {
    g.px(hx + I.hearth.w / 2 - 2, hy - 7, 4, 4, "#c9c3ae");
    g.px(hx + I.hearth.w / 2 - 1, hy - 6, 2, 2, "#2b2419");
    g.a(hx + I.hearth.w / 2 - 4, hy - 9, 8, 8, 232, 236, 214, 0.2);
  }

  if (spotlightBed) {
    const b2 = I.bed;
    const a = 0.3 + Math.sin(time / 160) * 0.16;
    for (let i = 0; i < b2.w + 12; i += 4) {
      g.a(b2.x - 6 + i, b2.y - 8, 2, 1, 224, 163, 60, a);
      g.a(b2.x - 6 + i, b2.y + b2.h + 6, 2, 1, 224, 163, 60, a);
    }
    for (let i = 0; i < b2.h + 14; i += 4) {
      g.a(b2.x - 6, b2.y - 8 + i, 1, 2, 224, 163, 60, a);
      g.a(b2.x + b2.w + 6, b2.y - 8 + i, 1, 2, 224, 163, 60, a);
    }
  }

  /*
   * And the man himself, drawn last so nothing in the room paints over him —
   * he stood behind the door at first. The room read as empty without him:
   * you walked into the place you live and there was nobody in it. He stands
   * in the middle of his own floor, turned towards the fire, and keeps his
   * idle ticks so the room is never quite still.
   */
  drawShepherd(g, Math.round(I.W / 2) - 8, I.floorY - SHEPHERD_H, {
    facing: -1, // looking across at the hearth
    tick: idleTick(time) ?? undefined,
  });
}

/* ================================================================== *
 * the pack
 * ================================================================== */

export const GLEN_ART: ArtPack = {
  id: "glen",
  name: "Glen",
  fluid: true,
  width: 240,
  height: 160,

  draw(g, s: Scene) {
    const st = s.state;
    const k = s.anim;
    const p = s.p;
    const L = layoutWorld(g.W, g.H, st, { shepherdAt: s.shepherdAt });
    /*
     * The night is two beats: `sleep` takes the light down and leaves it
     * down, `dawn` brings it back. Anything that happens in the dark — the
     * wolf, a fox raid — is queued between them, so a raid is no longer
     * played after the sun has already come up.
     */
    const night =
      k === "sleep" ? ease(clamp01(p)) : k === "dawn" ? 1 - ease(clamp01(p)) : k === "bark" || k === "fox" ? 1 : 0;

    setSpriteState({
      inverse: s.inverse,
      night,
      kit: {
        // he is not wearing it during the fight — the set piece hands it over
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

    // inside the house: a different room, not a different hill
    if (s.interior) {
      const I = layoutInterior(g.W, g.H);
      drawInterior(g, I, st, s.time, k === "sleep", !!s.spotlightBed);
        return;
    }

    // the ones that take the screen off the hill entirely
    if (k === "quit") return quitScene(g, L, p, s.time);
    if (k === "wolf") return wolfScene(g, L, s, true);
    if (k === "wolflost") return wolfScene(g, L, s, false);

    drawSky(g, L, st, night, s.time);
    drawBen(g, L, st, s.time);
    drawHills(g, L, st);
    drawGround(g, L, st, s.time);
    drawCroft(g, L, st, night, s.time);
    drawCart(g, L, st, s.time);

    if (k === "pub") {
      pubScene(g, L, p, s.time);
          return;
    }
    if (k === "fox") {
      foxRaid(g, L, s);
          return;
    }

    drawActors(g, L, s);
    drawWeather(g, L, st, s.time);
    if (night > 0) drawNight(g, L, st, night, s.time);

    if (s.active) drawHighlight(g, L, s.active, s.time);
    if (s.spotlight) drawHighlight(g, L, s.spotlight, s.time * 2.2);
  },
};
