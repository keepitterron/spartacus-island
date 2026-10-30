# Backlog

From Zoë and from play-testing. Story beats come from Zoë; ask her via Claudio.

## Story and levels

- **Island 5**: story not written yet. Eduardo's ability is pinching through ropes. Ask Zoë: where does the whale leave the ship, what's tied up, who needs rescuing. How-to: [islands.md](islands.md#adding-island-5-step-by-step).
- **Zoë's layouts** for Mossy Paw Woods and Bubbly Ocean (currently placeholders). Positions are island-local (`W3`, `W4`), so her maps are a number edit. A next step could be moving those positions into a plain data object per island.

## Spartacus

- Floppy labrador ears (currently short).
- Hazel eyes (currently brown). The app icon already has hazel eyes.

## Features

- **Mid-island saves**: persist grown vines, found items, dug spots, crew state.
- **Multiplayer** (the long-term goal): host-authoritative, one browser runs physics, others send inputs. Options: PeerJS/WebRTC with a share code, or PartyKit/Colyseus. Friends play crew members with built-in abilities (Mango glides/carries, Wasabi swims/bubbles, Eduardo pinches), which makes co-op puzzles natural. `stepPlayer` is already isolated, and `P` would become one of several players.
- **Ship home base** (Minecraft-style): spend bones/acorns/crabs on ship decorations, sail patterns, hats; rescued friends live on the ship.

## Tech

- **Phone performance**: instancing for repeated props (flowers, coral, seaweed strips, rocks) and merging static meshes per island.
- **Automated smoke tests** (Playwright): blocked on BUG-1 for software-GL runners; see [testing.md](testing.md).
- Upgrade three.js past 0.160 (check `CapsuleGeometry`, lighting and colour management for visual changes).
- Optional formatter/linter. The code is intentionally dense (it came from a single-file chat build); a formatter would expand it a lot.
