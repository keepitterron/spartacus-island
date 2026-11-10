# Island 7: Jamboree Island (the funfair)

Built and playable from the rainbow slide down to "To be continued…". **A surprise for Zoë:** Claudio asked for a level bigger and sillier than the others, with much more to play with, so this one was designed without her. Everything she usually decides is a **placeholder** until she has her say (see **For Zoë** at the end).

## The story in one breath

The ship slides down a rainbow from the sky island and lands beside a funfair run by the **Fuzzles**, tiny fluffy folk in party hats. Tonight is their fireworks show, but the cannon went off by mistake and blew the **five show rockets** all over the fair. Pip, the ringmaster in the top hat, asks Spartacus to find them. Each rocket waits at the end of a ride. With all five back on the stand, at night, Spartacus pushes the fuse box and the show goes up: a golden paw print, a heart, and then her name, **ZOË**, across the sky. _To be continued…_

It fits the rules: nobody is a villain (the cannon just misfired), nothing can hurt Spartacus, the friend from the last island helps (Leo finds golden tickets), and a fall or a miss costs seconds.

## What's new here

The other islands are puzzles; this one is a playground. Every ride is a toy that does something the moment you touch it.

| Toy               | What it does                                                                                                                                                                                                                                      | Rocket                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Jelly Jumps**   | Jellies bounce Spartacus up and each plays a note. Hold Jump to bounce higher; a **Slam** onto one is a MEGA bounce. A row of five is a staircase to the three-tier cake.                                                                         | Purple, on top of the cake (the last hop needs the Slam) |
| **Kaboom Cannon** | Hop in, the fuse fizzes, BOOM: a big somersaulting arc over the fair to Bullseye Rock, out at sea. A second cannon fires back onto the haystack. No aiming, so it can't go wrong.                                                                 | Red, on Bullseye Rock                                    |
| **Mega-Me fruit** | Spartacus is GIANT for 30 seconds: long strides, a deep woof, stomps that shake the palms and send the Fuzzles hopping. He steps over hedges and onto stall roofs. It wears off by itself (a count-down on the power badge, a wobble at the end). | Green, in the Secret Garden: a hedge ring with no door   |
| **Big Wheel**     | Stuck at first: it takes a giant woof to start it. Then hop in a gondola, ride up, and jump out at the top onto the Sky Deck.                                                                                                                     | Yellow, on the Sky Deck                                  |
| **Loop-de-Woof**  | The coaster: a cart from the Sky Deck down a big drop, through a real upside-down loop and round the east side to a little station by the plaza.                                                                                                  | Blue, hanging in the loop                                |
| **The Fuzzles**   | About 40 of them hop about, turn to watch Spartacus, scoot out from under his paws, squeak and jump for a woof, and fly up giggling for a giant's stomp or woof. They gather to watch the show.                                                   |                                                          |
| **Leo**           | He perches on the welcome arch. Woof, and he flies to the nearest golden ticket still out there and flutters over it.                                                                                                                             |                                                          |
| **Fireworks**     | The finale, and after it a firework goes up every few seconds at night; a woof by the stand sends up another.                                                                                                                                     |                                                          |

Twelve **golden tickets** reward trying everything: on the cannons' flight paths, on the wheel, along the coaster, above a jelly, on the cake, in the garden, on Bullseye Rock, and on a stall roof only a giant dog can step onto.

## Tasks

1. 🎩 Meet Pip the ringmaster
2. 💜 Purple rocket: bounce up the Jelly Jumps
3. ❤️ Red rocket: fly from the Kaboom Cannon
4. 🦖 Eat a Mega-Me fruit (`power`)
5. 💚 Green rocket: get into the Secret Garden
6. 💛 Yellow rocket: ride the Big Wheel to the top
7. 💙 Blue rocket: loop the Loop-de-Woof
8. 🎟️ Find 12 golden tickets
9. 🎆 Start the fireworks when it's dark

The rockets can be found in any order, except that the wheel (and so the coaster) needs Mega-Me first. A tall beam of each rocket's colour shows where it is, like the stars on Rainbow Reef. Touching a rocket sends it flying home to the stand by itself, so there's nothing to carry or drop.

## Can't get stuck

- Inside the Secret Garden as a normal dog (Mega-Me wore off): a jelly in there bounces him back out over the hedge.
- On Bullseye Rock: the second cannon, or just swim (the sea current carries him back to the fair).
- On the Sky Deck or the cake: jump off (no fall damage), ride the coaster, or hop into a passing gondola.
- A giant dog doesn't fit on the rides; a toast says so, and Mega-Me has always worn off within 30 seconds.
- Fell off the jelly staircase: the first jelly is at ground level, a few steps away.

## How it's built

- `islands/island7/layout.js`: every position on the island as data (the map is a number edit).
- `index.js` puts it together: terrain, tasks, hints, woof / stomp / pound reactions, saves.
- One module per toy: `jellies.js`, `cannon.js`, `wheel.js`, `coaster.js`, `fuzzles.js`, `rockets.js`, `fireworks.js`, `scout.js` (Leo), `decor.js` (arch, Big Top, stalls, lamps, bunting, balloons), `arrive.js` (the rainbow slide).
- **Rides** are a new player mode, `player.ride` (`systems/rides.js`): while it's set the main loop calls `ride.update(dt)` instead of walking. The cannon flight, a gondola seat and the coaster cart are all rides.
- **Mega-Me** is a power like the others (`systems/powers.js`), with its timer and stomps in `player/mega.js`. It's the first power that wears off.
- **The coaster** follows a Catmull-Rom curve; its speed comes from how far the cart has dropped. In the loop the cart's "up" points at the middle of the loop, so Spartacus really goes upside down (`ride.quaternion` turns the whole dog).
- **Fireworks** are `THREE.Points`: sparks fly from a centre to their places. Pictures are lists of 2D points; the name is written on a hidden canvas with the game font and read back as dots, sized to fit the screen (phones held upright are narrow). Change `NAME` in `fireworks.js` to write something else.

## Keeping it light on phones

- Fuzzles are four `InstancedMesh`es for all of them; bulbs, bunting flags, hedge lumps, sleepers and pillars are instanced too.
- About 290 draw calls on the plaza and 650 looking over the whole fair from the dock, in line with islands 5 and 6 (island 1 is about 1,600).
- No extra lights: the bulbs are one shared emissive material that glows brighter at night.
- A firework shell is one draw call; the show has at most about ten at once.

## For Zoë

Things she'd normally decide. Ask her after she's played it, and change them to her answers:

- **The name** of the island (Jamboree Island) and of the Fuzzles and **Pip**.
- **What the Mega-Me fruit looks like.** For now it's the Mini-Me mushroom's big twin: fat, yellow with red spots.
- **Who joins the crew.** Every island so far ends with a new friend; this one doesn't, so that she can choose (Pip? a Fuzzle? someone new?).
- **Tunes:** the island's music is a list of numbers (see systems.md), and the jellies play C D E G A.
- **What happens next.** The end panel asks her to make up the story.
- Tuning to try with her: jelly bounce heights (`BOUNCE` in `jellies.js`), Mega-Me's length and size (`MEGA` in `player/player.js`), the coaster's speed (`PULL` in `coaster.js`).

Ideas that didn't make this build: giant bowling (a huge ball and skittles only a Mega-Me dog can play), riding on Leo's back as a Mini-Me dog, a carousel, and friends playing together on the rides (the multiplayer goal in backlog.md).
