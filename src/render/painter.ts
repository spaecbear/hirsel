/** A tiny integer-pixel drawing surface. Everything lands on whole pixels. */
export class Painter {
  constructor(
    readonly cx: CanvasRenderingContext2D,
    readonly W: number,
    readonly H: number,
  ) {}

  px(x: number, y: number, w: number, h: number, c: string) {
    this.cx.fillStyle = c;
    this.cx.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0));
  }

  /** rgba fill without building strings at every call site */
  a(x: number, y: number, w: number, h: number, r: number, g: number, b: number, alpha: number) {
    this.cx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    this.cx.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0));
  }

  wash(c: string, alpha: number) {
    this.cx.fillStyle = c;
    this.cx.globalAlpha = alpha;
    this.cx.fillRect(0, 0, this.W, this.H);
    this.cx.globalAlpha = 1;
  }

  /** 2×2 bayer dither between two colours — the pixel-art way to get a gradient */
  dither(x: number, y: number, w: number, h: number, a: string, b: string, mix: number) {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx += 1) {
        const t = ((xx & 1) + ((yy & 1) << 1)) / 4;
        this.px(x + xx, y + yy, 1, 1, t < mix ? b : a);
      }
    }
  }
}

export const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
