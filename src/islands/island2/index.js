import * as THREE from 'three';
import { distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh, canvasTexture, drawPaw } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { say } from '../../game/talk.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { CENTER_2, CENTER_3 } from '../../world/layout.js';
import { makeLevel } from '../../world/level.js';
import { scatter } from '../../world/props.js';
import { addStatic } from '../../world/statics.js';
import { addCampfire } from '../../world/campfire.js';
import { addBubbleSpot } from '../../world/bubble-spot.js';
import { makeTin, makeBone } from '../../models/items.js';
import { player } from '../../player/player.js';
import { addItem, carryItem, useUpCarried } from '../../systems/items.js';
import { pickupText } from '../../systems/collect.js';
import { addDig } from '../../systems/digs.js';
import { addHook, swingOption } from '../../systems/hooks.js';
import { addToyArea, addToy } from '../../systems/toys.js';
import { visitPlaces, seenPlaces, restorePlaces } from '../../systems/places.js';
import { mango, placeMango, mangoHop, mangoToShip, ensureMangoCrew } from '../../npcs/mango.js';
import { startSail } from '../../cutscenes/sail.js';
import { completeTask } from '../../game/tasks.js';
import { enterIsland } from '../../game/flow.js';
import { hintTooHigh } from '../../game/interact.js';
import levelUrl from './level.glb?url';
import heightsUrl from './heights.bin?url';

// Island 2, Hook Rock Bay: Stretchy fruit + golden hooks. Mango the parrot is stuck (too hungry
// to fly) on the tallest pillar in the lagoon; his snack is buried on Cookie Mesa, which only a
// Boing-Boing jump reaches. Laid out in Blender (levels/island2.blend, made by
// tools/levels/make_island2.py, dressed by dress_island2.py; see docs/island2.md): six places,
// six bones. This code builds the swing pads, hooks, Mango's nest, the X and the camp's fire at
// the level's `spot:` markers.

const level = makeLevel(levelUrl, { center: CENTER_2, heightsUrl });

// filled in by build() from the level's spots; each is {x, z, y} with y the standing height
const spots = {};
// the swing route across the lagoon: west pad -> first pillar -> second pillar -> Mango's pillar ->
// east pad, with a branch first pillar -> side pillar for a bone; and the practice swing in
// Stretchy Grove
const HOOKS = [
  ['westPad', 'firstPillar'],
  ['firstPillar', 'secondPillar'],
  ['secondPillar', 'mangoPillar'],
  ['mangoPillar', 'eastPad'],
  ['firstPillar', 'sidePillar'],
  ['practicePad', 'practiceRock'],
];

// from the ship at the dock round the east of the bay, north to Mossy Paw Woods
const SHIP = { x: 5.6, z: CENTER_2.z + 58 }; // spot:ship in the level (island 1's voyage ends here)
const sailPath = new THREE.CatmullRomCurve3([
  vec3(SHIP.x, 0, SHIP.z),
  vec3(30, 0, CENTER_2.z + 66),
  vec3(62, 0, CENTER_2.z + 10),
  vec3(56, 0, -232),
  vec3(26, 0, -258),
  vec3(5.6, 0, CENTER_3.z + 54), // island 3's spot:ship
]);

// a wooden launch platform with a painted paw on top; returns its standing spot
function addSwingPad({ x, z }) {
  const groundY = terrainHeight(x, z);
  const base = mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.3, 12), material(0xc48a54), {
    receiveShadow: true,
  });
  base.position.set(x, groundY + 0.15, z);
  scene.add(base);
  addStatic(base);
  const pawTexture = canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#c48a54';
    c.fillRect(0, 0, w, h);
    drawPaw(c, { x: 64, y: 62, size: 30, color: '#ffd84d' });
  });
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 16),
    new THREE.MeshStandardMaterial({ map: pawTexture, roughness: 0.9 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.set(x, groundY + 0.31, z);
  top.receiveShadow = true;
  scene.add(top);
  addCylinder(x, z, { r: 1.3, bottom: groundY - 1, top: groundY + 0.3 });
  return { x, z, y: groundY + 0.3 };
}

// a spot marker as {x, z, y}, y the surface under it (a pillar's top, the mesa…)
const standingSpot = (name) => {
  const spot = level.spots[name];
  return { x: spot.x, z: spot.z, y: spot.ground };
};

function build() {
  level.build(island);
  spots.firstPillar = standingSpot('first pillar');
  spots.secondPillar = standingSpot('second pillar');
  spots.mangoPillar = standingSpot('mango pillar');
  spots.sidePillar = standingSpot('side pillar');
  spots.practiceRock = standingSpot('practice rock');
  spots.mesa = standingSpot('mesa');
  spots.snack = standingSpot('snack');
  spots.lagoon = level.spots.lagoon;
  spots.dockEnd = level.spots['dock end'];
  spots.westPad = addSwingPad(level.spots['west pad']);
  spots.eastPad = addSwingPad(level.spots['east pad']);
  spots.practicePad = addSwingPad(level.spots['practice pad']);
  const { mangoPillar } = spots;
  const nest = mesh(new THREE.TorusGeometry(0.6, 0.22, 6, 12), material(0x9c6436));
  nest.rotation.x = Math.PI / 2;
  nest.position.set(mangoPillar.x, mangoPillar.y + 0.15, mangoPillar.z);
  scene.add(nest);
  addStatic(nest);
  placeMango(mangoPillar, spots.secondPillar, 2);
  for (const [from, to] of HOOKS) addHook(spots[from], spots[to]);
  const camp = level.spots.camp;
  addCampfire({ x: camp.x, y: camp.ground, z: camp.z });
  // the cove's rock pools bubble a little
  spots.pools = level
    .all('spot')
    .filter((spot) => spot.arg === 'pool')
    .map((spot) => addBubbleSpot({ x: spot.x, y: 0, z: spot.z }, { size: 0.8, every: 1.2 }));
  buildToys();
  // bushes and flowers: not in the lagoon, on the mesa or the path to the dock (last: rand())
  const { lagoon, mesa } = spots;
  scatter(CENTER_2.x, CENTER_2.z, {
    radius: 38,
    allowed: (x, z) =>
      Math.hypot(x - lagoon.x, z - lagoon.z) > 14 &&
      Math.hypot(x - mesa.x, z - mesa.z) > 6 &&
      !(Math.abs(x - CENTER_2.x) < 3 && z > CENTER_2.z + 30),
    bushes: 24,
    flowers: 150,
  });
}

// Toys to bowl over (systems/toys.js): a stack of barrels and crates beside the camp
function buildToys() {
  const camp = level.spots.camp;
  const x = camp.x + 5,
    z = camp.z + 4;
  addToyArea(x, z, { size: 16 });
  const ground = terrainHeight(x, z);
  for (const [i, dx] of [-0.9, 0, 0.9].entries())
    addToy('barrel', { x: x + dx, z, y: ground, size: 0.85, color: 0x9a6a3e, yaw: i });
  for (const dx of [-0.45, 0.45])
    addToy('crate', { x: x + dx, z, y: ground + 0.9, size: 0.75, color: '#d09a5e' });
  addToy('barrel', { x, z, y: ground + 1.7, size: 0.7, color: 0xf2545b });
  addToy('bucket', { x: x - 2.2, z: z + 1, size: 0.4, color: 0x2fa4c7 });
}

// Mango's cracker tin: dug up on the mesa and carried straight away
function digUpSnack(dig) {
  const tin = addItem('snack', {
    model: makeTin(),
    pos: vec3(dig.x, dig.y + 0.2, dig.z),
    name: 'cracker tin',
    lift: 0.15,
  });
  carryItem(tin);
  toast('Mango’s cracker tin! Take it to the tall rock in the lagoon.', 3400);
  completeTask('snack');
}

// the fruit bushes and the buried bone are level markers (no rand() here)
function buildLate() {
  level.buildLate(island);
  addDig(spots.snack.x, spots.snack.z, { reward: digUpSnack, marked: true, y: spots.snack.y });
}

function feedMango() {
  useUpCarried();
  sfx.parrot();
  burst(mango.g.position.clone().add(vec3(0, 1, 0)), {
    count: 24,
    color: [0xff9fb2, 0xffd84d, 0x3fbf5a],
    speed: 4,
    up: 3,
    life: 1,
    size: 1,
  });
  mangoHop();
  toast('Crunch! Mango hops onto Spartacus’s hat!', 3000);
  completeTask('feed');
}

/* mid-island saves (game/progress.js) */

const saveState = () => ({ places: seenPlaces(2) });

// Mango follows from the ticked tasks (the cracker tin is an item, put back by the items system
// after its dig is redone)
function loadState(state) {
  restorePlaces(2, state.places);
  if (island.done.crew) ensureMangoCrew();
  else if (island.done.feed) mangoHop();
}

const onDockEnd = (p) =>
  p.z > spots.dockEnd.z && Math.abs(p.x - spots.dockEnd.x) < 1.6 && p.y > 0.5;

const island = {
  id: 2,
  center: CENTER_2,
  name: 'Hook Rock Bay',
  zMax: -85,
  level, // main.js loads it before anything is built
  height: level.height,
  // the old hand-built island left the shared random sequence here; the islands after it carry
  // on from it, so their scenery doesn't move (see main.js)
  sharedSeedAfter: -542749440,
  layout: 2, // the Blender remake: saves from the old layout don't put Spartacus back mid-island
  savesProgress: true,
  saveState,
  loadState,
  tasks: {
    title: 'Hook Rock Bay',
    list: [
      { id: 'stretch', ic: '➰', t: () => 'Eat a Stretchy fruit', power: 'stretch' },
      { id: 'bones2', ic: '🦴', t: () => pickupText(2, 'bones') },
      { id: 'snack', ic: '🍪', t: () => 'Dig up Mango’s snack' },
      { id: 'feed', ic: '🦜', t: () => 'Feed Mango the parrot' },
      { id: 'crew', ic: '⛵', t: () => 'Bring Mango to the ship' },
    ],
  },
  // total: counted from the level's bones and digs
  collect: {
    total: 0,
    count: 0,
    taskId: 'bones2',
    name: 'Bone',
    all: 'All the bones! Good boy, Spartacus!',
    model: makeBone,
  },
  // a skippy pirate jig (core/music.js)
  music: {
    tempo: 116,
    root: 65,
    wave: 'square',
    melody: [5, null, 4, 3, 4, null, 2, null, 3, 4, 5, null, 4, 3, 2, null],
    bass: [-5, null, -2, null, -5, null, -2, null, -4, null, -1, null, -3, null, -2, null],
  },
  intro: [[3400, 'Mango the parrot is stuck on the tallest rock in the lagoon!', 3400]],
  win: {
    title: 'New crew mate!',
    text: 'Mango the parrot joined Spartacus’s crew! Next stop: a mysterious forest island.',
    tip: 'You can also sail later from the end of the dock.',
    go: 'Set sail! ⛵',
  },
  sailPath,
  exit: {
    label: 'Sail',
    at: (p) => p.z > spots.dockEnd.z + 3 && Math.abs(p.x - spots.dockEnd.x) < 1.6 && p.y > 0.5,
    run: () => startSail(sailPath, () => enterIsland(3, true)),
  },
  build,
  buildLate,
  update(dt) {
    for (const pool of spots.pools) pool.update(dt, player.pos);
  },
  interact(p) {
    const { mesa, westPad, eastPad, practicePad, mangoPillar } = spots;
    visitPlaces(p);
    hintTooHigh(
      distXZ(p, mesa.x, mesa.z) < 6.5,
      'Something’s buried up on Cookie Mesa… A Boing-Boing fruit grows nearby!',
    );
    const nearPad = [westPad, eastPad, practicePad].some((pad) => distXZ(p, pad.x, pad.z) < 3);
    if (!player.canStretch && nearPad)
      hintOnce('hook', 'Golden hooks! Spartacus needs a Stretchy fruit to swing.', 3400);
    if (player.canStretch && swingOption())
      hintOnce('swing', `Press ${actionKeyName()} to swing!`, 2400);
    if (
      mango.state === 'hungry' &&
      distXZ(p, mangoPillar.x, mangoPillar.z) < 3 &&
      player.carrying?.id !== 'snack'
    )
      hintOnce(
        'mango',
        'Mango is too hungry to fly. His snack is buried on Cookie Mesa, under the red flag!',
        3600,
      );
    // walking onto the dock with Mango on the hat: he flies up to the crow's nest
    if (mango.state === 'riding' && onDockEnd(p)) {
      mangoToShip(() => completeTask('crew'));
      toast('Mango flies up to the crow’s nest!', 3000);
    }
  },
  actions(p) {
    const { mangoPillar } = spots;
    if (
      player.carrying?.id === 'snack' &&
      mango.state === 'hungry' &&
      distXZ(p, mangoPillar.x, mangoPillar.z) < 2.6 &&
      Math.abs(p.y - mangoPillar.y) < 1.5
    )
      return { label: 'Give', run: feedMango };
    return null;
  },
  bark(p) {
    if (mango.state !== 'hungry' || distXZ(p, spots.mangoPillar.x, spots.mangoPillar.z) >= 8)
      return;
    sfx.parrot();
    say('Mango', 'Snack? Snack? Buried on Cookie Mesa, by the red flag!', { auto: true });
  },
};
export default island;
