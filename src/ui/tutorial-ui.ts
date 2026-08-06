/**
 * Running the first day's walkthrough.
 *
 * Watches the game rather than driving it: each step names a thing to point
 * at and a condition that means the player has done it, and the banner moves
 * on when the condition comes true. Nothing is blocked or forced — a player
 * who ignores the prompt and does something else entirely is not stuck, and
 * a step that stops making sense (nothing worth shearing) is skipped.
 */
import { $, el } from "./dom";
import { allowsInteraction, currentStep, latchDone, type TutorialStep } from "../sim/tutorial";
import type { Game } from "../sim/game";
import type { HotspotId } from "../render/layout";

export class TutorialUi {
  /** things the player has done that the game state alone doesn't record */
  seen = new Set<string>();
  private banner: HTMLElement;
  step: TutorialStep | null = null;
  active = false;
  /** held back while a cutscene has the screen */
  private suspended = false;
  onFinish: () => void = () => {};

  constructor(private game: Game) {
    this.banner = $("tutorial");
  }

  setGame(game: Game) {
    this.game = game;
  }

  start() {
    this.active = true;
    this.seen.clear();
    this.refresh();
  }

  /** hide the banner without losing progress, for the length of a cutscene */
  suspend(on: boolean) {
    if (this.suspended === on) return;
    this.suspended = on;
    if (on) this.banner.classList.remove("on");
    else {
      this.step = null; // force a redraw of whatever step we are on
      this.refresh();
    }
  }

  stop() {
    this.active = false;
    this.step = null;
    this.banner.classList.remove("on");
  }

  /** the tutorial notices things the state doesn't say on its own */
  note(what: string) {
    if (!this.active) return;
    this.seen.add(what);
    this.refresh();
  }

  /** what the scene should be pointing at, if anything */
  get spotlight(): HotspotId | null {
    if (!this.active || !this.step?.target) return null;
    return this.step.target === "interior-bed" ? null : (this.step.target as HotspotId);
  }

  get pointingAtBed() {
    return this.active && this.step?.target === "interior-bed";
  }

  /** the walkthrough locks everything but the lesson — see allowsInteraction */
  allows(id: HotspotId): boolean {
    return !this.active || allowsInteraction(this.step, id);
  }

  /** a refused tap: draw the eye back to the prompt rather than saying nothing */
  nudge() {
    if (!this.active) return;
    this.banner.classList.remove("nudge");
    void this.banner.offsetWidth; // restart the animation
    this.banner.classList.add("nudge");
  }

  refresh() {
    if (!this.active || this.suspended) return;
    const g = this.game.state;
    latchDone(g, this.seen); // a step once passed does not come back
    const next = currentStep(g, this.seen);

    if (!next) {
      this.stop();
      this.onFinish();
      return;
    }
    if (next.id === this.step?.id) return; // same step, nothing to redraw

    this.step = next;
    this.banner.innerHTML = "";
    this.banner.appendChild(el("p", { class: "tut-text" }, next.text));

    const row = el("div", { class: "tut-row" });
    if (next.readOnly) {
      const go = el("button", { class: "tut-go", type: "button" }, "Go on") as HTMLButtonElement;
      go.addEventListener("click", () => this.note(next.id === "tools" ? "tools" : next.id === "sleep" ? "sleep-warned" : next.id));
      row.appendChild(go);
    }
    const skip = el("button", { class: "tut-skip", type: "button" }, "Skip the walkthrough") as HTMLButtonElement;
    skip.addEventListener("click", () => {
      this.stop();
      this.onFinish();
    });
    row.appendChild(skip);
    this.banner.appendChild(row);
    this.banner.classList.add("on");
  }
}
