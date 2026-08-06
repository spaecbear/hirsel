import { Painter } from "./painter";
import type { ArtPack } from "./art/types";

/**
 * Integer-scaled pixel art. The backing store is always a whole multiple of the
 * art pack's logical size, and smoothing is off — the browser never interpolates.
 */
export class Screen {
  painter: Painter;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private pack: ArtPack,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("no 2d context");
    this.ctx = ctx;
    this.painter = new Painter(ctx, pack.width, pack.height);
    this.fit();
  }

  setPack(pack: ArtPack) {
    this.pack = pack;
    this.painter = new Painter(this.ctx, pack.width, pack.height);
    this.canvas.width = 0; // force a resize on the next fit
    this.fit();
  }

  fit() {
    const { width: W, height: H } = this.pack;
    const cssW = this.canvas.clientWidth || W;
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(1, Math.round((cssW / W) * dpr));
    if (this.canvas.width !== W * scale) {
      this.canvas.width = W * scale;
      this.canvas.height = H * scale;
      this.canvas.style.aspectRatio = `${W} / ${H}`;
    }
    this.scale = scale;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  get logicalScale() {
    return this.scale;
  }
}
