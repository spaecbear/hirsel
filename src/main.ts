import "./styles.css";

import { Game } from "./sim/game";
import { owns } from "./sim/rules";
import { loadSettings, prefersReducedMotion, saveSettings, type Settings } from "./sim/settings";
import { clearSave, exportFile, hasSave, importFile, readSave, saveGame } from "./sim/save";
import { lexicon } from "./sim/lexicon";
import { revealNextCheat } from "./sim/cheats";
import { tutorialSetup } from "./sim/tutorial";
import type { GameState } from "./sim/types";

import { Animator } from "./render/animator";
import { Screen } from "./render/screen";
import { GLEN_ART } from "./render/art/glen";
import { HIRSEL_ART } from "./render/art/hirsel";
import type { ArtPack } from "./render/art/types";

import { AudioEngine } from "./audio/engine";
import { Score } from "./audio/score";
import { Rain } from "./audio/rain";
import { HIRSEL_AIR, TOD_JIG } from "./audio/tunes";
import { Sfx } from "./audio/sfx";

import { View } from "./ui/view";
import { WorldUi } from "./ui/world-ui";
import { SkyFeed } from "./ui/sky-feed";
import { TutorialUi } from "./ui/tutorial-ui";
import { buildSettings } from "./ui/settings-panel";
import { $, toast } from "./ui/dom";

/* ---------- state ---------- */
const settings: Settings = loadSettings();
const packs: Record<string, ArtPack> = { glen: GLEN_ART, retro: HIRSEL_ART };

let game = new Game();
const animator = new Animator();
const canvas = $<HTMLCanvasElement>("scene");
const screen = new Screen(canvas, packs[settings.ui] ?? GLEN_ART);
const audio = new AudioEngine();
const score = new Score(audio);
const rain = new Rain(audio);
const sfx = new Sfx(audio);
const sky = new SkyFeed();
const view = new View(game, animator, settings);
const world = new WorldUi(game, screen, animator, settings);
const tutorial = new TutorialUi(game);
tutorial.onFinish = () => {
  if (!settings.tutorialSeen) applySettings({ tutorialSeen: true });
  game.freeTaps = false;
};
world.onNote = (what) => tutorial.note(what);

/* ---------- opening ---------- */
function openingLines(g: Game) {
  const lex = lexicon(settings.inverse);
  g.say(`You handed in your notice. Six ${lex.beasts}, forty pounds, and a hill.`, "gold");
  g.say(`${lex.woolCap} is worth most between the fourth and ninth day of growth. After that it mats.`, "hi");
}

function wire(g: Game) {
  g.onAnim = (anim, after, payload) => {
    sfx.forAnim(anim, owns(g.state, "dog"));
    animator.play(anim, after, payload);
    render();
  };
  g.onAchievement = (a) => {
    toast(`Achievement — ${a.name}`);
    sky.add(`— ${a.name} —`, "gold", performance.now());
  };
  g.lex = lexicon(settings.inverse);
  g.zen = settings.zen;
  g.subscribe(render);
  g.hydrateAchievements();
}

/** both interfaces redraw from the same signal */
function render() {
  if (settings.ui === "retro") view.render();
  else world.refresh();
  /*
   * A run can end without an animation playing — selling the last beast at
   * the cart, for one. The end screen used to be raised only from the
   * animator going idle, so those endings left the game quietly over with
   * nothing on screen. Anything that finishes a run raises it now; the
   * animator check keeps it from cutting in front of a fox raid or a
   * mauling that is still playing out.
   */
  if (game.state.over && !animator.busy) showEnd();
  tutorial.refresh();
}

function startGame(state?: GameState, opts: { intro?: boolean } = {}) {
  endShown = false;
  animator.clear();
  sky.clear();
  tutorial.stop();
  game = new Game(state);
  view.setGame(game);
  world.setGame(game);
  tutorial.setGame(game);
  wire(game);

  // a brand new run, by a player who has never had one: walk them through it
  const teaching = !state && !settings.tutorialSeen && settings.ui === "glen";
  if (teaching) {
    tutorialSetup(game.state);
    game.freeTaps = true;
  }
  if (!state) openingLines(game);
  if (teaching) tutorial.start();
  view.goTab("day");
  lastDay = game.state.day;
  // the day you walked out, before the first day on the hill
  if (opts.intro && settings.ui === "glen" && !prefersReducedMotion(settings)) {
    animator.play("quit");
  }
  render();
}

/* ---------- settings application ---------- */
function applySettings(patch: Partial<Settings>) {
  const wasUi = settings.ui;
  Object.assign(settings, patch);
  saveSettings(settings);
  audio.setLevels({ master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted });
  animator.reduced = prefersReducedMotion(settings);
  document.body.classList.toggle("no-motion", animator.reduced);
  score.setTune(settings.inverse ? TOD_JIG : HIRSEL_AIR);
  game.lex = lexicon(settings.inverse);
  game.zen = settings.zen;

  if (settings.ui !== wasUi || !canvas.parentElement) applyUiMode();
  soundBtn.textContent = settings.muted ? "Sound off" : "Sound on";
  soundBtn.setAttribute("aria-pressed", String(!settings.muted));
  render();
}

/** move the one canvas between the two shells and re-fit it */
function applyUiMode() {
  const glen = settings.ui === "glen";
  document.body.classList.toggle("mode-glen", glen);
  document.body.classList.toggle("mode-retro", !glen);
  const host = $(glen ? "glen-stage" : "retro-stage");
  if (glen) host.appendChild(canvas);
  else host.insertBefore(canvas, $("tabs"));
  world.close();
  screen.setPack(packs[settings.ui] ?? GLEN_ART);
  screen.fit();
  measureScene();
}

const soundBtn = $<HTMLButtonElement>("btn-sound");

const settingsUi = buildSettings({
  settings,
  apply: (patch) => applySettings(patch),
  newGame: () => {
    startGame(undefined, { intro: true });
    closeSettings();
    hideTitle();
    toast("A new hill.");
  },
  saveNow: () => toast(saveGame(game.state) ? "Saved." : "Could not save."),
  loadSaved: () => {
    const f = readSave();
    if (!f) return toast("No save found.");
    startGame(f.state);
    closeSettings();
    hideTitle();
    toast(`Loaded — day ${f.state.day}.`);
  },
  exportSave: () => exportFile(game.state),
  importSave: (file) => {
    void importFile(file).then((state) => {
      if (!state) return toast("That file is not a Hirsel save.");
      startGame(state);
      closeSettings();
      hideTitle();
      toast(`Loaded — day ${state.day}.`);
    });
  },
  deleteSave: () => {
    clearSave();
    toast("Save deleted.");
    settingsUi.draw();
  },
  hasSave,
  cheatContext: () => ({
    game,
    settings,
    toggleRetro: () => applySettings({ ui: settings.ui === "retro" ? "glen" : "retro" }),
    toggleInverse: () => applySettings({ inverse: !settings.inverse }),
    toggleZen: () => applySettings({ zen: !settings.zen }),
    setSpeed: () => {},
    closeSettings: () => closeSettings(),
  }),
});

/* ---------- overlays ---------- */
function openSettings() {
  settingsUi.draw();
  $("settings").classList.add("on");
  document.body.classList.add("modal");
}
function closeSettings() {
  $("settings").classList.remove("on");
  document.body.classList.remove("modal");
}
$("btn-settings").addEventListener("click", openSettings);
$("settings-close").addEventListener("click", closeSettings);
soundBtn.addEventListener("click", () => applySettings({ muted: !settings.muted }));
$("over-again").addEventListener("click", () => {
  $("over").classList.remove("on");
  startGame(undefined, { intro: true });
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSettings();
});

/* ---------- the title ---------- */
function showTitle() {
  const save = readSave();
  const cont = $<HTMLButtonElement>("title-continue");
  cont.disabled = !save;
  cont.style.display = save ? "" : "none";
  $("title-foot").textContent = save ? `a run is waiting — day ${save.state.day}` : "";
  $("title").classList.add("on");
}
function hideTitle() {
  $("title").classList.remove("on");
  if (!settings.seenTitle) applySettings({ seenTitle: true });
}
$("title-new").addEventListener("click", () => {
  firstGesture();
  hideTitle();
  startGame(undefined, { intro: true });
});
$("title-continue").addEventListener("click", () => {
  firstGesture();
  const f = readSave();
  hideTitle();
  if (f) {
    startGame(f.state);
    game.say(`— Picked up where you left off, day ${f.state.day}. —`, "cozy");
  } else startGame(undefined, { intro: true });
});
$("title-settings").addEventListener("click", () => {
  firstGesture();
  openSettings();
});

/* ---------- audio starts on the first gesture ---------- */
function firstGesture() {
  if (audio.started) return;
  if (audio.start()) {
    audio.setLevels({ master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted });
    score.start();
    rain.start();
  }
}
for (const evt of ["pointerdown", "keydown", "touchstart"]) {
  addEventListener(evt, firstGesture, { passive: true });
}

/* ---------- night bookkeeping the UI owns ---------- */
let lastDay = 1;
animator.onStart = (anim) => {
  if (anim === "sleep" && settings.ui === "retro" && innerWidth <= 760) view.goTab("glen");
  if (anim === "wolf" || anim === "wolflost") score.cue("wolf");
  else if (anim === "fox") score.cue("fox");
};
animator.onIdle = () => {
  render();
  const g = game.state;
  // autosave lands only once the night (and any raid) has fully played out
  if (settings.autosave && g.day !== lastDay && !g.over) {
    lastDay = g.day;
    saveGame(g);
  }
  if (g.over) showEnd();
};

/*
 * Raised once per ending. It has to be idempotent because it writes settings
 * (the revealed code), which triggers a render, which is one of the things
 * that raises it — without this guard a single win recursed through the whole
 * cheat list and handed over every code at once.
 */
let endShown = false;
function showEnd() {
  const o = game.state.over;
  if (!o || endShown) return;
  endShown = true;
  $("over-title").textContent = o.title;
  $("over-body").textContent = o.body;

  const box = $("over-reward");
  box.innerHTML = "";
  box.style.display = "none";
  if (o.kind === "win") {
    // finishing a run hands over a code you did not have, for the next one
    const prize = revealNextCheat(settings.cheatsFound);
    if (prize) {
      applySettings({ cheatsFound: [...settings.cheatsFound, prize.code] });
      box.style.display = "";
      box.innerHTML =
        `<div class="reward-label">For the next hill, a word you did not have</div>` +
        `<div class="reward-code">${prize.code}</div>` +
        `<div class="reward-blurb">${prize.blurb}</div>` +
        `<div class="reward-foot">It is in Settings → Cheat codes from now on.</div>`;
    } else {
      box.style.display = "";
      box.innerHTML = `<div class="reward-label">You have them all now. There is nothing left to tell you.</div>`;
    }
  }
  $("over").classList.add("on");
}

/* ---------- the frame loop ---------- */
function frame(now: number) {
  animator.tick(now);
  const g = game.state;
  const isRaining = g.forecast[0] === "rain";
  score.mood = {
    night: animator.current === "sleep" || animator.current === "fox" || animator.current === "wolf",
    rain: isRaining,
  };
  rain.setActive(isRaining);
  sky.sync(g.log, now);
  const shepherdAt = world.walk.tick(now);

  screen.painter.cx.save();
  (packs[settings.ui] ?? GLEN_ART).draw(screen.painter, {
    state: g,
    anim: animator.current,
    p: animator.p,
    time: now,
    reduced: animator.reduced,
    inverse: settings.inverse,
    payload: animator.payload,
    messages: settings.ui === "glen" ? sky.list(now) : [],
    hover: settings.ui === "glen" ? world.hover : null,
    active: settings.ui === "glen" ? world.active : null,
    shepherdAt: settings.ui === "glen" ? shepherdAt : null,
    walking: settings.ui === "glen" && world.walk.walking,
    zen: settings.zen,
    interior: settings.ui === "glen" && world.interior,
    spotlight: settings.ui === "glen" && !world.interior ? tutorial.spotlight : null,
    spotlightBed: settings.ui === "glen" && world.interior && tutorial.pointingAtBed,
  });
  screen.painter.cx.restore();
  requestAnimationFrame(frame);
}

/* the retro day panel's header sticks below the scene, so it needs its height */
const sceneEl = document.querySelector<HTMLElement>(".scene");
function measureScene() {
  if (sceneEl) document.documentElement.style.setProperty("--scene-h", `${sceneEl.offsetHeight}px`);
}
if (sceneEl && "ResizeObserver" in window) new ResizeObserver(measureScene).observe(sceneEl);

addEventListener("resize", () => {
  screen.fit();
  measureScene();
});
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => applySettings({}));

/* ---------- boot ---------- */
applyUiMode();
applySettings({});
const existing = readSave();
startGame(existing && settings.autosave ? existing.state : undefined);
showTitle();
screen.fit();
requestAnimationFrame(frame);

/* ---------- dev handles, for poking at the running game in the console ---------- */
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).hirsel = {
    get game() {
      return game;
    },
    audio,
    score,
    rain,
    sfx,
    animator,
    settings,
    screen,
    world,
    sky,
    tutorial,
  };
}

/* ---------- PWA ---------- */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline play is a bonus, not a requirement */
    });
  });
}
