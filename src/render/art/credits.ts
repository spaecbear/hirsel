/**
 * The last thing you see.
 *
 * A player who has finished the croft, married her, and turned up every
 * secret the glen keeps gets one picture for it: the Quiraing on Skye at
 * sunset, and the three of them sat on the edge of it with their backs to
 * you, looking out at the thing they spent the whole game earning.
 *
 * It is built from a photograph of the real place — the long escarpment
 * stepping away to the right, the grass gone gold, the rock breaking out of
 * it in bands, and the ground falling away at your feet. Sunset rather than
 * daylight, because this is an ending, and because the low light is what
 * makes those slopes the colour they are.
 *
 * Nothing here is interactive and nothing reads the simulation. It is drawn
 * from the clock alone, so it can run behind the rolling credits for as long
 * as they take.
 */
import type { Painter } from "../painter";
import { KIT, drawDog, drawFox, drawSheep, hash, setSpriteState } from "../sprites";
import type { Sheep } from "../../sim/types";

/* The sunset, top to bottom. Deep above, and everything warming as it falls
 * to the horizon — the sun is only just down behind the ridge. */
const SKY = [
  { at: 0.0, c: "#2b2b46" },
  { at: 0.22, c: "#4a3a5c" },
  { at: 0.42, c: "#8a5560" },
  { at: 0.6, c: "#c9724a" },
  { at: 0.76, c: "#e39a4e" },
  { at: 1.0, c: "#f2c46a" },
];

/** the colour of the sky at a given fraction of the way down it */
function skyAt(t: number): string {
  for (let i = 1; i < SKY.length; i++) {
    if (t <= SKY[i].at) {
      const a = SKY[i - 1];
      const b = SKY[i];
      return mixHex(a.c, b.c, (t - a.at) / (b.at - a.at));
    }
  }
  return SKY[SKY.length - 1].c;
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * Math.max(0, Math.min(1, t))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/*
 * The picture is built as a stack of planes, and the whole job is making each
 * one read against the one behind it.
 *
 * The first attempt was a landscape in one colour: everything was a mid brown
 * within a few shades of everything else, so no edge in it had any force and
 * the shapes would not resolve into a place. Two rules fix that, and they are
 * the only reason this reads at all:
 *
 *   1. Every plane steps to a clearly different value from its neighbour, and
 *      they alternate light and dark rather than fading gradually down.
 *   2. Every plane gets a bright rim along its top edge, because the sun is
 *      behind the hill and that is what backlight does — and a lit line is
 *      what separates one dark mass from the next.
 *
 * The figures then sit on the dark foreground with a *lit* band directly
 * behind them, so they read as silhouettes. On dark ground against dark hill
 * they simply disappeared.
 */
export function drawCredits(g: Painter, W: number, H: number, time: number) {
  const horizonY = Math.round(H * 0.4);

  /* ---- sky ---- */
  for (let y = 0; y < horizonY; y++) g.px(0, y, W, 1, skyAt(y / horizonY));

  // the sun, low and just off the crest, with the glow it throws
  const sunX = Math.round(W * 0.7);
  const sunY = Math.round(horizonY - H * 0.055);
  const sunR = Math.max(6, Math.round(H * 0.036));
  for (let i = 6; i > 0; i--) {
    g.a(sunX - sunR * i * 1.4, sunY - sunR * i, sunR * i * 2.8, sunR * i * 2, 255, 205, 130, 0.045);
  }
  // a disc rather than a square: rows shortened towards the top and bottom
  for (let dy = -sunR; dy <= sunR; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, sunR * sunR - dy * dy)));
    g.px(sunX - half, sunY + dy, half * 2, 1, "#fff0c0");
  }

  /* ---- cloud banks, lit hard from underneath ---- */
  for (let i = 0; i < 10; i++) {
    const cy = Math.round(H * 0.04 + hash(i * 3.7) * horizonY * 0.7);
    const cw = Math.round(W * (0.18 + hash(i * 5.1) * 0.3));
    const cx = Math.round(hash(i * 7.3) * W - cw * 0.2 + Math.sin(time / 26000 + i) * 6);
    const ch = Math.max(3, Math.round(H * (0.013 + hash(i * 2.9) * 0.02)));
    const warmth = cy / horizonY;
    const body = mixHex("#7a6a90", "#f0a868", warmth);
    const under = mixHex("#b09ac0", "#ffd89a", warmth);
    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const sw = Math.round(cw * (0.4 + hash(i * 11 + sIdx) * 0.6));
      const sx = cx + Math.round(hash(i * 13 + sIdx) * (cw - sw));
      const sy = cy + Math.round(hash(i * 17 + sIdx) * ch);
      g.px(sx, sy, sw, ch, body);
      g.px(sx + 2, sy + ch, sw - 4, 1, under); // the lit underside
    }
  }

  /* ---- 1. the far hills: lightest of the land, hazed almost into the sky ---- */
  farRidge(g, W, horizonY, H, 0, "#8a86a0", 0.0, 0.5, 8);
  farRidge(g, W, horizonY, H, 1, "#6e6a88", 0.28, 0.78, 5);

  /*
   * 2. The escarpment. The signature of the Quiraing is a grass top that
   * stops dead at a cliff, so the crest is drawn as a bright lit strip and
   * the rock starts immediately under it — not as bands floating in a slope.
   */
  const crestAt = (x: number) => {
    const t = x / W;
    const shoulder = Math.sin(t * 1.4 + 0.55) * 0.5 + Math.sin(t * 3.1 + 1.2) * 0.1;
    const steps = Math.floor(t * 4) * 0.03; // stepping away to the right
    return Math.round(horizonY + H * (0.02 - shoulder * 0.16 + steps) + Math.sin(x / 13) * 2);
  };
  const cliffH = Math.round(H * 0.1);

  for (let x = 0; x < W; x++) {
    const y = crestAt(x);
    // the lit grass cap: bright, and only a few pixels of it
    g.px(x, y, 1, Math.round(H * 0.035), "#d8ab4a");
    g.px(x, y, 1, 2, "#ffe89a"); // the sun straight along the crest
    // the cliff under it: dark, and fluted the way columnar rock is
    const top = y + Math.round(H * 0.035);
    g.px(x, top, 1, cliffH, "#332c22");
    if (hash(Math.round(x / 3)) > 0.55) g.px(x, top + 2, 1, cliffH - 4, "#463c30"); // the columns
    g.px(x, top, 1, 1, "#8a7452"); // light caught on the lip of it
    g.px(x, top + cliffH, 1, 3, "#20190f"); // and its shadow on the slope below
  }

  /* ---- 3. the grass apron under the cliff: mid gold, catching the low sun ---- */
  const apronTop = (x: number) => crestAt(x) + Math.round(H * 0.035) + cliffH + 3;
  for (let x = 0; x < W; x++) {
    const y = apronTop(x);
    const lit = 0.45 + Math.sin(x / 37) * 0.35 + Math.sin(x / 11) * 0.1;
    g.px(x, y, 1, H - y, mixHex("#7a5c26", "#b58a34", lit));
  }
  // scattered fallen blocks on the apron, which give it scale
  for (let i = 0; i < 26; i++) {
    const x = Math.round(hash(i * 9.1) * W);
    const y = apronTop(x) + Math.round(hash(i * 4.7) * H * 0.07);
    const bw = 3 + Math.round(hash(i * 6.1) * 7);
    g.px(x, y, bw, Math.round(bw * 0.7), "#3f362b");
    g.px(x, y, bw, 1, "#7c6a50");
  }

  /* ---- 4. the hollow: the ground dropping away, darker than the apron ---- */
  const gx = Math.round(W * 0.56);
  const gw = Math.round(W * 0.3);
  for (let x = gx; x < gx + gw; x++) {
    const t = (x - gx) / gw;
    const d = Math.sin(t * Math.PI);
    if (d < 0.05) continue;
    const top = apronTop(x) + Math.round(H * 0.05);
    g.px(x, top, 1, Math.round(H * 0.13 * d), mixHex("#6a5024", "#2e2312", d));
    g.px(x, top, 1, 1, mixHex("#b08a3c", "#6a5024", d)); // its lit near lip
  }

  /*
   * 5. The shelf they are sitting above: lighter again, so the dark
   * foreground and the figures on it have something to stand against. This
   * is the band that makes the silhouettes work.
   */
  const shelfTop = (x: number) => Math.round(H * 0.7 + Math.sin(x / 41) * H * 0.018);
  for (let x = 0; x < W; x++) {
    const y = shelfTop(x);
    g.px(x, y, 1, H - y, "#8a6a2a");
    g.px(x, y, 1, 3, "#e0b552"); // the sun along its edge
  }

  /* ---- 6. the near ground: almost black, with the sun on its very edge ---- */
  const nearY = (x: number) => Math.round(H * 0.79 + Math.sin(x / 29) * H * 0.022 + Math.sin(x / 8 + 2) * 2);
  for (let x = 0; x < W; x++) {
    const y = nearY(x);
    g.px(x, y, 1, H - y, "#2a2114");
    g.px(x, y, 1, 2, "#e0a04c"); // rim light along the crest
    g.px(x, y + 2, 1, 2, "#5a421f");
  }
  // tussocks along that edge, so it is grass and not a ruled line
  for (let i = 0; i < Math.round(W / 4); i++) {
    const x = Math.round(hash(i * 4.1) * W);
    const y = nearY(x);
    const th = 2 + Math.round(hash(i * 6.3) * 4);
    g.px(x, y - th, 1, th, "#3a2c17");
    g.px(x, y - th, 1, 1, "#c08e3e");
  }
  // and broken rock in the very foreground, as in the photograph
  for (let i = 0; i < 16; i++) {
    const x = Math.round(hash(i * 9.7) * W);
    const y = Math.round(H * 0.9 + hash(i * 3.3) * H * 0.09);
    const w = 8 + Math.round(hash(i * 5.9) * 20);
    const h = 5 + Math.round(hash(i * 8.1) * 9);
    g.px(x, y, w, h, "#191309");
    g.px(x, y, w, 1, "#4a3520");
  }

  /*
   * The croft, finished, small in the hollow below them. Slated roof, smoke
   * out of the chimney, and the byre alongside it — the whole of what the
   * run was for, seen from above and a long way off.
   */
  {
    const hx = Math.round(W * 0.68);
    const hy = Math.round(H * 0.638);
    const hw = Math.round(Math.max(20, W * 0.068));
    const hh = Math.round(hw * 0.62);
    g.a(hx - 2, hy + hh, hw + 8, 2, 0, 0, 0, 0.3);
    g.px(hx, hy, hw, hh, "#7a6a52"); // its walls
    g.px(hx, hy, hw, 1, "#8f7f66");
    g.px(hx - 1, hy - Math.round(hh * 0.4), hw + 2, Math.round(hh * 0.4), "#4a4e56"); // the slate
    g.px(hx - 1, hy - Math.round(hh * 0.4), hw + 2, 1, "#6d7484");
    g.px(hx + hw - 4, hy - Math.round(hh * 0.75), 2, Math.round(hh * 0.4), "#6a5c48"); // the chimney
    g.px(hx + 2, hy + Math.round(hh * 0.4), 2, hh - Math.round(hh * 0.4), "#3a3226"); // a lit window
    g.a(hx + 2, hy + Math.round(hh * 0.4), 2, 2, 255, 200, 120, 0.9);
    // the byre, lower and longer, at its gable
    g.px(hx + hw + 2, hy + Math.round(hh * 0.3), Math.round(hw * 0.7), Math.round(hh * 0.7), "#6e6250");
    g.px(hx + hw + 1, hy + Math.round(hh * 0.15), Math.round(hw * 0.7) + 2, Math.round(hh * 0.2), "#4a4e56");
    // smoke, going straight up in the evening calm
    for (let i = 0; i < 6; i++) {
      const t = ((time / 3400 + i / 6) % 1);
      g.a(
        hx + hw - 4 + Math.round(Math.sin(t * 4 + i) * 3),
        hy - Math.round(hh * 0.75) - Math.round(t * H * 0.1),
        2,
        2,
        220,
        210,
        200,
        0.32 * (1 - t),
      );
    }
  }

  /*
   * A fox, trotting along the slope above the croft. He spent the whole game
   * taking sheep off you and there is nothing left to guard tonight.
   *
   * He is up on the apron rather than down on the near edge because the
   * sprites are all one size: beside the seated figures he came out bigger
   * than the sheep and bigger than the people, and the eye read him as the
   * subject of the picture. At that distance, among fallen blocks his own
   * size, he is a fox on a hillside.
   */
  {
    // he keeps to the open slope on the left: run the whole width and he
    // crosses the croft, and a fox standing on the roof is a different picture
    const t = (time / 20000) % 1;
    const fx = Math.round(-34 + t * (W * 0.58 + 34));
    drawFox(g, fx, apronTop(fx) + Math.round(H * 0.055), t * 7, 1);
  }

  /* ---- a couple of the flock, out along the shelf ---- */
  {
    const ewe = (n: number): Sheep => ({ id: n, fleece: 6, breed: "blackface", age: 40 });
    drawSheep(g, Math.round(W * 0.72), shelfTop(Math.round(W * 0.72)) + 4, ewe(1), { graze: true });
    drawSheep(g, Math.round(W * 0.82), shelfTop(Math.round(W * 0.82)) + 9, ewe(2), { graze: true, flip: true });
    drawSheep(g, Math.round(W * 0.9), shelfTop(Math.round(W * 0.9)) + 3, ewe(3), { graze: true });
  }

  /*
   * The group on the edge, spread out so that each of them is a separate
   * shape. Bunched together the dogs read as two dark clumps against the
   * couple; a clear gap either side is what makes four figures instead of
   * one mass.
   */
  {
    const gx0 = Math.round(W * 0.4);
    const gy = nearY(gx0);
    const u = Math.max(18, Math.round(H * 0.115));

    /*
     * Both dogs, which no single run can have — one dog to a game, so the
     * pair of them is the picture of having done it more than once. KIT
     * decides which coat drawDog paints, so it is flipped between the calls
     * and put back after.
     */
    const wasCollie = KIT.collie;
    /*
     * Both of them standing rather than curled. The curled sprite is lovely
     * in the room at the fire, but out here at this size it is a dark oval —
     * a dog reads from her legs, her head and her tail, and she needs to be
     * on her feet to have them.
     */
    setSpriteState({ kit: { collie: false } });
    const sx = gx0 - Math.round(u * 2.0);
    drawDog(g, sx, nearY(sx) - 12, 0, 0, 1, true); // the sheltie, tail going
    setSpriteState({ kit: { collie: true } });
    const cxd = gx0 + Math.round(u * 1.55);
    drawDog(g, cxd, nearY(cxd) - 12, 0, 0, -1, false); // the collie, watching the light
    setSpriteState({ kit: { collie: wasCollie } });

    drawGroup(g, gx0, gy, u, time);
  }

  /* ---- the light over all of it, and the corners dropped ---- */
  g.a(0, 0, W, H, 255, 170, 90, 0.05);
  for (let i = 0; i < 6; i++) {
    const a = 0.055 - i * 0.008;
    g.a(0, 0, W, Math.round(H * 0.05) - i * 2, 0, 0, 0, a);
    g.a(0, H - (Math.round(H * 0.09) - i * 2), W, Math.round(H * 0.09) - i * 2, 0, 0, 0, a);
  }
}

/** a ridge line far off, flattened and gone blue */
function farRidge(
  g: Painter,
  W: number,
  horizonY: number,
  H: number,
  seed: number,
  c: string,
  from: number,
  to: number,
  amp: number,
) {
  const x0 = Math.round(W * from);
  const x1 = Math.round(W * to);
  for (let x = x0; x < x1; x++) {
    // it fades out at either end rather than stopping at a cliff
    const edge = Math.min(1, Math.min(x - x0, x1 - x) / (W * 0.09));
    const y =
      horizonY -
      Math.round((Math.sin(x / 47 + seed * 3) * amp + Math.sin(x / 15 + seed) * (amp * 0.35)) * edge) -
      Math.round(H * 0.004 * edge);
    if (y >= horizonY) continue;
    g.px(x, y, 1, horizonY - y + 3, c);
    g.px(x, y, 1, 1, mixHex(c, "#f0c080", 0.45)); // the sun along the top of it
  }
}

/** a filled disc, for heads — blocks read as masonry, not people */
function disc(g: Painter, cx: number, cy: number, r: number, c: string) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    if (half > 0) g.px(cx - half, cy + dy, half * 2, 1, c);
  }
}

/**
 * Everyone who made it, sitting on the edge with their backs to us.
 *
 * This is the reward for finding *everything*, so everything is in it: the
 * wolf pelt round his shoulders, both dogs — you can only ever keep one in a
 * run, so the pair of them together is the picture of having done it twice —
 * a couple of the flock, a fox that no longer has to be chased off, and the
 * croft finished down below.
 *
 * They are lit rather than silhouetted. As black shapes you had to work out
 * who was who from the arrangement, so they wear their own colours: his
 * green coat and bunnet, the grey pelt over it, her blouse and skirt from the
 * inn, the sheltie's tan and the collie's black-and-white. The sun is still
 * behind them, so everything takes a warm rim down its right side — lit, but
 * not lit from the front.
 */
function drawGroup(g: Painter, cx: number, groundY: number, u: number, time: number) {
  const rim = "#ffca70";

  const breath = Math.sin(time / 2800) > 0 ? 0 : 1;
  const manX = cx - Math.round(u * 0.5);
  const wifeX = cx + Math.round(u * 0.34);

  /* ---- him: seated, in his coat and bunnet, with the pelt over it ---- */
  {
    const hh = u;
    const seatY = groundY - breath;
    const hipW = Math.round(hh * 0.5);
    const shoulderW = Math.round(hh * 0.44);
    const torsoH = Math.round(hh * 0.42);
    const hipsY = seatY - Math.round(hh * 0.16);

    // breeks on the ground, and his legs over the lip
    g.px(manX - Math.round(hipW / 2), hipsY, hipW, Math.round(hh * 0.16), "#4b4632");
    g.px(manX - Math.round(hipW * 0.34), seatY, Math.round(hipW * 0.26), Math.round(hh * 0.2), "#4b4632");
    g.px(manX + Math.round(hipW * 0.08), seatY, Math.round(hipW * 0.26), Math.round(hh * 0.2), "#4b4632");
    g.px(manX - Math.round(hipW * 0.34), seatY + Math.round(hh * 0.2), Math.round(hipW * 0.26), 2, "#2a2118"); // boots
    g.px(manX + Math.round(hipW * 0.08), seatY + Math.round(hh * 0.2), Math.round(hipW * 0.26), 2, "#2a2118");

    // his back, in the green coat
    for (let i = 0; i < torsoH; i++) {
      const t = i / torsoH;
      const w = Math.round(hipW + (shoulderW - hipW) * t);
      g.px(manX - Math.round(w / 2), hipsY - i, w, 1, "#4a5540");
    }
    const shoulderY = hipsY - torsoH;
    g.px(manX - Math.round(shoulderW / 2), shoulderY, shoulderW, 2, "#5a6650"); // lit shoulders

    /*
     * The wolf pelt, worn as the game describes it: the skin across his
     * shoulders and the head of it pushed back off his own. Drawn here rather
     * than through drawPelt because he is seated and that one is placed
     * against a standing sprite.
     */
    const pw = shoulderW + 5;
    const px0 = manX - Math.round(pw / 2);
    // the skin across his shoulders, in a grey light enough to tell from the
    // coat under it — at #3a3d47 it was the same value as the green and the
    // whole nod to the wolf disappeared into his back
    g.px(px0, shoulderY - 1, pw, Math.round(hh * 0.22), "#6a707e");
    g.px(px0, shoulderY - 1, pw, 2, "#8d95a4"); // the sun along the top of it
    g.px(px0 + 2, shoulderY + Math.round(hh * 0.1), pw - 4, 1, "#565c68"); // the fall of the fur
    g.px(px0 - 1, shoulderY + 2, 2, Math.round(hh * 0.3), "#6a707e"); // the brush down his back
    g.px(px0 - 1, shoulderY + Math.round(hh * 0.3), 2, 3, "#e8ecf2"); // its white tip
    // and the head of it, pushed back off his own as a hood
    g.px(px0 + 1, shoulderY - Math.round(hh * 0.1), 5, Math.round(hh * 0.1), "#5e646f");
    g.px(px0 + 1, shoulderY - Math.round(hh * 0.13), 2, 3, "#5e646f"); // its ears
    g.px(px0 + 4, shoulderY - Math.round(hh * 0.13), 2, 3, "#5e646f");

    // his head, hair and bunnet
    const headR = Math.max(3, Math.round(hh * 0.15));
    const headCy = shoulderY - headR;
    disc(g, manX, headCy, headR, "#8a6b4c");
    g.px(manX - headR, headCy - headR, headR * 2, Math.max(2, Math.round(headR * 0.9)), "#2f3327"); // bunnet
    g.px(manX - headR + 1, headCy - headR - 1, headR * 2 - 2, 1, "#3a3f31");
    g.px(manX + headR - 1, headCy - headR + 2, 1, headR * 2 - 2, rim); // sun down his right
    g.px(manX + Math.round(shoulderW / 2) - 1, shoulderY + 2, 1, torsoH - 2, rim);
  }

  /* ---- her: leaning in, in the blouse and skirt from the inn ---- */
  {
    const hh = Math.round(u * 0.92);
    const hipW = Math.round(hh * 0.46);
    const shoulderW = Math.round(hh * 0.38);
    const torsoH = Math.round(hh * 0.4);
    const hipsY = groundY - Math.round(hh * 0.14);

    // her skirt, spread on the grass
    g.px(wifeX - Math.round(hipW * 0.9), hipsY, Math.round(hipW * 1.8), Math.round(hh * 0.16), "#3d5a4a");
    g.px(wifeX - Math.round(hipW * 0.9), hipsY, Math.round(hipW * 1.8), 1, "#4e6f5c");
    for (let i = 0; i < torsoH; i++) {
      const t = i / torsoH;
      const w = Math.round(hipW + (shoulderW - hipW) * t);
      const lean = Math.round(-u * 0.06 * t); // she leans towards him
      g.px(wifeX - Math.round(w / 2) + lean, hipsY - i, w, 1, "#e8e3d2");
    }
    const shoulderY = hipsY - torsoH;
    const lean = Math.round(-u * 0.06);
    const headR = Math.max(3, Math.round(hh * 0.14));
    const headCx = wifeX + lean;
    const headCy = shoulderY - headR;
    disc(g, headCx, headCy, headR, "#c9a583");
    // her hair, down past her shoulders
    g.px(headCx - headR - 1, headCy - headR + 1, headR * 2 + 2, Math.round(hh * 0.28), "#7a3a24");
    disc(g, headCx, headCy - 1, headR, "#7a3a24");
    g.px(headCx - headR + 1, headCy + 1, headR * 2 - 2, headR, "#c9a583"); // her face out of it
    g.px(headCx + headR, headCy - headR + 2, 1, Math.round(hh * 0.3), rim);
    g.px(wifeX + Math.round(shoulderW / 2) + lean, shoulderY + 2, 1, torsoH - 2, rim);
  }
}

