# Testing and debugging

## Run it

```bash
npm run dev
```

Open http://localhost:5173/spartacus-island/. To test on a phone on the same Wi-Fi:

```bash
npm run dev -- --host
```

To test the production build (including the service worker):

```bash
npm run build && npm run preview
```

## Debug console (`window.__g`)

Always on in dev; on the live site add `?debug` to the URL. From the browser console:

| Call                                                       | Does                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `__g.go(3)`                                                | Jump to island 3 (from the title screen or mid-game)                                  |
| `__g.tp(x, z)` / `__g.tp(x, z, y)`                         | Teleport, island-local coordinates. Give a `y` above a rock or tree top to land on it |
| `__g.where()`                                              | Island-local position, state, island                                                  |
| `__g.power('boing')`                                       | Give a power (`boing`, `stretch`, `grow`, `chop`)                                     |
| `__g.done('bones')` / `__g.doneAll()`                      | Tick one task / the whole list (shows the win panel)                                  |
| `__g.action()` / `__g.act()`                               | What the action button would do / press it                                            |
| `__g.game`, `__g.player`, `__g.followCam`, `__g.colliders` | Raw state                                                                             |

In dev you can also import any module from the console, e.g. `(await import('/spartacus-island/src/npcs/wasabi.js')).wasabi.state`.

Other shortcuts: `#island2`, `#island3`, `#island4` in the URL make **Continue** go to that island (reload after changing the hash).

## Manual play-test checklist

The full game was play-tested this way after the Vite migration (Oct 2026). Re-run the parts you touch.

**Island 1**: walk; bones on the crate, the lighthouse rock, the far lily pad, (-12,13) and two dig spots; Boing-Boing fruit on the rock; bark at the gull on the dock; jump from the rock onto the lighthouse deck to ring the bell; grab the plank by the logs and Fix the bridge, then walk across; dig the X in the pond for the key; Open the chest; win panel; **Keep exploring**, then Sail from the end of the dock.

**Island 2**: Stretchy fruit; Swing from the shore pad; bones on two pillars, the mesa and a dig spot; Boing-Boing to the mesa and dig the snack; swing to Mango's pillar and Give; walk onto the dock: Mango flies to the crow's nest; win; Sail.

**Island 3**: Grow-Grow fruit; grow the seed at the first tree (`seedTree`), walk into the vine to climb; grow and Zip seedTree → junctionTree → hiveTree; bark under the flower, Mango drops it, Grab; Give it at the hive on hiveTree; take the key to the gate, Open; Wasabi refills, swims to the bucket; acorns (seedTree top, acornTree via Stretchy hook from junctionTree, mushroom with Boing-Boing, dig spot); win; **Keep exploring**, then **Dive** from the end of the dock.

**Island 4**: Chop-Chop fruit; crabs (sand, Boing shelf, lift-vent ledge, inside a clump, top of the kelp pillar via Grow-Grow); chop the lane entrance (octopus wakes), approach Eduardo, chop his two hiding clumps; get bonked by a tentacle once; pillow at the end of the vent canyon, Give it to the octopus; Eduardo recognises you and rides your hat; walk to the ship; win; **Keep exploring**, then **Ride** at the ship; whale; "To be continued…".

**Every time:** start screen with and without a save (Continue appears only with a save; "Start from the beginning" needs two taps when there is one); phone size (touch controls, toasts not covering buttons); no console errors.

## Headless browsers

Headless Chrome with software GL (`--use-gl=swiftshader`) currently **loses the WebGL context** right after the first frame with this build, while the original single-file game ran fine. See [bugs.md](bugs.md). Until that's fixed, automated tests need real GPU rendering (headful Chrome) or must tolerate the context loss. Lessons from earlier automated runs still apply: small viewport (software rendering is ~3 fps), poll `window.__g` instead of sleeping, teleport to each step and press F, keep each test short.
