# Store page: drafts

Drafts for the Steamworks store page, to edit rather than paste as they are. Everything
below is true of the game as built on the `steam` branch; if a feature changes, check here.

---

## Short description

Shown beside the capsule. At most 300 characters; this one is 265.

> You gave up the job in the city and took on a Highland hill. Graze the flock, shear and
> sell the clip, get them through the winter, and build the old croft up into a home, one
> short day at a time, with a dog at your heel and a pint at the inn when the work is done.

---

## About this game

**A hirsel is the stretch of hill one shepherd and one dog can work, and the flock that
lives on it.**

You handed in your notice. Now there is a hill in the Highlands, a handful of blackface
ewes, a tumbledown croft and forty pounds. Every day has a few taps of work in it: gather
the flock, shear, tend them, muck the pasture, cut hay while the sun shines, and every night
the hill decides how you did.

**A year on the hill.** Spring brings the lambs. Summer is for the clip, the hay and the
Highland show. Autumn is the market and the last good grass. Winter is snow on the hill and
whatever you managed to put in the barn.

**A flock of your own.** Blackface, Cheviot, Hebridean and Shetland, each with its own
fleece and its own price. The tup goes in with the ewes in autumn; see them through the
winter, and count the lambs on their feet in the spring.

**A dog at your heel.** A sheltie or a border collie to work the flock and see off the fox.
She grows old, and when her working life is over she retires to the fire, and the cart
will sell you another.

**A croft to build.** Slate the roof, build up the hearth, raise the byre. Everything you
buy ends up on the wall or by the fire in a room you can walk into.

**Neighbours.** Callum over the burn, who will lend a hand and ask for one. Letters from the
life you left. A dealer at the gate. And an evening at the inn, where someone is always
behind the bar.

**Made to be put down and picked back up.** No timers, no energy bars: a day is a handful of
choices and a night's sleep. Three difficulty scales, from Gentle to Hard. Play with a
mouse, the keyboard or a controller.

---

## Features (the bullet list, if the page wants one)

- A full year on the hill: four seasons, snow, lambing, hay, the show and the market
- Four breeds of sheep, each with its own fleece and price
- A dog that works the flock, grows old, and retires to the fire
- A croft to build room by room, and a house to walk into
- Neighbours, letters and chance visitors that ask something of you
- Short days, no timers: play in ten minutes or an evening
- Full controller support, and playable on Steam Deck
- 29 Steam achievements, some of them secret
- Steam Cloud saves
- Original music

---

## Tags

Pick from Steam's list in the partner site. Suggested, strongest first:

Cozy · Farming Sim · Pixel Graphics · Relaxing · Management · Life Sim · Singleplayer ·
Casual · Indie · Simulation · 2D · Controller

---

## Content survey

- **Tobacco:** he can smoke a pipe on the hill.
- **Alcohol:** an evening at the inn is a pint.
- **Violence:** a wolf may come for the flock on the high ground. With the broadsword he
  fights it off; without it, sheep are lost. Off-screen, not graphic.
- No sexual content, no gambling, no real-money purchases, no user-generated content.

## Privacy

The game makes no network connections of its own: no telemetry, no analytics, no accounts.
Saves are files on the player's machine, synced by Steam Cloud. Steam itself provides
achievements and the overlay.

---

## System requirements

Minimum and recommended can be the same; it is a 2D pixel game. The install is about
300 MB, almost all of it the Electron runtime.

**Windows**
- OS: Windows 10 64-bit or later
- Processor: any 64-bit dual core
- Memory: 4 GB RAM
- Graphics: anything from the last ten years; integrated is fine
- Storage: 400 MB

**SteamOS + Linux**
- OS: SteamOS 3, or a 64-bit Linux from Ubuntu 20.04 onward
- Processor, memory, graphics: as for Windows
- Storage: 400 MB

---

## Price

A cozy game of this size sits at $6–10, if a first win takes roughly 4–8 hours: the
playtest should confirm that before the price is set. $7.99 is a reasonable launch price; a launch discount of 10–20% is usual.

---

## The demo

Its own app on Steam, created under the game's. It is the first 30 days of a run (the
first spring and the start of summer), then a card that sends the player to the store page.
Saves are kept apart from the full game's, and don't carry over: thirty days is quickly
played again.
The store link in the demo comes from `VITE_STORE_URL` in `.env.demo`: set it once the
store page exists, then rebuild the demo.
