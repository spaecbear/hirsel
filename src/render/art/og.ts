/**
 * "OG" art pack — the original prototype's scene, ported faithfully.
 * Kept as a retro option so the two looks can be compared side by side.
 * Deliberately unchanged: if it looks like the prototype, it is correct.
 */
import { clamp01, ease, type Painter } from "../painter";
import { drawMoonDisc, moonPos } from "../moon";
import { BREEDS, WEATHER } from "../../sim/config";
import { grade, isFullMoon, moonPhase, owns } from "../../sim/rules";
import type { GameState, Sheep } from "../../sim/types";
import type { ArtPack, Scene } from "./types";

const W = 468;
const H = 150;
const SHEP = { x: 214, y: 96 };

const br = (s: Sheep) => BREEDS[s.breed] ?? BREEDS.blackface;
const wx = (st: GameState) => WEATHER[st.forecast[0]];

function sheepHome(i: number) {
  return { x: 16 + (i % 7) * 62 + (i > 6 ? 24 : 0), y: 110 + (i > 6 ? 20 : 0) };
}

function drawSheep(g: Painter, x: number, y: number, s: Sheep, shorn: boolean) {
  const gr = grade(shorn ? 0 : s.fleece);
  const size = Math.min(9, 4 + gr.v * 0.5);
  const b = br(s);
  g.px(x, y, size + 4, size, gr.label === "matted" ? "#a49b80" : b.wool);
  g.px(x + size + 2, y - 2, 4, 4, b.face);
  g.px(x + 1, y + size, 2, 3, b.face);
  g.px(x + size, y + size, 2, 3, b.face);
}

function drawShepherd(g: Painter, o: { dy?: number; crook?: boolean; arm?: boolean } = {}) {
  const x = SHEP.x;
  const y = SHEP.y + (o.dy ?? 0);
  g.px(x + 2, y + 20, 3, 6, "#3a3129");
  g.px(x + 7, y + 20, 3, 6, "#3a3129");
  g.px(x, y + 8, 12, 13, "#4a4f3c");
  g.px(x + 3, y + 2, 7, 7, "#c9a583");
  g.px(x + 2, y, 9, 3, "#2f3327");
  if (o.crook) for (let i = 0; i < 9; i++) g.px(x + 14, y + 2 + i * 2, 2, 2, "#6b5433");
  if (o.arm) g.px(x + 11, y + 9, 4, 3, "#c9a583");
}

/** tricolour sheltie: black saddle, tan points, white blaze, ruff, socks, tail tip */
function drawDog(g: Painter, x: number, y: number, run: number) {
  const leg = run ? (Math.sin(run * Math.PI * 10) > 0 ? 0 : 2) : 0;
  g.px(x + 1, y + 7, 2, 4, "#f0ece0");
  g.px(x + 8, y + 7 - leg, 2, 4, "#f0ece0");
  g.px(x + 4, y + 7 + leg, 2, 4, "#f0ece0");
  g.px(x + 11, y + 7, 2, 4, "#f0ece0");
  g.px(x + 1, y + 2, 13, 6, "#241f1c");
  g.px(x + 1, y + 6, 13, 2, "#b07a3e");
  g.px(x + 13, y, 6, 6, "#241f1c");
  g.px(x + 15, y + 3, 4, 3, "#b07a3e");
  g.px(x + 16, y + 1, 3, 1, "#f0ece0");
  g.px(x + 13, y - 2, 2, 3, "#241f1c");
  g.px(x + 17, y - 2, 2, 3, "#241f1c");
  g.px(x + 1, y + 1, 4, 3, "#f0ece0");
  const tail = run ? Math.sin(run * Math.PI * 8) * 2 : 0;
  g.px(x - 4, y + 1 + tail, 5, 3, "#241f1c");
  g.px(x - 6, y + 2 + tail, 2, 2, "#f0ece0");
}

function drawFox(g: Painter, x: number, y: number, run: number) {
  const leg = Math.sin(run * Math.PI * 14) > 0 ? 0 : 2;
  g.px(x + 2, y + 6, 2, 4, "#2b201a");
  g.px(x + 8, y + 6 - leg, 2, 4, "#2b201a");
  g.px(x + 5, y + 6 + leg, 2, 4, "#2b201a");
  g.px(x + 10, y + 6, 2, 4, "#2b201a");
  g.px(x + 1, y + 2, 12, 5, "#b4472c");
  g.px(x + 12, y, 5, 5, "#b4472c");
  g.px(x + 16, y + 2, 3, 2, "#2b201a");
  g.px(x + 12, y - 2, 2, 3, "#8f3623");
  g.px(x + 15, y - 2, 2, 3, "#8f3623");
  g.px(x - 6, y + 1, 7, 3, "#b4472c");
  g.px(x - 8, y + 1, 3, 3, "#f0ece0");
}

function drawBase(g: Painter, st: GameState) {
  g.px(0, 0, W, H, wx(st).sky);
  const hills = [
    { c: "#2c3630", y: 62, a: 16 },
    { c: "#333f33", y: 76, a: 11 },
  ];
  hills.forEach((h, hi) => {
    for (let x = 0; x < W; x += 4) {
      const y = h.y + Math.round(Math.sin((x / W) * 4 + hi * 2) * h.a);
      g.px(x, y, 4, H - y, h.c);
    }
  });
  const p = st.pastures[st.at];
  const lush = p.grass / p.cap;
  g.px(0, 96, W, H - 96, lush > 0.6 ? "#6d8a4b" : lush > 0.3 ? "#5c6f42" : "#5a5638");
  for (let x = 0; x < W; x += 8) g.px(x, 96 + ((x / 8) % 2 ? 2 : 0), 4, 2, "#4e6339");
  for (let x = 0; x < W; x += 6) {
    g.px(x, 88, 5, 7, "#6d7263");
    g.px(x + 3, 83, 5, 5, "#6d7263");
  }
}

function drawWeather(g: Painter, st: GameState, t: number) {
  if (st.forecast[0] === "rain") {
    g.cx.fillStyle = "rgba(150,180,200,.30)";
    for (let i = 0; i < 130; i++) {
      const x = (i * 37 + t * 0.25) % W;
      const y = (i * 53 + t * 0.6) % H;
      g.cx.fillRect(x | 0, y | 0, 1, 5);
    }
  }
  if (st.forecast[0] === "mist") {
    g.cx.fillStyle = "rgba(200,205,200,.22)";
    g.cx.fillRect(0, 40 + Math.sin(t / 900) * 3, W, H - 40);
  }
}

function drawShear(g: Painter, p: number) {
  drawShepherd(g, { arm: true, dy: Math.sin(p * Math.PI * 10) * 0.6 });
  const open = Math.sin(p * Math.PI * 12) > 0 ? 2 : 0;
  g.px(SHEP.x + 15, SHEP.y + 9 - open, 6, 2, "#b9bcae");
  g.px(SHEP.x + 15, SHEP.y + 12 + open, 6, 2, "#b9bcae");
  for (let i = 0; i < 14; i++) {
    const t = (p * 1.5 + i / 14) % 1;
    g.px(SHEP.x + 18 + i * 9 - t * 10, 108 - t * 34, 3, 3, t > 0.8 ? "rgba(221,217,200,.35)" : "#ddd9c8");
  }
}

function drawMarket(g: Painter, p: number) {
  const x = -70 + p * (W + 140);
  drawShepherd(g, { crook: true, dy: Math.sin(p * Math.PI * 10) });
  g.px(x, 104, 34, 12, "#6b5433");
  g.px(x + 4, 96, 10, 9, "#ddd9c8");
  g.px(x + 17, 94, 11, 11, "#ddd9c8");
  const spin = Math.sin(p * 22) > 0;
  g.px(x + 4, 116, 7, 7, "#3f3527");
  g.px(x + 24, 116, 7, 7, "#3f3527");
  g.px(x + 6, 118 + (spin ? 0 : 3), 3, 1, "#7a6a4a");
  g.px(x + 26, 118 + (spin ? 0 : 3), 3, 1, "#7a6a4a");
  if (p > 0.55) {
    for (let i = 0; i < 7; i++) {
      const t = (p - 0.55) / 0.45;
      const yy = 120 - Math.sin(t * Math.PI) * (26 + i * 3);
      g.px(SHEP.x - 30 + i * 11, yy, 4, 4, "#e0a33c");
    }
  }
}

function drawPipe(g: Painter, p: number) {
  drawShepherd(g, { dy: p > 0.15 ? 1 : 0 });
  g.px(SHEP.x + 11, SHEP.y + 6, 4, 2, "#6b5433");
  g.px(SHEP.x + 15, SHEP.y + 4, 3, 4, "#4a3a24");
  for (let i = 0; i < 9; i++) {
    const t = (p * 1.1 + i / 9) % 1;
    const rise = t * 46;
    const sway = Math.sin(t * 7 + i) * 7;
    const sz = 2 + t * 4;
    g.cx.fillStyle = `rgba(214,214,204,${(0.55 * (1 - t)).toFixed(2)})`;
    g.cx.fillRect((SHEP.x + 16 + sway) | 0, (SHEP.y + 2 - rise) | 0, sz, sz);
  }
}

function drawMusic(g: Painter, p: number) {
  drawShepherd(g, { arm: true });
  g.px(SHEP.x + 11, SHEP.y + 9, 9, 8, "#7d4a4a");
  g.px(SHEP.x + 13, SHEP.y - 2, 2, 11, "#6b5433");
  g.px(SHEP.x + 17, SHEP.y - 5, 2, 14, "#6b5433");
  g.px(SHEP.x + 13, SHEP.y - 4, 2, 2, "#c9c3ae");
  g.px(SHEP.x + 17, SHEP.y - 7, 2, 2, "#c9c3ae");
  for (let i = 0; i < 5; i++) {
    const t = (p * 1.4 + i / 5) % 1;
    g.cx.fillStyle = `rgba(138,106,156,${(0.5 * (1 - t)).toFixed(2)})`;
    const r = t * 130;
    g.cx.fillRect((SHEP.x + 8 - r) | 0, (SHEP.y + 4) | 0, 3, 3);
    g.cx.fillRect((SHEP.x + 22 + r) | 0, (SHEP.y + 4) | 0, 3, 3);
    g.cx.fillRect((SHEP.x + 14) | 0, (SHEP.y + 4 - r * 0.45) | 0, 3, 3);
  }
}

function drawTend(g: Painter, p: number) {
  const idx = Math.floor(p * 3) % 3;
  const bob = Math.sin(p * Math.PI * 12) * 0.8;
  drawShepherd(g, { arm: true, dy: 6 + bob });
  g.px(SHEP.x + 12, SHEP.y + 13, 5, 3, "#c9a583");
  for (let i = 0; i < 5; i++) {
    const t = (p * 1.6 + i / 5) % 1;
    g.cx.fillStyle = `rgba(125,154,85,${(0.7 * (1 - t)).toFixed(2)})`;
    g.cx.fillRect((SHEP.x + 6 + i * 7) | 0, (SHEP.y + 10 - t * 22) | 0, 2, 2);
  }
  if (idx > 0) g.px(SHEP.x - 14 - idx * 4, SHEP.y + 16, 3, 3, "#e0a33c");
}

function drawMuck(g: Painter, p: number) {
  const x = 20 + ease(p) * (W - 90);
  drawShepherd(g, { dy: Math.sin(p * Math.PI * 14) * 0.7 });
  g.px(x, 110, 22, 9, "#5b4a30");
  g.px(x + 3, 104, 15, 7, "#3f3324");
  g.px(x + 2, 119, 6, 6, "#3f3527");
  for (let i = 0; i < 16; i++) {
    const t = (p * 2 + i / 16) % 1;
    const sx = x - t * 40 + i * 3;
    const sy = 112 - Math.sin(t * Math.PI) * 13;
    g.px(sx, sy, 3, 3, t < 0.5 ? "#4a3a24" : "#6d8a4b");
  }
  for (let i = 0; i < Math.floor(p * 14); i++) g.px(24 + i * 30, 124, 3, 5, "#8fae5f");
}

function drawBuySheep(g: Painter, st: GameState, p: number, breed?: string) {
  const x = -20 + ease(Math.min(1, p * 1.2)) * (SHEP.x - 40);
  drawShepherd(g, { crook: true });
  const last = st.flock[st.flock.length - 1];
  const s: Sheep = { id: -1, fleece: 1, breed: (breed as Sheep["breed"]) ?? last?.breed ?? "blackface", age: 0 };
  drawSheep(g, x, 116 - Math.abs(Math.sin(p * Math.PI * 7)) * 2, s, false);
  if (p > 0.7) {
    for (let i = 0; i < 4; i++) {
      const t = (p - 0.7) / 0.3;
      g.cx.fillStyle = `rgba(224,163,60,${(0.6 * (1 - t)).toFixed(2)})`;
      g.cx.fillRect((x + 4 + i * 6) | 0, (110 - t * 18) | 0, 2, 2);
    }
  }
}

function drawFoxRaid(g: Painter, st: GameState, p: number) {
  g.cx.fillStyle = "rgba(8,10,20,.86)";
  g.cx.fillRect(0, 0, W, H);
  for (let i = 0; i < 20; i++) g.px((i * 97) % W, (i * 41) % 50, 2, 2, "rgba(210,215,235,.55)");
  const mi = moonPhase(st.day);
  const mp = moonPos(mi, W);
  drawMoonDisc(g, mp.x | 0, mp.y | 0, 7, mi, 0.85);

  const outbound = p < 0.55;
  const fx = outbound ? -30 + (p / 0.55) * (W * 0.55) : W * 0.55 - ((p - 0.55) / 0.45) * (W * 0.75);
  const fy = 108 + Math.sin(p * Math.PI * 6) * 2;

  st.flock.slice(0, 10).forEach((s, i) => {
    const h = sheepHome(i);
    const flee = Math.max(0, 1 - Math.abs(h.x - fx) / 120) * ease(Math.min(1, p * 1.6));
    drawSheep(g, h.x + (h.x < fx ? -1 : 1) * flee * 36, h.y - flee * 3, s, false);
  });

  drawFox(g, fx, fy, p);
  if (!outbound) g.px(fx + 16, fy + 2, 7, 5, "#cfcab8");

  if (owns(st, "dog")) {
    const dx = 40 + ease(Math.min(1, p * 1.1)) * (W * 0.45);
    drawDog(g, dx, 112, p);
    if (p > 0.6) {
      for (let i = 0; i < 5; i++) {
        const t = (p - 0.6) / 0.4;
        g.cx.fillStyle = `rgba(240,236,224,${(0.5 * (1 - t)).toFixed(2)})`;
        g.cx.fillRect((dx + 20 + i * 8) | 0, (106 - t * 14) | 0, 2, 2);
      }
    }
  }
  drawShepherd(g, { dy: 2 });
}

function drawWolf(g: Painter, p: number, armed: boolean) {
  g.cx.fillStyle = "#080a14";
  g.cx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) g.px((i * 83) % W, (i * 29) % 62, 2, 2, "rgba(215,220,240,.65)");
  const mp2 = moonPos(4, W);
  drawMoonDisc(g, mp2.x | 0, 30, 17, 4, 1);

  for (let x = 0; x < W; x += 4) {
    const y = 70 + Math.round(Math.sin((x / W) * 3.2) * 13);
    g.px(x, y, 4, H - y, "#111524");
  }
  g.px(0, 100, W, H - 100, "#161b26");

  const stage = p < 0.34 ? 0 : p < 0.5 ? 1 : p < 0.62 ? 2 : 3;

  if (!armed) {
    const wx1 = 300 - ease(Math.min(1, p / 0.6)) * 200;
    const leg = Math.sin(p * Math.PI * 18) > 0 ? 0 : 3;
    for (let i = 0; i < 9; i++) {
      if (p > 0.45 + i * 0.05) continue;
      const hx = 30 + i * 46;
      const run = ease(Math.min(1, p * 1.4)) * 70;
      drawSheep(g, hx - (hx < wx1 ? run : -run), 118 - Math.abs(Math.sin(p * 9 + i)) * 3, { id: -1, fleece: 6, breed: "blackface", age: 0 }, false);
    }
    if (p > 0.6) drawSheep(g, 96, 120, { id: -1, fleece: 6, breed: "blackface", age: 0 }, false);

    g.px(wx1 + 3, 101, 3, 7, "#0d0f16");
    g.px(wx1 + 11, 101 - leg, 3, 7, "#0d0f16");
    g.px(wx1 + 7, 101 + leg, 3, 7, "#0d0f16");
    g.px(wx1 + 15, 101, 3, 7, "#0d0f16");
    g.px(wx1, 93, 20, 9, "#22252f");
    g.px(wx1 + 18, 89, 9, 8, "#22252f");
    g.px(wx1 + 25, 93, 4, 3, "#0d0f16");
    g.px(wx1 + 18, 85, 3, 5, "#22252f");
    g.px(wx1 + 23, 85, 3, 5, "#22252f");
    g.px(wx1 + 21, 91, 2, 2, "#d8a23c");
    g.px(wx1 + 25, 91, 2, 2, "#d8a23c");
    g.px(wx1 - 9, 91, 10, 4, "#22252f");

    const sx2 = 76 + Math.sin(p * Math.PI * 6) * 2;
    const sy2 = 88;
    g.px(sx2 + 2, sy2 + 20, 3, 6, "#2a2620");
    g.px(sx2 + 7, sy2 + 20, 3, 6, "#2a2620");
    g.px(sx2, sy2 + 8, 12, 13, "#3b4030");
    g.px(sx2 + 3, sy2 + 2, 7, 7, "#9d8368");
    g.px(sx2 + 2, sy2, 9, 3, "#23261d");
    for (let i = 0; i < 9; i++) g.px(sx2 + 14, sy2 + 4 + i * 2, 2, 2, "#6b5433");
    if (p > 0.75) {
      g.cx.fillStyle = `rgba(180,71,44,${(0.22 * Math.sin(((p - 0.75) / 0.25) * Math.PI)).toFixed(2)})`;
      g.cx.fillRect(0, 0, W, H);
    }
    return;
  }

  const wx0 = 300 - ease(Math.min(1, p / 0.34)) * 110;
  const wy0 = 92;
  if (stage < 3) {
    const leg = Math.sin(p * Math.PI * 16) > 0 ? 0 : 3;
    g.px(wx0 + 3, wy0 + 9, 3, 7, "#0d0f16");
    g.px(wx0 + 11, wy0 + 9 - leg, 3, 7, "#0d0f16");
    g.px(wx0 + 7, wy0 + 9 + leg, 3, 7, "#0d0f16");
    g.px(wx0 + 15, wy0 + 9, 3, 7, "#0d0f16");
    g.px(wx0, wy0 + 1, 20, 9, "#22252f");
    g.px(wx0 + 18, wy0 - 3, 9, 8, "#22252f");
    g.px(wx0 + 25, wy0 + 1, 4, 3, "#0d0f16");
    g.px(wx0 + 18, wy0 - 7, 3, 5, "#22252f");
    g.px(wx0 + 23, wy0 - 7, 3, 5, "#22252f");
    g.px(wx0 + 21, wy0 - 1, 2, 2, "#d8a23c");
    g.px(wx0 + 25, wy0 - 1, 2, 2, "#d8a23c");
    g.px(wx0 - 9, wy0 - 1, 10, 4, "#22252f");
  }

  const sx = 110;
  const sy = 88;
  g.px(sx + 2, sy + 20, 3, 6, "#2a2620");
  g.px(sx + 7, sy + 20, 3, 6, "#2a2620");
  g.px(sx, sy + 8, 12, 13, "#3b4030");
  g.px(sx + 3, sy + 2, 7, 7, "#9d8368");
  g.px(sx + 2, sy, 9, 3, "#23261d");

  if (stage < 2) {
    g.px(sx + 13, sy - 14, 3, 20, "#cdd3d8");
    g.px(sx + 11, sy + 5, 7, 3, "#8a6a3c");
    if (stage === 1) for (let i = 0; i < 6; i++) g.px(sx + 14, sy - 16 - i * 2, 3, 2, `rgba(232,236,214,${0.6 - i * 0.09})`);
  } else {
    g.px(sx + 13, sy + 4, 22, 3, "#cdd3d8");
    g.px(sx + 11, sy + 2, 4, 7, "#8a6a3c");
  }

  if (stage === 2) {
    const t = (p - 0.5) / 0.12;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const d = t * 30;
      g.cx.fillStyle = `rgba(232,236,214,${(0.9 * (1 - t)).toFixed(2)})`;
      g.cx.fillRect((wx0 + 6 + Math.cos(a) * d) | 0, (wy0 + 4 + Math.sin(a) * d) | 0, 3, 3);
    }
    g.cx.fillStyle = `rgba(255,255,240,${(0.55 * (1 - t)).toFixed(2)})`;
    g.cx.fillRect(0, 0, W, H);
  }

  if (stage === 3) {
    const t = (p - 0.62) / 0.38;
    g.px(sx - 4, sy + 6, 20, 10, "#3a3d47");
    g.px(sx - 8, sy + 8, 5, 5, "#22252f");
    for (let i = 0; i < 10; i++) {
      const q = (t + i / 10) % 1;
      g.cx.fillStyle = `rgba(138,106,156,${(0.55 * (1 - q)).toFixed(2)})`;
      g.cx.fillRect((sx - 14 + i * 7) | 0, (sy + 4 - q * 30) | 0, 3, 3);
    }
  }
}

function drawPub(g: Painter, p: number) {
  const inRoom = Math.min(1, p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1);
  g.cx.fillStyle = `rgba(20,23,15,${inRoom.toFixed(2)})`;
  g.cx.fillRect(0, 0, W, H);
  if (inRoom < 0.9) return;

  g.px(0, 0, W, H, "#2a2018");
  for (let x = 0; x < W; x += 26) g.px(x, 0, 2, H, "#221a13");
  g.px(30, 84, 54, 46, "#3a2c1e");
  g.px(38, 104, 38, 22, "#e0a33c");
  g.px(44, 110, 26, 14, "#f0c86a");
  g.px(120, 96, W - 150, 10, "#4a3826");
  g.px(120, 106, W - 150, 34, "#33261a");
  g.px(196, 64, 14, 34, "#4a4f3c");
  g.px(198, 58, 10, 7, "#2f3327");
  const fill = clamp01((p - 0.3) / 0.4);
  g.px(228, 74, 14, 24, "#9aa3a5");
  g.px(230, 96 - fill * 20, 10, fill * 20, "#c98a2e");
  if (fill > 0.9) g.px(230, 74, 10, 4, "#f2eddb");
  for (let i = 0; i < 4; i++) {
    const t = (p * 1.3 + i / 4) % 1;
    g.cx.fillStyle = `rgba(224,163,60,${(0.4 * (1 - t)).toFixed(2)})`;
    g.cx.fillRect((300 + i * 14) | 0, (70 - t * 30) | 0, 3, 3);
  }
}

function drawNight(g: Painter, st: GameState, p: number, time: number) {
  const dark = Math.sin(p * Math.PI);
  g.cx.fillStyle = `rgba(8,10,20,${(dark * 0.88).toFixed(2)})`;
  g.cx.fillRect(0, 0, W, H);
  if (dark <= 0.35) return;
  const a = (dark - 0.35) / 0.65;
  for (let i = 0; i < 26; i++) {
    const x = (i * 97) % W;
    const y = (i * 41) % 56;
    const tw = Math.sin(time / 300 + i) > 0 ? 1 : 0.5;
    g.cx.fillStyle = `rgba(220,225,240,${(a * tw * 0.9).toFixed(2)})`;
    g.cx.fillRect(x, y, 2, 2);
  }
  const idx = moonPhase(st.day);
  const pos = moonPos(idx, W);
  drawMoonDisc(g, pos.x | 0, pos.y | 0, isFullMoon(st.day) ? 9 : 7, idx, a);
}

export const OG_ART: ArtPack = {
  id: "og",
  name: "Original",
  width: W,
  height: H,
  draw(g, s: Scene) {
    const st = s.state;
    const k = s.anim;
    const p = s.p;
    drawBase(g, st);

    if (k === "pub") return drawPub(g, p);
    if (k === "fox") return drawFoxRaid(g, st, p);
    if (k === "wolf") return drawWolf(g, p, true);
    if (k === "wolflost") return drawWolf(g, p, false);

    st.flock.slice(0, 14).forEach((sh, i) => {
      const h = sheepHome(i);
      let x = h.x;
      let y = h.y;
      let shorn = false;
      if (k === "gather") {
        const e = ease(Math.min(1, p * 1.3));
        x = h.x + (SHEP.x - 24 + (i % 5) * 14 - h.x) * e;
        y = h.y + (118 - h.y) * e;
      }
      if (k === "move") x = h.x - (1 - ease(p)) * 140;
      if (k === "shear") {
        const turn = i / Math.max(1, st.flock.length);
        shorn = sh.fleece === 0 && p > turn * 0.7;
        if (Math.abs(p - turn * 0.7) < 0.08) y = h.y - 2;
      }
      if (k === "music") y = h.y - Math.abs(Math.sin(p * Math.PI * 3 + i)) * 2;
      drawSheep(g, x, y, sh, shorn);
    });

    if (k === "shear") drawShear(g, p);
    if (k === "market") drawMarket(g, p);
    if (k === "pipe") drawPipe(g, p);
    if (k === "music") drawMusic(g, p);
    if (k === "tend") drawTend(g, p);
    if (k === "muck") drawMuck(g, p);
    if (k === "buysheep") drawBuySheep(g, st, p, s.payload?.breed);
    if (k === "gather") drawShepherd(g, { crook: true, dy: Math.sin(p * Math.PI * 4) });
    if (k === "move") drawShepherd(g, { crook: true, dy: Math.sin(p * Math.PI * 8) });
    if (k === "sleep") {
      drawShepherd(g, {});
      if (owns(st, "dog")) drawDog(g, SHEP.x - 28, 116, 0);
      drawNight(g, st, p, s.time);
    }
    if (!k) drawShepherd(g, { crook: true });

    if (owns(st, "dog") && k !== "sleep") {
      if (k === "gather") drawDog(g, SHEP.x - 60 + ease(p) * 70, 118, p);
      else if (k === "move") drawDog(g, SHEP.x - 34 + Math.sin(p * Math.PI * 4) * 6, 118, p);
      else if (k === "muck") drawDog(g, SHEP.x - 30, 118, 0);
      else drawDog(g, SHEP.x - 28, 116 + (Math.sin(s.time / 700) > 0 ? 0 : 1), 0);
    }

    drawWeather(g, st, s.time);
  },
};
