# Design rules

These came from Zoë and are the whole point of the game. Check every new feature and level against them.

- **No conflict.** No enemies, no damage, no health, no game over. "Grumpy" characters (the octopus) are obstacles with a happy ending, never villains.
- **Failing costs seconds, never progress.**
  - Water: Spartacus wades in the shallows and paddles in deep water; the open sea gently carries him back to the island. No drowning, no bubble.
  - Tentacles and vents: a soft bonk back a few steps.
  - Items dropped in water float back to where they were found, in a visible bubble, with sparkles.
- **Cute even when challenging.** Challenge comes from timing, platforming and figuring things out. Her references: Rayman, Sackboy, Humans Fall Flat, Untitled Goose Game.
- **One power at a time.** Each fruit gives a power; eating another swaps it. Bushes regrow, so swapping can be part of a puzzle.
- **The friend you rescue helps on the next island.** Mango (parrot) fetches things on island 3; Wasabi (axolotl) is the breathing bubble on island 4; Eduardo (crab) pinches through ropes on island 5; Lina (the unicorn) flaps an updraft on the sky island (island 6).
- **Every new thing gets a one-time hint toast** (`hintOnce`). If a kid can't tell what to do, that's a bug.
- **Zoë writes the story.** Ask her (via Claudio) rather than inventing big story beats. She enjoys story-making more than drawing.
- **Never lose progress by accident.** Destructive buttons (restart, start over) need a second tap (`armButton`).
- **Spartacus is Spartacus.** He's the real family dog in his straw hat, and that never changes: no outfits, accessories, skins or dress-up.

## Zoë's play-test feedback

Things she tried and said no to, so we don't build them again. Newest first.

- **Nov 2026:**
  - **No gifts or dress-up.** Hidden presents with accessories and a wardrobe were built and removed: she doesn't want Spartacus customised, and the presents weren't fun without that.
  - **No ocean sound.** A swelling waves ambience (and an underwater hum) was unsettling. The island tunes and footsteps are fine.
  - **No bubble rescue.** Being carried back after falling in the water was frustrating. Wading and paddling replaced it.
  - The ground-pound animation was too fast to read; it now has a slower wind-up, a visible drop and a landing pause.

## Audience and platforms

- Plays on phones (touch: stick + Act / Woof / Jump buttons) and desktop (keyboard).
- Long term: playable **together with her friends** in the browser (see [backlog.md](backlog.md)).
- Kids read slowly: keep toasts short, one idea per toast. `toast()` shows each one for at least 3.5 s, longer for long messages, and island intros wait for the previous message.

## Spartacus

The real Spartacus: half pitbull, half labrador, shiny black coat, thin white stripe down the muzzle, big white chest patch, white paw tips, floppy fluffy ears, hazel eyes. Straw hat with a red band. Big dog, big deep "WOOF-WOOF" (`sfx.bark`). Model: `src/player/dog.js`.

## IP note

The straw hat and the "Chop-Chop fruit" name are One Piece nods; the Mini-Me mushroom is a Super Mario nod and the spiky blue Smash-Smash fruit a Sonic nod (Zoë's picks). Fine for a private family game; **rename/redesign before sharing publicly**. The GitHub repo and Pages site are currently public.
