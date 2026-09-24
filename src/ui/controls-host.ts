/**
 * The listening half of ui/controls.ts: keys from the window, the pad polled
 * once a frame, and the pointer only to notice it is back in use.
 */
import { keyIntent, PadReader, type Device, type Intent } from "./controls";

const EDITABLE = (t: EventTarget | null): t is HTMLInputElement | HTMLTextAreaElement =>
  (t instanceof HTMLInputElement && (t.type === "text" || t.type === "search")) || t instanceof HTMLTextAreaElement;

export class Controls {
  device: Device = "pointer";
  onIntent: (i: Intent, native: boolean) => void = () => {};
  onDevice: (d: Device) => void = () => {};
  /** the right stick, every frame it is pushed */
  onWalk: (x: number, y: number, now: number) => void = () => {};
  private pad = new PadReader();

  constructor() {
    addEventListener("keydown", (e) => this.key(e));
    // any real pointer use hands control back to the pointer
    addEventListener("pointerdown", (e) => {
      if (e.pointerType) this.use("pointer");
    });
    let lx = -1;
    let ly = -1;
    addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      // a mouse nudged by a desk is not a mouse being used
      if (lx >= 0 && Math.hypot(e.clientX - lx, e.clientY - ly) > 6) this.use("pointer");
      lx = e.clientX;
      ly = e.clientY;
    });
  }

  private use(d: Device) {
    if (d === this.device) return;
    this.device = d;
    this.onDevice(d);
  }

  private key(e: KeyboardEvent) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    /*
     * Typing into a field is typing, not steering: WASD and Backspace belong
     * to the words. Escape gives the field up; up and down leave it for the
     * next thing, so a keyboard player is never trapped in the cheat box.
     */
    if (EDITABLE(t)) {
      if (e.key === "Escape") {
        t.blur();
        e.preventDefault();
        return;
      }
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    }
    const intent = keyIntent(e.key);
    if (!intent) return;
    if (e.repeat && (intent === "confirm" || intent === "back")) return;
    this.use("keys");

    const a = document.activeElement;
    const onButton = a instanceof HTMLButtonElement || a instanceof HTMLSelectElement;
    const onRange = a instanceof HTMLInputElement && a.type === "range";
    // the browser already clicks a focused button on Enter and Space, and moves a slider on the arrows
    const native = (intent === "confirm" && onButton) || (onRange && (intent === "left" || intent === "right"));
    if (!native) e.preventDefault();
    this.onIntent(intent, native);
  }

  /** once a frame */
  poll(now: number) {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find((p): p is Gamepad => !!p && p.connected);
    if (!pad) return;
    if (PadReader.active(pad)) this.use("pad");
    const { intents, walk } = this.pad.read(pad, now);
    for (const i of intents) this.onIntent(i, false);
    if (walk) this.onWalk(walk.x, walk.y, now);
  }
}
