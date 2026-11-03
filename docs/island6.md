# Island 6: Cottoncrest Islets (the sky island)

Built and playable, from Claudio's idea and Zoë's answers. Zoë named it **Cottoncrest Islets**. What was built, and how, is under **Built so far** below.

**What Zoë gave us:** the unicorn is **Lina**, and she gets wings in the sky. **Leo** the magpie has her jewel, wants a **fork** for it, and becomes a friend. Clouds under the island, not water. The fruits are **Mini-Me** and **Smash-Smash**. Shrinking is fine: Spartacus doesn't change, he just gets smaller for a while.

## The story in one breath

The rainbow lifts the ship up to the sky island, Lina's home: little clouds floating around a crystal palace. Back in the sky, Lina's **wings unfold** (they only work up here, which is why she was stuck on the reef). But her **Sky Jewel**, the gem that makes the palace fountain sparkle, is gone: Leo the magpie saw it glinting and carried it off to the nest at the top of the island. Lina can't reach the nest (too big for the windy gaps, and Leo squawks at her), but she can flap a warm updraft under Spartacus. He floats from cloud to cloud on her wind, shrinks with **Mini-Me** to squeeze through tiny gaps, rolls with **Smash-Smash** through cracked crystal walls, finds a shiny **fork**, sneaks up to the nest and swaps it for the jewel. Leo loves the fork and becomes a friend. The fountain sparkles again. _To be continued…_

It fits the rules: Lina has a simple need, Leo is an obstacle with a happy ending (a fork and a new friend), and Lina is the tool for this island (the updraft).

## Floating on Lina's wind

- Lina flies along behind Spartacus (a flying `unicornFollow`) and flaps. Under her wind he **floats**: low gravity, a slow top fall speed.
- **Tap Jump in the air to flap up** a little; **hold Jump to glide** (falls even slower). Gentle, Rayman helicopter-hair style, not Flappy Bird: wide gaps, nothing to bonk your head on.
- An updraft sparkle shows where the wind is.
- **Falling:** below the island is a sea of clouds. Spartacus sinks in with a _poof_ and pops back up on the **last cloud he stood on**, in about a second. Every cloud you land on is a checkpoint, so a fall costs one hop. (The bubble rescue was frustrating because it was slow and took control away; this has to be quick.)

## Shape: four sections climbing up

| #   | Section               | What you do                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Windy Steps**       | Learn to float: big clouds, short hops, Lina flapping close behind. Ends at the palace, where Lina tells the story.                                                                                                                                                                                                         |
| 2   | **Tickle Tunnels**    | A Mini-Me bush. Cloud walls with gaps only a small dog fits through. Tiny Spartacus floats a bit higher in the updraft.                                                                                                                                                                                                     |
| 3   | **Crystal Wall**      | A Smash-Smash bush. Run to curl into a ball and burst through cracked crystal walls (sideways; the Slam goes down). Behind the last wall: a cloud picnic with a shiny **fork**. Getting it out needs one swap back to Mini-Me at a regrowing bush.                                                                          |
| 4   | **The Magpie's Nest** | Sneaking, on solid cloud (never mid-flight): puffy bushes to hide behind; Leo looks around, shows "?" when curious and "!" on spotting you, then flutters to the next perch with the jewel (costs seconds, nothing else). Mini-Me makes you harder to see, and a woof distracts Leo. Reach the nest with the fork and swap. |

Lina keeps flapping the whole time; she gasps when Leo flutters off, but never stops.

## Tasks

1. 🦄 Fly with Lina
2. 🤏 Eat a Mini-Me fruit (`power`)
3. 💥 Eat a Smash-Smash fruit (`power`)
4. 🍴 Find something shiny for Leo
5. 💎 Swap the fork for the Sky Jewel
6. ⛲ Bring the jewel to the fountain

Plus a "collect a number" task (feathers?) to reward exploring the edges.

## New things to build (and a hint for each)

1. **Flight:** island `physics` overrides (gravity, `maxFall`) plus a flap/glide in `stepPlayer` behind a flag, active while Lina's updraft is on. Lina's wings and a flying follow state in `npcs/unicorn.js`; move `updateUnicorn` into the main loop (systems.md already expects this).
2. **Cloud sea + checkpoints:** falling below a height pops Spartacus back to the last cloud he stood on (the "last dry spot" mid-island saves already track).
3. **Mini-Me power:** `player.tiny`, scale the dog to about 0.45, a smaller collision radius, the camera closer. Gap colliders that only stop a full-size dog. It wears off when another fruit is eaten (one power at a time), so a bush near every exit.
4. **Smash-Smash power:** running curls him into a rolling ball; cracked walls are colliders switched off (`c.top = -999`) with crystal debris.
5. **Leo the magpie** (`npcs/leo.js`, since Leo becomes a friend and may travel): perches, a look-around cycle with "?" / "!", a sight check (distance, view cone, hiding bushes; smaller range when tiny), a bark distracts, the swap, then a happy state.
6. **The fork:** an ordinary item (`addItem`), not heavy.
7. **Fountain finale** and the "To be continued…" panel moves here from island 5.

## Keeping it light on phones

- **No terrain heightfield:** clouds are cylinder/box colliders and `supportHeight`, so no ground mesh or canvas texture.
- **Clouds as instances:** a few lumpy blob shapes in `InstancedMesh`es with one flat-shaded material. Aim for 20–30 draw calls for the whole island. Fog hides the distance, so no backdrop.
- **Hide the other islands** while on this one. Every island is built at boot and stays in the scene; hiding all but the current one helps every level, not just this one.
- **Shadows** only from Spartacus, Lina and Leo; no cloud shadows with `LOW_POWER`.
- **Updraft sparkles:** one `Points` object, about 100 points, only while Lina flaps.
- **Magpie sight** is plain maths (distance, angle, circle checks against the hiding bushes), no raycasting.
- **Mid-island saves** (`savesProgress: true`): checkpoint, powers, fork and jewel survive a closed tab.

## Still open (for Zoë)

- Nothing for this island. Next: what happens on the next island?

## Built so far

- **Plumbing:** `islands/island6/`, `CENTER_6` at z = −1550, past the end of island 5's sea. Island 5's rainbow ride carries the ship straight here.
- **Floating:** `physics: { gravity: 16, maxFall: 7, flap: true }`. In the air, a Jump press flaps (`FLY.flaps` per jump, reset on landing) and holding Jump caps the fall at `FLY.glideFall`. Tune live with `__g.fly` while Zoë plays.
- **Lina:** `unicornFly()` shows her wings; she flies behind and to one side so she never blocks the camera.
- **Clouds** (`clouds.js`): each platform is a cylinder collider drawn as instanced cushions and puffs; the cloud sea is one plane plus instanced puffs. Its own `seededRandom`, so the shared `rand()` sequence (and every other island's scenery) is untouched.
- **Checkpoints:** sinking into the cloud sea, or falling 8 below the last cloud with nothing underneath, poofs and pops him back onto the middle of the last cloud he stood on (0.6 s).
- **Windy Steps:** five clouds from the ship up to the palace cloud; landing there ticks "Fly with Lina" and she tells the story.
- **Updraft sparkles** (`updraft.js`): one `Points` of 100, only while he's in the air.
- **Tickle Tunnels** (west of the palace): a Mini-Me bush on the palace cloud, then two clouds each split by a tall cloud wall (`addCloudWall`) with a hole at its foot. The lintel is 0.8 up and a full-size Spartacus is 1.1 tall, so only a tiny dog gets through. Checkpoints remember where he stood (pulled in from the edge), so a wall across a cloud never puts him back on the wrong side.
- **Crystal Wall** (north-west): the Smash-Smash cloud (with a Mini-Me bush for the way back), a cloud with a cracked wall across it to learn smashing, a step, then the picnic cloud inside a square crystal fence with one cracked panel. Inside: a blanket, a basket, a Mini-Me bush and the crystal cubby (`addCubby`) with the fork at the back, out of reach from the door. Smashed walls are saved (`saveState`).
- **The way back:** three level clouds high above the palace and one big drop onto it. They're 8 above the palace, more than even a tiny dog can float up (about 6.7), so nobody can skip the puzzles.
- **Dropping things:** an item dropped with no cloud underneath floats home in a bubble (`physics.floor`), like items dropped in the sea.
- **Fruit looks are placeholders:** Mini-Me is pink with white dots, Smash-Smash crystal blue with white cracks, until Zoë says what they look like.
- **The Magpie's Nest** (`nest.js`, east of the palace): three hops up to Leo's cloud. Leo looks round from his nest at the far side; six pink cloud bushes (`addCloudBush`) hide you on the way. Spotted, he shows "!" and flutters to a crystal perch with the jewel for a few seconds, then comes home. Hints build up: the first time he sees you, then "woof to distract him", then "a teeny dog is harder to spot". With the fork, **Swap** at the nest: the fork goes in, the jewel goes in Spartacus's mouth, and Leo is a friend. The swap is put back from its task on Continue.
- **Seeing past walls** (Claudio's play-test: holes were hard to find, and walls hid the way on): cloud walls and the crystal fence fade almost fully see-through while they're between the camera and Spartacus (`fade.js`; each such wall has its own material). The tunnel holes and the cubby door have little golden arches that sparkle when you're near (`doors.js`), the cubby is clear crystal, and the fork glints until it's found.
- **Fountain finale** (`fountain.js`): with the jewel, **Place** at the palace fountain puts it back on the spout. Water fills the basin, a jet sparkles over the jewel, Lina hops for joy, and the last task ticks, which brings up the win panel. Its button, or **Sail** at the ship afterwards, shows "To be continued…". That panel now has **Keep exploring**, and its **Start over** needs a second tap. A placed jewel is put back from its task on Continue.
- **Zoë's answers (Nov 2026):** the name is Cottoncrest Islets; the Mini-Me fruit looks like a red mushroom with white spots and the Smash-Smash fruit like a spiky blue ball (a hedgehog curled up), both whole models (`fruitModels` in `systems/powers.js`); there are **8 feathers** to find, on two little side clouds, the edges and past each puzzle; and **Leo joins the crew**: once the jewel is in the fountain he asks to come along and flies to the ship, where he rides on the figurehead (`leoToShip()`, `leoAboard()`).
- **Telling things apart** (Claudio's play-test: everything was white): the island has its own deeper blue `sky` (daylight.js reads `island.sky`), the cloud sea is a shady lilac blue, the clouds you land on are a sunlit warm white, and a soft round shadow (`shadow.js`) marks where Spartacus will land while he floats.
