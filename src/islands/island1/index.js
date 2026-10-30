import * as THREE from 'three';
import { distXZ, lerp, smoothstep, rand, vec3 } from '../../core/util.js';
import { scene, LOW_POWER } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { addCylinder, addBox } from '../../core/colliders.js';
import { terrainHeight, buildGround } from '../../world/terrain.js';
import { CENTER_1, CENTER_2 } from '../../world/layout.js';
import { palm, rock, crate, scatter, dock } from '../../world/props.js';
import { makePlank, makeKey, makeBoot, makeBone } from '../../models/items.js';
import { player } from '../../player/player.js';
import { addItem, carryItem, useUpCarried, placeItem } from '../../systems/items.js';
import { addPickup, pickupText } from '../../systems/collect.js';
import { addFruit } from '../../systems/powers.js';
import { addDig, digNear } from '../../systems/digs.js';
import { gull, perchGull, wakeGull } from '../../npcs/gull.js';
import { startSail } from '../../cutscenes/sail.js';
import { completeTask } from '../../game/tasks.js';
import { enterIsland } from '../../game/flow.js';
import { hintTooHigh } from '../../game/interact.js';

// Island 1, the starter island: bones, the Boing-Boing fruit, a sleepy seagull, the lighthouse
// bell, a broken bridge, a buried key and a treasure chest with the map to island 2.

const POND = { x: 8, z: -8 };
const HILL = { x: -11, z: -15, r: 9, h: 4.5 }; // r: radius, h: height of the bump

// distance from the island centre to the shoreline at `angle`, wobbly so it isn't a circle
function shoreRadius(angle) {
  return 30 + Math.sin(angle * 3) * 1.8 + Math.sin(angle * 5 + 1) * 1.0;
}

// pond profile by distance from its centre: islet in the middle, sloping down to a -2 basin,
// blending back up to the land height `landY` at the rim
function pondHeight(dist, landY) {
  if (dist < 2.5) return 1;
  if (dist < 3.5) return lerp(1, -2, dist - 2.5);
  if (dist < 12) return -2;
  return lerp(-2, landY, smoothstep(12, 14, dist));
}

// terrain: gentle bumps, the hill, the pond, a flat beach ring, then dropping into the sea
function height(x, z) {
  const r = Math.hypot(x, z),
    shore = shoreRadius(Math.atan2(z, x));
  let h = 1.2 + 0.35 * Math.sin(x * 0.3) * Math.cos(z * 0.27) + 0.2 * Math.sin(x * 0.7 + z * 0.55);
  const hillDist = Math.hypot(x - HILL.x, z - HILL.z);
  if (hillDist < HILL.r) {
    const t = 1 - hillDist / HILL.r;
    h += HILL.h * t * t * (3 - 2 * t); // smoothstep-shaped bump
  }
  const pondDist = Math.hypot(x - POND.x, z - POND.z);
  if (pondDist < 14) h = pondHeight(pondDist, h);
  h = lerp(h, 0.35, smoothstep(shore - 6, shore - 2.5, r));
  return lerp(h, -4, smoothstep(shore, shore + 2.5, r));
}

// Fixed spots; build() adds more fields to some of them (meshes, heights, animation state).
const GULL_POST = { x: -1.8, z: 35.3, top: 1.6 }; // the seagull's post on the dock
// + bell, deckTop, swing (bell swing amount 1..0), rockX/rockZ/rockTop (the rock you climb to reach it)
const LIGHTHOUSE = { x: -19, z: -3 };
const FRUIT_ROCK = { x: 21, z: 6 }; // rock with the Boing-Boing fruit; + top
// bridge over the pond along x at z, deck height y; the broken gap runs from x gapStart to gapEnd
const BRIDGE = { z: -8, y: 1.3, gapStart: -2.5, gapEnd: 3.5 };
// on top of the hill; + y, lid, flag, openAmount (lid 0..1), opening
const CHEST = { x: HILL.x, z: HILL.z };
const LOG_PILE = { x: -12, z: 7 }; // where the plank is
const lilies = []; // {g, phase}: bobbing lily pads
let plankGhost, mapScroll; // see-through plank showing where it goes; the map that pops out of the chest

const sailPath = new THREE.CatmullRomCurve3([
  vec3(5.6, 0, 33.5),
  vec3(14, 0, 47),
  vec3(40, 0, 32),
  vec3(48, 0, -40),
  vec3(40, 0, -108),
  vec3(22, 0, -128),
  vec3(5.6, 0, CENTER_2.z + 26.5),
]);

function addGullPost() {
  const post = mesh(new THREE.CylinderGeometry(0.24, 0.26, 4, 7), material(0x8b5a3c));
  post.position.set(GULL_POST.x, GULL_POST.top - 2, GULL_POST.z);
  scene.add(post);
  addCylinder(GULL_POST.x, GULL_POST.z, { r: 0.26, bottom: -3, top: GULL_POST.top });
}

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

// pond: a bridge with a gap (fix it with the plank) + lily pads to hop across
function buildBridge() {
  addBridgeSection(-7.5, BRIDGE.gapStart);
  addBridgeSection(BRIDGE.gapEnd, 6.2);
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

// six lily pads in an arc 10.5 m from the pond centre; every other one (and the last, bigger
// one, which holds a bone) has a flower
function buildLilyPads() {
  const angles = [100, 79, 58, 37, 16, -5];
  for (const [i, deg] of angles.entries()) {
    const angle = (deg * Math.PI) / 180,
      last = i === angles.length - 1,
      r = last ? 1.15 : 0.85;
    const x = POND.x + Math.cos(angle) * 10.5,
      z = POND.z + Math.sin(angle) * 10.5;
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

// treasure chest on the hill, with an X-marks-the-spot flag beside it
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
  // the lid is a half cylinder hinged at the back edge
  CHEST.lid = new THREE.Group();
  CHEST.lid.position.set(0, 0.85, -0.52);
  g.add(CHEST.lid);
  const lidGeometry = new THREE.CylinderGeometry(0.52, 0.52, 1.5, 10, 1, false, 0, Math.PI);
  lidGeometry.rotateZ(Math.PI / 2);
  const lid = mesh(lidGeometry, material(0xc4834a));
  lid.rotateX(-Math.PI / 2);
  lid.position.set(0, 0, 0.52);
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

// five logs stacked 3 + 2
function buildLogPile() {
  const groundY = terrainHeight(LOG_PILE.x, LOG_PILE.z);
  for (let i = 0; i < 5; i++) {
    const log = mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 2.2, 7),
      material(i % 2 ? 0x9c6436 : 0x8b5a3c),
    );
    log.rotation.x = Math.PI / 2;
    const row = i < 3 ? 0 : 1;
    log.position.set(
      LOG_PILE.x - 1.2 + (row ? 0.3 : 0) + (i % 3) * 0.58,
      groundY + 0.28 + row * 0.5,
      LOG_PILE.z - 2.2,
    );
    scene.add(log);
  }
  addBox(LOG_PILE.x - 0.6, LOG_PILE.z - 2.2, {
    hw: 1,
    hd: 1.1,
    bottom: groundY - 1,
    top: groundY + 1.05,
  });
}

function build() {
  buildGround(0, 0, { size: 100, segments: LOW_POWER ? 120 : 200 });
  island.spawn = vec3(0, 0, 21);
  island.spawn.y = terrainHeight(island.spawn.x, island.spawn.z);
  const palmSpots = [
    [16, 17],
    [21, 12],
    [-6, 21],
    [11, 23],
    [-24, 8],
    [-21, -12],
    [-2, -24],
    [12, -23],
    [25, -6],
    [25, 3],
    [-14, 20],
    [-26, -1],
    [7.2, -7.3],
    [-15, -9],
    [3, 12],
    [-3, -4],
    [18, -16],
    [-9, 4],
  ];
  for (const [x, z] of palmSpots) palm(x, z);
  // no bushes/flowers in the pond, by the lighthouse, on the hilltop, or on the path to the dock
  scatter(0, 0, {
    radius: 20,
    allowed: (x, z) =>
      Math.hypot(x - POND.x, z - POND.z) > 15 &&
      Math.hypot(x + 19, z + 3) > 5 &&
      Math.hypot(x - HILL.x, z - HILL.z) > 3 &&
      !(Math.abs(x) < 3 && z > 17),
    bushes: 26,
    flowers: 140,
  });
  dock(0, { zFrom: 25, zTo: 36 });
  addGullPost();
  perchGull(GULL_POST);
  crate(3.1, 20.2);
  const crateTop = crate(4.35, 19.8);

  buildLighthouse();
  addLighthouseRock();
  FRUIT_ROCK.top = rock(FRUIT_ROCK.x, FRUIT_ROCK.z, { radius: 1.1, height: 1.15 });
  rock(-23, 18, { radius: 1.3, height: 0.8 });
  rock(14, 20, { radius: 0.9, height: 0.6 });
  rock(-6, -26, { radius: 1.4, height: 1.2 });

  buildBridge();
  buildLilyPads();
  buildChest();
  buildMapScroll();
  buildLogPile();

  addItem('plank', {
    model: makePlank(BRIDGE.gapEnd - BRIDGE.gapStart),
    pos: vec3(LOG_PILE.x + 1.8, terrainHeight(LOG_PILE.x + 1.8, LOG_PILE.z) + 0.1, LOG_PILE.z),
    heavy: true,
    name: 'plank',
    yaw: 0.3,
    reach: 2.6,
    lift: 0.1,
    carryPos: vec3(0, -0.02, 0.18),
    onCarry: () => hintOnce('plank', 'A long plank! It’s heavy, so Spartacus is slower.', 3000),
  });
  // bones: on the crate, in the grass, on the lighthouse rock, on the last lily pad
  addPickup(4.35, 19.8, { y: crateTop, island: 1 });
  addPickup(-12, 13, { island: 1 });
  addPickup(LIGHTHOUSE.rockX, LIGHTHOUSE.rockZ, { y: LIGHTHOUSE.rockTop, island: 1 });
  const lastLily = lilies.at(-1).g.position;
  addPickup(lastLily.x, lastLily.z, { y: 0.22, island: 1 });
}

function digUpBone(dig) {
  addPickup(dig.x, dig.z, { y: dig.y, island: 1, pop: 0.6 });
  toast('A buried bone!', 1800);
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

// fruit and dig spots are added after every island is built (they don't affect scenery)
function buildLate() {
  addFruit(FRUIT_ROCK.x, FRUIT_ROCK.z, { type: 'boing', y: FRUIT_ROCK.top, bush: false });
  addDig(18, 15, { reward: digUpBone });
  addDig(-22, 15, { reward: digUpBone });
  addDig(POND.x + 0.6, POND.z - 0.6, { reward: digUpKey, marked: true });
  addDig(-4, 6, { reward: digUpBoot });
  addDig(9, -22, { reward: digUpBone });
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
    // the collider is 0.1 wider each side than the gap so there's no seam to fall through
    addBox((BRIDGE.gapStart + BRIDGE.gapEnd) / 2, BRIDGE.z, {
      hw: (BRIDGE.gapEnd - BRIDGE.gapStart) / 2 + 0.1,
      hd: 0.9,
      bottom: -3,
      top: BRIDGE.y,
    });
    sfx.thunk();
    burst(plankGhost.position.clone().add(vec3(0, 0.3, 0)), {
      count: 20,
      color: [0xd09a5e, 0xffd84d],
      speed: 4,
      up: 3,
      life: 0.7,
      size: 1,
    });
    toast('The bridge is fixed!');
    completeTask('bridge');
  });
}
function openChest() {
  useUpCarried();
  CHEST.opening = true;
  sfx.creak();
  burst(vec3(CHEST.x, CHEST.y + 1.2, CHEST.z), {
    count: 30,
    color: [0xffd84d, 0xffffff, 0xff9fb2],
    speed: 5,
    up: 3,
    life: 1,
    size: 1,
  });
  mapScroll.visible = true;
  mapScroll.position.set(CHEST.x, CHEST.y + 1, CHEST.z);
  mapScroll.userData.t = 0;
  setTimeout(() => toast('A map to a new island! Where could it lead?', 3600), 500);
  completeTask('chest');
}

const island = {
  id: 1,
  center: CENTER_1,
  name: 'Spartacus’s Island',
  zMax: Infinity,
  height,
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
  collect: {
    total: 6,
    count: 0,
    taskId: 'bones',
    name: 'Bone',
    all: 'All the bones! Good boy, Spartacus!',
    model: makeBone,
  },
  // hidden presents with accessories inside (systems/secrets.js), island-local coordinates
  secrets: [
    { id: 'i1-lighthouse', x: -20, z: -3.2, reward: 'sunglasses' }, // on the lighthouse deck
    { id: 'i1-logs', x: -13, z: 2.4, reward: 'red-bandana' }, // behind the log pile
    { id: 'i1-islet', x: 9.6, z: -6.6, reward: 'shell-necklace' }, // across the fixed bridge
    { id: 'i1-shore-rock', x: -6, z: -26, reward: 'flower-crown' }, // on the rock by the sea
    { id: 'i1-hill', x: -13.6, z: -16.6, reward: 'tricorn' }, // next to the treasure chest
    { id: 'i1-dig', x: 22, z: -4, reward: 'feather-bow', dig: true },
  ],
  intro: [[400, 'Check the list. Let’s go, Spartacus!', 2600]],
  win: {
    title: 'Ready to sail!',
    text: 'Spartacus found a map to a new island. All aboard!',
    tip: 'You can also sail later from the end of the dock.',
    go: 'Set sail! ⛵',
  },
  onAllDone() {
    game.flagUp = true;
    toast('Everything’s done! Time to sail!', 3200);
  },
  sailPath,
  exit: {
    label: 'Sail',
    at: (p) => p.z > 29 && Math.abs(p.x) < 1.6 && p.y > 0.5,
    run: () => startSail(sailPath, () => enterIsland(2, true)),
  },
  build,
  buildLate,
  update(dt) {
    const time = game.time;
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
    if (
      !island.done.bridge &&
      !player.carrying &&
      distXZ(p, BRIDGE.gapStart - 1, BRIDGE.z) < 2.5 &&
      p.y > 1
    )
      hintOnce('bridge', 'The bridge is broken! Find a long plank.', 3200);
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
    if (gull.state !== 'sleep' || distXZ(p, GULL_POST.x, GULL_POST.z) >= 6.5) return;
    wakeGull();
    setTimeout(() => toast('Squawk! The seagull flew away. Oops!'), 300);
    completeTask('gull');
  },
};
export default island;
