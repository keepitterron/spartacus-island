# Backlog

From Zoë and from play-testing. Story beats come from Zoë; ask her via Claudio.

## Story and levels

- **Island 5, Rainbow Reef**: live. Next: Zoë play-tests it on her phone. The unicorn is called Lina.
- **Island 6, the sky island**: built and playable to "To be continued…". Still Zoë's to decide: its name, what the fruits look like, a collect-a-number task (feathers?), and whether Leo joins the crew. See [island6.md](island6.md).
- **Zoë's layouts** for Mossy Paw Woods and Bubbly Ocean (currently placeholders). Positions are island-local (`toWorld(x, z)` in each island), so her maps are a number edit. A next step could be moving those positions into a plain data object per island.

## Features

- **Mid-island saves for islands 1–4**: the system exists (`savesProgress`, see systems.md) and island 5 uses it. The older islands would each need a `saveState`/`loadState` for their own story state (bridge fixed, chest open, Mango riding, Eduardo's chase…), and restore-safe dig rewards.
- **Multiplayer** (the long-term goal): host-authoritative, one browser runs physics, others send inputs. Options: PeerJS/WebRTC with a share code, or PartyKit/Colyseus. Friends play crew members with built-in abilities (Mango glides/carries, Wasabi swims/bubbles, Eduardo pinches), which makes co-op puzzles natural. `stepPlayer` is already isolated, and `P` would become one of several players.
- **Ship home base** (Minecraft-style): spend bones/acorns/crabs on ship decorations and sail patterns (not on Spartacus: no dress-up, see design-rules.md); rescued friends live on the ship.

## Tech

- **Phone performance**: instancing for repeated props (flowers, coral, seaweed strips, rocks) and merging static meshes per island.
- **Automated smoke tests** (Playwright): blocked on BUG-1 for software-GL runners; see [testing.md](testing.md).
- Upgrade three.js past 0.160 (check `CapsuleGeometry`, lighting and colour management for visual changes).
- Optional formatter/linter. The code is intentionally dense (it came from a single-file chat build); a formatter would expand it a lot.
