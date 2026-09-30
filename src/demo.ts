/**
 * The demo: the same game, stopped at the turn from spring into summer.
 *
 * Built with `npm run build:demo`, which reads `.env.demo`. There is no
 * separate demo code path in the game — the sim never knows — only a card
 * that comes up once the last demo day has been slept through, and a word
 * on the title. A normal build has DEMO_DAYS at 0 and none of this shows.
 *
 * Thirty days: the whole of the first spring (seasons are 24 days) and the
 * first days of summer. By then the player has met Callum (day 3), bought
 * the first tools, seen two full moons and the warning between them, and
 * stands at the start of the hay — with the show, the first winter and the
 * lambing after it all still ahead, in the game rather than the demo. It was
 * fourteen before there were seasons, which stopped halfway through a spring.
 * Progress does not carry over to the full game: thirty days is quickly
 * played again, and the saves are kept apart on purpose.
 */
export const DEMO_DAYS = Number(import.meta.env.VITE_DEMO_DAYS ?? 0) || 0;
export const IS_DEMO = DEMO_DAYS > 0;
/** where the wishlist button goes. The store page, once it has an address */
export const STORE_URL: string = import.meta.env.VITE_STORE_URL || "https://store.steampowered.com/search/?term=Hirsel";

/** the demo is over once the last of its days has been slept through */
export const demoOver = (day: number) => IS_DEMO && day > DEMO_DAYS;
