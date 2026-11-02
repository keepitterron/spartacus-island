# Island 5: Rainbow Reef (design draft)

A first design to build together. Zoë likes surprises, so this is ours to make; she play-tests each piece as it lands and her reactions steer it. The name is a placeholder.

**What Zoë gave us:** the whale leaves the ship at a cluster of small islands, all connected somehow. A unicorn becomes the friend. Every fruit comes back. Night is part of the puzzle. The chest's map leads to a sky island of rainbows and clouds (island 6, later).

## The story in one breath

The whale gives the ship a ride to a ring of little islands around a turquoise lagoon. On the middle island sits a unicorn next to a grey stone arch. She slid down her rainbow from the sky island, it broke into four **colour stars**, and they scattered over the reef, so now she can't get home. Spartacus and the crew find the stars, put them back in the arch, and at night her horn lights the arch: the rainbow is back. She joins the crew, and the rainbow lifts the ship towards the sky island. _To be continued…_

It fits the rules: a friend with a simple need, no villains, and the friend is the tool for the next island (on the sky island the unicorn makes rainbow bridges).

## Shape: a hub and four islets

```
                 [ Sea stack ]  orange: the climb
                       |
 [ Crab Cove ] ---- ( Hub ) ---- [ Tide pools ]
   red: ropes    lagoon, whale,    yellow: night
                  unicorn, arch
                       |
                 [ Kelp garden ]  blue: chop + ball
```

- **About 3× the playfield of island 2.** The hub has a radius of about 18 and each islet about 10–14, set 45–55 out, in shallow water. Every channel is shallow enough to wade or paddle, so water is a path, not a wall. Beyond the ring, the existing sea current carries Spartacus back to the hub (it already pulls towards the island centre).
- **Any order.** All four islets are open from the start, and each one is a complete puzzle that ends in a star.
- **Each islet has its own connection to the hub,** so getting there is part of the fun. Each one also opens a **shortcut home** when you finish it.
- **You can always tell where to go.** Each uncollected star shines as a tall beam of its colour, visible from everywhere. When you collect it, the beam goes out and its socket in the arch lights up. The to-do list is grouped by islet.

## The hub: Unicorn Lagoon

- The ship arrives here, and so does the whale, who **stays**: every so often it surfaces in the lagoon. Stand on its back and its **spout launches you** high, like island 4's lift vent with a friendly face. That's the surprise way up to the sea stack.
- Three fruit bushes (Boing, Stretchy, Grow) are the swap station. The Chop bush is out on the kelp garden.
- The unicorn and the stone arch with four empty sockets.
- Shells to collect, spread over the whole reef (8, the usual "collect a number" task, and they reward exploring the edges).

## The four islets

**Crab Cove (red): Eduardo's ropes.** _Getting there:_ a drawbridge on the cove side is pulled up and tied. Paddle over, climb the rocks, and **Pinch** the rope (a new action while Eduardo rides your hat), and the bridge drops: that's the shortcut. _Puzzle:_ a crate hangs from a fishing crane on a rope. Pinch it so it drops into the sand, then **ground-pound** it open. The star is inside, plus a heavy anchor (see the sea stack).

**Sea stack (orange): every fruit in one climb.** A tall rock pillar. **Boing** up to the first ledge, where a Stretchy bush grows; **swing** round the pillar on golden hooks to a ledge with a Grow bush; **grow** a vine to the top. Or skip the first step by riding the whale's spout. At the top: the star, and a seed that **grows a zipline** back to the hub (the shortcut). _Optional bonus:_ a seesaw on the hook ledge. Carry the heavy anchor from Crab Cove there (heavy means no Boing and no climbing, but hooks still work, so the route is hooks only), drop it on one end, and the other end flips a shell up to Mango's reach.

**Tide pools (yellow): night is the key.** By day the tide is in and the pools are a pretty lagoon you paddle across. A cave mouth is just under the water and Wasabi's bubbles show where. **Switch to night 🌙 and the tide goes out:** sandbars and the cave appear, fireflies show the path, and moonflowers open as stepping pads. In the cave, the star is buried under a sand mound: **pound** it. Switch back to day and the tide floods the cave behind you. That's fine, the star is already yours (the beam moves to the arch).

**Kelp garden (blue): Chop and a ball.** Thick seaweed blocks the channel. **Chop-Chop** it (that bush is here). Inside the garden, a giant clam is shut. Three pressure plates sit around it, and beach balls are nearby: **kick, bark or slam** a ball onto each plate (Goose Game vibes) and the clam opens. **Wasabi** helps with the last ball, which rolled into deep water: paddle over its bubbles and **bark**, and she pushes it back up.

## Finale

With all four stars in the arch, a hint says "The unicorn's horn glows in the dark…". **Switch to night**: her horn lights the arch, the colours fill in one by one, and the rainbow forms with music and confetti. She trots aboard (a crew spot on the ship), the rainbow curls under the ship and lifts it into the clouds, and the "To be continued…" panel moves here from island 4.

## The crew as tools, one rule each

| Friend  | How you use them                                                | Where                                       |
| ------- | --------------------------------------------------------------- | ------------------------------------------- |
| Mango   | bark under something high → he fetches it                       | shells on the pillars (reuses `mangoFetch`) |
| Wasabi  | bark while paddling over bubbles → she fetches from the sea bed | the kelp garden ball, a shell               |
| Eduardo | **Pinch** next to a rope                                        | the drawbridge, the crane                   |
| Whale   | stand on its back when it surfaces → spout                      | the hub, a way up the stack                 |

## Tasks

1. 🦄 Meet the unicorn
2. ❤️ Red star (Crab Cove)
3. 🧡 Orange star (Sea stack)
4. 💛 Yellow star (Tide pools)
5. 💙 Blue star (Kelp garden)
6. 🐚 Shells (0/8)
7. 🌈 Fix the rainbow (at night)
8. ⛵ Bring the unicorn aboard

## New things to build (and new hints for each)

1. **Mid-island save first:** stars found, bridges dropped, vines grown, digs dug, crew state. A big island can't be lost to a closed tab.
2. **Ropes** (`systems/ropes.js`): `addRope({x,y,z,onCut})` plus a **Pinch** action while Eduardo rides along.
3. **Pressure plates** (`systems/plates.js`): pressed by a ball, Spartacus or an item; `onAllPressed`. Reusable later as general switches.
4. **Tide:** the island reads `daylight.night` and raises or lowers sandbars and the cave as colliders, eased like the day/night fade. Moving the sea surface itself would be nicer but touches the ocean and the water physics, so try the sandbar version first.
5. **Crew calls:** bark near a target routes to Mango or Wasabi (a Wasabi fetch modelled on `mangoFetch`).
6. **Whale spout:** a surfacing platform that launches you up (like island 4's lift vent).
7. **Star beacons** and arch sockets; the unicorn NPC (`npcs/unicorn.js`: sad → happy → crew); the rainbow-lift cutscene.
8. **Placement:** the cluster needs its own terrain band. Island 4 owns everything at z < −600 today, so either give island 4 a lower bound or place island 5 off to the side. The whale's ending becomes a short ride to the hub.
9. **Phone performance:** instancing and merging static props, since this is about 3× the area of island 2.

## Building it in steps (Zoë play-tests each one)

1. ✅ Mid-island save, then a blockout of the hub, the islets and the channels (shapes only, no puzzles). Check that wading, paddling, the current and the camera feel good at this size. _Built: `islands/island5/`, reachable after the whale in dev/`?debug` (`preview: true`), or with `__g.go(5)`. The tasks are placeholders: visit each islet and find 8 shells._
2. ✅ Hub + unicorn + arch + beacons, then the **sea stack** (only existing systems, so it's quick and proves the "every fruit" idea). _Built: the unicorn is sad by the arch with a grey mane, and walking up to her tells the story. The sea stack (`island5/seastack.js`) has tiers 7 apart (a Boing-Boing jump reaches about 6.4 with the step up, so nothing can be skipped): Boing-Boing onto the first ledge, Stretchy bush, two hook swings, Grow-Grow bush, a vine up the column to the cap. The orange star flies home to the arch (`island5/stars.js`) and colours her second stripe; a zipline from the cap lands on a lookout rock on the hub. Not yet: the whale spout._
3. **Crab Cove** (ropes, pinch), then the **kelp garden** (plates, Wasabi call), then the **tide pools** (tide).
4. Finale, shells, music, hints, then a full play-through on a phone.

## Open for us (not for Zoë)

- The anchor seesaw: is it a fun bonus, or one thing too many?
- Should the whale's spout be the only way to the sea stack's first ledge (a surprise) or an alternative to Boing (a safer choice)?
- The unicorn's name: ask Zoë at the moment it matters (she meets her), so it's still a surprise.
