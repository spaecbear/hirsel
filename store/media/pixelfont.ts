/*
 * The pixel lettering for the store art and the trailer: the HIRSEL wordmark
 * and the few words the cards need, in 5×7 capitals drawn in blocks of k×k
 * game pixels, gorse lit from above, with an ink outline and a drop shadow so
 * it reads over sky, heather or black.
 */
import type { Painter } from "../../src/render/painter";

const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  ",": ["00000", "00000", "00000", "00000", "00000", "00100", "01000"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10010", "10001", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};
const GAP = 2; // glyph cells between letters, for the name and the cards; a line of prose sets them closer

/** the size of `text` in game pixels at block size `k` */
export function textSize(text: string, k: number, gap = GAP) {
  return { w: (text.length * 5 + (text.length - 1) * gap) * k + 2, h: 7 * k + 3 };
}

export interface Ink {
  top: string;
  mid: string;
  foot: string;
  shine: string;
}
export const GORSE: Ink = { top: "#f0c86a", mid: "#e0a33c", foot: "#c4862a", shine: "#f8dc96" };
export const WOOL: Ink = { top: "#f2eee0", mid: "#ddd9c8", foot: "#bdb9a8", shine: "#ffffff" };

export function pixelText(g: Painter, text: string, x: number, y: number, k: number, ink: Ink = GORSE, alpha = 1, gap = GAP) {
  const cells: [number, number][] = [];
  [...text.toUpperCase()].forEach((ch, i) => {
    (GLYPHS[ch] ?? GLYPHS[" "]).forEach((row, r) => [...row].forEach((b, c) => b === "1" && cells.push([i * (5 + gap) + c, r])));
  });
  const at = (cx: number, cy: number) => [x + 1 + cx * k, y + 1 + cy * k] as const;
  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
  const put = (px: number, py: number, w: number, h: number, c: string) => {
    if (alpha >= 1) g.px(px, py, w, h, c);
    else {
      const [r, gg, b] = hex(c);
      g.a(px, py, w, h, r, gg, b, alpha);
    }
  };
  for (const [cx, cy] of cells) {
    const [px, py] = at(cx, cy);
    g.a(px + 1, py + 2, k, k, 0, 0, 0, 0.45 * alpha);
  }
  for (const [cx, cy] of cells) {
    const [px, py] = at(cx, cy);
    put(px - 1, py - 1, k + 2, k + 2, "#14170f");
  }
  for (const [cx, cy] of cells) {
    const [px, py] = at(cx, cy);
    put(px, py, k, k, cy <= 1 ? ink.top : cy >= 5 ? ink.foot : ink.mid);
    if (cy === 0) put(px, py, k, Math.max(1, Math.floor(k / 3)), ink.shine);
  }
}
