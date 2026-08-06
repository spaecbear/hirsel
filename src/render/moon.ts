import type { Painter } from "./painter";

/**
 * The moon, drawn at its true phase by masking a disc with the terminator
 * ellipse. Shared by both art packs — the phase is game information, not style.
 */
export function drawMoonDisc(g: Painter, mx: number, my: number, r: number, phase: number, alpha: number, lit = "232,236,214") {
  const p = phase / 8;
  const a = Math.cos(2 * Math.PI * p);
  const waxing = p < 0.5;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const nx = x / r;
      const ny = y / r;
      const edge = a * Math.sqrt(Math.max(0, 1 - ny * ny));
      const isLit = waxing ? nx > edge : nx < -edge;
      if (isLit) {
        g.cx.fillStyle = `rgba(${lit},${alpha.toFixed(2)})`;
      } else {
        g.cx.fillStyle = `rgba(46,52,64,${(alpha * 0.5).toFixed(2)})`;
      }
      g.cx.fillRect(mx + x, my + y, 1, 1);
    }
  }
  // maria, only where they would be lit
  if (phase >= 3 && phase <= 5) {
    const s = Math.max(1, r >> 2);
    g.cx.fillStyle = `rgba(215,219,196,${alpha.toFixed(2)})`;
    g.cx.fillRect(mx - Math.round(r * 0.35), my - Math.round(r * 0.25), s, s);
    g.cx.fillRect(mx + Math.round(r * 0.2), my + Math.round(r * 0.3), s, s);
  }
}

/** the moon travels an arc across the sky as the cycle turns */
export function moonPos(phase: number, W: number) {
  return { x: 34 + phase * ((W - 68) / 7), y: 44 - Math.sin((phase / 7) * Math.PI) * 26 };
}
