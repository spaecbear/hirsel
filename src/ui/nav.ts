/**
 * Playing without a pointer: what each intent does, wherever you are.
 *
 * The screen is always in exactly one layer — the credits, Settings, the end
 * of a run, the title, a sheet, a walkthrough card waiting on "Go on", the
 * retro panels, or the hill itself — and the topmost one gets the input.
 * In a DOM layer, a direction moves focus to the nearest button that way; on
 * the hill it moves a cursor between the things you can tap. Choose is a
 * click or a tap; back closes whatever is open.
 *
 * The pointer is never switched off: touching or clicking hands control back
 * to it, and the focus ring and button prompts go away until a key or the pad
 * is used again.
 */
import { Controls } from "./controls-host";
import type { Device, Dir, Intent, Quick } from "./controls";
import { toast } from "./dom";
import { nearestInDirection, type Box } from "./spatial";
import type { WorldUi } from "./world-ui";

type LayerKind = "credits" | "settings" | "over" | "title" | "event" | "sheet" | "tutorial" | "retro" | "hill";

interface Layer {
  kind: LayerKind;
  root: HTMLElement | null;
}

export interface NavHooks {
  world: WorldUi;
  isRetro: () => boolean;
  openSettings: () => void;
  closeSettings: () => void;
  closeCredits: () => void;
  /** Settings, opened at the list of keys */
  showKeys: () => void;
  /** the walkthrough's target, which is where the cursor should start */
  spotlight: () => string | null;
  /** a text field was chosen with the pad: ask for the words some other way (the Deck's keyboard) */
  textInput?: (field: HTMLInputElement) => void;
}

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";

const byId = (id: string) => document.getElementById(id);
const isOn = (id: string) => !!byId(id)?.classList.contains("on");

function visible(el: HTMLElement) {
  if (el.closest("[hidden]")) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}

export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
}

const boxOf = (el: HTMLElement): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
};

const scrolls = (n: HTMLElement) => /(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight;

/**
 * What to scroll so an info-only sheet can still be read: the box the focus
 * sits in if it scrolls, else the first box in the layer that does. The sky
 * sheet is all reading and one close button, and the button is in the
 * header — outside the part that scrolls.
 */
function scroller(el: HTMLElement | null, root: HTMLElement): HTMLElement | null {
  for (let n = el; n && n !== root.parentElement; n = n.parentElement) if (scrolls(n)) return n;
  return [...root.querySelectorAll<HTMLElement>("*")].find(scrolls) ?? null;
}

export class Nav {
  readonly controls = new Controls();
  private lastLayer = "";
  private lastSpotlight: string | null = null;

  constructor(private hooks: NavHooks) {
    this.controls.onIntent = (i, native) => this.handle(i, native);
    this.controls.onDevice = (d) => this.deviceChanged(d);
    this.controls.onQuick = (q) => this.quick(q);
    this.controls.onWalk = (x, y, now) => {
      if (this.layer().kind === "hill") this.hooks.world.stride(x, y, now);
    };
  }

  get device(): Device {
    return this.controls.device;
  }

  /** which layer has the input just now — the topmost one open */
  layer(): Layer {
    if (isOn("credits")) return { kind: "credits", root: byId("credits") };
    if (isOn("settings")) return { kind: "settings", root: byId("settings") };
    if (isOn("over")) return { kind: "over", root: byId("over") };
    if (isOn("demo-end")) return { kind: "over", root: byId("demo-end") };
    if (isOn("title")) return { kind: "title", root: byId("title") };
    if (isOn("event")) return { kind: "event", root: byId("event") };
    if (isOn("sheet")) return { kind: "sheet", root: byId("sheet") };
    const tut = byId("tutorial");
    if (tut?.classList.contains("on") && tut.querySelector(".tut-go")) return { kind: "tutorial", root: tut };
    if (this.hooks.isRetro()) return { kind: "retro", root: document.body };
    return { kind: "hill", root: null };
  }

  /** once a frame: read the pad, and land focus in any layer that has just opened */
  tick(now: number) {
    this.controls.poll(now);
    const L = this.layer();
    const key = `${L.kind}:${this.hooks.world.interior}`;
    const using = this.device !== "pointer";
    this.hooks.world.focusSheets = using;
    this.hooks.world.showKeys = this.device === "keys";
    if (key !== this.lastLayer) {
      this.lastLayer = key;
      if (using) this.landFocus(L);
    }
    // a focus left behind in a layer that has closed would swallow Enter
    const a = document.activeElement as HTMLElement | null;
    if (a && a !== document.body && L.root && !L.root.contains(a) && L.kind !== "retro") a.blur();
    if (L.kind === "hill" && using) {
      // the walkthrough moved on to something new: the cursor goes with it
      const spot = this.hooks.spotlight();
      if (spot && spot !== this.lastSpotlight) this.hooks.world.ensureFocus(spot as never);
      else this.hooks.world.ensureFocus();
    }
    this.lastSpotlight = this.hooks.spotlight();
  }

  /** where focus goes when a layer opens: the obvious choice, not the first button in the markup */
  private landFocus(L: Layer) {
    if (L.kind === "hill") {
      (document.activeElement as HTMLElement | null)?.blur?.();
      this.hooks.world.ensureFocus(this.hooks.spotlight() as never);
      return;
    }
    if (!L.root) return;
    // in order of preference: the first that is there and showing wins
    const prefer: Partial<Record<LayerKind, string[]>> = {
      title: ["#title-continue", "#title-new"],
      over: ["#over-stay", "#over-again", "#demo-wishlist"],
      tutorial: [".tut-go"],
      credits: ["#credits-close"],
      event: [".event-choices button:not([disabled])"],
      sheet: [".sheet-body button:not([disabled]):not([data-no-landing])", ".sheet-x"],
    };
    let pick: HTMLElement | null = null;
    // something asked to be landed on (the list of keys, opened by "?"): it wins, once
    const asked = L.root.querySelector<HTMLElement>("[data-land]");
    if (asked) {
      delete asked.dataset.land;
      asked.focus({ preventScroll: true });
      asked.scrollIntoView({ block: "start" });
      return;
    }
    for (const sel of prefer[L.kind] ?? []) {
      pick = [...L.root.querySelectorAll<HTMLElement>(sel)].find((e) => visible(e) && !(e as HTMLButtonElement).disabled) ?? null;
      if (pick) break;
    }
    pick ??= focusables(L.root)[0] ?? null;
    pick?.focus({ preventScroll: true });
    pick?.scrollIntoView({ block: "nearest" });
  }

  private deviceChanged(d: Device) {
    document.body.classList.toggle("input-pointer", d === "pointer");
    document.body.classList.toggle("input-keys", d === "keys");
    document.body.classList.toggle("input-pad", d === "pad");
    if (d === "pointer") {
      this.hooks.world.focusId = null;
      return;
    }
    this.lastLayer = ""; // land focus afresh on the next tick
  }

  /**
   * One intent. `native` is true when the browser is about to do the same
   * thing itself (Enter or Space on a focused button, arrows on a slider),
   * and the handler stands aside so nothing happens twice.
   */
  private handle(i: Intent, native: boolean) {
    const L = this.layer();

    if (i === "menu") {
      if (L.kind === "settings") this.hooks.closeSettings();
      else if (L.kind !== "credits") this.hooks.openSettings();
      return;
    }

    if (L.kind === "hill") return this.hill(i);

    // every DOM layer
    const root = L.root!;
    if (i === "back") return this.back(L);
    if (i === "sky") return;
    if (i === "confirm") {
      if (native) return;
      const a = document.activeElement as HTMLElement | null;
      if (a && root.contains(a) && a !== document.body) this.choose(a);
      else this.landFocus(L);
      return;
    }
    this.move(root, i, native);
  }

  /**
   * A quick key does its thing on the hill, or from over a sheet (which it
   * closes), or in the retro panels. Anywhere else — Settings, the title, the
   * end of a run — the letters mean nothing, so a stray key cannot spend a
   * tap from behind a menu.
   */
  private quick(q: Quick) {
    const L = this.layer().kind;
    if ("go" in q && q.go === "keys") {
      if (L === "hill" || L === "sheet" || L === "retro" || L === "title") this.hooks.showKeys();
      return;
    }
    if (L !== "hill" && L !== "sheet" && L !== "retro") return;
    if (L === "retro" && "go" in q && (q.go === "house" || q.go === "cart")) return;
    const why = this.hooks.world.quick(q);
    if (why) toast(why);
  }

  private hill(i: Intent) {
    const w = this.hooks.world;
    switch (i) {
      case "confirm":
        return w.confirmFocus();
      case "back":
        // out of the house; on the open hill, back is the menu, as Escape is everywhere
        if (!w.leaveHouse()) this.hooks.openSettings();
        return;
      case "sky":
        if (!w.interior) {
          w.focusId = "sky";
          w.hover = "sky";
          w.confirmFocus();
        }
        return;
      case "menu":
        return;
      default:
        w.moveFocus(i);
    }
  }

  private back(L: Layer) {
    switch (L.kind) {
      case "settings":
        return this.hooks.closeSettings();
      case "sheet":
        return this.hooks.world.close();
      case "credits":
        return this.hooks.closeCredits();
      default:
        return; // the title, the end of a run and a walkthrough card are only left by choosing
    }
  }

  /** choose a focused element: a text field asks for words, everything else is clicked */
  private choose(a: HTMLElement) {
    if (a instanceof HTMLInputElement && a.type === "text") {
      if (this.device === "pad" && this.hooks.textInput) this.hooks.textInput(a);
      else a.focus();
      return;
    }
    a.click();
  }

  private move(root: HTMLElement, dir: Dir, native: boolean) {
    const a = document.activeElement as HTMLElement | null;
    // a slider takes left and right for itself: the keys already do it, the pad is shown how
    if (a instanceof HTMLInputElement && a.type === "range" && (dir === "left" || dir === "right")) {
      if (native) return;
      // a pad press is a coarse thing: five at a time, not one
      if (dir === "left") a.stepDown(5);
      else a.stepUp(5);
      a.dispatchEvent(new Event("input", { bubbles: true }));
      a.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    const all = focusables(root);
    if (!all.length) return;
    if (!a || !root.contains(a) || a === document.body) {
      all[0].focus({ preventScroll: true });
      all[0].scrollIntoView({ block: "nearest" });
      return;
    }
    const next = nearestInDirection(
      boxOf(a),
      all.filter((e) => e !== a).map((e) => ({ el: e, box: boxOf(e) })),
      dir,
    );
    if (next) {
      next.el.focus({ preventScroll: true });
      next.el.scrollIntoView({ block: "nearest" });
      return;
    }
    // nothing further that way: scroll, so a long sheet of things to read can still be read
    const s = scroller(a, root);
    if (s && (dir === "up" || dir === "down")) s.scrollBy({ top: dir === "down" ? 80 : -80 });
  }
}
