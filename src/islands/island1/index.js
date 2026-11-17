import * as THREE from 'three';
import { clamp, distXZ, lerp, rand, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { addCylinder, addBox, supportHeight } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { CENTER_1, CENTER_2 } from '../../world/layout.js';
import { makeLevel } from '../../world/level.js';
import { rock, scatter, DOCK_TOP } from '../../world/props.js';
import { placeShipAt } from '../../world/ship.js';
import { makePlank, makeKey, makeBoot, makeBone } from '../../models/items.js';
import { player } from '../../player/player.js';
import { addItem, carryItem, useUpCarried, placeItem } from '../../systems/items.js';
import { addPickup, pickupText } from '../../systems/collect.js';
import { addDig, digNear } from '../../systems/digs.js';
import { addToyArea, addToy, toysNear } from '../../systems/toys.js';
import {
  addPlace,
  addSignpost,
  letterBoard,
  visitPlaces,
  seenPlaces,
  restorePlaces,
} from '../../systems/places.js';
import { gull, perchGull, wakeGull, gullJoinsShip } from '../../npcs/gull.js';
import { startSail } from '../../cutscenes/sail.js';
import { completeTask, allTasksDone } from '../../game/tasks.js';
import { enterIsland } from '../../game/flow.js';
import { hintTooHigh } from '../../game/interact.js';
import {
  addJufAnne,
  interactJufAnne,
  barkAtCave,
  updateJufAnne,
  jufAnneState,
  restoreJufAnne,
  sayGoodbye,
} from './juf-anne.js';
import { addChris, interactChris, barkAtChris, updateChris } from './chris.js';
import {
  addAmethystCrabs,
  interactAmethyst,
  barkAtCrabs,
  updateAmethystCrabs,
  amethystCrabsState,
  restoreAmethystCrabs,
} from './amethyst.js';
import levelUrl from './level.glb?url';

// Island 1, the starter island: bones, the Boing-Boing fruit, a sleepy seagull, the lighthouse
// bell, a broken bridge, a buried key and a treasure chest with the map to island 2.
// Laid out in Blender (levels/island1.blend, made by tools/levels/make_island1.py from the map in
// docs/island1.md): the terrain, the cave, camp, grove ledges, reeds and ruins come from there,
// and every place this code builds at is a `spot:` marker.

const level = makeLevel(levelUrl, { center: CENTER_1 });

// Filled in by build() from the level's spots.
const GULL_POST = {}; // {x, z, top}: the top of the beached boat's mast
// + bell, deckTop, swing (bell swing amount 1..0), rockX/rockZ/rockTop (the rock you climb to reach it)
const LIGHTHOUSE = {};
// bridge along x at z, deck height y, from `from` to `to`; the broken gap runs from gapStart to gapEnd
const BRIDGE = {};
const POND = {}; // {x, z, radius}
// on top of the ruins hill; + y, lid, flag, openAmount (lid 0..1), opening
const CHEST = {};
const DOCK = {}; // {x, zFrom, zTo}
// the cave: {x, z, floor}, its middle; walls, roof and mouth (towards +z) as in build_cave() in
// tools/levels/make_island1.py: 6 m wide inside, the roof's underside 2.5 m above the floor
const CAVE = {};
const CAVE_HALF_WIDTH = 3,
  CAVE_BACK = -2.9,
  CAVE_FRONT = 4.1, // the roof's front edge, from the middle
  CAVE_ROOF = 2.5;
const lilies = []; // {g, phase}: bobbing lily pads
let plankGhost, mapScroll; // see-through plank showing where it goes; the map that pops out of the chest
let plankItem; // the plank (systems/items.js), which Chris points at while it's in the pile

// The places, named for Zoë (she lives in Amsterdam and goes to a Montessori school), island-local
// like the level's spots: x, z, radius (m) for the title card; sign: where its signpost stands.
// Hallo Harbour's signpost has arrows to the others; Lost & Found Camp paints the level's own sign.
const PLACES = [
  { name: 'Hallo Harbour', x: 0, z: 50, radius: 13, sign: { x: 4.5, z: 45 } },
  { name: 'Sleepy Gull Beach', x: -37, z: 48, radius: 12, sign: { x: -29, z: 43 } },
  { name: 'Boing-Boing Grove', x: 39, z: 30, radius: 12, sign: { x: 29, z: 31 } },
  { name: 'Growly Cave', x: -3, z: 20, radius: 8, sign: { x: 2.6, z: 23.5 } },
  { name: 'Lost & Found Camp', x: -41, z: -1, radius: 10 },
  { name: 'Lily Pond', x: 14, z: -4, radius: 19, sign: { x: -4.5, z: 3 } },
  { name: 'Ding-Dong Point', x: -40, z: -35, radius: 12, sign: { x: -30, z: -27 } },
  { name: 'Treasure Hill', x: -6, z: -48, radius: 11, sign: { x: -5, z: -36 } },
  { name: 'Bubbly Spring', x: 24, z: -40, radius: 8, sign: { x: 19, z: -42 } },
];
// the harbour signpost's arrows, top to bottom
const HARBOUR_ARROWS = [
  'Growly Cave',
  'Treasure Hill',
  'Ding-Dong Point',
  'Sleepy Gull Beach',
  'Boing-Boing Grove',
];

// from the ship at the dock, round the east of the island and north to Hook Rock Bay
const sailPath = new THREE.CatmullRomCurve3([
  vec3(5.6, 0, 72),
  vec3(22, 0, 86),
  vec3(62, 0, 74),
  vec3(88, 0, 20),
  vec3(86, 0, -50),
  vec3(56, 0, -108),
  vec3(22, 0, -130),
  vec3(5.6, 0, CENTER_2.z + 26.5),
]);

// the bell hangs from a gallows on the lighthouse deck; returns the swinging bell group
function addBell(g) {
  for (const side of [-1, 1]) {
    const post = mesh(new THREE.BoxGeometry(0.16, 1.95, 0.16), material(0x7a4a2a));
    post.position.set(side * 0.78, 8.4 + 0.97, 0);
    g.add(post);
  }
  const bar = mesh(new THREE.BoxGeometry(1.8, 0.16, 0.16), material(0x7a4a2a));
  bar.position.y = 10.35;
  g.add(bar);
  const roof = mesh(new THREE.ConeGeometry(1.25, 0.7, 4), material(0xf2545b));
  roof.position.y = 10.8;
  roof.rotation.y = Math.PI / 4;
  g.add(roof);
  // bell silhouette (radius, y), spun round by the lathe
  const profile = [
    [0.03, 0],
    [0.16, -0.03],
    [0.22, -0.15],
    [0.26, -0.45],
    [0.42, -0.72],
    [0.47, -0.8],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const bell = new THREE.Group();
  bell.position.y = 10.25;
  g.add(bell);
  bell.add(
    mesh(
      new THREE.LatheGeometry(profile, 12),
      material(0xffc83d, { metalness: 0.35, roughness: 0.4, side: THREE.DoubleSide }),
    ),
  );
  const clapper = mesh(new THREE.SphereGeometry(0.1, 6, 5), material(0x7a4a2a));
  clapper.position.y = -0.7;
  bell.add(clapper);
  return bell;
}

// lighthouse: climb the rock with Boing-Boing, then jump onto the deck to ring the bell
function buildLighthouse() {
  const groundY = terrainHeight(LIGHTHOUSE.x, LIGHTHOUSE.z),
    g = new THREE.Group();
  g.position.set(LIGHTHOUSE.x, groundY, LIGHTHOUSE.z);
  g.rotation.y = Math.atan2(-LIGHTHOUSE.x, -LIGHTHOUSE.z); // door faces the island centre
  scene.add(g);
  // four 2 m tower sections, red and white, tapering from radius 1.9 to 1.5
  for (let i = 0; i < 4; i++) {
    const bottomR = lerp(1.9, 1.5, i / 4),
      topR = lerp(1.9, 1.5, (i + 1) / 4);
    const section = mesh(
      new THREE.CylinderGeometry(topR, bottomR, 2, 16),
      material(i % 2 ? 0xf2545b : 0xfffaf0),
      { receiveShadow: true },
    );
    section.position.y = 2 * i + 1;
    g.add(section);
  }
  const door = mesh(new THREE.BoxGeometry(0.8, 1.3, 0.2), material(0x2fa4c7));
  door.position.set(0, 0.65, 1.86);
  g.add(door);
  for (const y of [3, 5.2]) {
    const win = mesh(new THREE.BoxGeometry(0.45, 0.6, 0.2), material(0x2b3a55));
    win.position.set(0, y, lerp(1.9, 1.5, y / 8) - 0.02);
    g.add(win);
  }
  const deck = mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.4, 16), material(0xc48a54), {
    receiveShadow: true,
  });
  deck.position.y = 8.2;
  g.add(deck);
  for (let k = 0; k < 14; k++) {
    const angle = (k / 14) * 6.283,
      railPost = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 4), material(0xfffaf0));
    railPost.position.set(Math.cos(angle) * 2.15, 8.68, Math.sin(angle) * 2.15);
    g.add(railPost);
  }
  const rail = mesh(new THREE.TorusGeometry(2.15, 0.06, 4, 28), material(0xfffaf0));
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 8.95;
  g.add(rail);
  LIGHTHOUSE.bell = addBell(g);
  LIGHTHOUSE.deckTop = groundY + 8.4;
  LIGHTHOUSE.swing = 0;
  addCylinder(LIGHTHOUSE.x, LIGHTHOUSE.z, { r: 1.9, bottom: groundY - 2, top: groundY + 8 });
  addCylinder(LIGHTHOUSE.x, LIGHTHOUSE.z, { r: 2.3, bottom: groundY + 8, top: groundY + 8.4 });
  // colliders for the two bell posts, rotated with the lighthouse
  const cos = Math.cos(g.rotation.y),
    sin = Math.sin(g.rotation.y);
  for (const side of [-1, 1])
    addCylinder(LIGHTHOUSE.x + side * 0.78 * cos, LIGHTHOUSE.z - side * 0.78 * sin, {
      r: 0.12,
      bottom: groundY + 8.3,
      top: groundY + 10.4,
    });
}

// the climbing rock sits 4.4 m from the lighthouse towards the island centre
function addLighthouseRock() {
  const dx = -LIGHTHOUSE.x,
    dz = -LIGHTHOUSE.z,
    dist = Math.hypot(dx, dz);
  LIGHTHOUSE.rockX = LIGHTHOUSE.x + (dx / dist) * 4.4;
  LIGHTHOUSE.rockZ = LIGHTHOUSE.z + (dz / dist) * 4.4;
  LIGHTHOUSE.rockTop = rock(LIGHTHOUSE.rockX, LIGHTHOUSE.rockZ, { radius: 1.55, height: 4.35 });
}

// one walkable stretch of bridge from xFrom to xTo: planks, piles, rope rails
function addBridgeSection(xFrom, xTo) {
  const length = xTo - xFrom;
  const plankCount = Math.round(length / 0.55);
  for (let i = 0; i < plankCount; i++) {
    const x = xFrom + ((i + 0.5) * length) / plankCount;
    const plank = mesh(
      new THREE.BoxGeometry((length / plankCount) * 0.9, 0.16, 1.8),
      material(i % 2 ? 0xc48a54 : 0xb57b46),
      { receiveShadow: true },
    );
    plank.position.set(x, BRIDGE.y - 0.08, BRIDGE.z);
    plank.rotation.x = (rand() - 0.5) * 0.04; // slightly wonky planks
    scene.add(plank);
  }
  for (const x of [xFrom + 0.2, xTo - 0.2])
    for (const side of [-1, 1]) {
      const pile = mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.6, 6), material(0x7a4a2a));
      pile.position.set(x, BRIDGE.y - 1.4, BRIDGE.z + side * 0.95);
      scene.add(pile);
    }
  for (const side of [-1, 1]) {
    const rope = mesh(new THREE.CylinderGeometry(0.04, 0.04, length, 4), material(0xe8d3a0));
    rope.rotation.z = Math.PI / 2;
    rope.position.set((xFrom + xTo) / 2, BRIDGE.y + 0.55, BRIDGE.z + side * 0.95);
    scene.add(rope);
    for (const x of [xFrom + 0.2, xTo - 0.2]) {
      const ropePost = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 5), material(0x7a4a2a));
      ropePost.position.set(x, BRIDGE.y + 0.3, BRIDGE.z + side * 0.95);
      scene.add(ropePost);
    }
  }
  addBox((xFrom + xTo) / 2, BRIDGE.z, { hw: length / 2, hd: 0.9, bottom: -3, top: BRIDGE.y });
}

// the bridge to the islet, with a gap the plank fills
function buildBridge() {
  addBridgeSection(BRIDGE.from, BRIDGE.gapStart);
  addBridgeSection(BRIDGE.gapEnd, BRIDGE.to);
  plankGhost = mesh(
    new THREE.BoxGeometry(BRIDGE.gapEnd - BRIDGE.gapStart, 0.16, 1.6),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
    { castShadow: false },
  );
  plankGhost.position.set((BRIDGE.gapStart + BRIDGE.gapEnd) / 2, BRIDGE.y - 0.08, BRIDGE.z);
  scene.add(plankGhost);
}

// six lily pads in an arc across the south of the pond, well clear of the islet (the bridge is
// the only way there); every other one (and the last, bigger one, which holds a bone) has a flower
function buildLilyPads() {
  const angles = [125, 105, 85, 65, 45, 25];
  for (const [i, deg] of angles.entries()) {
    const angle = (deg * Math.PI) / 180,
      last = i === angles.length - 1,
      r = last ? 1.15 : 0.85;
    const x = POND.x + Math.cos(angle) * (POND.radius - 4.5),
      z = POND.z + Math.sin(angle) * (POND.radius - 4.5);
    const g = new THREE.Group();
    g.position.set(x, 0.16, z);
    // a pad with a notch cut out
    g.add(
      mesh(new THREE.CylinderGeometry(r, r, 0.12, 12, 1, false, 0.4, 5.8), material(0x5fbf5a), {
        receiveShadow: true,
      }),
    );
    if (i % 2 === 0 || last) {
      const flower = mesh(new THREE.IcosahedronGeometry(0.18, 0), material(0xff9fb2), {
        castShadow: false,
      });
      flower.position.set(r * 0.4, 0.15, -r * 0.3);
      g.add(flower);
    }
    scene.add(g);
    lilies.push({ g, phase: i });
    addCylinder(x, z, { r, bottom: -3, top: 0.22 });
  }
}

// treasure chest in the ruins, with an X-marks-the-spot flag beside it
function buildChest() {
  const groundY = terrainHeight(CHEST.x, CHEST.z);
  CHEST.y = groundY;
  const g = new THREE.Group();
  g.position.set(CHEST.x, groundY, CHEST.z);
  g.rotation.y = Math.atan2(-CHEST.x, -CHEST.z);
  scene.add(g);
  const base = mesh(new THREE.BoxGeometry(1.5, 0.85, 1.05), material(0xb5743e), {
    receiveShadow: true,
  });
  base.position.y = 0.43;
  g.add(base);
  for (const x of [-0.55, 0.55]) {
    const band = mesh(
      new THREE.BoxGeometry(0.14, 0.88, 1.08),
      material(0xffc83d, { metalness: 0.3, roughness: 0.5 }),
    );
    band.position.set(x, 0.43, 0);
    g.add(band);
  }
  // the lid: a domed half cylinder lying along x, with a flat bottom so it never looks hollow,
  // hinged at the base's back top edge (opening tips the front up and over towards the back)
  CHEST.lid = new THREE.Group();
  CHEST.lid.position.set(0, 0.85, -0.52);
  g.add(CHEST.lid);
  const dome = new THREE.CylinderGeometry(0.52, 0.52, 1.5, 10, 1, false, 0, Math.PI);
  dome.rotateZ(Math.PI / 2); // axis along x, the curved half on top
  const lid = new THREE.Group();
  lid.position.z = 0.52; // dome centred over the base
  lid.add(mesh(dome, material(0xc4834a, { side: THREE.DoubleSide })));
  lid.add(mesh(new THREE.BoxGeometry(1.5, 0.05, 1.04), material(0xa8693a)));
  for (const x of [-0.55, 0.55]) {
    const band = new THREE.CylinderGeometry(0.545, 0.545, 0.14, 10, 1, true, 0, Math.PI);
    band.rotateZ(Math.PI / 2);
    const gold = mesh(
      band,
      material(0xffc83d, { metalness: 0.3, roughness: 0.5, side: THREE.DoubleSide }),
    );
    gold.position.x = x;
    lid.add(gold);
  }
  CHEST.lid.add(lid);
  const lock = mesh(
    new THREE.BoxGeometry(0.28, 0.32, 0.1),
    material(0xffc83d, { metalness: 0.3, roughness: 0.5 }),
  );
  lock.position.set(0, 0.72, 0.55);
  g.add(lock);
  CHEST.openAmount = 0;
  CHEST.opening = false;
  addBox(CHEST.x, CHEST.z, { hw: 0.8, hd: 0.8, bottom: groundY - 1, top: groundY + 0.9 });
  const pole = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 5), material(0x7a4a2a));
  pole.position.set(1.3, 1.2, -0.3);
  g.add(pole);
  const flag = mesh(
    new THREE.PlaneGeometry(0.8, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xf2545b, side: THREE.DoubleSide }),
  );
  flag.position.set(1.7, 2.1, -0.3);
  g.add(flag);
  CHEST.flag = flag;
}

// the rolled-up map, hidden until the chest opens
function buildMapScroll() {
  mapScroll = new THREE.Group();
  const paper = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 10), material(0xfff3d6));
  paper.rotation.z = Math.PI / 2;
  mapScroll.add(paper);
  const ribbon = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 10), material(0xf2545b));
  ribbon.rotation.z = Math.PI / 2;
  mapScroll.add(ribbon);
  mapScroll.visible = false;
  scene.add(mapScroll);
}

// the places this code builds at, from the level's `spot:` markers
function readSpots() {
  const spot = (name) => level.spots[name];
  const gullSpot = spot('gull');
  Object.assign(GULL_POST, { x: gullSpot.x, z: gullSpot.z, top: gullSpot.y });
  Object.assign(LIGHTHOUSE, { x: spot('lighthouse').x, z: spot('lighthouse').z });
  Object.assign(CHEST, { x: spot('chest').x, z: spot('chest').z });
  Object.assign(POND, { x: spot('pond').x, z: spot('pond').z, radius: spot('pond').props.radius });
  Object.assign(BRIDGE, {
    z: spot('bridge start').z,
    y: spot('bridge start').y,
    from: spot('bridge start').x,
    gapStart: spot('gap start').x,
    gapEnd: spot('gap end').x,
    to: spot('bridge end').x,
  });
  const cave = spot('cave');
  Object.assign(CAVE, { x: cave.x, z: cave.z, floor: cave.ground });
  const dock = level.all('dock')[0];
  Object.assign(DOCK, { x: dock.x, zFrom: dock.z, zTo: dock.z + (dock.props.length ?? 11) });
}

// markers only island 1 has: the key under its red X, and the joke boot
const MARKERS = {
  key: {
    phase: 'late',
    run: (marker) =>
      addDig(marker.x, marker.z, { reward: digUpKey, marked: true, y: marker.ground }),
  },
  boot: {
    phase: 'late',
    run: (marker) => addDig(marker.x, marker.z, { reward: digUpBoot, y: marker.ground }),
  },
};

function build() {
  level.build(island, { markers: MARKERS });
  readSpots();
  perchGull(GULL_POST);
  buildLighthouse();
  addLighthouseRock();
  buildBridge();
  buildLilyPads();
  buildChest();
  buildMapScroll();
  const plankSpot = level.spots.plank;
  plankItem = addItem('plank', {
    model: makePlank(BRIDGE.gapEnd - BRIDGE.gapStart),
    pos: vec3(plankSpot.x, plankSpot.ground + 0.1, plankSpot.z),
    heavy: true,
    name: 'plank',
    yaw: 0.3,
    reach: 2.6,
    lift: 0.1,
    carryPos: vec3(0, -0.02, 0.18),
    onCarry: () => hintOnce('plank', 'A long plank! It’s heavy, so Spartacus is slower.', 3000),
  });
  // two bones on things this code builds: the lighthouse rock and the last lily pad; a third is
  // Juf Anne's thank-you (the level counted the rest)
  addPickup(LIGHTHOUSE.rockX, LIGHTHOUSE.rockZ, { y: LIGHTHOUSE.rockTop, island: 1 });
  const lastLily = lilies.at(-1).g.position;
  addPickup(lastLily.x, lastLily.z, { y: 0.22, island: 1 });
  island.collect.total += 3;
  // Zoë's characters: Juf Anne in the cave, Chris at the lost and found, the amethyst crabs
  const ground = (name) => {
    const spot = level.spots[name];
    return { x: spot.x, z: spot.z, y: spot.ground };
  };
  addJufAnne(ground('cave mouth'), { inside: ground('cave') });
  addChris(ground('chris'), { plank: plankSpot });
  addAmethystCrabs(ground('crabs'), { to: ground('amethyst') });
  // bushes and flowers on open grass: not in the pond or creek, on rocks, or on the dock path
  scatter(0, 0, {
    radius: 56,
    allowed: (x, z) =>
      supportHeight(x, z, Infinity) - terrainHeight(x, z) < 0.05 &&
      Math.hypot(x - POND.x, z - POND.z) > POND.radius + 1 &&
      !(Math.abs(x - DOCK.x) < 3 && z > DOCK.zFrom - 8),
    bushes: 28,
    flowers: 140,
  });
  placeShipAt(0, sailPath);
  buildPlaces();
  buildToys();
}

// Toys to bowl over (systems/toys.js, real physics): a stack of crates and some barrels at the
// harbour, and odds and ends on top of Chris's lost-and-found pile
const HARBOUR_TOYS = { x: -7, z: 46 };
function buildToys() {
  const { x, z } = HARBOUR_TOYS;
  addToyArea(x, z, { size: 18 });
  const ground = terrainHeight(x, z);
  const crate = 0.8;
  // a pyramid, three crates along x at the bottom
  for (const [row, count] of [3, 2, 1].entries())
    for (let i = 0; i < count; i++)
      addToy('crate', {
        x: x + (i - (count - 1) / 2) * (crate + 0.03),
        z,
        y: ground + row * (crate + 0.01),
        size: crate,
        color: ['#c48a54', '#b57b46', '#d09a5e'][(row + i) % 3],
      });
  for (const [dx, dz] of [
    [-2.6, -1.4],
    [-3.3, -0.6],
    [-2.4, -0.2],
  ])
    addToy('barrel', { x: x + dx, z: z + dz, size: 0.9, color: 0x9a6a3e });
  addToy('bucket', { x: x + 1.8, z: z + 1.2, size: 0.4, color: 0x2fa4c7 });
  buildLostAndFoundToys();
}

// on the level's pile boxes (their tops are colliders) and round its foot
function buildLostAndFoundToys() {
  const pile = level.spots['lost and found'];
  addToyArea(pile.x, pile.z, { size: 14 });
  // offsets from the spot (the middle of the biggest box; see build_camp in make_island1.py)
  const things = [
    ['crate', -0.5, -0.3, 0.5, '#f2545b'],
    ['crate', 0.5, -0.4, 0.45, '#ffd84d'],
    ['bucket', 0, 0.45, 0.4, 0x7fd36a],
    ['barrel', 1.6, -0.4, 0.6, 0x2fa4c7],
    ['crate', -1.4, 0.4, 0.45, '#2fa4c7'],
    ['crate', -2.2, -1.6, 0.5, '#9b7fd9'],
    ['crate', 2.2, -1.8, 0.55, '#7fd36a'],
    ['bucket', 1.2, -1.8, 0.4, 0xf2545b],
  ];
  for (const [kind, dx, dz, size, color] of things) {
    const tx = pile.x + dx,
      tz = pile.z + dz;
    addToy(kind, { x: tx, z: tz, y: supportHeight(tx, tz, Infinity) + 0.02, size, color, yaw: dx });
  }
}

const placeNamed = (name) => PLACES.find((place) => place.name === name);

// the named places, their signposts, and the name on the camp's sign
function buildPlaces() {
  const centre = { x: 0, z: 10 }; // signs face the middle of the island
  for (const place of PLACES) {
    addPlace(place.name, place);
    if (!place.sign) continue;
    const arrows =
      place.name === 'Hallo Harbour'
        ? HARBOUR_ARROWS.map((text) => ({ text, to: placeNamed(text) }))
        : [];
    addSignpost(place.sign.x, place.sign.z, { name: place.name, faceTo: centre, arrows });
  }
  const campSign = level.root.getObjectByName('sign');
  if (!campSign) return;
  const board = new THREE.Box3().setFromObject(campSign);
  letterBoard(board.getCenter(vec3()), { text: 'Lost & Found', width: 1.45, height: 0.8 });
}

function digUpKey(dig) {
  const key = addItem('key', {
    model: makeKey(),
    pos: vec3(dig.x, dig.y + 0.2, dig.z),
    name: 'key',
  });
  carryItem(key);
  toast('An old key! Where could it fit?', 3200);
  completeTask('key');
}

// a joke dig: you can carry the boot but it isn't for anything
function digUpBoot(dig) {
  const boot = addItem('boot', {
    model: makeBoot(),
    pos: vec3(dig.x, dig.y + 0.25, dig.z),
    name: 'boot',
    lift: 0.15,
  });
  carryItem(boot);
  toast('Just an old boot. Silly Spartacus!', 2800);
}

function ringBell() {
  LIGHTHOUSE.swing = 1;
  sfx.ding();
  if (island.done.bell) return;
  toast('Ding dong! Everyone knows Spartacus is here.', 3000);
  completeTask('bell');
}
function placePlank() {
  placeItem(plankGhost.position, () => {
    sfx.thunk();
    burst(plankGhost.position.clone().add(vec3(0, 0.3, 0)), {
      count: 20,
      color: [0xd09a5e, 0xffd84d],
      speed: 4,
      up: 3,
      life: 0.7,
      size: 1,
    });
    fillBridgeGap();
    toast('The bridge is fixed!');
    completeTask('bridge');
  });
}
// the walkable plank across the gap; the collider is 0.1 wider each side than the gap so there's
// no seam to fall through
function fillBridgeGap() {
  addBox((BRIDGE.gapStart + BRIDGE.gapEnd) / 2, BRIDGE.z, {
    hw: (BRIDGE.gapEnd - BRIDGE.gapStart) / 2 + 0.1,
    hd: 0.9,
    bottom: -3,
    top: BRIDGE.y,
  });
}
function openChest() {
  useUpCarried();
  sfx.creak();
  burst(vec3(CHEST.x, CHEST.y + 1.2, CHEST.z), {
    count: 30,
    color: [0xffd84d, 0xffffff, 0xff9fb2],
    speed: 5,
    up: 3,
    life: 1,
    size: 1,
  });
  showMapScroll();
  setTimeout(() => toast('A map to a new island! Where could it lead?', 3600), 500);
  completeTask('chest');
}
// the lid swings open and the map rises out of the chest (update() animates both)
function showMapScroll() {
  CHEST.opening = true;
  mapScroll.visible = true;
  mapScroll.position.set(CHEST.x, CHEST.y + 1, CHEST.z);
  mapScroll.userData.t = 0;
}

// mid-island saves (game/progress.js): ticked tasks, bones, digs and items are saved for us; this
// is what only island 1 knows (Juf Anne's class, the crabs)
const saveState = () => ({
  anne: jufAnneState(),
  crabs: amethystCrabsState(),
  places: seenPlaces(1),
});

// putting a save back: everything the ticked tasks changed, quietly
function loadState(state) {
  if (island.done.gull) gullJoinsShip();
  if (island.done.bridge) {
    plankItem.state = 'placed';
    plankItem.mesh.position.copy(plankGhost.position);
    plankItem.mesh.rotation.set(0, 0, 0);
    fillBridgeGap();
  }
  if (island.done.chest) {
    showMapScroll();
    CHEST.openAmount = 1;
    CHEST.lid.rotation.x = -1.9;
  }
  restoreJufAnne(state.anne);
  restoreAmethystCrabs(state.crabs);
  restorePlaces(1, state.places);
  game.flagUp = allTasksDone(island);
  if (allTasksDone(island)) waveGoodbye();
}

// Juf Anne and her class come to wave from the dock (Zoë), standing along its west edge
function waveGoodbye() {
  sayGoodbye({ x: DOCK.x - 0.75, z: DOCK.zFrom + 4.5, y: DOCK_TOP });
}

// Under the cave roof the follow camera would end up inside the rock: keep it inside the cave or
// out in front of the mouth, and below the roof, so Spartacus (and Juf Anne's class) stay in view.
function limitCaveCamera(wanted) {
  const p = player.pos;
  const underRoof =
    Math.abs(p.x - CAVE.x) < CAVE_HALF_WIDTH + 0.2 &&
    p.z > CAVE.z + CAVE_BACK - 0.6 &&
    p.z < CAVE.z + CAVE_FRONT &&
    p.y < CAVE.floor + CAVE_ROOF;
  if (!underRoof) return;
  const margin = 0.6; // keeps the camera's near plane out of the walls
  wanted.x = clamp(wanted.x, CAVE.x - CAVE_HALF_WIDTH + margin, CAVE.x + CAVE_HALF_WIDTH - margin);
  wanted.z = clamp(wanted.z, CAVE.z + CAVE_BACK + margin, CAVE.z + CAVE_FRONT + 3);
  wanted.y = Math.min(wanted.y, CAVE.floor + CAVE_ROOF - 0.35);
}

const onBrokenBridge = (p) =>
  !island.done.bridge &&
  Math.abs(p.z - BRIDGE.z) < 1.3 &&
  p.x > BRIDGE.from - 0.5 &&
  p.x < BRIDGE.to + 0.5 &&
  p.y > BRIDGE.y - 0.3;

// The old bridge is too wobbly to Boing-Boing from: a super jump would clear the gap, and Zoë
// wants the bridge (with the plank) to be the only way to the key. Off the bridge it comes back.
function updateWobblyBridge(p) {
  if (player.power !== 'boing') return;
  const wobbly = onBrokenBridge(p);
  player.superJump = !wobbly;
  if (wobbly) hintOnce('wobbly', 'This old bridge is too wobbly for Boing-Boing!', 3000);
}

const island = {
  id: 1,
  center: CENTER_1,
  name: 'Spartacus’s Island',
  zMax: Infinity,
  level,
  height: level.height,
  // where the shared random sequence stood after the hand-built island 1, so islands 2–7 keep
  // exactly the scenery they had (main.js)
  sharedSeedAfter: 988508491,
  // a big island: closing the tab mid-way keeps what was done (game/progress.js)
  savesProgress: true,
  saveState,
  loadState,
  tasks: {
    title: 'Spartacus’s to-do list',
    list: [
      { id: 'bones', ic: '🦴', t: () => pickupText(1, 'bones') },
      { id: 'fruit', ic: '🌀', t: () => 'Eat the Boing-Boing fruit', power: 'boing' },
      { id: 'gull', ic: '🐦', t: () => 'Bark at the sleepy seagull' },
      { id: 'bell', ic: '🔔', t: () => 'Ring the lighthouse bell' },
      { id: 'bridge', ic: '🪵', t: () => 'Fix the broken bridge' },
      { id: 'key', ic: '🗝️', t: () => 'Dig up the old key' },
      { id: 'chest', ic: '🧰', t: () => 'Open the treasure chest' },
    ],
  },
  // total: counted from the level's markers, plus the two bones build() adds
  collect: {
    total: 0,
    count: 0,
    taskId: 'bones',
    name: 'Bone',
    all: 'All the bones! Good boy, Spartacus!',
    model: makeBone,
  },
  // a sunny, bouncy tune (core/music.js)
  music: {
    tempo: 100,
    root: 60,
    wave: 'triangle',
    melody: [0, 2, 4, null, 4, 5, 4, 2, 3, null, 2, 0, 1, null, 0, null],
    bass: [-5, null, null, null, -2, null, null, null, -1, null, null, null, -2, null, null, null],
  },
  intro: [[400, 'Check the list. Let’s go, Spartacus!', 2600]],
  win: {
    title: 'Ready to sail!',
    text: 'Spartacus found a map to a new island. All aboard!',
    tip: 'You can also sail later from the end of the dock.',
    go: 'Set sail! ⛵',
  },
  onAllDone() {
    game.flagUp = true;
    waveGoodbye();
    toast('Everything’s done! Time to sail!', 3200);
  },
  sailPath,
  exit: {
    label: 'Sail',
    at: (p) => p.z > DOCK.zTo - 7 && Math.abs(p.x - DOCK.x) < 1.6 && p.y > 0.5,
    run: () => startSail(sailPath, () => enterIsland(2, true)),
  },
  camera: { limit: limitCaveCamera },
  build,
  buildLate: () => level.buildLate(island),
  update(dt) {
    const time = game.time;
    updateJufAnne(dt, player.pos);
    updateChris(dt, { p: player.pos, plank: plankItem });
    updateAmethystCrabs(dt);
    CHEST.flag.rotation.y = Math.sin(time * 3) * 0.3;
    for (const lily of lilies) {
      lily.g.position.y = 0.16 + Math.sin(time * 1.6 + lily.phase) * 0.04;
      lily.g.rotation.y = Math.sin(time * 0.5 + lily.phase) * 0.15;
    }
    // the ghost plank pulses until the bridge is fixed
    plankGhost.material.opacity = island.done.bridge ? 0 : 0.2 + 0.12 * Math.sin(time * 4);
    if (CHEST.opening && CHEST.openAmount < 1) {
      CHEST.openAmount = Math.min(1, CHEST.openAmount + dt * 1.4);
      CHEST.lid.rotation.x = -1.9 * CHEST.openAmount;
    }
    // the map rises 1.6 m out of the chest over 1 s, then hovers, spinning
    if (mapScroll.visible) {
      mapScroll.userData.t += dt;
      const t = mapScroll.userData.t;
      mapScroll.position.y = CHEST.y + 1 + Math.min(t, 1) * 1.6 + Math.sin(t * 3) * 0.1;
      mapScroll.rotation.y += dt * 2.5;
    }
    LIGHTHOUSE.swing *= Math.exp(-dt * 1.2);
    LIGHTHOUSE.bell.rotation.x = Math.sin(time * 8) * 0.5 * LIGHTHOUSE.swing;
  },
  interact(p) {
    visitPlaces(p);
    // standing on the deck rings the bell (again once it has nearly stopped swinging)
    if (
      p.y > LIGHTHOUSE.deckTop - 0.3 &&
      distXZ(p, LIGHTHOUSE.x, LIGHTHOUSE.z) < 1.55 &&
      LIGHTHOUSE.swing < 0.25
    )
      ringBell();
    hintTooHigh(
      distXZ(p, LIGHTHOUSE.rockX, LIGHTHOUSE.rockZ) < 3.2,
      'Too high to jump… find the swirly fruit!',
    );
    updateWobblyBridge(p);
    interactJufAnne(p, { bones: island.collect.count });
    interactChris(p, { plank: plankItem, bridgeFixed: island.done.bridge });
    interactAmethyst(p);
    if (
      !island.done.bridge &&
      !player.carrying &&
      distXZ(p, BRIDGE.gapStart - 1, BRIDGE.z) < 2.5 &&
      p.y > 1
    )
      hintOnce('bridge', 'The bridge is broken! Find a long plank.', 3200);
    if (toysNear(p, 3.5)) hintOnce('toys', 'Boxes and barrels! Bump into them, or woof!', 3000);
    if (digNear(p, 4)) hintOnce('dig', `A sand mound! Dig it with ${actionKeyName()}.`, 3200);
    if (!island.done.chest && distXZ(p, CHEST.x, CHEST.z) < 3 && player.carrying?.id !== 'key')
      hintOnce('chest', 'A locked treasure chest. It needs a key…', 3200);
  },
  actions(p) {
    const carried = player.carrying;
    if (!carried) return null;
    const atGap = Math.abs(p.x - BRIDGE.gapStart) < 2.4 || Math.abs(p.x - BRIDGE.gapEnd) < 2.4;
    if (
      carried.id === 'plank' &&
      !island.done.bridge &&
      p.y > BRIDGE.y - 0.3 &&
      Math.abs(p.z - BRIDGE.z) < 1.6 &&
      atGap
    )
      return { label: 'Fix', run: placePlank };
    if (
      carried.id === 'key' &&
      !island.done.chest &&
      distXZ(p, CHEST.x, CHEST.z) < 2.4 &&
      Math.abs(p.y - CHEST.y) < 2
    )
      return { label: 'Open', run: openChest };
    return null;
  },
  bark(p) {
    barkAtCave(p);
    barkAtChris(p);
    barkAtCrabs(p);
    if (gull.state !== 'sleep' || distXZ(p, GULL_POST.x, GULL_POST.z) >= 6.5) return;
    wakeGull();
    setTimeout(() => toast('Squawk! The seagull flew away. Oops!'), 300);
    completeTask('gull');
  },
};
export default island;
