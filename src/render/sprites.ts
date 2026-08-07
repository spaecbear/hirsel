/**
 * Every sprite in the game, and the palette they are drawn from.
 *
 * Shared by both interfaces: the full-screen `glen` scene and the older
 * panelled `retro` one. They lay the world out very differently, but a sheep
 * is a sheep — keeping one copy means a fix to the dog's ears or the pelt
 * lands in both places rather than one of them drifting.
 *
 * Sprite state that changes per frame rather than per call (the TOD cheat,
 * what kit he owns, how dark it is) is set once a frame via `setSpriteState`
 * instead of threaded through every signature.
 */
import type { Painter } from "./painter";
import { BREEDS } from "../sim/config";
import { grade } from "../sim/rules";
import type { Sheep, WeatherId } from "../sim/types";

/* ---------- palette ---------- */
export const C = {
  ink: "#0b0d08",
  peat: "#14170f",
  turf: ["#5d7a42", "#6d8a4b", "#7d9a55"],
  turfDry: ["#565a36", "#666a3e", "#767a49"],
  turfDark: "#3f5230",
  rock: "#6d7263",
  rockDark: "#4d5247",
  rockLit: "#878b7c",
  heather: "#8a6a9c",
  heatherDim: "#6a5079",
  gorse: "#e0a33c",
  wool: "#ddd9c8",
  bark: "#5b4a30",
  slate: "#4a5058",
  thatch: "#8a7443",
  fire: "#e0a33c",
  night: "#0a0d18",
  water: "#43606e",
  waterLit: "#5d7d8a",
  fox: "#b4472c",
};

/** sky gradient per weather: [high, low] */
export const SKY: Record<WeatherId, [string, string]> = {
  sun: ["#3f6a7e", "#87b0b4"],
  overcast: ["#3a4046", "#5c6167"],
  rain: ["#252c33", "#3c464e"],
  mist: ["#454b4a", "#697070"],
};

/* ---------- helpers ---------- */
export const br = (s: Sheep) => BREEDS[s.breed] ?? BREEDS.blackface;

/** deterministic scatter, so the hillside doesn't crawl between frames */
export const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ---------- per-frame sprite state ---------- */
let INV = false;
let NIGHT = 0;

/**
 * What he owns, refreshed each frame. Every tool that can be seen is drawn:
 * buying something should change the picture, not just a line in a menu.
 * The broadsword is the deliberate exception — it stays out of sight.
 */
export const KIT = {
  /** which dog she is, if any — they are drawn differently */
  collie: false,
  crook: false,
  boots: false,
  shears: false,
  lamp: false,
  cart: false,
  watch: false,
  oilskin: false,
  saltlick: false,
  pelt: false,
};

export function setSpriteState(o: { inverse?: boolean; night?: number; kit?: Partial<typeof KIT> }) {
  if (o.inverse !== undefined) INV = o.inverse;
  if (o.night !== undefined) NIGHT = o.night;
  if (o.kit) Object.assign(KIT, o.kit);
}

export const isInverse = () => INV;
export const nightLevel = () => NIGHT;

/* ---------- the flock ---------- */

/** the inverse flock: a fox whose brush thickens the way a fleece would */
function drawFoxBeast(g: Painter, x: number, y: number, s: Sheep, o: { shorn?: boolean; run?: number; flip?: boolean }) {
  const gr = grade(o.shorn ? 0 : s.fleece);
  const bulk = Math.round(Math.min(5, gr.v * 0.5));
  const b = br(s);
  // breed colour still reads, just on a fox
  const coat = s.breed === "hebridean" ? "#7a3a24" : s.breed === "shetland" ? "#c06a34" : C.fox;
  const dir = o.flip ? -1 : 1;
  const leg = o.run ? (Math.sin(o.run * Math.PI * 14) > 0 ? 0 : 2) : 0;
  g.a(x, y + 11, 14, 2, 0, 0, 0, 0.22);
  g.px(x + 2, y + 7, 2, 4, "#2b201a");
  g.px(x + 8, y + 7 - leg, 2, 4, "#2b201a");
  g.px(x + 5, y + 7 + leg, 2, 4, "#2b201a");
  g.px(x + 10, y + 7, 2, 4, "#2b201a");
  g.px(x + 1, y + 3, 12, 5, coat);
  g.px(x + 1, y + 3, 12, 1, shade(coat, 18));
  const hx = dir > 0 ? x + 12 : x - 4;
  g.px(hx, y + 1, 6, 5, coat);
  g.px(hx + (dir > 0 ? 4 : -1), y + 3, 3, 2, "#2b201a");
  g.px(hx + (dir > 0 ? 1 : 4), y + 2, 1, 1, "#e8d27a");
  g.px(hx, y - 2, 2, 3, shade(coat, -30));
  g.px(hx + 3, y - 2, 2, 3, shade(coat, -30));
  // the brush, which is what you are farming now
  const bw = 7 + bulk * 2;
  g.px(dir > 0 ? x - bw : x + 13, y + 2, bw, 4 + bulk, gr.label === "matted" ? "#8a6a52" : coat);
  g.px(dir > 0 ? x - bw - 2 : x + 13 + bw, y + 2, 3, 3, b.wool);
}

/** the inverse raider: a ram off the hill, horns and all */
/** the raider in TOD. Mirrored about its own span so it faces where it runs. */
export function drawRam(g: Painter, x: number, y: number, run: number, facing: 1 | -1 = 1) {
  const SPAN = 25;
  const leg = Math.sin(run * Math.PI * 14) > 0 ? 0 : 2;
  const p = (dx: number, dy: number, w: number, h: number, c: string) =>
    g.px(facing > 0 ? x + dx : x + SPAN - dx - w, y + dy, w, h, c);
  p(2, 8, 3, 5, "#3a352c");
  p(9, 8 - leg, 3, 5, "#3a352c");
  p(6, 8 + leg, 3, 5, "#2e2a22");
  p(13, 8, 3, 5, "#2e2a22");
  p(0, 0, 18, 9, "#ddd9c8");
  p(1, -1, 16, 2, "#efeada");
  p(17, 1, 7, 6, "#2b2b26"); // the head
  p(22, 3, 1, 1, "#e8d27a"); // its eye
  p(17, -3, 7, 2, "#b8a878"); // horns
  p(23, -2, 2, 4, "#b8a878");
  p(15, -2, 2, 3, "#b8a878");
}

export interface SheepOpts {
  shorn?: boolean;
  graze?: boolean;
  run?: number;
  flip?: boolean;
}

export function drawSheep(g: Painter, x: number, y: number, s: Sheep, o: SheepOpts = {}) {
  if (INV) return drawFoxBeast(g, x, y, s, o);
  const gr = grade(o.shorn ? 0 : s.fleece);
  const b = br(s);
  const bulk = Math.round(Math.min(6, gr.v * 0.55));
  const w = 11 + bulk;
  const h = 7 + Math.round(bulk * 0.5);
  const wool = gr.label === "matted" ? "#a49b80" : b.wool;
  const dir = o.flip ? -1 : 1;
  const legPhase = o.run ? (Math.sin(o.run * Math.PI * 12) > 0 ? 1 : -1) : 0;

  g.a(x, y + h + 3, w, 2, 0, 0, 0, 0.22); // shadow
  g.px(x + 2, y + h, 2, 4 - Math.abs(legPhase), "#3a352c"); // legs
  g.px(x + w - 5, y + h, 2, 4 - Math.abs(legPhase), "#3a352c");
  g.px(x + 4, y + h, 2, 4 + legPhase, "#2e2a22");
  g.px(x + w - 7, y + h, 2, 4 - legPhase, "#2e2a22");
  g.px(x, y + 1, w, h - 1, wool); // fleece, lit along the top
  g.px(x + 1, y, w - 2, 2, shade(wool, 12));
  g.px(x, y + h - 1, w, 1, shade(wool, -26));
  for (let i = 1; i < w - 1; i += 3) g.px(x + i, y + 2 + ((i / 3) % 2), 2, 1, shade(wool, -14)); // curls
  const hx = dir > 0 ? x + w - 2 : x - 4;
  const hy = o.graze ? y + h - 2 : y - 3;
  g.px(hx, hy, 6, 5, b.face);
  g.px(hx + (dir > 0 ? 4 : 0), hy + 2, 2, 2, shade(b.face, 24));
  g.px(hx + (dir > 0 ? 1 : 3), hy + 1, 1, 1, "#0d0d0b");
  g.px(hx + (dir > 0 ? 0 : 4), hy - 2, 2, 2, b.face); // ear
  g.px(dir > 0 ? x - 2 : x + w, y + 2, 2, 3, wool); // tail
}

/* ---------- the shepherd ---------- */

/** the wolf skin: hood with the ears still on it, mantle over the shoulders */
function drawPelt(g: Painter, x: number, y: number) {
  g.px(x - 2, y + 5, 16, 7, "#3a3d47");
  g.px(x - 2, y + 5, 16, 2, "#4a4e5a"); // moonlit along the top
  g.px(x - 2, y + 11, 16, 1, "#2a2d36");
  g.px(x - 4, y + 10, 4, 8, "#3a3d47"); // the brush, down his back
  g.px(x - 4, y + 17, 4, 3, "#8f939c");
  g.px(x + 1, y - 5, 11, 5, "#3a3d47"); // the head worn as a hood
  g.px(x + 1, y - 5, 11, 1, "#4a4e5a");
  g.px(x + 1, y - 8, 3, 4, "#3a3d47");
  g.px(x + 8, y - 8, 3, 4, "#3a3d47");
  g.px(x + 2, y - 7, 1, 2, "#22252f"); // where the ears fold
  g.px(x + 9, y - 7, 1, 2, "#22252f");
}

export interface ShepherdOpts {
  crook?: boolean;
  arm?: number;
  walk?: number;
  sit?: boolean;
  /** seen from behind — for walking away from the camera */
  back?: boolean;
  /**
   * An idle gesture, if he is in the middle of one. `t` runs 0 → 1.
   *
   * A man who stands perfectly still between chores reads as a game piece.
   * These are the small things a person does with their hands when there is
   * nothing in them.
   */
  tick?: { kind: "brow" | "stretch" | "look"; t: number };
  /**
   * Which way he is turned: 1 right, -1 left, 0 square to the camera.
   *
   * He used to be square-on always, two eyes to the viewer, which read as
   * "facing you" whatever he was doing — squaring up to a wolf coming down
   * the hill at him, or striding across the field away from it. In profile
   * he shows one eye and the bunnet's peak leads the way he is going.
   */
  facing?: 1 | -1 | 0;
}

/** 12 wide, 26 tall from `y` (the top of his head) to the soles */
export const SHEPHERD_W = 12;
export const SHEPHERD_H = 26;

/** how wide he is, crook and all, for mirroring him about his own middle */
const SHEPHERD_SPAN = 15;

/** the bunnet: a soft crown, a stubby peak, and the button on top */
function drawBunnet(px: (dx: number, dy: number, w: number, h: number, c: string) => void, dx: number, dy: number) {
  px(dx, dy + 1, 9, 3, "#2f3327");
  px(dx + 1, dy, 7, 1, "#3a3f31"); // the crown, lit along the top
  px(dx + 4, dy - 1, 2, 1, "#3a3f31"); // its button
  px(dx + 7, dy + 2, 4, 2, "#272b20"); // the peak, out over his eyes
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function drawShepherd(g: Painter, x: number, y: number, o: ShepherdOpts = {}) {
  const step = o.walk ? (Math.sin(o.walk * Math.PI * 8) > 0 ? 1 : 0) : 0;
  const tick = o.tick;
  // the bunnet is off his head for the middle of a brow-wipe
  const hatOff = tick?.kind === "brow" && tick.t > 0.18 && tick.t < 0.82;
  const profile = (o.facing ?? 0) !== 0;
  const flip = o.facing === -1;

  /*
   * He is drawn facing right and mirrored about his own width when he turns,
   * so there is one set of coordinates to keep true rather than two that
   * drift apart.
   */
  const px = (dx: number, dy: number, w: number, h: number, c: string) =>
    g.px(flip ? x + SHEPHERD_SPAN - dx - w : x + dx, y + dy, w, h, c);
  const al = (dx: number, dy: number, w: number, h: number, r: number, gr: number, b: number, a: number) =>
    g.a(flip ? x + SHEPHERD_SPAN - dx - w : x + dx, y + dy, w, h, r, gr, b, a);

  g.a(x - 1, y + 26, 14, 2, 0, 0, 0, 0.25);

  // boots: tackety ones once he has bought a pair, taller and nailed
  if (KIT.boots) {
    px(0, 20, 5, 6, "#2a2118");
    px(6, 20 - step, 5, 6, "#2a2118");
    px(0, 25, 5, 1, "#6b5a44");
    px(6, 25 - step, 5, 1, "#6b5a44");
  } else {
    px(1, 22, 4, 4, "#33291f");
    px(7, 22 - step, 4, 4, "#33291f");
  }
  px(1, 15, 10, 8, "#4b4632"); // breeks

  // coat — the waxed oilskin is longer, darker and has a sheen on it
  if (KIT.oilskin) {
    px(0, 6, 12, 15, "#2f3a35");
    px(0, 6, 12, 2, "#43524a");
    px(11, 8, 1, 11, "#54655c"); // wax catching the light
    px(5, 8, 2, 12, "#26302c");
    px(0, 5, 12, 2, "#3a4a42"); // collar up
  } else {
    px(0, 6, 12, 11, "#4a5540");
    px(0, 6, 12, 2, "#5a6650");
    px(5, 8, 2, 9, "#3b4433"); // buttoned seam
    px(1, 5, 10, 2, "#8a4a3c"); // scarf
  }
  if (KIT.shears && o.arm === undefined) {
    px(-2, 15, 4, 2, "#b9bcae"); // shears on the belt
    px(-3, 16, 2, 3, "#6b5433");
  }
  if (KIT.watch) {
    px(2, 11, 5, 1, "#c9a83c"); // watch chain
    px(7, 10, 1, 2, "#e0c34c");
  }

  if (o.back) {
    // the back of his head: no face, and the bunnet's peak points away
    px(2, 0, 8, 6, "#8a6b4c"); // hair
    px(3, 4, 6, 2, "#c9a583"); // his neck below it
    px(2, -3, 9, 4, "#2f3327");
    px(3, -4, 7, 1, "#3a3f31");
  } else if (profile) {
    // side on: one eye, the ear behind it, and the peak leading the way
    px(2, 0, 8, 6, "#c9a583");
    px(2, 0, 3, 5, "#b8926f"); // the shaded side of his face
    /*
     * The eye sits at 8 rather than 7 on purpose. The sprite mirrors about
     * SHEPHERD_SPAN/2 = 7.5, so anything at 7 lands back on itself and he
     * looked identical turned either way.
     */
    px(8, 2, 1, 1, "#26201a"); // the one eye you can see
    px(3, 3, 2, 1, "#a8825f"); // ear, behind it
    px(2, -3, 9, 4, "#2f3327"); // bunnet
    px(10, -2, 4, 2, "#2f3327"); // peak, out over his nose
  } else {
    px(2, 0, 8, 6, "#c9a583"); // head
    px(3, 2, 1, 1, "#26201a");
    px(7, 2, 1, 1, "#26201a");
    if (!hatOff) drawBunnet(px, 2, -3);
    else px(3, -1, 7, 2, "#8a6b4c"); // his hair, flattened where it sat
  }

  if (KIT.pelt) drawPelt(g, flip ? x + SHEPHERD_SPAN - 12 : x, y);
  if (o.arm !== undefined) px(10, 8 + o.arm, 4, 3, "#c9a583");

  /* ---- the idle gestures ---- */
  if (tick) {
    const t = tick.t;
    if (tick.kind === "brow") {
      // bunnet off, back of the wrist across his forehead, bunnet back on
      const armUp = hatOff ? 1 : 0;
      px(10, 3 + (1 - armUp) * 6, 4, 3, "#c9a583"); // the hand that took it off
      if (hatOff) {
        drawBunnet(px, 11, 6); // held down at his side
        px(1, 0, 5, 2, "#c9a583"); // and the other wrist up at his brow
        px(0, 1, 2, 3, "#c9a583");
      }
    } else if (tick.kind === "stretch") {
      /*
       * Both arms up and out, and down again. Two segments a side rather
       * than one nub: at this size a single 4x3 block beside the coat is
       * lost against it and reads as standing still.
       */
      const lift = Math.sin(clamp(t, 0, 1) * Math.PI);
      const rise = Math.round(lift * 6);
      // the arm is a chain from the shoulder: upper, forearm, hand, each
      // starting where the last one ended. Drawn as separate pieces at their
      // own heights they hung in the air beside him with a gap at the elbow.
      const upY = 7 - Math.round(rise * 0.5);
      px(11, upY, 3, 4, "#c9a583"); // upper arm, out from the shoulder
      px(-2, upY, 3, 4, "#c9a583");
      px(13, upY - 3, 3, 4, "#c9a583"); // forearm, straight up off the elbow
      px(-4, upY - 3, 3, 4, "#c9a583");
      if (lift > 0.5) {
        px(14, upY - 5, 2, 3, "#c9a583"); // and the hands at the top of it
        px(-5, upY - 5, 2, 3, "#c9a583");
        px(1, 4, 10, 2, "#3b4433"); // his chest opens out with it
      }
    } else if (tick.kind === "look") {
      // a hand up to shade his eyes, looking out over the hill
      px(10, 1, 5, 2, "#c9a583");
      px(14, 2, 2, 2, "#c9a583");
    }
  }

  if (KIT.lamp) {
    // storm lantern in the free hand, burning brighter the darker it gets
    const lx = -7;
    const ly = 12;
    /*
     * It has to read as the thing you paid £44 for. The window of a built-up
     * hearth throws real light across the croft at night and this was a faint
     * smudge beside it — so the pool it casts now grows with the dark, in
     * three falling-off steps rather than one flat wash.
     */
    const glow = 0.45 + NIGHT * 0.55;
    al(lx - 13, ly - 12, 30, 30, 240, 186, 88, 0.04 + NIGHT * 0.2);
    al(lx - 8, ly - 7, 20, 21, 244, 196, 100, 0.07 + NIGHT * 0.3);
    al(lx - 4, ly - 3, 12, 13, 250, 208, 118, 0.1 + NIGHT * 0.4);
    // and it throws a pool on the ground he is standing on
    al(lx - 10, ly + 12, 26, 3, 240, 190, 90, 0.05 + NIGHT * 0.3);
    px(lx + 1, ly - 4, 2, 3, "#6d7263"); // bail
    px(lx, ly - 1, 5, 6, "#8a8f88"); // body
    al(lx + 1, ly, 3, 4, 255, 214, 120, glow); // the flame
    px(lx, ly + 5, 5, 1, "#5a5f58");
  }
  if (o.crook && KIT.crook) {
    for (let i = 0; i < 11; i++) px(13, 1 + i * 2, 2, 2, "#6b5433");
    px(11, -1, 4, 2, "#6b5433");
  }
}

/* ---------- the animals ---------- */

/**
 * The sheltie. Tricolour: black saddle, tan points, and the white chest the
 * breed is actually recognised by.
 *
 * `spin` (0→1) turns her right round on the spot, the way a collie does when
 * she is pleased with herself. Four orientations — side, rear, the other
 * side, front — because two would read as a flicker rather than a turn. Her
 * body foreshortens to nothing when she is end-on, which is what sells it.
 */
/**
 * Coat colours. A rough sheltie is black, tan and white; a border collie is
 * black and white with no tan and a heavier white collar. Same silhouette,
 * so the two read as the same working animal in different clothes.
 */
const DOG_COATS = {
  sheltie: { dark: "#2a2320", tan: "#b07a3e", white: "#f2eee2", shade: "#d8d4c8", soft: "#e2ded2" },
  collie: { dark: "#22201f", tan: "#3a3634", white: "#f6f4ec", shade: "#dcd9cf", soft: "#e8e5db" },
};

/**
 * Curled up asleep, seen from the side — for the collie at the hearth.
 *
 * A dog in front of a fire is not standing at it. She was drawn with the
 * walking sprite, which read as a dog waiting to be let out rather than one
 * that has settled for the evening. Nose tucked to her flank, tail round to
 * meet it, and the whole of her one low rounded mass; she breathes, because
 * a perfectly still sprite next to a flickering fire looks dead.
 */
export function drawDogCurled(g: Painter, x: number, y: number, time: number, facing: 1 | -1 = 1) {
  const SPAN = 22;
  const coat = KIT.collie ? DOG_COATS.collie : DOG_COATS.sheltie;
  // the slow rise and fall of her side
  const breath = Math.sin(time / 900) > 0 ? 0 : 1;
  const px = (dx: number, dy: number, w: number, h: number, c: string) =>
    g.px(facing > 0 ? x + dx : x + SPAN - dx - w, y + dy, w, h, c);

  g.a(x - 1, y + 9, SPAN + 2, 2, 0, 0, 0, 0.25); // her shadow on the boards

  // the curl of her back, highest at the shoulder and falling away to the tail
  px(3, 2 - breath, 16, 7 + breath, coat.dark);
  px(2, 4, 18, 5, coat.dark);
  px(5, 1 - breath, 11, 2, coat.dark);
  px(6, 1 - breath, 8, 1, coat.shade); // light along her spine

  // the tail, come round the front of her
  px(1, 6, 6, 3, coat.dark);
  px(0, 7, 4, 2, coat.white);

  // her flank and the white of her chest, tucked under
  px(4, 6, 12, 3, coat.tan);
  px(9, 7, 8, 2, coat.white);

  // the head, laid down along her side
  px(14, 5 - breath, 7, 5, coat.dark);
  px(16, 7 - breath, 5, 3, coat.white); // the blaze down her muzzle
  px(19, 8 - breath, 3, 2, coat.tan); // her nose, on her paws
  px(15, 6 - breath, 1, 1, "#0d0d0b"); // one eye, shut
  px(13, 3 - breath, 3, 3, coat.dark); // an ear folded over
  px(13, 3 - breath, 3, 1, coat.shade);

  // front paws out in front of her nose
  px(17, 9, 4, 2, coat.white);
}

export function drawDog(g: Painter, x: number, y: number, run: number, spin = 0, facing: 1 | -1 = 1, wag = false) {
  const leg = run ? (Math.sin(run * Math.PI * 12) > 0 ? 0 : 2) : 0;
  /*
   * The tail is told when to wag rather than deciding for itself. It used to
   * go whenever she was on the move, so she wagged all the way round a
   * herding circuit — and a working dog does not. Quick and short when it
   * does go: the old sweep read as a metronome rather than a dog pleased
   * with itself.
   */
  const tail = wag ? Math.sin(Date.now() / 190) * 2 : 0;
  g.a(x - 2, y + 11, 18, 2, 0, 0, 0, 0.22);

  const coat = KIT.collie ? DOG_COATS.collie : DOG_COATS.sheltie;
  if (spin > 0) {
    /*
     * Rotation by foreshortening rather than by cutting between four poses.
     * Her length across the screen is |cos| of the angle she has turned
     * through, so she narrows into the end-on views and widens out of them;
     * cutting straight between four fixed poses read as four poses, not a
     * turn.
     */
    const angle = spin * Math.PI * 2;
    const across = Math.cos(angle);
    const hop = Math.round(Math.sin(spin * Math.PI * 2) * 2);
    if (Math.abs(across) > 0.34) {
      drawDogSide(g, x, y - hop, run, across > 0 ? 1 : -1, tail, leg, Math.abs(across), coat);
      return;
    }
    const quarter = Math.sin(angle) > 0 ? 1 : 3;
    if (quarter === 1 || quarter === 3) {
      // end-on: she is only as wide as her shoulders
      const rear = quarter === 1;
      const bx = x + 6;
      const by = y - hop;
      g.px(bx + 1, by + 7, 2, 4, coat.white); // her feet
      g.px(bx + 4, by + 7, 2, 4, coat.white);
      g.px(bx, by + 2, 7, 6, coat.dark); // shoulders, foreshortened
      if (rear) {
        g.px(bx + 2, by + 4, 3, 4, coat.tan); // under her tail
        g.px(bx + 2, by - 2 + Math.round(tail), 3, 5, coat.dark); // tail up
        g.px(bx + 2, by - 3 + Math.round(tail), 3, 2, coat.white);
      } else {
        g.px(bx + 1, by + 2, 5, 5, coat.white); // the bib, straight at us
        g.px(bx, by - 3, 7, 6, coat.dark); // her head
        g.px(bx + 2, by - 1, 3, 4, coat.tan); // muzzle
        g.px(bx + 3, by, 1, 2, coat.white); // blaze
        g.px(bx + 1, by, 1, 1, "#0d0d0b"); // both eyes on you
        g.px(bx + 5, by, 1, 1, "#0d0d0b");
        g.px(bx - 1, by - 5, 2, 3, coat.dark); // ears
        g.px(bx + 6, by - 5, 2, 3, coat.dark);
      }
      return;
    }
    return;
  }

  drawDogSide(g, x, y, run, facing, tail, leg, 1, coat);
}

/** her side view, facing right by default and mirrored about her own length */
function drawDogSide(
  g: Painter,
  x: number,
  y: number,
  run: number,
  facing: 1 | -1,
  tail: number,
  leg: number,
  squash = 1,
  coat: (typeof DOG_COATS)["sheltie"] = DOG_COATS.sheltie,
) {
  const SPAN = 20;
  // `squash` foreshortens her along her length as she turns, and keeps her
  // centred on the same spot while she does it
  const k = Math.max(0.2, squash);
  const originShift = Math.round((SPAN * (1 - k)) / 2);
  const px = (dx: number, dy: number, w: number, h: number, c: string) => {
    const sx = Math.round(dx * k);
    const sw = Math.max(1, Math.round(w * k));
    g.px((facing > 0 ? x + sx : x + Math.round(SPAN * k) - sx - sw) + originShift, y + dy, sw, h, c);
  };
  void run;

  px(1, 7, 2, 4, coat.white); // socks
  px(8, 7 - leg, 2, 4, coat.white);
  px(4, 7 + leg, 2, 4, coat.white);
  px(11, 7, 2, 4, coat.white);
  px(1, 2, 13, 6, coat.dark); // the black saddle
  px(1, 6, 13, 2, coat.tan); // tan along her belly
  px(11, 0, 5, 4, coat.white); // the white chest, up under her chin
  px(10, 2, 6, 5, coat.white);
  px(12, 6, 4, 3, coat.soft);
  px(10, 1, 1, 6, coat.shade);
  px(2, 1, 3, 2, coat.white); // a little white at her shoulder
  px(13, -1, 6, 7, coat.dark); // head
  px(15, 3, 5, 3, coat.tan); // muzzle
  px(16, 0, 2, 4, coat.white); // blaze
  px(18, 3, 1, 1, "#0d0d0b"); // eye
  px(13, -4, 2, 3, coat.dark); // ears
  px(17, -4, 2, 3, coat.dark);
  px(-4, Math.round(tail), 5, 3, coat.dark); // tail
  px(-7, 1 + Math.round(tail), 3, 3, coat.white);
}

export function drawFox(g: Painter, x: number, y: number, run: number, facing: 1 | -1 = 1) {
  const SPAN = 29;
  const leg = Math.sin(run * Math.PI * 16) > 0 ? 0 : 2;
  const p = (dx: number, dy: number, w: number, h: number, c: string) =>
    g.px(facing > 0 ? x + dx : x + SPAN - dx - w, y + dy, w, h, c);

  p(2, 1, 8, 4, C.fox); // brush
  p(0, 1, 3, 3, "#f0ece0"); // white tip
  p(11, 6, 2, 4, "#2b201a"); // legs
  p(17, 6 - leg, 2, 4, "#2b201a");
  p(14, 6 + leg, 2, 4, "#2b201a");
  p(19, 6, 2, 4, "#2b201a");
  p(10, 2, 12, 5, C.fox); // body
  p(10, 2, 12, 1, "#c85a38"); // sunlit back
  p(21, 0, 6, 5, C.fox); // head
  p(26, 2, 3, 2, "#2b201a"); // snout
  p(25, 1, 1, 1, "#e8d27a"); // eye
  p(21, -2, 2, 3, "#8f3623"); // ears
  p(24, -2, 2, 3, "#8f3623");
}

/**
 * The wolf, facing LEFT. He comes down off the skyline towards the shepherd,
 * so his head has to be on the leading edge — drawn facing right he walked
 * backwards down the hill.
 *
 * Local coordinates run from the nose at 0 to the tail tip at 49, and `x` is
 * the nose. Everything takes an alpha so he can fade up out of the dark
 * behind his own eyes: eyes first, then the shape of him.
 */
const WOLF_BODY: [number, number, number] = [37, 41, 53];
const WOLF_SPINE: [number, number, number] = [51, 56, 73];
const WOLF_DARK: [number, number, number] = [13, 15, 22];
const WOLF_LEG: [number, number, number] = [18, 20, 28];
const WOLF_EYE: [number, number, number] = [232, 178, 60];

export function drawWolfBeast(g: Painter, x: number, y: number, run: number, body = 1, eyeGlow = 1) {
  const leg = Math.sin(run * Math.PI * 14) > 0 ? 0 : 3;
  const p = (dx: number, dy: number, w: number, h: number, c: [number, number, number], a = body) =>
    g.a(x + dx, y + dy, w, h, c[0], c[1], c[2], a);

  if (body > 0.02) {
    p(37, -1, 12, 5, WOLF_BODY); // brush
    p(11, 1, 26, 11, WOLF_BODY); // barrel
    p(11, 1, 26, 2, WOLF_SPINE); // moonlight along the back
    p(13, 11, 4, 9, WOLF_DARK); // fore legs under the head
    p(19, 11 - leg, 4, 9, WOLF_DARK);
    p(27, 11 + leg, 4, 12, WOLF_LEG); // hind legs under the tail
    p(33, 11, 4, 9, WOLF_LEG);
    p(4, -4, 11, 10, WOLF_BODY); // head
    p(0, 1, 5, 4, WOLF_DARK); // muzzle
    p(5, -9, 4, 6, WOLF_BODY); // ears
    p(11, -9, 4, 6, WOLF_BODY);
  }

  if (eyeGlow > 0.01) {
    // the halo goes down first, so the eyes read before the shape does
    p(3, -3, 14, 5, WOLF_EYE, eyeGlow * 0.12);
    p(5, -2, 11, 3, WOLF_EYE, eyeGlow * 0.22);
    p(6, -1, 3, 2, WOLF_EYE, eyeGlow);
    p(11, -1, 3, 2, WOLF_EYE, eyeGlow);
  }
}

/* ---------- things on the ground ---------- */

export function drawSaltLick(g: Painter, x: number, y: number) {
  g.a(x - 1, y + 7, 12, 2, 0, 0, 0, 0.2);
  g.px(x, y + 2, 10, 5, "#b9b6a4"); // the block
  g.px(x, y + 2, 10, 1, "#d8d5c4");
  g.px(x, y + 7, 10, 1, "#8d8a7c");
  g.px(x - 1, y + 6, 12, 2, "#5b4a30"); // the trough it sits in
}

/** the pony and cart, standing by the croft on a day you don't go to market */
export function drawParkedCart(g: Painter, x: number, y: number, time: number) {
  g.px(x, y, 26, 9, C.bark);
  g.px(x, y, 26, 2, "#6d5a3c");
  g.px(x + 2, y + 9, 7, 7, "#3f3527"); // wheels
  g.px(x + 17, y + 9, 7, 7, "#3f3527");
  g.px(x + 4, y + 12, 3, 1, "#7a6a4a");
  g.px(x + 19, y + 12, 3, 1, "#7a6a4a");
  g.px(x + 26, y + 2, 8, 2, C.bark); // shafts
  // the pony, dozing, with the odd flick of the tail
  const px0 = x + 34;
  g.px(px0, y - 2, 20, 9, "#6a4f33");
  g.px(px0 + 18, y - 8, 8, 7, "#6a4f33");
  g.px(px0 + 24, y - 4, 4, 3, "#4a3624");
  g.px(px0 + 18, y - 11, 3, 4, "#6a4f33");
  g.px(px0 + 23, y - 11, 3, 4, "#6a4f33");
  g.px(px0 + 2, y + 7, 3, 6, "#4a3624");
  g.px(px0 + 15, y + 7, 3, 6, "#4a3624");
  const flick = Math.sin(time / 800) > 0 ? 0 : 1;
  g.px(px0 - 3, y - 1 + flick, 4, 7, "#4a3624");
}

export function drawDyke(g: Painter, x0: number, y: number, len: number) {
  for (let x = x0; x < x0 + len; x += 5) {
    g.px(x, y, 5, 4, C.rock);
    g.px(x, y, 5, 1, C.rockLit);
    g.px(x + 2, y + 4, 4, 4, C.rockDark);
    g.px(x, y + 4, 2, 4, C.rock);
  }
}

/** wool sacks, stacked by the cart — how much is waiting to go to market */
export function drawWoolSacks(g: Painter, x: number, y: number, stone: number) {
  const n = Math.min(4, Math.ceil(stone / 12));
  for (let i = 0; i < n; i++) {
    const sx = x + (i % 2) * 9;
    const sy = y - Math.floor(i / 2) * 8;
    g.px(sx, sy, 8, 7, C.wool);
    g.px(sx, sy, 8, 2, shade(C.wool, 10));
    g.px(sx + 2, sy - 1, 4, 2, "#b8b4a2"); // the tied neck
  }
}
