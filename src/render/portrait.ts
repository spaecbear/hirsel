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
 * Callum over the burn: a hill shepherd of your father's age, in a flat cap,
 * a short grey beard and a tweed jacket.
 *
 * Drawn the way everyone else in the glen is drawn: flat colour, the same
 * skin as the shepherd and her, two single dark dots for eyes, and no mouth.
 * He had whites to his eyes, brows, a nose, red cheeks and a mouth that
 * moved while he talked, which made him the one face in the game from a
 * different game. What tells him apart now is the cap, the beard and the
 * tweed, the way the shepherd is told apart by his bunnet and his scarf.
 */
export function drawCallum(g: Painter) {
  const W = PORTRAIT_W;
  const H = PORTRAIT_H;

  // behind him: the hill in a grey sky
  g.px(0, 0, W, H, "#4b5a5e");
  g.px(0, 0, W, 16, "#5d6c70");
  for (let x = 0; x < W; x += 2) g.px(x + ((x / 2) % 2), 16, 1, 1, "#5d6c70");
  for (let x = 0; x < W; x++) {
    const y = 24 + Math.round(Math.sin(x / 7) * 2 + Math.sin(x / 3) * 0.6);
    g.px(x, y, 1, H - y, "#3d4a2f");
  }

  // the same palette the sprites use: one skin, flat cloth, a lit edge on top
  const skin = "#c9a583";
  const beard = "#9d9890";
  const tweed = "#6b6446";
  const tweedLit = "#7a7352";
  const tweedSeam = "#57513a";
  const cap = "#5e5040";
  const capLit = "#76664f";

  // shoulders: the tweed jacket, lit along the top, a seam down the front, a shirt at the neck
  g.px(4, 33, 32, 11, tweed);
  g.px(2, 36, 36, 8, tweed);
  g.px(4, 33, 32, 2, tweedLit);
  g.px(15, 32, 10, 4, "#d9d2bd"); // the collar
  g.px(19, 35, 2, 9, tweedSeam); // buttoned down the front

  // the face: one flat block, ears either side, and the neck under it
  g.px(16, 28, 8, 5, skin);
  g.px(12, 12, 16, 17, skin);
  g.px(11, 17, 1, 5, skin);
  g.px(28, 17, 1, 5, skin);

  // the beard: short and grey, round the jaw
  g.px(12, 22, 16, 8, beard);
  g.px(13, 30, 14, 1, beard);

  // two dots for eyes, and that is the whole of his face
  g.px(16, 17, 2, 2, "#26201a");
  g.px(22, 17, 2, 2, "#26201a");

  // the flat cap: a crown lit along the top, and the peak out over his brow
  g.px(10, 8, 20, 5, cap);
  g.px(11, 7, 18, 1, capLit);
  g.px(9, 12, 23, 2, cap);
  g.px(9, 12, 23, 1, capLit);

  // a frame, so it sits on the card as a picture
  g.px(0, 0, W, 1, "#1d2016");
  g.px(0, H - 1, W, 1, "#1d2016");
  g.px(0, 0, 1, H, "#1d2016");
  g.px(W - 1, 0, 1, H, "#1d2016");
}
