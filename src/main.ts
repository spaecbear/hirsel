import "./styles.css";

import { Game } from "./sim/game";
import { owns } from "./sim/rules";
import { loadSettings, prefersReducedMotion, saveSettings, type Settings } from "./sim/settings";
import { clearSave, exportFile, hasSave, importFile, readSave, saveGame } from "./sim/save";
import { lexicon } from "./sim/lexicon";
import type { GameState } from "./sim/types";

import { Animator } from "./render/animator";
import { Screen } from "./render/screen";
import { HIRSEL_ART } from "./render/art/hirsel";
import { OG_ART } from "./render/art/og";
import type { ArtPack } from "./render/art/types";

import { AudioEngine } from "./audio/engine";
import { Score } from "./audio/score";
import { Sfx } from "./audio/sfx";

import { View } from "./ui/view";
import { buildSettings } from "./ui/settings-panel";
import { $, toast } from "./ui/dom";

/* ---------- state ---------- */
const settings: Settings = loadSettings();
const packs: Record<string, ArtPack> = { hirsel: HIRSEL_ART, og: OG_ART };

let game = new Game(undefined, { testMode: settings.testMode });
const animator = new Animator();
const canvas = $<HTMLCanvasElement>("scene");
const screen = new Screen(canvas, packs[settings.art] ?? HIRSEL_ART);
const audio = new AudioEngine();
const score = new Score(audio);
const sfx = new Sfx(audio);
const view = new View(game, animator, settings);

/* ---------- opening ---------- */
function openingLines(g: Game) {
  const lex = lexicon(settings.inverse);
  g.say(`You handed in your notice. Six ${lex.beasts}, ${settings.testMode ? "a thousand pounds" : "forty pounds"}, and a hill.`, "gold");
  if (settings.testMode) g.say("TEST PURSE — starting money is £1000. Switch to the ship purse in Settings.", "cozy");
  g.say(`${lex.woolCap} is worth most between the fourth and ninth day of growth. After that it mats.`, "hi");
}

function wire(g: Game) {
  g.onAnim = (anim, after) => {
    sfx.forAnim(anim, owns(g.state, "dog"));
    animator.play(anim, after);
    view.render();
  };
  g.onAchievement = (a) => toast(`Achievement — ${a.name}`);
  g.subscribe(() => view.render());
  g.hydrateAchievements();
}

function startGame(state?: GameState) {
  animator.clear();
  game = new Game(state, { testMode: settings.testMode });
  view.setGame(game);
  wire(game);
  if (!state) openingLines(game);
  view.goTab("day");
  view.render();
}

/* ---------- settings application ---------- */
function applySettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  saveSettings(settings);
  audio.setLevels({ master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted });
  animator.reduced = prefersReducedMotion(settings);
  document.body.classList.toggle("no-motion", animator.reduced);
  const pack = packs[settings.art] ?? HIRSEL_ART;
  screen.setPack(pack);
  soundBtn.textContent = settings.muted ? "Sound off" : "Sound on";
  soundBtn.setAttribute("aria-pressed", String(!settings.muted));
  view.render();
}

const soundBtn = $<HTMLButtonElement>("btn-sound");

const settingsUi = buildSettings({
  settings,
  apply: (patch) => {
    applySettings(patch);
  },
  newGame: () => {
    startGame();
    closeSettings();
    toast("A new hill.");
  },
  saveNow: () => toast(saveGame(game.state) ? "Saved." : "Could not save."),
  loadSaved: () => {
    const f = readSave();
    if (!f) return toast("No save found.");
    startGame(f.state);
    closeSettings();
    toast(`Loaded — day ${f.state.day}.`);
  },
  exportSave: () => exportFile(game.state),
  importSave: (file) => {
    void importFile(file).then((state) => {
      if (!state) return toast("That file is not a Hirsel save.");
      startGame(state);
      closeSettings();
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
    toggleRetro: () => applySettings({ art: settings.art === "og" ? "hirsel" : "og" }),
    toggleInverse: () => applySettings({ inverse: !settings.inverse }),
    setSpeed: () => {},
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
  startGame();
});
addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSettings();
});

/* ---------- audio starts on the first gesture ---------- */
function firstGesture() {
  if (audio.started) return;
  if (audio.start()) {
    audio.setLevels({ master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted });
    score.start();
  }
}
for (const evt of ["pointerdown", "keydown", "touchstart"]) {
  addEventListener(evt, firstGesture, { passive: true });
}

/* ---------- night bookkeeping the UI owns ---------- */
let lastDay = 1;
animator.onStart = (anim) => {
  if (anim === "sleep" && innerWidth <= 760) view.goTab("glen");
};
animator.onIdle = () => {
  view.render();
  const g = game.state;
  // autosave lands only once the night (and any raid) has fully played out
  if (settings.autosave && g.day !== lastDay && !g.over) {
    lastDay = g.day;
    saveGame(g);
  }
  if (g.over) showEnd();
};

function showEnd() {
  const o = game.state.over;
  if (!o) return;
  $("over-title").textContent = o.title;
  $("over-body").textContent = o.body;
  $("over").classList.add("on");
}

/* ---------- the frame loop ---------- */
function frame(now: number) {
  animator.tick(now);
  const g = game.state;
  score.mood = { night: animator.current === "sleep" || animator.current === "fox" || animator.current === "wolf", rain: g.forecast[0] === "rain" };
  screen.painter.cx.save();
  (packs[settings.art] ?? HIRSEL_ART).draw(screen.painter, {
    state: g,
    anim: animator.current,
    p: animator.p,
    time: now,
    reduced: animator.reduced,
    inverse: settings.inverse,
  });
  screen.painter.cx.restore();
  requestAnimationFrame(frame);
}

addEventListener("resize", () => screen.fit());
matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => applySettings({}));

/* ---------- boot ---------- */
applySettings({});
const existing = readSave();
if (existing && settings.autosave) {
  startGame(existing.state);
  lastDay = existing.state.day;
  game.say(`— Picked up where you left off, day ${existing.state.day}. —`, "cozy");
  view.render();
} else {
  startGame();
}
screen.fit();
requestAnimationFrame(frame);

/* ---------- dev handles, for poking at the running game in the console ---------- */
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).hirsel = { get game() { return game; }, audio, score, animator, settings };
}

/* ---------- PWA ---------- */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => {
    void navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline play is a bonus, not a requirement */
    });
  });
}
