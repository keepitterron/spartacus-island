# Backlog

From Zoë and from play-testing. Story beats come from Zoë; ask her via Claudio.

## Story and levels

- **Island 5, Rainbow Reef**: live. Next: Zoë play-tests it on her phone. The unicorn is called Lina.
- **Island 6, Cottoncrest Islets**: built and playable to "To be continued…", with Zoë's name, fruit looks, feathers and Leo joining the crew. See [island6.md](island6.md).
- **Island 7, Jamboree Island**: built and playable as a surprise for Zoë (Nov 2026): a funfair of rides, the Mega-Me fruit and a fireworks finale that spells her name. Next: she plays it, then her answers to the questions in [island7.md](island7.md) (names, the Mega-Me fruit's look, who joins the crew, what happens next). Ideas kept for later: giant bowling, riding Leo as a Mini-Me dog, a carousel.
- **Zoë's layouts** for Mossy Paw Woods and Bubbly Ocean (currently placeholders). Positions are island-local (`toWorld(x, z)` in each island), so her maps are a number edit. A next step could be moving those positions into a plain data object per island.

## Features

- **Mid-island saves for islands 2–4**: the system exists (`savesProgress`, see systems.md) and islands 1, 5, 6 and 7 use it. The older islands would each need a `saveState`/`loadState` for their own story state (bridge fixed, chest open, Mango riding, Eduardo's chase…), and restore-safe dig rewards.
- **Multiplayer** (the long-term goal): host-authoritative, one browser runs physics, others send inputs. Options: PeerJS/WebRTC with a share code, or PartyKit/Colyseus. Friends play crew members with built-in abilities (Mango glides/carries, Wasabi swims/bubbles, Eduardo pinches), which makes co-op puzzles natural. `stepPlayer` is already isolated, and `P` would become one of several players.
- **Ship home base** (Minecraft-style): spend bones/acorns/crabs on ship decorations and sail patterns (not on Spartacus: no dress-up, see design-rules.md); rescued friends live on the ship.

## Tech

- **Blender levels** ([levels.md](levels.md)), live with island 8 as a test. Next: rebuild an existing island bigger in Blender (island 1 is a good first one), sail into level islands, instanced palms/flowers for big maps. Rapier is in for loose props (`systems/toys.js`, a test on island 1); moving Spartacus onto it only when a level needs rotated or mesh colliders or overhangs (it would replace `stepPlayer`). A smaller download: the non-compat `@dimforge/rapier3d` loads a separate `.wasm` (~3 MB raw instead of 4.3 MB of base64) but needs a Vite wasm plugin.
- **Phone performance**: static scenery is merged (`world/statics.js`) for the shared props and Blender levels. Next: register islands 2–7's own static props (coral, seaweed strips, fences, stalls) with `addStatic`; more characters could use `mergeParts` (the crab model can't in general: Eduardo wiggles its legs one by one); the island 1 level file is 2.9 MB (half of it the ground mesh).
- **Automated smoke tests** (Playwright): blocked on BUG-1 for software-GL runners; see [testing.md](testing.md).
- Upgrade three.js past 0.160 (check `CapsuleGeometry`, lighting and colour management for visual changes).
- Optional formatter/linter. The code is intentionally dense (it came from a single-file chat build); a formatter would expand it a lot.
