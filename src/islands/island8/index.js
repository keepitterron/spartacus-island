import * as THREE from 'three';
import { clamp, distXZ, lerp, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mergeParts, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { addBox, supportHeight } from '../../core/colliders.js';
import { CENTER_8 } from '../../world/layout.js';
import { makeLevel } from '../../world/level.js';
import { addSea } from '../../world/ocean.js';
import { addCampfire } from '../../world/campfire.js';
import { ship, shipState, shipBubble } from '../../world/ship.js';
import { makeKey, makeCrayon } from '../../models/items.js';
import { player } from '../../player/player.js';
import { pickupText } from '../../systems/collect.js';
import { addDig } from '../../systems/digs.js';
import { addItem, carryItem, placeItem, useUpCarried, items } from '../../systems/items.js';
import { addHook } from '../../systems/hooks.js';
import { addChoppable, chopAction } from '../../systems/hat.js';
import { addToyArea, addToy } from '../../systems/toys.js';
import { keepTreasure } from '../../systems/treasures.js';
import { visitPlaces, seenPlaces, restorePlaces } from '../../systems/places.js';
import { ensureMangoCrew } from '../../npcs/mango.js';
import { wasabiToBucket } from '../../npcs/wasabi.js';
import { unicornAboard, colourStripe } from '../../npcs/unicorn.js';
import { leoAboard } from '../../npcs/leo.js';
import { ensureEduardoCrew } from '../island4/eduardo.js';
import { BANDS } from '../island5/finale.js';
import { completeTask, renderTasks } from '../../game/tasks.js';
import { say } from '../../game/talk.js';
import { showEnd } from '../../game/flow.js';
import {
  cleo,
  addCleo,
  cleoFollow,
  cleoStay,
  cleoWalk,
  cleoToClass,
  cleoHeardWoof,
  cleoNear,
  cleoSitsOn,
  isFollowing,
  isStaying,
  updateCleo,
  cleoState,
  restoreCleo,
  yip,
} from './cleo.js';
import {
  addSchool,
  schoolGo,
  schoolAt,
  anneSpot,
  cheerSchool,
  updateSchool,
  schoolState,
  restoreSchool,
} from './school.js';
import { addDoor, addPlate, updateDoors, GEM_COLORS } from './doors.js';
import {
  addBlock,
  blockOn,
  blocksHome,
  resetBlocks,
  updateBlocks,
  blockCells,
  restoreBlocks,
} from './blocks.js';
import {
  addCrystal,
  addColourBlock,
  woofCrystals,
  updateCrystals,
  upColour,
  restoreCrystals,
} from './crystals.js';
import { addBeamRoom, mirrorAction, updateBeams, mirrorFaces, restoreMirrors } from './beams.js';
import { addChest, chestAction, updateChests, makeSunGem } from './chests.js';
import { sunDog, addSunDog, stirSunDog, wakeSunDog, updateSunDog } from './sundog.js';
import { startPhoto } from './photo.js';
import levelUrl from './level.glb?url';
import heightsUrl from './heights.bin?url';

// Island 8, Sunpaw Temple: a jungle island with an old temple built by dogs, long ago. Juf Anne
// (island 1's squirrel teacher) is here on a school trip with her class and Cleo, their school
// dog, a corgi. The temple only opens for dogs, two at a time, so Cleo joins Spartacus: Juf Anne
// gives them missions one after another (they appear on the to-do list as she gives them).
// Inside, a dungeon of puzzle rooms round the Great Hall: the Garden Court (Cleo's tunnel, a key
// to dig up, stone blocks to push), the Echo Hall (woof at crystals, red and blue blocks swap),
// the Mirror Hall (turn mirrors to send a sunbeam to the sun face; Cleo holds a shutter open; a
// Stretchy swing to the island in the pit). Each has a Sun Gem in a chest; three gems open the
// Sun Door, behind which the giant Sun Dog sleeps. Sunshine on his nose, two dogs on the paw
// plates and a WOOF wake him, and the class takes a photo with him (a real picture, kept on the
// ship). The level is levels/island8.blend (tools/levels/make_island8.py); every moving part here
// stands on one of its `spot:` markers. The design, and what Zoë might rename: docs/island8.md.

const CRAYONS = [0xff5a6e, 0xff9a3d, 0xffd84d, 0x6ccb5f, 0x5aa8ff, 0xb06cff];
const PLINTH = 4; // the temple floor (make_island8.py)
// the temple's rooms, for the camera (make_island8.py ROOMS, without the terrace outside)
const TEMPLE = [
  [-16, 16, -54, -16],
  [-48, 48, -16, 16],
  [-48, 16, 16, 38],
];
// rooms with puzzles: x0, x1, z0, z1 (island-local, between wall centre lines)
const ECHO_HALL = [-48, -16, -16, 16];
const MIRROR_HALL = [16, 48, -16, 16];
const SUN_CHAMBER = [-16, 16, -54, -16];
const GARDEN = [-48, -16, 16, 38];
const GARDEN_MIDDLE = { x: -32, z: 27 }; // island-local
const LEAVE_GARDEN = 30; // m from its middle: the stone blocks slide home if it isn't solved
const CLEO_WANDERS_OFF = 40; // m: left waiting on a plate this far away, Cleo comes running
const TALK_REACH = 10;

const level = makeLevel(levelUrl, { center: CENTER_8, heightsUrl, seaFloor: -4.6 });

/* ---------------- what has happened (saved) ---------------- */

// mission: how many of Juf Anne's missions she has given (MISSIONS below); the rest are the
// puzzles: whether each door, gate and chest is open, the gems in the Sun Door, the Sun Dog
const trip = {
  mission: 0,
  vinesCut: false,
  doorOpen: false,
  gateOpen: false,
  stairsUp: false,
  echoOpen: false,
  mirrorSolved: false,
  chests: { garden: false, echo: false, mirror: false },
  socketed: [], // gem names, in the order they went into the Sun Door
  sunDoorOpen: false,
  sunDog: 'asleep',
  photo: false,
};

// Juf Anne's missions: each list of tasks appears on the to-do list when she gives that mission
const MISSIONS = [
  ['tripMeet'],
  ['tripDoor', 'tripCrayons'],
  ['tripGarden', 'tripEcho', 'tripMirror', 'tripSunDoor'],
  ['tripSunDog'],
  ['tripPhoto'],
];
const revealed = (id) => MISSIONS.findIndex((ids) => ids.includes(id)) <= trip.mission;

function giveMission(stage) {
  if (stage <= trip.mission) return;
  trip.mission = stage;
  renderTasks(MISSIONS[stage][0]);
  sfx.chime();
  toast('📋 A new mission from Juf Anne! Look at the to-do list.', 3400);
}

// a task that stays off the to-do list until Juf Anne gives it
const mission = (id, ic, text) => ({ id, ic, t: text, hidden: () => !revealed(id) });

/* ---------------- building ---------------- */

const spots = {}; // the moving parts, filled in by build()
// a level spot as a world position on whatever is under it
const at = (name) => {
  const spot = level.spots[name];
  return vec3(spot.x, spot.ground, spot.z);
};
const local = (pos) => ({ x: pos.x - CENTER_8.x, z: pos.z - CENTER_8.z });

function build() {
  level.build(island);
  addSea(CENTER_8.x, CENTER_8.z - 12, { width: 300, depth: 400 });
  buildCamp();
  buildEntrance();
  buildGarden();
  buildGreatHall();
  buildEchoHall();
  buildMirrorHall();
  buildSunChamber();
}

// Base Camp: the campfire, Juf Anne, the class and Cleo
function buildCamp() {
  addCampfire(at('camp'));
  const dockMarker = level.all('dock')[0];
  const dockSpot = vec3(dockMarker.x, 0, dockMarker.z + 1.5);
  dockSpot.y = supportHeight(dockSpot.x, dockSpot.z, 2);
  spots.dock = dockSpot;
  addSchool({
    camp: at('camp'),
    anne: at('anne'),
    classroom: at('classroom'),
    photo: at('photo'),
    dock: dockSpot,
  });
  addCleo(at('cleo'), { faceTo: at('anne') });
}

// vines over the Great Door; the door and its two paw plates
function buildEntrance() {
  const vines = at('vines');
  spots.vines = makeVines(vines);
  addChoppable({ x: vines.x, y: vines.y + 1, z: vines.z, onChop: cutVines });
  spots.greatDoor = addDoor(at('greatDoor'), { across: 'x', width: 4, look: 'slab' });
  spots.doorPlates = [addPlate(at('doorPlateWest')), addPlate(at('doorPlateEast'))];
}

// a curtain of hanging leaves in front of the door
function makeVines(pos) {
  const g = new THREE.Group();
  const leaf = new THREE.IcosahedronGeometry(0.45, 0);
  const greens = [material(0x3a9e48), material(0x4cb956), material(0x2f8a3c)];
  for (let i = 0; i < 9; i++)
    for (let j = 0; j < 6; j++) {
      const m = mesh(leaf, greens[(i + j) % 3]);
      m.position.set(-2.4 + i * 0.6, 0.4 + j * 0.75 + (i % 2) * 0.3, 0.1 + ((i * j) % 3) * 0.08);
      m.scale.set(1, 1.4, 0.6);
      g.add(m);
    }
  g.position.copy(pos).add(vec3(0, 0, 0.3));
  scene.add(g);
  return mergeParts(g); // three draw calls, not fifty
}

function cutVines() {
  trip.vinesCut = true;
  spots.vines.visible = false;
  burst(spots.vines.position.clone().add(vec3(0, 2, 0.4)), {
    count: 40,
    color: [0x3a9e48, 0x4cb956, 0x9be07a],
    speed: 5,
    up: 3,
    life: 1.2,
    size: 1.4,
    gravity: 0.5,
  });
  toast('The vines are gone! Two paw prints on the door…', 3200);
}

// the Garden Court: Cleo's tunnel and the gate she opens, a key to dig up, a stone block and the
// two plates that raise the steps up to the sun dais
function buildGarden() {
  spots.gate = addDoor(at('gardenGate'), { across: 'z', width: 4, look: 'bars' });
  spots.gatePlate = addPlate(at('gatePlate'));
  const tunnel = at('tunnel');
  spots.tunnelIn = vec3(tunnel.x + 1.4, tunnel.y, tunnel.z); // the Entrance Hall side
  spots.tunnelRoute = [spots.tunnelIn, vec3(tunnel.x - 1.4, tunnel.y, tunnel.z), at('gatePlate')];
  const dig = at('keyDig');
  spots.keyDig = addDig(dig.x, dig.z, { y: dig.y, reward: digUpKey });
  spots.cleoPlate = addPlate(at('cleoPlate'));
  spots.blockPlate = addPlate(at('blockPlate'), { icon: 'block' });
  const start = at('blockStart');
  const steps = at('daisSteps');
  // the squares the block may use: 2 m apart, clear of the dais, its steps and the planters
  const field = {
    cell: 2,
    x0: start.x - 10,
    x1: start.x + 6,
    z0: start.z - 12,
    z1: start.z + 4,
    blocked: [
      [-36, 30],
      [-32, 28],
      [-26, 34],
    ]
      .map(([x, z]) => [CENTER_8.x + x, CENTER_8.z + z])
      .concat([
        [steps.x, steps.z],
        [steps.x - 2, steps.z],
      ]),
  };
  addBlock(start, { field });
  // two steps up to the dais, under the floor until the plates are both down
  spots.stairs = [1, 2].map((rise, i) => {
    const x = steps.x - i * 2;
    const m = mesh(new THREE.BoxGeometry(2, rise, 3), material(0xc9ae82), { receiveShadow: true });
    m.position.set(x, steps.y - rise / 2, steps.z);
    scene.add(m);
    const collider = addBox(x, steps.z, { hw: 1, hd: 1.5, bottom: steps.y - 1, top: -999 });
    return { m, collider, rise, floor: steps.y, t: 0 };
  });
  spots.gardenChest = addChest(at('gardenChest'), {
    yaw: Math.PI / 2,
    onOpen: () => openGemChest('garden'),
  });
}

function digUpKey(dig) {
  const key = addItem('templeKey', {
    model: makeKey(),
    pos: vec3(dig.x, dig.y + 0.12, dig.z),
    name: 'key',
  });
  if (!player.carrying) carryItem(key);
  if (game.restoring) return;
  sfx.chime();
  toast('A golden key! Somewhere a door is locked…', 3200);
}

// the Great Hall: the classroom, the Sun Door with its three holes, pots to bowl over
function buildGreatHall() {
  spots.sunDoor = addDoor(at('sunDoor'), { across: 'x', width: 6, look: 'sun' });
  spots.echoDoor = addDoor(at('echoDoor'), { across: 'z', width: 4, look: 'locked' });
  const pots = at('pots');
  addToyArea(pots.x, pots.z, { size: 12 });
  const colors = ['#d9824a', '#c96f3a', '#e0a060'];
  for (const [i, [x, z]] of [
    [0, 0],
    [1, 0.3],
    [-1, 0.2],
    [0.5, 1],
    [-0.5, 1.1],
    [0, 2],
    [2, 1.6],
  ].entries())
    addToy('pot', { x: pots.x + x, z: pots.z + z, y: pots.y, size: 0.8, color: colors[i % 3] });
}

// the Echo Hall: three crystals, a blue gate, a red gate and a red step up to the ledge
function buildEchoHall() {
  for (const name of ['crystalA', 'crystalB', 'crystalC']) addCrystal(at(name));
  addColourBlock(at('gateBlue'), { color: 'blue', hw: 0.6, hd: 1.5, tall: 3, wall: true });
  addColourBlock(at('gateRed'), { color: 'red', hw: 0.6, hd: 2, tall: 3, wall: true });
  addColourBlock(at('stepRed'), { color: 'red', hw: 1.2, hd: 1.2, tall: 1.5 });
  spots.echoChest = addChest(at('echoChest'), {
    yaw: Math.PI / 2,
    onOpen: () => openGemChest('echo'),
  });
}

// the Mirror Hall: a sunbeam through the east wall, three mirrors, a shutter Cleo holds open,
// the sun face it has to reach, and golden hooks over the pit
function buildMirrorHall() {
  const sunWindow = at('sunWindow');
  addSunWindow(sunWindow);
  const room = addBeamRoom({
    source: sunWindow,
    dir: { x: -1, z: 0 },
    bounds: boundsOf(MIRROR_HALL),
  });
  room.addMirror(at('mirror1'), { face: 'a' });
  room.addMirror(at('mirror2'), { face: 'b' });
  room.addMirror(at('mirror3'), { face: 'b' });
  spots.shutter = addShutter(at('shutter'));
  room.addBlocker(() => (spots.shutter.height > 0.4 ? spots.shutter.rect : null));
  spots.shutterPlate = addPlate(at('shutterPlate'));
  spots.sunEye = addSunFace(at('sunEye'));
  spots.mirrorTarget = room.addTarget(at('sunEye'), { radius: 0.9, onLit: solveMirrors });
  const west = at('hookWest'),
    island = at('hookIsland');
  addHook({ x: west.x, y: west.y, z: west.z }, { x: island.x, y: island.y, z: island.z });
  spots.hookWest = west;
  spots.mirrorChest = addChest(at('mirrorChest'), {
    yaw: Math.PI,
    hidden: true,
    onOpen: () => openGemChest('mirror'),
  });
}

// a room's inside (between its walls) in world coordinates; walls are 1.2 thick
const boundsOf = ([x0, x1, z0, z1]) => ({
  x0: CENTER_8.x + x0 + 0.6,
  x1: CENTER_8.x + x1 - 0.6,
  z0: CENTER_8.z + z0 + 0.6,
  z1: CENTER_8.z + z1 - 0.6,
});

// a bright crack in the wall where the sunlight comes in
function addSunWindow(pos) {
  const light = mesh(
    new THREE.BoxGeometry(0.2, 2.6, 1.2),
    new THREE.MeshBasicMaterial({ color: 0xfff3a8 }),
  );
  light.position.set(pos.x, pos.y + 1.6, pos.z);
  scene.add(light);
}

// a stone slab across the beam's way; it sinks while its paw plate is down
function addShutter(pos) {
  const m = mesh(new THREE.BoxGeometry(2.4, 2.4, 0.5), material(0xb8a58a), { receiveShadow: true });
  m.position.set(pos.x, pos.y + 1.2, pos.z);
  scene.add(m);
  const collider = addBox(pos.x, pos.z, { hw: 1.2, hd: 0.25, bottom: pos.y - 1, top: pos.y + 2.4 });
  const rect = { x0: pos.x - 1.2, x1: pos.x + 1.2, z0: pos.z - 0.25, z1: pos.z + 0.25 };
  return { m, collider, rect, floor: pos.y, height: 2.4 };
}

// the gold sun face high on the wall the beam has to reach; it glows once it's lit
function addSunFace(pos) {
  const faceMaterial = new THREE.MeshStandardMaterial({
    color: 0xf2b84b,
    emissive: 0xffa030,
    emissiveIntensity: 0.1,
    metalness: 0.3,
  });
  const g = new THREE.Group();
  const disc = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 20), faceMaterial);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  for (let i = 0; i < 10; i++) {
    const ray = mesh(new THREE.ConeGeometry(0.18, 0.5, 4), faceMaterial);
    const angle = (i / 10) * Math.PI * 2;
    ray.position.set(Math.cos(angle) * 1.15, Math.sin(angle) * 1.15, 0);
    ray.rotation.z = angle - Math.PI / 2;
    g.add(ray);
  }
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.1, 6, 5), material(0x5a4636));
    eye.position.set(side * 0.3, 0.2, 0.12);
    g.add(eye);
  }
  g.position.set(pos.x, pos.y + 1.3, pos.z + 0.25);
  scene.add(g);
  mergeParts(g);
  return { g, faceMaterial };
}

// the Sun Chamber: the Sun Dog, light from the hole in the roof, two mirrors, two paw plates and
// the paw mark for the class photo
function buildSunChamber() {
  addSunDog(at('sunDog'));
  const roof = at('roofLight');
  spots.shaft = addLightShaft(roof);
  const room = addBeamRoom({ source: roof, dir: { x: 1, z: 0 }, bounds: boundsOf(SUN_CHAMBER) });
  room.addMirror(at('sunMirrorA'), { face: 'a' });
  room.addMirror(at('sunMirrorB'), { face: 'b' });
  room.addBlocker(() => sunDog.blocker);
  spots.snoutTarget = room.addTarget(sunDog.snout, { radius: 1.1, onLit: stirTheSunDog });
  spots.pawPlates = [addPlate(at('pawWest')), addPlate(at('pawEast'))];
  spots.photo = at('photo');
  spots.photoMark = addPlate(spots.photo, { radius: 0.8 });
  spots.photoMark.m.visible = false;
}

// sunlight pouring down through the roof onto a gold dish
function addLightShaft(pos) {
  const shaftMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff3a8,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 8, 16, 1, true), shaftMaterial);
  shaft.position.set(pos.x, pos.y + 4, pos.z);
  shaft.userData.alwaysDrawn = true;
  scene.add(shaft);
  const dish = mesh(
    new THREE.CylinderGeometry(0.8, 0.5, 0.4, 14),
    material(0xf2b84b, { metalness: 0.4 }),
  );
  dish.position.set(pos.x, pos.y + 1.1, pos.z);
  dish.rotation.z = -0.5;
  scene.add(dish);
  addBox(pos.x, pos.z, { hw: 0.6, hd: 0.6, bottom: pos.y - 1, top: pos.y + 1.4 });
  return { shaft, shaftMaterial };
}

// crayons, one colour after another (no rand())
const crayonColour = { next: 0 };
const nextCrayon = () => {
  const crayon = makeCrayon(CRAYONS[crayonColour.next++ % CRAYONS.length]);
  crayon.scale.setScalar(1.5);
  return crayon;
};

/* ---------------- arriving ---------------- */

// the whole crew is aboard: Mango, Wasabi, Eduardo, Lina (wings folded) and Leo on the bow
function enter() {
  const spot = level.spots.shipSpot;
  ship.position.set(spot.x, 0, spot.z);
  ship.rotation.y = Math.PI;
  ship.updateMatrixWorld(true);
  shipState.baseY = -0.15;
  shipState.depth = 0;
  shipBubble.visible = false;
  ensureMangoCrew();
  wasabiToBucket();
  ensureEduardoCrew();
  BANDS.forEach((color, i) => colourStripe(i, color, { quiet: true }));
  unicornAboard();
  leoAboard();
}

/* ---------------- the story: Juf Anne and Cleo ---------------- */

const nearAnne = (p, reach) => {
  const anne = anneSpot();
  return distXZ(p, anne.x, anne.z) < reach && Math.abs(p.y - anne.y) < 2.5;
};
const talkAt = () => ({ at: () => anneSpot(), reach: TALK_REACH });

// mission 1 at Base Camp: hello, the temple, Cleo; open the door, find the crayons
function meetAnne() {
  completeTask('tripMeet');
  cheerSchool();
  say(
    'Juf Anne',
    [
      'Spartacus! What a surprise! We’re on a school trip!',
      'That’s the Sun Temple. Long, long ago, DOGS built it.',
      { text: 'This is Cleo, our school dog. She’s a corgi!', run: yip },
      'The temple door only opens for dogs… and it takes TWO dogs.',
      'Mission one: open the temple door, with Cleo!',
      'Oh! And the little ones dropped their crayons everywhere. Can you find them?',
    ],
    { ...talkAt(), onEnd: cleoJoins },
  );
}
function cleoJoins() {
  giveMission(1);
  if (cleo.state !== 'camp') return;
  cleoFollow();
  hintOnce(
    'cleoFollows',
    `Cleo follows you! At a paw plate, press ${actionKeyName()} and Cleo stays there.`,
    4200,
  );
}

// mission 2 in the Great Hall: the three Sun Gems
function anneInTheHall() {
  say(
    'Juf Anne',
    [
      'Look, class! The Sun Door. It has three empty holes.',
      'Three Sun Gems are hidden in the temple: in the Garden Court, the Echo Hall and the Mirror Hall.',
      'Mission two: bring back the three Sun Gems!',
      'Psst… I saw a little tunnel in the Entrance Hall. Just right for a corgi!',
    ],
    { ...talkAt(), once: 'anneHall', onEnd: () => giveMission(2) },
  );
}

// a woof near her: a reminder of what's next
function askAnne() {
  cheerSchool();
  const near = talkAt();
  if (trip.mission < 1) return;
  if (!trip.doorOpen) {
    say(
      'Juf Anne',
      trip.vinesCut
        ? 'Stand on one paw plate, and tell Cleo to stay on the other!'
        : 'First the vines… a Chop-Chop fruit grows by the steps.',
      near,
    );
    return;
  }
  if (trip.mission < 2) {
    say('Juf Anne', 'Come and see the Great Hall, Spartacus!', near);
    return;
  }
  if (trip.socketed.length < 3) {
    say('Juf Anne', gemTip(), near);
    return;
  }
  if (trip.sunDog !== 'awake') {
    say(
      'Juf Anne',
      'The old stories say: sunshine on his nose, then two dogs and one big WOOF!',
      near,
    );
    return;
  }
  say('Juf Anne', 'What a school trip! Thank you, Spartacus and Cleo!', near);
}
function gemTip() {
  if (!trip.chests.garden)
    return 'The Garden Court is behind the little tunnel in the Entrance Hall.';
  if (!trip.echoOpen) return 'The Echo Hall is locked… The key must be in the garden!';
  if (!trip.chests.echo) return 'In the Echo Hall, woof at the crystals and watch the blocks.';
  if (!trip.chests.mirror)
    return 'In the Mirror Hall, turn the mirrors to send the sunbeam to the sun face.';
  return 'Put the Sun Gems in the Sun Door!';
}

/* ---------------- the Great Door ---------------- */

// a dog stands on a plate: Spartacus's feet, or Cleo sitting on it
const dogOn = (plate) =>
  (player.grounded &&
    distXZ(player.pos, plate.x, plate.z) < plate.radius &&
    Math.abs(player.pos.y - plate.y) < 0.5) ||
  cleoSitsOn(plate, plate.radius);

function updateGreatDoor() {
  const [west, east] = spots.doorPlates;
  for (const plate of spots.doorPlates) plate.press(trip.doorOpen || dogOn(plate));
  if (trip.doorOpen || !west.pressed || !east.pressed) return;
  if (!trip.vinesCut) {
    hintOnce('vinesHold', 'The vines hold the door shut! A Chop-Chop fruit could cut them.', 3400);
    return;
  }
  openGreatDoor();
}

function openGreatDoor() {
  trip.doorOpen = true;
  spots.greatDoor.open();
  completeTask('tripDoor');
  cheerSchool();
  schoolGo('hall');
  setTimeout(() => {
    yip();
    toast('The Great Door is open! Juf Anne and the class are coming in too.', 3600);
  }, 1500);
}

/* ---------------- the Garden Court ---------------- */

function sendCleoThroughTunnel() {
  hintOnce('tunnelGo', 'Off she goes, through the little tunnel!', 2600);
  cleoWalk(spots.tunnelRoute, {
    onArrive() {
      trip.gateOpen = true;
      spots.gatePlate.press(true);
      spots.gate.open();
      toast('Click! Cleo opened the gate from the other side!', 3200);
    },
  });
}

function updateGarden(p) {
  spots.gatePlate.press(trip.gateOpen);
  const blockDown = trip.stairsUp || blockOn(spots.blockPlate);
  spots.blockPlate.press(blockDown);
  spots.cleoPlate.press(trip.stairsUp || cleoSitsOn(spots.cleoPlate));
  if (!trip.stairsUp && spots.blockPlate.pressed && spots.cleoPlate.pressed) raiseStairs();
  const fromMiddle = distXZ(p, CENTER_8.x + GARDEN_MIDDLE.x, CENTER_8.z + GARDEN_MIDDLE.z);
  if (!trip.stairsUp && fromMiddle > LEAVE_GARDEN && !blocksHome()) resetBlocks();
  // Cleo sniffs out the key once she's in the garden with him
  const dig = spots.keyDig;
  if (!dig.dug && isFollowing() && fromMiddle < 15 && trip.gateOpen) {
    cleoStay(vec3(dig.x + 1.1, dig.y, dig.z), { sniff: true });
    hintOnce('cleoSniffs', 'Cleo is sniffing at something in the corner… dig there!', 3400);
  }
}

function raiseStairs({ quiet = false } = {}) {
  trip.stairsUp = true;
  for (const step of spots.stairs) {
    step.t = quiet ? 1 : 0;
    step.collider.top = step.floor + step.rise;
    if (quiet) step.m.position.y = step.floor + step.rise / 2;
  }
  if (quiet) return;
  sfx.rumble();
  toast('Steps rise up to the sun dais!', 3000);
}

function updateStairs(dt) {
  for (const step of spots.stairs) {
    if (step.t >= 1) continue;
    step.t = Math.min(1, step.t + dt / 1.5);
    step.m.position.y = step.floor - step.rise / 2 + step.rise * step.t;
  }
}

/* ---------------- the Sun Gems ---------------- */

function openGemChest(name) {
  trip.chests[name] = true;
  const chest = { garden: spots.gardenChest, echo: spots.echoChest, mirror: spots.mirrorChest }[
    name
  ];
  const gem = addGem(name, chest.spot.clone().add(vec3(0, 1, 0)));
  if (!player.carrying) carryItem(gem);
  else gem.mesh.position.set(chest.spot.x + 1.2, chest.spot.y + 0.3, chest.spot.z);
  burst(chest.spot.clone().add(vec3(0, 1.2, 0)), {
    count: 30,
    color: [GEM_COLORS[name], 0xffffff, 0xffd84d],
    speed: 4,
    up: 4,
    life: 1.2,
    size: 1.3,
  });
  completeTask({ garden: 'tripGarden', echo: 'tripEcho', mirror: 'tripMirror' }[name]);
  toast('A Sun Gem! Take it to the Sun Door in the Great Hall.', 3400);
}

function addGem(name, pos) {
  return addItem(`gem_${name}`, {
    model: makeSunGem(GEM_COLORS[name]),
    pos,
    name: 'Sun Gem',
    gem: name,
    lift: 0.4,
  });
}

const nearSunDoor = (p) => {
  const door = spots.sunDoor.spot;
  return distXZ(p, door.x, door.z) < 4 && p.z > door.z && Math.abs(p.y - door.y) < 1.5;
};

function placeGemAction(p) {
  const gem = player.carrying?.gem;
  if (!gem || trip.sunDoorOpen || !nearSunDoor(p)) return null;
  return { label: 'Place', run: () => placeGem(gem) };
}

function placeGem(name) {
  const hole = spots.sunDoor.sockets[Object.keys(GEM_COLORS).indexOf(name)];
  placeItem(hole, () => {
    sfx.ding();
    trip.socketed.push(name);
    burst(hole.clone(), {
      count: 16,
      color: [GEM_COLORS[name], 0xffffff],
      speed: 3,
      up: 2,
      life: 0.8,
      size: 1,
    });
    if (trip.socketed.length === 3) setTimeout(openSunDoor, 900);
    else toast(`${trip.socketed.length} of 3 Sun Gems are in the Sun Door!`, 2800);
  });
}

function openSunDoor() {
  trip.sunDoorOpen = true;
  for (const it of items) if (it.gem) it.mesh.visible = false; // they sink with the door
  spots.sunDoor.open();
  completeTask('tripSunDoor');
  cheerSchool();
  say(
    'Juf Anne',
    [
      'The Sun Door is open! Behind it sleeps the Sun Dog.',
      'Mission three: wake up the Sun Dog! Be gentle, he’s very old.',
    ],
    { onEnd: () => giveMission(3) },
  );
}

/* ---------------- the Echo Hall ---------------- */

const inRoom = (p, [x0, x1, z0, z1]) => {
  const { x, z } = local(p);
  return x > x0 && x < x1 && z > z0 && z < z1 && p.y > PLINTH - 0.6;
};

function unlockAction(p) {
  const door = spots.echoDoor.spot;
  const near = distXZ(p, door.x, door.z) < 3.2 && Math.abs(p.y - door.y) < 1.2;
  if (player.carrying?.id !== 'templeKey' || trip.echoOpen || !near) return null;
  return { label: 'Open', run: unlockEchoHall };
}

function unlockEchoHall() {
  useUpCarried();
  trip.echoOpen = true;
  spots.echoDoor.open();
  toast('Click! The key fits!', 2600);
}

/* ---------------- the Mirror Hall ---------------- */

function updateShutter(dt) {
  const plate = spots.shutterPlate;
  plate.press(trip.mirrorSolved || dogOn(plate));
  const shutter = spots.shutter;
  const target = plate.pressed ? 0 : 2.4;
  shutter.height = clamp(target, shutter.height - dt * 4, shutter.height + dt * 4);
  shutter.m.position.y = shutter.floor + shutter.height - 1.2;
  shutter.collider.top = shutter.height > 0.3 ? shutter.floor + shutter.height : -999;
}

function solveMirrors({ quiet = false } = {}) {
  trip.mirrorSolved = true;
  spots.sunEye.faceMaterial.emissiveIntensity = 0.8;
  spots.mirrorChest.rise({ quiet });
  if (quiet) return;
  sfx.ding();
  toast('The sun face lights up! A chest rises on the island in the pit!', 3600);
}

/* ---------------- the Sun Chamber ---------------- */

function stirTheSunDog({ quiet = false } = {}) {
  trip.sunDog = trip.sunDog === 'awake' ? 'awake' : 'stirred';
  if (quiet) {
    sunDog.state = 'stirred';
    return;
  }
  stirSunDog();
  say('The Sun Dog', ['Hmm…? Sunshine… on my nose…', 'AAAH-CHOOO!', '…five more minutes…'], {
    auto: true,
  });
  setTimeout(
    () => hintOnce('twoDogs', 'Still sleepy! Two paw plates… two dogs… and one big WOOF?', 3800),
    7000,
  );
}

function updatePawPlates() {
  for (const plate of spots.pawPlates) plate.press(trip.sunDog === 'awake' || dogOn(plate));
}

// a woof in the Sun Chamber: with sunshine on his nose and two dogs on the plates, he wakes up
function woofAtSunDog(p) {
  if (!inRoom(p, SUN_CHAMBER) || trip.sunDog === 'awake') return false;
  const bothDown = spots.pawPlates.every((plate) => plate.pressed);
  if (!bothDown) {
    say('The Sun Dog', 'Zzz… mmm… zzz…', { auto: true, once: 'sunDogSnore' });
    return true;
  }
  if (trip.sunDog === 'asleep') {
    say('The Sun Dog', 'Zzz… it’s too dark to wake up… zzz…', { auto: true });
    return true;
  }
  wakeTheSunDog();
  return true;
}

function wakeTheSunDog() {
  trip.sunDog = 'awake';
  wakeSunDog();
  lightBraziers();
  completeTask('tripSunDog');
  setTimeout(() => {
    say(
      'The Sun Dog',
      [
        'WOOF! Two good dogs woke me up!',
        'For a thousand years nobody played in my temple.',
        { text: 'Take this Sun Medal for your ship. Thank you, friends!', run: giveMedal },
      ],
      { onEnd: classPhotoTime },
    );
  }, 2600);
}

function giveMedal() {
  keepTreasure('sunMedal');
  sfx.chime();
}

function lightBraziers() {
  const roof = at('roofLight');
  spots.shaft.shaftMaterial.opacity = 0.45;
  for (const [x, z] of [
    [-13, -20],
    [13, -20],
    [-13, -40],
    [13, -30],
  ])
    addBrazier(vec3(CENTER_8.x + x, roof.y, CENTER_8.z + z));
}

// a stone bowl on a stand with a fire in it (world/campfire.js does the flames)
function addBrazier(pos) {
  const stand = mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.2, 8), material(0xc9ae82));
  stand.position.set(pos.x, pos.y + 0.6, pos.z);
  scene.add(stand);
  const bowl = mesh(
    new THREE.CylinderGeometry(0.6, 0.35, 0.4, 10),
    material(0xf2b84b, { metalness: 0.3 }),
  );
  bowl.position.set(pos.x, pos.y + 1.35, pos.z);
  scene.add(bowl);
  addBox(pos.x, pos.z, { hw: 0.45, hd: 0.45, bottom: pos.y - 1, top: pos.y + 1.55 });
  addCampfire(vec3(pos.x, pos.y + 1.4, pos.z));
}

// mission 4: everyone comes in for a class photo with the Sun Dog
function classPhotoTime() {
  schoolGo('photo', { now: true });
  cheerSchool();
  spots.photoMark.m.visible = true;
  say(
    'Juf Anne',
    ['Class photo! Everybody stand by the Sun Dog!', 'Spartacus, stand on the paw mark!'],
    {
      onEnd: () => giveMission(4),
    },
  );
}

function photoAction(p) {
  if (trip.mission < 4 || trip.photo) return null;
  const mark = spots.photo;
  if (distXZ(p, mark.x, mark.z) > 1.6 || Math.abs(p.y - mark.y) > 1) return null;
  return { label: 'Say cheese!', run: takeClassPhoto };
}

function takeClassPhoto() {
  const mark = spots.photo;
  cleoToClass(vec3(mark.x + 1.3, mark.y, mark.z + 0.2), {
    faceTo: vec3(mark.x, mark.y, mark.z + 10),
  });
  cheerSchool();
  startPhoto(mark, {
    onDone() {
      trip.photo = true;
      cleoFollow(); // all the way back to the dock, where the class waits
      keepTreasure('classPhoto');
      completeTask('tripPhoto');
    },
  });
}

/* ---------------- Cleo's commands ---------------- */

// the plates Cleo can sit on, while they still need her
function platesForCleo() {
  const plates = [];
  if (!trip.doorOpen) plates.push(...spots.doorPlates);
  if (!trip.stairsUp) plates.push(spots.cleoPlate);
  if (!trip.mirrorSolved) plates.push(spots.shutterPlate);
  if (trip.sunDog !== 'awake') plates.push(...spots.pawPlates);
  return plates;
}

function cleoAction(p) {
  if (isStaying() && cleoNear(p, 2.6) && !cleo.sniff) return { label: 'Come, Cleo', run: callCleo };
  if (!isFollowing() || !cleoNear(p, 8)) return null;
  const tunnel = spots.tunnelIn;
  if (!trip.gateOpen && distXZ(p, tunnel.x, tunnel.z) < 2.6 && Math.abs(p.y - tunnel.y) < 1)
    return { label: 'Go, Cleo!', run: sendCleoThroughTunnel };
  for (const plate of platesForCleo()) {
    const dist = distXZ(p, plate.x, plate.z);
    if (dist < 3.2 && dist > plate.radius && Math.abs(p.y - plate.y) < 1)
      return { label: 'Stay, Cleo', run: () => cleoStay(vec3(plate.x, plate.y + 0.2, plate.z)) };
  }
  return null;
}

function callCleo() {
  cleoFollow();
  yip();
}

// Cleo waiting on a plate comes back as soon as her job there is done. Behind the Garden's gate
// she waits until he's come through to her side; and if he goes far away she always comes running
// (so she's never lost)
function updateCleoWaiting(p) {
  if (!isStaying()) return;
  const needed = platesForCleo().some((plate) => cleoSitsOn(plate, plate.radius));
  const sniffing = cleo.sniff && !spots.keyDig.dug;
  const behindGate = cleoSitsOn(spots.gatePlate, 1.5) && !cleoNear(p, 5.5);
  const far = !cleoNear(p, CLEO_WANDERS_OFF);
  if ((!needed && !sniffing && !behindGate) || far) {
    cleoFollow();
    if (far) toast('Cleo comes running after you!', 2400);
  }
}

/* ---------------- every frame ---------------- */

const camera8 = { inside: 0 }; // 0 outside .. 1 inside the temple: the camera looks down more

function update(dt) {
  updateCleo(dt);
  updateSchool(dt);
  updateDoors(dt);
  updateBlocks(dt);
  updateCrystals(dt);
  updateBeams(dt);
  updateChests(dt);
  updateSunDog(dt);
  updateStairs(dt);
  updateShutter(dt);
  updateGreatDoor();
  updatePawPlates();
  const inside = inTemple(player.pos) ? 1 : 0;
  camera8.inside = lerp(camera8.inside, inside, Math.min(1, dt * 2));
  spots.shaft.shaftMaterial.opacity =
    (trip.sunDog === 'awake' ? 0.45 : 0.22) + Math.sin(game.time * 1.5) * 0.04;
}

const inTemple = (p) => p.y > PLINTH - 0.6 && TEMPLE.some((room) => inRoom(p, room));

function interact(p) {
  visitPlaces(p);
  if (!island.done.tripMeet && schoolAt() === 'camp' && nearAnne(p, 5)) meetAnne();
  if (trip.doorOpen && trip.mission < 2 && schoolAt() === 'hall' && nearAnne(p, 6)) anneInTheHall();
  updateGarden(p);
  updateCleoWaiting(p);
  // the end of the trip: Cleo goes back to her class on the dock
  if (
    trip.photo &&
    schoolAt() === 'dock' &&
    cleo.state !== 'class' &&
    distXZ(p, spots.dock.x, spots.dock.z) < 12
  ) {
    cleoToClass(vec3(spots.dock.x + 1, spots.dock.y, spots.dock.z - 0.4), { faceTo: p });
    say(
      'Juf Anne',
      ['Goodbye, Spartacus! Cleo will miss you!', 'Come and visit our school one day!'],
      {
        at: spots.dock,
        reach: 14,
        once: 'tripGoodbye',
      },
    );
  }
  hints(p);
}

// one-time hints for everything new
function hints(p) {
  const near = (name, reach) => {
    const spot = level.spots[name];
    return distXZ(p, spot.x, spot.z) < reach && Math.abs(p.y - spot.ground) < 2;
  };
  if (near('vines', 7) && !trip.vinesCut && player.power !== 'chop')
    hintOnce('vines', 'Thick vines cover the door! A Chop-Chop fruit could cut them. 🌿', 3600);
  if (near('greatDoor', 7) && trip.vinesCut && !trip.doorOpen)
    hintOnce(
      'twoPlates',
      island.done.tripMeet
        ? 'Two paw plates: it takes TWO dogs! Stand on one, and tell Cleo to stay on the other.'
        : 'Two paw plates… it takes two dogs. Is there another dog on this island?',
      4200,
    );
  if (near('tunnel', 5) && !trip.gateOpen)
    hintOnce(
      'tunnel',
      'A little tunnel, too small for Spartacus… but just right for a corgi!',
      3600,
    );
  if (inRoom(p, GARDEN)) {
    hintOnce(
      'blocks',
      'Push the stone block onto the square plate! Stuck? Walk out of the garden and it slides back.',
      4600,
    );
    if (near('cleoPlate', 4)) hintOnce('cleoPlate', 'This paw plate is for Cleo!', 2800);
  }
  if (near('echoDoor', 5) && !trip.echoOpen && player.carrying?.id !== 'templeKey')
    hintOnce(
      'locked',
      'Locked! A big golden keyhole… The key must be somewhere in the temple.',
      3600,
    );
  if (inRoom(p, ECHO_HALL))
    hintOnce('crystals', 'Crystal balls! WOOF close to one and see what happens…', 3600);
  if (inRoom(p, MIRROR_HALL)) {
    hintOnce(
      'mirrors',
      `A sunbeam! Turn the mirrors (${actionKeyName()}) to send it to the gold sun on the wall.`,
      4200,
    );
    if (near('shutter', 6) && spots.shutter.height > 1)
      hintOnce(
        'shutter',
        'A stone shutter blocks the light. The paw plate by the door lowers it… Cleo could sit there!',
        4200,
      );
    if (near('hookWest', 4) && !player.canStretch)
      hintOnce(
        'hooks',
        'Golden hooks over the pit! The Stretchy fruit in the Great Hall swings you across.',
        4000,
      );
  }
  if (nearSunDoor(p) && !trip.sunDoorOpen)
    hintOnce('sunDoor', 'Three empty holes in the Sun Door… for three Sun Gems!', 3400);
  if (inRoom(p, SUN_CHAMBER) && trip.sunDog === 'asleep')
    hintOnce(
      'sunDog',
      'A giant stone dog, fast asleep! Turn the mirrors to shine the sunlight on his nose.',
      4200,
    );
  if (trip.mission >= 4 && !trip.photo && near('photo', 4))
    hintOnce('photo', `Stand on the paw mark and press ${actionKeyName()} for the photo!`, 3000);
}

// a woof: Cleo yips back; crystals in the Echo Hall; the Sun Dog; Juf Anne
function bark(p) {
  cleoHeardWoof();
  if (inRoom(p, ECHO_HALL)) {
    sfx.echo();
    if (woofCrystals(p)) hintOnce('swapped', 'The red and blue blocks swapped!', 2800);
    return;
  }
  if (woofAtSunDog(p)) return;
  if (nearAnne(p, 8)) askAnne();
}

function actions(p) {
  return (
    photoAction(p) ||
    placeGemAction(p) ||
    unlockAction(p) ||
    chestAction(p) ||
    cleoAction(p) ||
    mirrorAction(p) ||
    chopAction(p)
  );
}

/* ---------------- leaving, saving ---------------- */

const onDockEnd = (p) => {
  const dockMarker = level.all('dock')[0];
  const end = dockMarker.z + (dockMarker.props.length ?? 11);
  return p.z > end - 4 && Math.abs(p.x - dockMarker.x) < 1.6 && p.y > 0.5;
};
const sailOn = () =>
  showEnd(
    'The Sun Dog is awake, the temple shines again, and the class photo is on the ship! Where does the ship sail next? Make up the story!',
  );

function loadState(state) {
  restorePlaces(8, state.places);
  Object.assign(trip, state.trip ?? {});
  trip.socketed = [...(trip.socketed ?? [])];
  if (trip.vinesCut) {
    spots.vines.visible = false;
    trip.vinesCut = true;
  }
  if (trip.doorOpen) spots.greatDoor.open({ quiet: true });
  if (trip.gateOpen) spots.gate.open({ quiet: true });
  if (trip.stairsUp) raiseStairs({ quiet: true });
  if (trip.echoOpen) spots.echoDoor.open({ quiet: true });
  if (trip.mirrorSolved) {
    spots.mirrorTarget.everLit = true;
    solveMirrors({ quiet: true });
  }
  restoreChests();
  if (trip.sunDoorOpen) spots.sunDoor.open({ quiet: true });
  if (trip.sunDog !== 'asleep') {
    spots.snoutTarget.everLit = true;
    stirTheSunDog({ quiet: true });
  }
  if (trip.sunDog === 'awake') {
    trip.sunDog = 'awake';
    wakeSunDog({ quiet: true });
    lightBraziers();
  }
  if (trip.mission >= 4) spots.photoMark.m.visible = true;
  restoreCrystals(state.crystals);
  restoreMirrors(state.mirrors);
  restoreBlocks(state.blocks);
  restoreSchool(state.school);
  restoreCleo(state.cleo);
  renderTasks();
}

// opened chests, and their gems: in the Sun Door, or back as items (restoreItems puts them where
// they were saved)
function restoreChests() {
  const chests = { garden: spots.gardenChest, echo: spots.echoChest, mirror: spots.mirrorChest };
  for (const [name, opened] of Object.entries(trip.chests)) {
    if (!opened) continue;
    chests[name].open({ quiet: true });
    const gem = addGem(name, chests[name].spot.clone().add(vec3(0, 1, 0)));
    if (!trip.socketed.includes(name)) continue;
    const hole = spots.sunDoor.sockets[Object.keys(GEM_COLORS).indexOf(name)];
    gem.state = 'placed';
    gem.mesh.position.copy(hole);
    gem.mesh.visible = !trip.sunDoorOpen;
  }
}

const saveState = () => ({
  trip: { ...trip, chests: { ...trip.chests }, socketed: [...trip.socketed] },
  places: seenPlaces(8),
  crystals: upColour(),
  mirrors: mirrorFaces(),
  blocks: blockCells(),
  school: schoolState(),
  cleo: cleoState(),
});

const island = {
  id: 8,
  center: CENTER_8,
  name: 'Sunpaw Temple',
  zMax: -2240,
  level, // main.js loads it before anything is built
  height: level.height,
  savesProgress: true,
  // keeps Spartacus over the ground mesh; the sea current brings him back long before this
  physics: { bound: { x: CENTER_8.x, z: CENTER_8.z + 8, r: 115 } },
  // inside the temple the camera rises and looks down, so the walls never hide him
  camera: {
    limit(wanted) {
      const k = camera8.inside;
      if (k < 0.01) return;
      const p = player.pos;
      const dx = wanted.x - p.x,
        dz = wanted.z - p.z,
        flat = Math.hypot(dx, dz) || 1;
      const above = vec3(p.x + (dx / flat) * 8.5, p.y + 10, p.z + (dz / flat) * 8.5);
      wanted.lerp(above, k);
    },
  },
  tasks: {
    title: 'Juf Anne’s school trip',
    more: '❔ More missions from Juf Anne to come…',
    list: [
      mission('tripMeet', '🐿️', () => 'Say hello to Juf Anne at the camp'),
      mission('tripDoor', '🚪', () => 'Open the temple door with Cleo'),
      mission('tripCrayons', '🖍️', () => pickupText(8, 'crayons')),
      mission('tripGarden', '🌸', () => 'Garden Court: find the pink Sun Gem'),
      mission('tripEcho', '🔔', () => 'Echo Hall: find the blue Sun Gem'),
      mission('tripMirror', '🪞', () => 'Mirror Hall: find the gold Sun Gem'),
      mission('tripSunDoor', '☀️', () => 'Put the three Sun Gems in the Sun Door'),
      mission('tripSunDog', '🐕', () => 'Wake up the Sun Dog'),
      mission('tripPhoto', '📸', () => 'Class photo with the Sun Dog'),
    ],
  },
  collect: {
    total: 12,
    count: 0,
    taskId: 'tripCrayons',
    name: 'Crayon',
    all: 'All twelve crayons! The class can draw again! 🖍️',
    model: nextCrayon,
  },
  // a mysterious, tiptoeing temple tune (core/music.js)
  music: {
    tempo: 96,
    root: 57,
    wave: 'triangle',
    melody: [0, null, 2, 4, null, 3, 2, null, 5, null, 4, 2, 3, null, 1, null],
    bass: [-5, null, null, -3, null, null, -4, null, -5, null, null, -2, null, null, -4, null],
  },
  intro: [
    [3400, 'A jungle island with an old temple! Someone is camping by the beach…', 3600],
    [7800, 'Little squirrels with backpacks… it’s Juf Anne’s class!', 3400],
  ],
  win: {
    title: 'What a school trip!',
    text: 'The Sun Dog is awake, the temple shines again, every crayon is back, and the class photo is on the ship. Cleo was the best helper!',
    tip: 'Keep exploring: roll the pots, woof in the Echo Hall, and say goodbye to Cleo at the dock.',
    go: 'What happens next? ✨',
  },
  exit: { label: 'Sail', at: onDockEnd, run: sailOn },
  onAllDone() {
    schoolGo('dock');
  },
  build,
  buildLate: () => level.buildLate(island),
  enter,
  update,
  interact,
  actions,
  bark,
  saveState,
  loadState,
};
export default island;
