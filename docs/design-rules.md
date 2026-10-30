# Design rules

These came from Zoë and are the whole point of the game. Check every new feature and level against them.

- **No conflict.** No enemies, no damage, no health, no game over. "Grumpy" characters (the octopus) are obstacles with a happy ending, never villains.
- **Failing costs seconds, never progress.**
  - Falling in water: a bubble carries you back to where you were ~2 s earlier (`startRescue`).
  - Tentacles and vents: a soft bonk back a few steps.
  - Items dropped in water float back to where they were found, in a visible bubble, with sparkles.
- **Cute even when challenging.** Challenge comes from timing, platforming and figuring things out. Her references: Rayman, Sackboy, Humans Fall Flat, Untitled Goose Game.
- **One power at a time.** Each fruit gives a power; eating another swaps it. Bushes regrow, so swapping can be part of a puzzle.
- **The friend you rescue helps on the next island.** Mango (parrot) fetches things on island 3; Wasabi (axolotl) is the breathing bubble on island 4; Eduardo (crab) will pinch through ropes on island 5.
- **Every new thing gets a one-time hint toast** (`hintOnce`). If a kid can't tell what to do, that's a bug.
- **Zoë writes the story.** Ask her (via Claudio) rather than inventing big story beats. She enjoys story-making more than drawing.
- **Never lose progress by accident.** Destructive buttons (restart, start over) need a second tap (`armButton`).

## Audience and platforms

- Plays on phones (touch: stick + Act / Woof / Jump buttons) and desktop (keyboard).
- Long term: playable **together with her friends** in the browser (see [backlog.md](backlog.md)).
- Kids read slowly: keep toasts short, show them for 3–4 s, one idea per toast.

## Spartacus

The real Spartacus: half pitbull, half labrador, shiny black coat, thin white stripe down the muzzle, big white chest patch, white paw tips, floppy ears, hazel eyes. Straw hat with a red band. Model: `src/player/dog.js`.

## IP note

The straw hat and the "Chop-Chop fruit" name are One Piece nods. Fine for a private family game; **rename/redesign before sharing publicly**. The GitHub repo and Pages site are currently public.
