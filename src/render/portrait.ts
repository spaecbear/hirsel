/**
 * Faces for the cards: who is at the door, head and shoulders, drawn at a
 * fixed small size and integer-scaled by CSS like everything else.
 *
 * Only Callum so far. He is the one person in the glen who comes back again
 * and again, and a name on a card was not enough to make him someone the
 * player knows. The portrait is what makes the card a visit.
 */
import type { Painter } from "./painter";

export const PORTRAIT_W = 40;
export const PORTRAIT_H = 44;

/**
 * Callum over the burn: a hill shepherd of your father's age. Flat cap, a
 * weathered face gone red at the cheeks, a grey beard kept short, and a tweed
 * jacket that has seen more weather than you have. `since` is how long the
 * card has been up — he talks for the first moments of it and then listens,
 * and blinks now and then throughout.
 */
export function drawCallum(g: Painter, time: number, since: number) {
  const W = PORTRAIT_W;
  const H = PORTRAIT_H;

  // behind him: the hill in a grey sky, dithered at the join like the glen's
  g.px(0, 0, W, H, "#4b5a5e");
  g.px(0, 0, W, 16, "#5d6c70");
  for (let x = 0; x < W; x += 2) g.px(x + ((x / 2) % 2), 16, 1, 1, "#5d6c70");
  for (let x = 0; x < W; x++) {
    const y = 24 + Math.round(Math.sin(x / 7) * 2 + Math.sin(x / 3) * 0.6);
    g.px(x, y, 1, H - y, "#3d4a2f");
  }

  const skin = "#c89a78";
  const skinShade = "#a97c5c";
  const cheek = "#c47b62";
  const beard = "#9d9890";
  const beardDark = "#7d7a74";
  const tweed = "#6b6446";
  const tweedDark = "#57513a";
  const cap = "#5e5040";
  const capLit = "#76664f";

  // shoulders and the tweed jacket, with a fleck to it, and a shirt at the neck
  g.px(4, 33, 32, 11, tweed);
  g.px(2, 36, 36, 8, tweed);
  for (let i = 0; i < 26; i++) g.px(3 + ((i * 7) % 34), 34 + ((i * 5) % 9), 1, 1, i % 2 ? tweedDark : "#7a7352");
  g.px(15, 32, 10, 5, "#d9d2bd"); // the collar
  g.px(19, 33, 2, 11, tweedDark); // the lapels meet
  g.px(4, 33, 1, 11, tweedDark);
  g.px(35, 33, 1, 11, tweedDark);

  // the neck and the face
  g.px(16, 28, 8, 5, skinShade);
  g.px(12, 12, 16, 17, skin);
  g.px(12, 12, 2, 17, skinShade); // the shaded side
  g.px(11, 17, 1, 5, skin); // ears
  g.px(28, 17, 1, 5, skinShade);
  g.px(14, 21, 3, 2, cheek); // weather in the cheeks
  g.px(23, 21, 3, 2, cheek);

  // the beard: short and grey, round the jaw and over the lip
  g.px(12, 22, 16, 8, beard);
  g.px(13, 30, 14, 1, beardDark);
  g.px(15, 22, 10, 2, beard); // the moustache
  g.px(12, 24, 1, 5, beardDark);
  // the mouth: open a little while he is talking, closed after
  const talking = since < 2400 && Math.floor(since / 160) % 2 === 0;
  g.px(17, 25, 6, talking ? 2 : 1, "#4a2e24");

  // the nose, and the eyes under heavy grey brows
  g.px(19, 17, 2, 5, skinShade);
  g.px(19, 21, 3, 1, "#8f6a4d");
  g.px(14, 15, 5, 1, beardDark);
  g.px(22, 15, 5, 1, beardDark);
  const blink = time % 3600 < 140;
  if (blink) {
    g.px(15, 17, 3, 1, "#5a4030");
    g.px(23, 17, 3, 1, "#5a4030");
  } else {
    g.px(15, 16, 3, 2, "#f0ebe0");
    g.px(23, 16, 3, 2, "#f0ebe0");
    g.px(16, 16, 2, 2, "#2c2a26");
    g.px(24, 16, 2, 2, "#2c2a26");
  }

  // the flat cap: a peak out over the brow, the crown sloping back
  g.px(10, 8, 20, 5, cap);
  g.px(11, 7, 17, 2, cap);
  g.px(9, 12, 24, 2, cap); // the peak
  g.px(11, 7, 17, 1, capLit);
  g.px(9, 12, 24, 1, capLit);
  g.px(12, 14, 1, 2, "#8f8a82"); // grey at the temple
  g.px(27, 14, 1, 2, "#8f8a82");

  // a frame, so it sits on the card as a picture
  g.px(0, 0, W, 1, "#1d2016");
  g.px(0, H - 1, W, 1, "#1d2016");
  g.px(0, 0, 1, H, "#1d2016");
  g.px(W - 1, 0, 1, H, "#1d2016");
}
