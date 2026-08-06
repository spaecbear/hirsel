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
import { boundsOf, layoutWorld, type WorldLayout } from "../layout";
import { drawText, drawTextCentred, textWidth } from "../text";
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
  drawWolfBeast,
  drawWoolSacks,
  hash,
  isInverse,
  setSpriteState,
  shade,
} from "../sprites";
import { isFullMoon, moonPhase, owns, priceOn } from "../../sim/rules";
import type { GameState, Sheep } from "../../sim/types";
import type { ArtPack, Scene, SkyMessage } from "./types";

const wxOf = (st: GameState) => st.forecast[0];

/* ================================================================== *
 * sky
 * ================================================================== */

function drawSky(g: Painter, L: WorldLayout, st: GameState, night: number, time: number) {
  const [top, low] = SKY[wxOf(st)];
  const band = L.horizonY + 8;
  // per-row dither, so the ramp reads as one sky rather than a stack of stripes
  for (let y = 0; y < band; y++) {
    const mix = Math.pow(y / band, 1.4);
    for (let x = 0; x < L.W; x += 2) {
      const t = ((x >> 1) & 1) + ((y & 1) << 1);
      g.px(x, y, 2, 1, t / 4 < mix ? low : top);
    }
  }

  if (wxOf(st) === "sun" && night < 0.4) {
    const sx = Math.round(L.W * 0.76);
    const sy = Math.round(L.horizonY * 0.3);
    g.px(sx, sy, 9, 9, "#f0d79a");
    g.px(sx - 2, sy + 2, 13, 5, "#f0d79a");
    g.a(sx - 5, sy - 4, 19, 17, 240, 215, 154, 0.16);
  }

  // birds, only when the weather is fit for them
  if ((wxOf(st) === "sun" || wxOf(st) === "overcast") && night < 0.3) {
    for (let i = 0; i < 4; i++) {
      const drift = (time / 90 + i * 60) % (L.W + 40);
      const x = Math.round(L.W - drift);
      const y = Math.round(L.horizonY * (0.22 + hash(i * 7) * 0.4) + Math.sin(time / 700 + i) * 2);
      g.px(x, y, 3, 1, "#2c3a3a");
      g.px(x + 3, y - 1, 3, 1, "#2c3a3a");
    }
  }
}

/** the far ben, with snow in the gullies — sits above the near hills */
function drawBen(g: Painter, L: WorldLayout) {
  const base = L.horizonY;
  for (let x = 0; x < L.W; x += 2) {
    const y = base - Math.round(Math.sin(x / 61) * 13 + Math.sin(x / 17) * 3 + 12);
    g.px(x, y, 2, base - y + 2, "#39434a");
    g.px(x, y, 2, 2, "#4a555c");
    if (hash(x) > 0.86) g.px(x, y + 2, 2, 3, "#8e9aa0");
  }
}

/** the near hills, coloured by the ground you are standing on */
function drawHills(g: Painter, L: WorldLayout, st: GameState) {
  const at = st.at;
  const base = at === 2 ? "#3d4438" : at === 1 ? "#3a4a30" : "#38492f";
  for (let x = 0; x < L.W; x += 2) {
    const y = L.horizonY + Math.round(Math.sin(x / 47 + at) * 6 + Math.sin(x / 13) * 2);
    g.px(x, y, 2, L.groundY - y + 2, base);
    g.px(x, y, 2, 1, shade(base, 14));
    const h = hash(x + at * 100);
    if (h > 0.93) g.px(x, y + 3 + Math.round(h * 8), 2, 2, C.heatherDim);
    else if (h > 0.88) g.px(x, y + 4 + Math.round(h * 9), 2, 2, "#6a6534");
  }
}

/* ================================================================== *
 * ground
 * ================================================================== */

function drawGround(g: Painter, L: WorldLayout, st: GameState, time: number) {
  const p = st.pastures[st.at];
  const lush = p.grass / p.cap;
  const pal = lush > 0.45 ? C.turf : C.turfDry;
  const mix = clamp01((lush - 0.15) / 0.7);
  const h = L.H - L.groundY;

  g.dither(0, L.groundY, L.W, 6, pal[0], pal[1], mix);
  g.px(0, L.groundY + 6, L.W, h, pal[1]);
  // tufts, thicker where the grass is
  for (let x = 0; x < L.W; x += 3) {
    const v = hash(x * 1.7 + st.at * 31);
    if (v < 0.25 + mix * 0.45) {
      const y = L.groundY + 6 + Math.round(hash(x) * (h - 8));
      g.px(x, y, 2, 2, pal[2]);
      if (v > 0.62) g.px(x, y - 2, 1, 2, shade(pal[2], 12));
    }
  }
  g.px(0, L.groundY - 1, L.W, 1, C.turfDark);

  if (st.at === 0) {
    // the low field: the loch behind the dyke
    const wy = L.groundY + Math.round(h * 0.06);
    g.px(0, wy, Math.round(L.W * 0.42), 9, C.water);
    for (let x = 0; x < L.W * 0.42; x += 4) {
      if (Math.sin(x / 9 + time / 900) > 0.3) g.px(x, wy + 2 + ((x / 4) % 3), 3, 1, C.waterLit);
    }
    drawDyke(g, 0, wy + 9, L.W);
  } else if (st.at === 1) {
    drawDyke(g, 0, L.groundY + Math.round(h * 0.12), Math.round(L.W * 0.7));
    for (let i = 0; i < 4; i++) {
      const x = Math.round(L.W * (0.1 + i * 0.26));
      const y = L.groundY + Math.round(h * 0.2);
      g.px(x, y, 13, 7, "#3f5a2e");
      g.px(x + 2, y - 2, 9, 4, "#4a6a35");
      for (let j = 0; j < 4; j++) g.px(x + 2 + j * 3, y - 1 + (j % 2) * 3, 2, 2, C.gorse);
    }
  } else {
    // the corrie: scree and boulders
    for (let i = 0; i < 10; i++) {
      const x = Math.round(hash(i * 3) * (L.W - 14));
      const y = L.groundY + Math.round(hash(i * 5) * (h - 8));
      const w = 5 + Math.round(hash(i * 7) * 6);
      g.px(x, y, w, 4, C.rock);
      g.px(x, y, w, 2, C.rockLit);
      g.px(x, y + 4, w, 1, C.rockDark);
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

const MSG_COLOUR: Record<string, string> = {
  "": "#b9c0ac",
  hi: "#ddd9c8",
  gold: "#e0a33c",
  bad: "#b4472c",
  cozy: "#8a6a9c",
};

function drawMessages(g: Painter, L: WorldLayout, messages: SkyMessage[]) {
  let y = Math.round(L.horizonY * 0.42);
  for (const m of messages) {
    // in fast, out slow: it should be readable before it starts leaving
    const fade = m.age < 0.12 ? m.age / 0.12 : m.age > 0.6 ? 1 - (m.age - 0.6) / 0.4 : 1;
    const alpha = clamp01(fade) * 0.92;
    if (alpha > 0.02) {
      const drift = Math.round(m.age * 7);
      drawTextCentred(g, m.text, L.W / 2, y - drift, MSG_COLOUR[m.cls] ?? MSG_COLOUR[""], alpha);
    }
    y += 11;
  }
}

/* ================================================================== *
 * the HUD
 * ================================================================== */

function drawHud(g: Painter, L: WorldLayout, st: GameState) {
  const h = 13;
  g.a(0, 0, L.W, h, 11, 13, 8, 0.72);
  g.a(0, h, L.W, 1, 60, 74, 46, 0.8);

  const left = `DAY ${st.day}`;
  const taps = `${"·".repeat(Math.max(0, st.taps))}${st.taps === 0 ? "spent" : ""}`;
  drawText(g, left, 3, 3, "#ddd9c8", 0.95);
  drawText(g, taps, 3 + textWidth(left) + 6, 3, st.taps === 0 ? "#b4472c" : "#e0a33c", 0.95);

  /*
   * The weather is not written down: it is falling on the hill in front of
   * you. That leaves room for the numbers you cannot see by looking, which
   * is what stops the three groups colliding on a phone.
   */
  const right = `£${st.money}  ${st.wool}st`;
  drawText(g, right, L.W - textWidth(right) - 3, 3, "#ddd9c8", 0.95);

  // the one warning always on screen without being a sentence
  if (isFullMoon(st.day)) {
    const t = "FULL MOON";
    const cx = L.W / 2;
    if (cx - textWidth(t) / 2 > 3 + textWidth(left) + textWidth(taps) + 10) {
      drawTextCentred(g, t, cx, 3, "#e8ecd6", 0.95);
    }
  }
}

/** a hint of what the thing under your finger is */
function drawHoverLabel(g: Painter, L: WorldLayout, label: string) {
  const w = textWidth(label) + 8;
  const x = Math.round(L.W / 2 - w / 2);
  const y = L.H - 16;
  g.a(x, y, w, 12, 11, 13, 8, 0.75);
  g.a(x, y, w, 1, 224, 163, 60, 0.5);
  drawText(g, label, x + 4, y + 3, "#e0a33c", 0.95);
}

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
    let { x, y } = home;
    let shorn = false;
    let run = 0;
    let graze = Math.sin(s.time / 1400 + i * 2) > 0;

    if (k === "gather") {
      const e = ease(clamp01(p * 1.3));
      x = home.x + (L.shepherd.x - 20 + (i % 5) * 9 - home.x) * e;
      y = home.y + (L.shepherd.y + 14 - home.y) * e;
      run = p;
      graze = false;
    }
    if (k === "move") {
      x = home.x - (1 - ease(p)) * (L.W * 0.9);
      run = p;
      graze = false;
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
    drawSheep(g, x, y, sh, { shorn, graze, run, flip: i % 4 === 0 });
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
  if (owns(st, "dog")) {
    if (k === "gather") drawDog(g, sx - 50 + ease(p) * 56, sy + 16, p);
    else if (k === "move") drawDog(g, sx - 30 + Math.sin(p * Math.PI * 4) * 8, sy + 16, p);
    else drawDog(g, L.dog.x, L.dog.y + (Math.sin(s.time / 700) > 0 ? 0 : 1), 0);
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
    case "tend":
      drawShepherd(g, sx, sy + 4, { arm: 4 });
      g.px(sx + 12, sy + 17, 5, 3, "#c9a583");
      for (let i = 0; i < 6; i++) {
        const t = (p * 1.6 + i / 6) % 1;
        g.a(sx + 4 + i * 6, sy + 10 - t * 22, 2, 2, 125, 154, 85, 0.7 * (1 - t));
      }
      break;
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
      g.px(sx + 10, sy + 8, 10, 9, "#7d4a4a");
      g.px(sx + 12, sy - 4, 2, 13, "#6b5433");
      g.px(sx + 16, sy - 8, 2, 17, "#6b5433");
      g.px(sx + 12, sy - 6, 2, 2, "#c9c3ae");
      g.px(sx + 16, sy - 10, 2, 2, "#c9c3ae");
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
    case "muck": {
      const x = L.W * 0.1 + ease(p) * (L.W * 0.7);
      drawShepherd(g, sx, sy, { walk: p });
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
      drawShepherd(g, sx, sy, { crook: true, walk: p });
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
      drawShepherd(g, sx, sy, { crook: true, walk: p });
      break;
    case "sleep":
      drawShepherd(g, sx, sy, {});
      break;
    default:
      // walking to a spot he was sent to, or standing at his mark
      if (s.walking) drawShepherd(g, sx, sy, { crook: true, walk: s.time / 90 });
      else drawShepherd(g, sx, sy + (Math.sin(s.time / 1600) > 0 ? 0 : 1), { crook: true });
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

  if (isInverse()) drawRam(g, fx, fy - 2, p);
  else drawFox(g, fx, fy, p, outbound ? 1 : -1);
  if (!outbound) g.px(fx + 1, fy + 1, 8, 5, isInverse() ? "#b4472c" : "#cfcab8");

  if (owns(st, "dog")) {
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
    drawShepherd(g, sx + Math.sin(p * Math.PI * 6) * 2, sy, { crook: true });
    if (p > 0.75) g.a(0, 0, L.W, L.H, 180, 71, 44, 0.22 * Math.sin(((p - 0.75) / 0.25) * Math.PI));
    return;
  }

  const stage = p < 0.34 ? 0 : p < 0.5 ? 1 : p < 0.62 ? 2 : 3;
  const wolfX = L.W * 0.9 - march(0.42) * (L.W * 0.45);
  if (stage < 3) drawWolfBeast(g, wolfX, sy + 4, p, bodyAlpha, eyeGlow);

  if (stage === 3) {
    setSpriteState({ kit: { pelt: true } });
    drawShepherd(g, sx, sy, {});
    setSpriteState({ kit: { pelt: false } });
    const t = (p - 0.62) / 0.38;
    for (let i = 0; i < 12; i++) {
      const q = (t + i / 12) % 1;
      g.a(sx - 16 + i * 7, sy + 4 - q * 34, 3, 3, 138, 106, 156, 0.55 * (1 - q));
    }
  } else {
    drawShepherd(g, sx, sy, {});
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

/** the pub leaves the glen entirely — that is what makes £8 feel like an event */
function pubScene(g: Painter, L: WorldLayout, p: number, time: number) {
  const inRoom = clamp01(p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1);
  g.a(0, 0, L.W, L.H, 20, 23, 15, inRoom);
  if (inRoom < 0.92) return;

  g.px(0, 0, L.W, L.H, "#2a2018");
  for (let x = 0; x < L.W; x += 28) g.px(x, 0, 3, L.H, "#221a13");
  for (let y = 0; y < L.H; y += 34) g.a(0, y, L.W, 1, 0, 0, 0, 0.16);

  const fy = Math.round(L.H * 0.4);
  g.px(6, fy, 54, 56, "#3a2c1e"); // hearth
  g.px(12, fy + 8, 42, 8, "#241a12");
  const flick = Math.sin(time / 130) * 3;
  g.px(16, fy + 26, 34, 28, "#c07a24");
  g.px(22, fy + 32 + flick, 22, 20, C.fire);
  g.px(28, fy + 38 + flick, 12, 12, "#f0c86a");
  g.a(0, fy - 8, 70, 70, 240, 180, 80, 0.12 + Math.sin(time / 200) * 0.03);

  const by = Math.round(L.H * 0.52);
  g.px(Math.round(L.W * 0.38), by, Math.round(L.W * 0.6), 10, "#4a3826"); // bar
  g.px(Math.round(L.W * 0.38), by, Math.round(L.W * 0.6), 2, "#5f4a32");
  g.px(Math.round(L.W * 0.38), by + 10, Math.round(L.W * 0.6), Math.max(10, L.H - by - 10), "#33261a");

  const mx = Math.round(L.W * 0.5);
  g.px(mx, by - 34, 16, 36, "#4a5540"); // him at the bar, back to us
  g.px(mx + 2, by - 42, 12, 8, "#2f3327");
  g.px(mx + 16, by - 22, 5, 12, "#c9a583");

  const fill = clamp01((p - 0.3) / 0.4); // the pint
  g.px(mx + 24, by - 26, 16, 26, "#9aa3a5");
  g.px(mx + 26, by - 4 - fill * 22, 12, fill * 22, "#c98a2e");
  if (fill > 0.9) {
    g.px(mx + 26, by - 26, 12, 5, "#f2eddb");
    g.px(mx + 28, by - 28, 8, 3, "#f2eddb");
  }
  for (let i = 0; i < 5; i++) {
    const t = (p * 1.3 + i / 5) % 1;
    g.a(L.W * 0.75 + i * 8, by - 12 - t * 30, 3, 3, 224, 163, 60, 0.4 * (1 - t));
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
    const t = clamp01((p - 0.05) / 0.2);
    drawTextCentred(g, "You handed in your notice.", L.W / 2, Math.round(L.H * 0.2), "#ddd9c8", t * (p > 0.34 ? clamp01((0.42 - p) / 0.08) : 1));
    return;
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
  for (let y = 0; y < L.H; y++) {
    const mix = Math.pow(y / L.H, 1.4);
    for (let x = 0; x < L.W; x += 2) {
      const d = ((x >> 1) & 1) + ((y & 1) << 1);
      g.px(x, y, 2, 1, d / 4 < mix ? low : top);
    }
  }
  // the hill rising to the right, him climbing it
  const baseY = Math.round(L.H * 0.94);
  for (let x = 0; x < L.W; x += 2) {
    const y = baseY - Math.round((x / L.W) * L.H * 0.55) - Math.round(Math.sin(x / 23) * 3);
    g.px(x, y, 2, L.H - y, "#3a4a30");
    g.px(x, y, 2, 1, "#4a5a3c");
  }
  const wx = L.W * 0.1 + t * L.W * 0.6;
  const wy = baseY - (wx / L.W) * L.H * 0.55 - 26;
  drawShepherd(g, Math.round(wx), Math.round(wy), { crook: true, walk: time / 90 });
  const fade = clamp01((p - 0.68) / 0.12) * clamp01((1 - p) / 0.08);
  drawTextCentred(g, "A hill, and whatever you can make of it.", L.W / 2, Math.round(L.H * 0.18), "#ddd9c8", fade);
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
    const night = k === "sleep" ? Math.sin(p * Math.PI) : 0;

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
        watch: owns(st, "watch"),
        oilskin: owns(st, "oilskin"),
        saltlick: owns(st, "saltlick"),
      },
    });

    // the ones that take the screen off the hill entirely
    if (k === "quit") return quitScene(g, L, p, s.time);
    if (k === "wolf") return wolfScene(g, L, s, true);
    if (k === "wolflost") return wolfScene(g, L, s, false);

    drawSky(g, L, st, night, s.time);
    drawBen(g, L);
    drawHills(g, L, st);
    drawGround(g, L, st, s.time);
    drawCroft(g, L, st, night, s.time);
    drawCart(g, L, st, s.time);

    if (k === "pub") {
      pubScene(g, L, p, s.time);
      drawMessages(g, L, s.messages ?? []);
      drawHud(g, L, st);
      return;
    }
    if (k === "fox") {
      foxRaid(g, L, s);
      drawMessages(g, L, s.messages ?? []);
      drawHud(g, L, st);
      return;
    }

    drawActors(g, L, s);
    drawWeather(g, L, st, s.time);
    if (night > 0) drawNight(g, L, st, night, s.time);

    if (s.active) drawHighlight(g, L, s.active, s.time);
    drawMessages(g, L, s.messages ?? []);
    drawHud(g, L, st);
    if (s.hover) {
      const spot = L.hotspots.find((h) => h.id === s.hover);
      if (spot) drawHoverLabel(g, L, hoverLabel(spot.id, st));
    }
  },
};

function hoverLabel(id: string, st: GameState): string {
  switch (id) {
    case "croft":
      return owns(st, "ring") ? "The croft — finished" : "The croft — build it up";
    case "cart":
      return `The cart — wool ${priceOn(st.day)}p a stone`;
    case "flock":
      return `The flock — ${st.flock.length} on the hill`;
    case "shepherd":
      return "Yourself";
    case "ground":
      return `${st.pastures[st.at].name} — grass ${Math.round(st.pastures[st.at].grass)}%`;
    case "hills":
      return "The hills — move the flock";
    default:
      return "";
  }
}
