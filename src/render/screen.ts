import { Painter } from "./painter";
import type { ArtPack } from "./art/types";

/**
 * Integer-scaled pixel art. The backing store is always a whole multiple of
 * the logical size and smoothing is off, so the browser never interpolates.
 *
 * Two kinds of pack:
 *  - fixed  (retro): a set logical size, scaled up to fit its element
 *  - fluid  (glen):  fills the viewport, so the logical size is derived from
 *                    it — a phone gets a tall hillside, a desktop a wide one.
 *                    The scale is chosen first and the logical size falls out
 *                    of it, which is what keeps the pixel grid honest.
 */
export class Screen {
  painter: Painter;
  private ctx: CanvasRenderingContext2D;
  private scale = 1;
  /** logical size, which for fluid packs changes with the window */
  W = 0;
  H = 0;

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
    this.canvas.width = 0; // force a resize on the next fit
    this.fit();
  }

  /** how many device pixels one logical pixel occupies */
  get pixelScale() {
    return this.scale;
  }

  /** CSS pixels → logical scene pixels, for hit-testing taps */
  toLogical(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * this.W,
      y: ((clientY - r.top) / r.height) * this.H,
    };
  }

  fit() {
    const dpr = window.devicePixelRatio || 1;
    if (this.pack.fluid) {
      // fill the element; pick a chunky scale first so sprites read as pixels,
      // then let the logical size be whatever fits inside it
      const cssW = this.canvas.clientWidth || window.innerWidth;
      const cssH = this.canvas.clientHeight || window.innerHeight;
      /*
       * Aim for a different logical width depending on orientation: a phone
       * held upright wants to be closer to the hill (bigger sprites, less
       * width), a desktop wants the vista. The scale is chosen against that
       * aim and stays a whole number, so the pixel grid never breaks.
       */
      const portrait = cssH > cssW;
      // landscape aims wider than it used to: at 250 the near ground was only
      // ~50 logical rows once the croft was standing in it, which read as
      // cramped on a desktop. More logical pixels means more hill, not
      // bigger sprites.
      const aim = portrait ? 168 : 320;
      const scale = Math.max(2, Math.min(6, Math.round(cssW / aim)));
      const W = Math.max(120, Math.floor(cssW / scale));
      const H = Math.max(120, Math.floor(cssH / scale));
      const dev = Math.max(1, Math.round(scale * Math.min(dpr, 2)));
      if (this.W !== W || this.H !== H || this.canvas.width !== W * dev) {
        this.W = W;
        this.H = H;
        this.canvas.width = W * dev;
        this.canvas.height = H * dev;
        this.painter = new Painter(this.ctx, W, H);
      }
      this.scale = dev;
      this.ctx.setTransform(dev, 0, 0, dev, 0, 0);
      this.ctx.imageSmoothingEnabled = false;
      return;
    }

    const { width: W, height: H } = this.pack;
    const cssW = this.canvas.clientWidth || W;
    const scale = Math.max(1, Math.round((cssW / W) * dpr));
    if (this.canvas.width !== W * scale) {
      this.canvas.width = W * scale;
      this.canvas.height = H * scale;
      this.canvas.style.aspectRatio = `${W} / ${H}`;
      this.painter = new Painter(this.ctx, W, H);
    }
    this.W = W;
    this.H = H;
    this.scale = scale;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }
}
