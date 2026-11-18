import * as THREE from 'three';
import { distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh, canvasTexture } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { toast, hintOnce } from '../../core/ui.js';
import { say } from '../../game/talk.js';
import { burst } from '../../core/fx.js';
import { addCylinder } from '../../core/colliders.js';
import { makeFork, makeFeather } from '../../models/items.js';
import { CENTER_6 } from '../../world/layout.js';
import { ship, shipState, shipBubble } from '../../world/ship.js';
import { player } from '../../player/player.js';
import { pickupText } from '../../systems/collect.js';
import { makeLevel } from '../../world/level.js';
import { visitPlaces, seenPlaces, restorePlaces } from '../../systems/places.js';
import levelUrl from './level.glb?url';
import { items, addItem, placeItem } from '../../systems/items.js';
import { ensureMangoCrew } from '../../npcs/mango.js';
import { wasabiToBucket } from '../../npcs/wasabi.js';
import { unicorn, unicornFly, colourStripe } from '../../npcs/unicorn.js';
import { leoToShip, leoAboard } from '../../npcs/leo.js';
import { ensureEduardoCrew } from '../island4/eduardo.js';
import { BANDS } from '../island5/finale.js';
import { completeTask } from '../../game/tasks.js';
import { showEnd, nextIsland } from '../../game/flow.js';
import { startRainbowSlide } from '../island7/arrive.js';
import {
  CLOUD_SEA_Y,
  addCloud,
  addCloudWall,
  buildCloudSea,
  finishClouds,
  setCheckpoint,
  updateCheckpoint,
} from './clouds.js';
import { buildUpdraft, updateUpdraft } from './updraft.js';
import { buildLandingShadow, updateLandingShadow } from './shadow.js';
import { buildNest } from './nest.js';
import { addDoorArch, updateDoorArches } from './doors.js';
import { updateFaders } from './fade.js';
import { buildFountain } from './fountain.js';
import {
  crystalMaterial,
  addCrystalWall,
  addCubby,
  smashWalls,
  crackedWallNear,
  brokenWallIds,
  restoreBrokenWalls,
} from './crystal.js';

// Island 6, the sky island: little clouds floating round Lina's crystal palace, high above a sea
// of clouds. Back home, Lina's wings unfold and she flaps an updraft under Spartacus, so he
// floats from cloud to cloud. Her Sky Jewel is gone: Leo the magpie took it to his nest at the
// top. The Windy Steps lead up to the palace; the Tickle Tunnels (Mini-Me) and the Crystal Wall
// (Smash-Smash) lead to a fork; at Leo's nest (nest.js) the fork is swapped for the jewel, and
// the jewel goes back in the palace fountain (fountain.js). See docs/island6.md.

const toWorld = (x, z) => ({ x: CENTER_6.x + x, z: CENTER_6.z + z }); // island-local -> world

// The clouds are levels/island6.blend (made by tools/levels/make_island6.py as the layout was,
// dressed by dress_island6.py): each a `cloud` marker, its size the radius and its height the top.
// Named ones (cloud:spawn, cloud:palace, cloud:tunnel 1 and 2, cloud:smash, cloud:cracked,
// cloud:picnic) are the ones this code builds on. Feathers and fruit bushes are level markers too.
// There's no ground: below the clouds is the cloud sea.
const level = makeLevel(levelUrl, { center: CENTER_6, seaFloor: CLOUD_SEA_Y - 30 });
const clouds = {}; // the named clouds, by name: {x, z, r, top}
// the crystal fence round the picnic (island-local; its middle is the picnic cloud's, set in build)
const FENCE = { x: 0, z: 0, half: 5, height: 7 };

// filled in by build(): the clouds and spots the triggers use
const spots = {};

// cloud and cloud:name markers: a cloud to stand on (built first, so markers on top land on it)
const MARKERS = {
  cloud: {
    phase: 'shape',
    run(marker) {
      const cloud = addCloud(marker.x, marker.z, { r: marker.scale.x, top: marker.y });
      if (marker.arg) clouds[marker.arg] = cloud;
    },
  },
};

function build() {
  buildCloudSea(CENTER_6.x, CENTER_6.z);
  level.build(island, { markers: MARKERS });
  spots.spawnCloud = clouds.spawn;
  spots.palace = clouds.palace;
  buildPalace(spots.palace);
  buildTunnels();
  buildCrystalWall();
  spots.nest = buildNest(toWorld, { island });
  finishClouds();
  buildUpdraft();
  buildLandingShadow();
}

// Lina's crystal palace: a half ring of crystal towers behind a dry fountain (the jewel made it
// sparkle). She tells the story when Spartacus lands on this cloud.
function buildPalace(cloud) {
  const crystal = crystalMaterial();
  const towerHeights = [5, 7.5, 9, 7.5, 5];
  towerHeights.forEach((height, i) => {
    const angle = Math.PI + 0.45 + i * 0.55, // a half ring on the far side from the steps
      x = cloud.x + Math.cos(angle) * 6.5,
      z = cloud.z + Math.sin(angle) * 6.5;
    addTower(x, z, { height, y: cloud.top, mat: crystal });
  });
  spots.fountain = buildFountain(cloud);
}

// a cloud wall across each tunnel cloud (north-south, so the way west goes through the holes)
function buildTunnels() {
  spots.holes = ['tunnel 1', 'tunnel 2'].map((name) => {
    const cloud = clouds[name];
    const hole = addCloudWall(cloud.x, cloud.z, {
      top: cloud.top,
      axis: 'z',
      length: cloud.r * 2 + 4,
    });
    // a golden arch just in front of both faces of the wall (it runs north-south; its puffs
    // stick out about 0.8 either side)
    for (const side of [-1, 1]) addDoorArch(vec3(hole.x + side * 0.9, hole.y, hole.z), hole);
    return hole;
  });
  spots.smash = clouds.smash;
}

function buildCrystalWall() {
  const { cracked } = clouds;
  // east-west across the cloud: solid either side, cracked in the middle
  const wall = { y: cracked.top, height: 7, hd: 0.3, fades: true };
  addCrystalWall(cracked.x - 6, cracked.z, { ...wall, hw: 4 });
  addCrystalWall(cracked.x, cracked.z, { ...wall, hw: 2, cracked: true, id: 'skyWall' });
  addCrystalWall(cracked.x + 6, cracked.z, { ...wall, hw: 4 });
  spots.cracked = cracked;
  spots.picnic = clouds.picnic;
  FENCE.x = clouds.picnic.x - CENTER_6.x;
  FENCE.z = clouds.picnic.z - CENTER_6.z;
  buildFence(toWorld(FENCE.x, FENCE.z), { y: spots.picnic.top });
  buildPicnic(spots.picnic);
}

// a square crystal fence round the picnic; the west side's middle panel is cracked
function buildFence(center, { y }) {
  const { half, height } = FENCE,
    thick = 0.3,
    side = { y, height, fades: true };
  for (const dir of [-1, 1]) {
    // north and south sides, a bit longer so the corners close
    addCrystalWall(center.x, center.z + dir * half, { ...side, hw: half + thick, hd: thick });
    // the west side is three panels: solid, cracked, solid
    addCrystalWall(center.x - half, center.z + dir * 3.5, { ...side, hw: thick, hd: 1.5 });
  }
  addCrystalWall(center.x - half, center.z, {
    ...side,
    hw: thick,
    hd: 2,
    cracked: true,
    id: 'skyFence',
  });
  addCrystalWall(center.x + half, center.z, { ...side, hw: thick, hd: half });
}

// a picnic inside the fence: a chequered blanket, a basket, and the crystal cubby where the
// fork is (its door is only big enough for a Mini-Me dog)
function buildPicnic(cloud) {
  const y = cloud.top;
  const blanketTexture = canvasTexture(128, 128, (ctx, w, h) => {
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++) {
        ctx.fillStyle = (row + col) % 2 ? '#ff6b6b' : '#fff6e2';
        ctx.fillRect((col * w) / 8, (row * h) / 8, w / 8, h / 8);
      }
  });
  const blanketAt = toWorld(FENCE.x + 2, FENCE.z + 1);
  const blanket = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
    new THREE.MeshStandardMaterial({ map: blanketTexture, roughness: 0.9 }),
  );
  blanket.rotation.x = -Math.PI / 2;
  blanket.position.set(blanketAt.x, y + 0.03, blanketAt.z);
  blanket.receiveShadow = true;
  scene.add(blanket);
  const basketAt = toWorld(FENCE.x + 2.5, FENCE.z - 2.5);
  const wicker = material(0xc48a54);
  const basket = mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.6, 10), wicker);
  basket.position.set(basketAt.x, y + 0.3, basketAt.z);
  scene.add(basket);
  const handle = mesh(new THREE.TorusGeometry(0.45, 0.06, 6, 12, Math.PI), wicker);
  handle.position.set(basketAt.x, y + 0.6, basketAt.z);
  scene.add(handle);
  addCylinder(basketAt.x, basketAt.z, { r: 0.6, bottom: y, top: y + 0.6 });
  const cubbyAt = toWorld(FENCE.x - 2, FENCE.z - 2.2);
  spots.cubby = addCubby(cubbyAt.x, cubbyAt.z, { y });
  const { door, doorYaw, doorRadius } = spots.cubby;
  addDoorArch(door.clone().setX(door.x + 0.2), { yaw: doorYaw, radius: doorRadius });
}

// a six-sided crystal with a pointed cap, standing at height y
function addTower(x, z, { height, y, mat }) {
  const body = mesh(new THREE.CylinderGeometry(1.1, 1.1, height, 6), mat);
  body.position.set(x, y + height / 2, z);
  scene.add(body);
  const cap = mesh(new THREE.ConeGeometry(1.1, 1.6, 6), mat);
  cap.position.set(x, y + height + 0.8, z);
  scene.add(cap);
  addCylinder(x, z, { r: 1.1, bottom: y, top: y + height + 1.6 });
}

// the ship moors alongside the first cloud, bow towards the palace, floating on the rainbow's
// magic; the crew stays on deck (Eduardo too: nothing to pinch up here yet)
function enter() {
  const at = level.spots.ship;
  ship.position.set(at.x, 0, at.z);
  ship.rotation.y = Math.PI;
  ship.updateMatrixWorld(true);
  shipState.baseY = spots.spawnCloud.top - 0.9;
  shipState.depth = 0;
  shipBubble.visible = false;
  ensureMangoCrew();
  wasabiToBucket();
  ensureEduardoCrew();
  // her colours came back on island 5 (also when Continue skips straight here)
  BANDS.forEach((color, i) => colourStripe(i, color, { quiet: true }));
  unicornFly();
  setCheckpoint(spots.spawnCloud);
}

// fruit bushes (no rand() here) and the fork. One power at a time, so there's a bush wherever
// you need to swap: Mini-Me by the palace (into the tunnels), both on the Smash-Smash cloud
// (Mini-Me again for the way back), and Mini-Me inside the picnic fence (for the cubby door).
function buildLate() {
  level.buildLate(island); // the fruit bushes
  const { back } = spots.cubby;
  addItem('fork', {
    model: makeFork(),
    pos: vec3(back.x, back.y + 0.1, back.z),
    name: 'fork',
    lift: 0.1,
    yaw: Math.PI / 2,
    onCarry: foundFork,
  });
}

// the fork glints in its cubby until it's found, so you can spot it through the crystal
const glint = { timeLeft: 0 };
function glintFork(dt) {
  glint.timeLeft -= dt;
  if (island.done.skyFork || glint.timeLeft > 0) return;
  glint.timeLeft = 0.5;
  const { back } = spots.cubby;
  // big enough, and shooting high enough, to be spotted from the palace
  burst(back.clone().add(vec3(0, 0.25, 0)), {
    count: 5,
    color: [0xffffff, 0xdfe6f0, 0xffd84d],
    speed: 1,
    up: 3.5,
    life: 0.9,
    size: 1.2,
  });
}

function foundFork() {
  if (island.done.skyFork) return;
  completeTask('skyFork');
  toast('A shiny fork! Leo the magpie loves shiny things…', 3400);
}

// arriving at the palace: Lina tells what happened
function meetAtPalace() {
  completeTask('skyFly');
  sfx.fruit();
  say('Lina', [
    'Home! Look, my wings work up here!',
    'But my Sky Jewel is gone. It made the fountain sparkle.',
    'Leo the magpie took it to his nest, right at the top.',
  ]);
}

// one-time hints for the tunnels, the cracked crystal and the cubby
function hintPowers(p) {
  const nearHole = spots.holes.some(
    (hole) => distXZ(p, hole.x, hole.z) < 3 && Math.abs(p.y - hole.y) < 1,
  );
  if (nearHole && !player.tiny)
    hintOnce('tinyHole', 'A teeny hole! Only a teeny dog fits. Try a Mini-Me fruit.', 3600);
  if (nearHole && player.tiny && player.size < 0.5)
    hintOnce('tickle', 'Hee hee! The cloud tickles!', 2400);
  if (crackedWallNear(p, 3)) {
    if (player.canSmash) hintOnce('smashRun', 'Run fast at the crack to roll and SMASH!', 3200);
    else hintOnce('cracked', 'Cracked crystal! A Smash-Smash fruit could break it.', 3400);
  }
  const { door } = spots.cubby;
  const nearDoor = distXZ(p, door.x, door.z) < 2.5 && Math.abs(p.y - door.y) < 1;
  if (nearDoor && !player.tiny && !island.done.skyFork)
    hintOnce('cubby', 'Something shiny inside! The door is very small…', 3200);
}

// the palace fountain, where the Sky Jewel goes back on top of the spout
const nearFountain = (p) =>
  distXZ(p, spots.palace.x, spots.palace.z) < 3.6 && Math.abs(p.y - spots.palace.top) < 1;
function fountainAction(p) {
  if (player.carrying?.id !== 'jewel' || !nearFountain(p)) return null;
  return { label: 'Place', run: () => placeItem(spots.fountain.top, lightFountain) };
}

// the jewel is home: the fountain sparkles again, Lina is overjoyed, and the island is done
function lightFountain() {
  spots.fountain.light();
  unicorn.hop = 0.6;
  completeTask('skyFountain');
  say('Lina', 'My Sky Jewel! The fountain sparkles again!');
  // then Leo asks to come along, and flies off to the ship as he says it
  say('Leo', {
    text: 'Chack-chack! Can I come on your ship too?',
    run: () =>
      leoToShip(() => toast('Leo joins the crew! He rides on the ship’s figurehead.', 3400)),
  });
  if (island.collect.count < island.collect.total)
    setTimeout(() => toast('There are still feathers to find… 🪶', 3000), 11000);
}

// a save: the jewel back on the spout (the items system leaves placed items to the island)
function putJewelInFountain() {
  const jewel = items.find((it) => it.island === island.id && it.id === 'jewel');
  jewel.mesh.position.copy(spots.fountain.top);
  jewel.state = 'placed';
  spots.fountain.light({ quiet: true });
}

// leaving the sky island: back at the ship, a rainbow slide down to the funfair (island 7)
const atShip = (p) =>
  distXZ(p, toWorld(6, 16).x, toWorld(6, 16).z) < 2.5 && Math.abs(p.y - spots.spawnCloud.top) < 1;
const sailOn = () => {
  if (nextIsland()) startRainbowSlide();
  else
    showEnd(
      'The Sky Jewel is home, the fountain sparkles, and Leo the magpie joined the crew! Where does the ship float next? Make up the story!',
    );
};

function interact(p, dt) {
  visitPlaces(p);
  updateCheckpoint(dt);
  smashWalls(p);
  hintPowers(p);
  spots.nest.interact(p);
  if (player.carrying?.id === 'jewel' && nearFountain(p))
    hintOnce('fountain', 'Put the Sky Jewel back on top of the fountain!', 3000);
  const { palace, spawnCloud } = spots;
  if (!player.grounded && p.y > spawnCloud.top + 1.5)
    hintOnce('flap', 'Tap Jump in the air to flap! Hold Jump to float down slowly.', 3800);
  // landing anywhere on the palace's cloud: she can see him from the fountain
  const onPalace = distXZ(p, palace.x, palace.z) < palace.r && Math.abs(p.y - palace.top) < 1;
  if (!island.done.skyFly && onPalace) meetAtPalace();
}

const island = {
  id: 6,
  center: CENTER_6,
  name: 'Cottoncrest Islets',
  zMax: -1350,
  // no ground up here, only clouds: the "terrain" is far below the cloud sea
  level, // main.js loads it before anything is built
  height: level.height, // no ground: the cloud sea far below
  // where the shared random sequence stood after the old code-built island (see main.js)
  sharedSeedAfter: -1827648295,
  savesProgress: true,
  // Lina flaps the whole time, so Spartacus always floats: low gravity, a slow fall, flapping
  physics: { gravity: 16, maxFall: 7, water: false, flap: true, floor: CLOUD_SEA_Y },
  camera: { minY: () => CLOUD_SEA_Y + 1 },
  // a deeper blue than the sea islands' pale sky, so white clouds stand out against it (and
  // fade into blue in the distance); lilac light from below instead of green grass
  sky: {
    day: new THREE.Color(0x4f9be6),
    night: new THREE.Color(0x18214d),
    ground: new THREE.Color(0xb7a8e0),
  },
  collect: {
    total: 0, // the level's feathers
    count: 0,
    taskId: 'skyFeathers',
    name: 'Feather',
    all: 'All the feathers! Good boy, Spartacus!',
    model: makeFeather,
  },
  tasks: {
    title: 'Cottoncrest Islets',
    list: [
      { id: 'skyFly', ic: '🦄', t: () => 'Fly with Lina to her palace' },
      { id: 'skyFeathers', ic: '🪶', t: () => pickupText(6, 'feathers') },
      { id: 'skyMini', ic: '🤏', t: () => 'Eat a Mini-Me fruit', power: 'mini' },
      { id: 'skySmash', ic: '💥', t: () => 'Eat a Smash-Smash fruit', power: 'smash' },
      { id: 'skyFork', ic: '🍴', t: () => 'Find something shiny for Leo' },
      { id: 'skyJewel', ic: '💎', t: () => 'Swap it for the Sky Jewel' },
      { id: 'skyFountain', ic: '⛲', t: () => 'Bring the jewel to the fountain' },
    ],
  },
  // a floaty, dreamy tune (core/music.js)
  music: {
    tempo: 84,
    root: 67,
    wave: 'sine',
    melody: [0, null, 4, 7, 9, null, 7, null, 4, null, 2, 4, 0, null, null, null],
    bass: [
      -12,
      null,
      null,
      null,
      -8,
      null,
      null,
      null,
      -10,
      null,
      null,
      null,
      -5,
      null,
      null,
      null,
    ],
  },
  intro: [
    [3400, 'Lina is home in the sky! Her wings unfold ✨', 3400],
    [7400, 'Her wind makes Spartacus float. Jump from cloud to cloud!', 3600],
  ],
  win: {
    title: 'The fountain sparkles!',
    text: 'The Sky Jewel is home, Lina’s palace shines again, and Leo the magpie joined the crew!',
    tip: 'You can keep exploring and go back to the ship later.',
    go: 'Slide down the rainbow! 🌈',
  },
  exit: { label: 'Sail', at: atShip, run: sailOn },
  build,
  buildLate,
  enter,
  update(dt) {
    updateUpdraft(dt);
    updateLandingShadow();
    updateDoorArches(dt);
    updateFaders(dt);
    glintFork(dt);
    spots.nest.update(dt);
    spots.fountain.update(dt);
  },
  interact,
  actions: (p) => spots.nest.action(p) || fountainAction(p),
  // the fork, the jewel and the power are saved for you; the smashed walls aren't, and the swap
  // and the fountain are put back from their tasks
  saveState: () => ({ broken: brokenWallIds(), places: seenPlaces(6) }),
  loadState(state) {
    restorePlaces(6, state.places);
    restoreBrokenWalls(state.broken);
    spots.nest.load();
    if (island.done.skyFountain) {
      putJewelInFountain();
      leoAboard();
    }
  },
  bark(p) {
    if (spots.nest.bark(p)) return;
    if (unicorn.g.position.distanceTo(p) > 8) return;
    sfx.flutter();
    say('Lina', 'Whee! Up we go!', { auto: true });
  },
};
export default island;
