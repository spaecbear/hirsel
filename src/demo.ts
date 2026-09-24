/**
 * The demo: the same game, stopped after a fortnight on the hill.
 *
 * Built with `npm run build:demo`, which reads `.env.demo`. There is no
 * separate demo code path in the game — the sim never knows — only a card
 * that comes up once the last demo day has been slept through, and a word
 * on the title. A normal build has DEMO_DAYS at 0 and none of this shows.
 *
 * Fourteen days is chosen to land after the first tools are usually bought
 * and after the first full moon (day 5, and the warning on day 13), so the
 * demo has shown the loop, the kit and the one thing the game never explains.
 */
export const DEMO_DAYS = Number(import.meta.env.VITE_DEMO_DAYS ?? 0) || 0;
export const IS_DEMO = DEMO_DAYS > 0;
/** where the wishlist button goes. The store page, once it has an address */
export const STORE_URL: string = import.meta.env.VITE_STORE_URL || "https://store.steampowered.com/search/?term=Hirsel";

/** the demo is over once the last of its days has been slept through */
export const demoOver = (day: number) => IS_DEMO && day > DEMO_DAYS;
