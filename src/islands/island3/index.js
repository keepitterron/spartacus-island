// Island 3, Mossy Paw Woods: big trees linked by vines, the bees' hive, the water gate and Wasabi's spring.
import * as THREE from 'three';
import { clamp, distXZ, lerp, smoothstep, rand, distToSegmentXZ, vec3 } from '../../core/util.js';
import { scene, LOW_POWER } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst, textSprite, onFontsReady } from '../../core/fx.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { addCylinder, addBox } from '../../core/colliders.js';
import { terrainHeight, buildGround } from '../../world/terrain.js';
import { CENTER_3 } from '../../world/layout.js';
import { scatter, dock } from '../../world/props.js';
import { ship, addBucket } from '../../world/ship.js';
import { makeKey, makeFlower, makeAcorn } from '../../models/items.js';
import { player } from '../../player/player.js';
import { addItem, carryItem, useUpCarried } from '../../systems/items.js';
import { addPickup, pickupText } from '../../systems/collect.js';
import { addFruit } from '../../systems/powers.js';
import { addDig } from '../../systems/digs.js';
import { addHook } from '../../systems/hooks.js';
import { climbVine, zipVine, vineAction } from '../../systems/vines.js';
import { mango, ensureMangoCrew, mangoFetch } from '../../npcs/mango.js';
import { wasabi } from '../../npcs/wasabi.js';
import { startBubble } from '../../cutscenes/bubble.js';
import { completeTask } from '../../game/tasks.js';
import { enterIsland } from '../../game/flow.js';
import { hintTooHigh } from '../../game/interact.js';

/* Grow-Grow fruit: magic seeds grow a climbing vine and ziplines between treetops.
   Mango fetches a flower, the bees trade it for a key, the key opens the water gate,
   the stream refills Wasabi's spring and she swims down to the ship.

   PLACEHOLDER LAYOUT until Zoë draws the map. Everything is positioned with toWorld(x, z) in
   island-local coordinates, so her layout can be dropped in by editing the numbers. */

const toWorld = (x, z) => ({ x: CENTER_3.x + x, z: CENTER_3.z + z });
const SPRING = { x: CENTER_3.x - 12, z: CENTER_3.z - 4 }; // Wasabi's spring
// the stream bed, from just below the gate down past the spring to the beach
const STREAM = [
  [-14, -15],
  [-12, -4],
  [-10, 6],
  [-8, 16],
  [-7, 30],
].map(([x, z]) => vec3(CENTER_3.x + x, 0, CENTER_3.z + z));

function distToStream(x, z) {
  let d = 1e9;
  for (let i = 0; i < STREAM.length - 1; i++)
    d = Math.min(d, distToSegmentXZ({ x, z }, STREAM[i], STREAM[i + 1]));
  return d;
}
// wobbly radius of the shoreline at angle a around the island centre
function coastRadius(a) {
  return 26 + Math.sin(a * 5) * 1.2 + Math.sin(a * 3 + 2) * 1.4;
}
// ground height: gentle hills, carved down for the stream bed and the spring, then the beach and sea
function height(x, z) {
  const lx = x - CENTER_3.x,
    lz = z - CENTER_3.z,
    r = Math.hypot(lx, lz),
    coast = coastRadius(Math.atan2(lz, lx));
  let y =
    1.25 + 0.3 * Math.sin(x * 0.35 + 1) * Math.cos(z * 0.3) + 0.18 * Math.sin(x * 0.8 + z * 0.7);
  const dStream = distToStream(x, z);
  if (dStream < 2.2) y = lerp(0.5, y, smoothstep(1.1, 2.2, dStream));
  const dSpring = Math.hypot(x - SPRING.x, z - SPRING.z);
  if (dSpring < 4.6) y = lerp(0.45, y, smoothstep(3.2, 4.6, dSpring));
  y = lerp(y, 0.35, smoothstep(coast - 5, coast - 2, r));
  return lerp(y, -4, smoothstep(coast, coast + 2.5, r));
}

// A big tree with a flat leafy deck on top; smooth bark can't be climbed even with a vine.
// Returns the tree record systems/vines.js uses: {x, z, gh (ground), top, grown, col}.
function bigTree(lx, lz, { top, smoothBark = false }) {
  const { x, z } = toWorld(lx, lz),
    gh = terrainHeight(x, z),
    trunkHeight = top - gh;
  const tree = { x, z, gh, top, grown: false };
  const trunk = mesh(
    new THREE.CylinderGeometry(1.0, 1.35, trunkHeight, 9),
    material(smoothBark ? 0x9a7a5e : 0x6e4a30),
    { receiveShadow: true },
  );
  trunk.position.set(x, gh + trunkHeight / 2, z);
  scene.add(trunk);
  const deck = mesh(new THREE.CylinderGeometry(3.2, 2.9, 0.5, 14), material(0x5ea84c), {
    receiveShadow: true,
  });
  deck.position.set(x, top - 0.25, z);
  scene.add(deck);
  // a ring of leaf clumps around the deck edge, then a bigger ring underneath
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * 6.283;
    const leaf = mesh(
      new THREE.IcosahedronGeometry(0.9 + rand() * 0.4, 0),
      material(k % 2 ? 0x3f8f3f : 0x4fa84a),
    );
    leaf.position.set(x + Math.cos(a) * 3.5, top - 0.3 + rand() * 0.5, z + Math.sin(a) * 3.5);
    scene.add(leaf);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 6.283 + 0.3;
    const leaf = mesh(new THREE.IcosahedronGeometry(1.5, 0), material(0x3a8a3c));
    leaf.position.set(x + Math.cos(a) * 2.3, top - 1.5, z + Math.sin(a) * 2.3);
    scene.add(leaf);
  }
  tree.col = addCylinder(x, z, { r: 1.2, bottom: gh - 1, top: top - 0.6 });
  tree.col.tree = tree; // lets the player climb the trunk once its vine has grown
  addCylinder(x, z, { r: 3.2, bottom: top - 0.6, top });
  return tree;
}

// small background tree: either a stacked-cone pine or a round leafy one
function forestTree(x, z) {
  const gh = terrainHeight(x, z);
  if (rand() < 0.5) {
    const trunk = mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 6), material(0x6e4a30));
    trunk.position.set(x, gh + 0.7, z);
    scene.add(trunk);
    for (let k = 0; k < 3; k++) {
      const cone = mesh(
        new THREE.ConeGeometry(1.6 - k * 0.4, 1.8, 7),
        material(k % 2 ? 0x2f7f3f : 0x3a9446),
      );
      cone.position.set(x, gh + 1.6 + k * 1.1, z);
      scene.add(cone);
    }
  } else {
    const trunkHeight = 2.5 + rand() * 1.5;
    const trunk = mesh(new THREE.CylinderGeometry(0.25, 0.35, trunkHeight, 6), material(0x6e4a30));
    trunk.position.set(x, gh + trunkHeight / 2, z);
    scene.add(trunk);
    for (let k = 0; k < 3; k++) {
      const leaf = mesh(
        new THREE.IcosahedronGeometry(1.1 + rand() * 0.5, 0),
        material(k % 2 ? 0x4fa84a : 0x5fbf55),
      );
      leaf.position.set(
        x + (rand() - 0.5) * 1.2,
        gh + trunkHeight + 0.3 + rand() * 0.6,
        z + (rand() - 0.5) * 1.2,
      );
      scene.add(leaf);
    }
  }
  addCylinder(x, z, { r: 0.4, bottom: gh - 1, top: gh + 3 });
}

// the four big trees (see build) and the grower record of the vine on seedTree
let seedTree, junctionTree, hiveTree, acornTree, seedVine;
let flowerMesh, streamCurve, streamGeo, springWater;
let thirstyLabel = null;
let flowProgress = 0, // 0..1: how far the water has run down the stream since the gate opened
  flowerCalled = false; // Mango has been sent for the flower
// These are filled in by build(): HIVE {x, y, z, bees, excite}, GATE {y, frontX, frontZ, doors, lock, col, open},
// FLOWER {x, y, z, treeX} (also Mango's fetch target), MUSHROOM {top}.
const HIVE = {},
  GATE = toWorld(-14, -17.5),
  FLOWER = {},
  MUSHROOM = toWorld(14, 6);
const FRUIT_BUSHES = { grow: toWorld(5, 9), boing: toWorld(11, 1), stretch: toWorld(9, -2) };

// the bees' hive sits on hiveTree's deck, on the side facing junctionTree (where the zipline lands)
function buildHive() {
  const dx = hiveTree.x - junctionTree.x,
    dz = hiveTree.z - junctionTree.z,
    d = Math.hypot(dx, dz);
  HIVE.x = hiveTree.x + (dx / d) * 1.7;
  HIVE.z = hiveTree.z + (dz / d) * 1.7;
  HIVE.y = hiveTree.top;
  const g = new THREE.Group();
  g.position.set(HIVE.x, HIVE.y, HIVE.z);
  g.rotation.y = Math.atan2(-dx, -dz);
  scene.add(g);
  for (let i = 0; i < 4; i++) {
    const ring = mesh(new THREE.TorusGeometry(0.75 - i * 0.15, 0.17, 6, 14), material(0xf2c14e));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.18 + i * 0.3;
    g.add(ring);
  }
  const core = mesh(new THREE.SphereGeometry(0.68, 10, 8), material(0xe8b23e));
  core.scale.y = 1.1;
  core.position.y = 0.55;
  g.add(core);
  const door = mesh(new THREE.CircleGeometry(0.16, 10), material(0x3a2a1a), {
    castShadow: false,
  });
  door.position.set(0, 0.3, 0.71);
  g.add(door);
  addCylinder(HIVE.x, HIVE.z, { r: 0.75, bottom: HIVE.y - 0.5, top: HIVE.y + 1.3 });
  HIVE.bees = []; // {g, phase, radius, height}: each bee circles the hive (see updateBees)
  const wingMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 7; i++) {
    const bee = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(0.09, 6, 5), material(0xffd84d), {
      castShadow: false,
    });
    body.scale.z = 1.3;
    bee.add(body);
    const stripe = mesh(new THREE.TorusGeometry(0.085, 0.022, 4, 10), material(0x2b2b38), {
      castShadow: false,
    });
    bee.add(stripe);
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), wingMaterial);
      wing.position.set(side * 0.07, 0.07, 0);
      wing.rotation.x = -Math.PI / 2;
      bee.add(wing);
    }
    scene.add(bee);
    HIVE.bees.push({
      g: bee,
      phase: i * 0.9,
      radius: 1.1 + rand() * 0.6,
      height: 0.6 + rand() * 0.8,
    });
  }
  HIVE.excite = 0; // seconds of extra buzzing after the flower is handed over
}

// the locked water gate upstream of Wasabi's spring, with the full reservoir behind it
function buildGate() {
  const gh = terrainHeight(GATE.x, GATE.z);
  GATE.y = gh;
  // where Spartacus stands to use the key: just downstream of the doors
  GATE.frontX = GATE.x;
  GATE.frontZ = GATE.z + 1.8;
  for (const side of [-1, 1]) {
    const wall = mesh(new THREE.BoxGeometry(3, 2.4, 1.3), material(0x9aa6b8), {
      receiveShadow: true,
    });
    wall.position.set(GATE.x + side * 2.6, gh + 1.2, GATE.z);
    scene.add(wall);
    addBox(GATE.x + side * 2.6, GATE.z, { hw: 1.5, hd: 0.65, bottom: gh - 1, top: gh + 2.4 });
    const moss = mesh(new THREE.BoxGeometry(3.05, 0.2, 1.35), material(0x7cc86a), {
      castShadow: false,
    });
    moss.position.set(GATE.x + side * 2.6, gh + 2.45, GATE.z);
    scene.add(moss);
  }
  // each door hangs from a hinge group at its outer edge, so rotating the group swings it open
  GATE.doors = [-1, 1].map((side) => {
    const hinge = new THREE.Group();
    hinge.position.set(GATE.x + side * 1.1, gh, GATE.z);
    const door = mesh(new THREE.BoxGeometry(1.1, 1.9, 0.16), material(0x9c6436));
    door.position.set(-side * 0.55, 0.95, 0);
    hinge.add(door);
    for (const y of [0.4, 1.5]) {
      const plank = mesh(new THREE.BoxGeometry(1.12, 0.12, 0.18), material(0x6e4a30), {
        castShadow: false,
      });
      plank.position.set(-side * 0.55, y, 0);
      hinge.add(plank);
    }
    scene.add(hinge);
    hinge.userData.side = side;
    return hinge;
  });
  GATE.lock = mesh(
    new THREE.BoxGeometry(0.3, 0.34, 0.12),
    material(0xffc83d, { metalness: 0.35, roughness: 0.4 }),
  );
  GATE.lock.position.set(GATE.x, gh + 1.05, GATE.z + 0.15);
  scene.add(GATE.lock);
  GATE.col = addBox(GATE.x, GATE.z, { hw: 1.1, hd: 0.25, bottom: gh - 1, top: gh + 1.9 });
  const reservoir = new THREE.Mesh(
    new THREE.CircleGeometry(3.2, 18),
    new THREE.MeshStandardMaterial({
      color: 0x34b3d4,
      transparent: true,
      opacity: 0.85,
      roughness: 0.3,
    }),
  );
  reservoir.rotation.x = -Math.PI / 2;
  reservoir.position.set(GATE.x, gh + 0.35, GATE.z - 3.2);
  scene.add(reservoir);
  const rim = mesh(new THREE.TorusGeometry(3.25, 0.3, 5, 20), material(0x9aa6b8));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(GATE.x, gh + 0.35, GATE.z - 3.2);
  scene.add(rim);
  GATE.open = 0; // 0 = shut, rises to 1 as the doors swing open
}

// dry stream bed + spring; the water tube is revealed bit by bit once the gate opens
function buildStream() {
  streamCurve = new THREE.CatmullRomCurve3([
    vec3(GATE.x, 0, GATE.z + 0.8),
    ...STREAM.map((p) => vec3(p.x, 0, p.z)),
  ]);
  streamGeo = new THREE.TubeGeometry(streamCurve, 140, 0.95, 6);
  streamGeo.setDrawRange(0, 0);
  const streamMesh = new THREE.Mesh(
    streamGeo,
    new THREE.MeshStandardMaterial({
      color: 0x4cc3e6,
      transparent: true,
      opacity: 0.8,
      roughness: 0.25,
    }),
  );
  streamMesh.position.y = 0.62;
  streamMesh.scale.y = 0.18; // squash the tube into a flat ribbon of water
  scene.add(streamMesh);
  springWater = new THREE.Mesh(
    new THREE.CircleGeometry(4.1, 22),
    new THREE.MeshStandardMaterial({
      color: 0x4cc3e6,
      transparent: true,
      opacity: 0.82,
      roughness: 0.25,
    }),
  );
  springWater.rotation.x = -Math.PI / 2;
  springWater.position.set(SPRING.x, 0.52, SPRING.z);
  springWater.scale.setScalar(0.28); // just a puddle until the stream refills it
  scene.add(springWater);
}

// tall tree with the flower on a branch high above the stream (Mango fetches it)
function buildFlowerTree() {
  const treeX = CENTER_3.x - 5,
    treeZ = CENTER_3.z + 9,
    gh = terrainHeight(treeX, treeZ);
  const trunk = mesh(new THREE.CylinderGeometry(0.4, 0.55, 6.5, 7), material(0x6e4a30));
  trunk.position.set(treeX, gh + 3.25, treeZ);
  scene.add(trunk);
  addCylinder(treeX, treeZ, { r: 0.55, bottom: gh - 1, top: gh + 6 });
  for (let k = 0; k < 5; k++) {
    const leaf = mesh(
      new THREE.IcosahedronGeometry(1.5 + rand() * 0.4, 0),
      material(k % 2 ? 0x4fa84a : 0x3f8f3f),
    );
    leaf.position.set(treeX + (rand() - 0.5) * 2, gh + 6.8 + rand(), treeZ + (rand() - 0.5) * 2);
    scene.add(leaf);
  }
  const branchX = CENTER_3.x - 9.6,
    branchY = gh + 5.4;
  const branch = mesh(new THREE.CylinderGeometry(0.08, 0.16, 4.8, 5), material(0x6e4a30));
  branch.rotation.z = Math.PI / 2 + 0.12;
  branch.position.set((treeX + branchX) / 2, branchY + 0.2, treeZ);
  scene.add(branch);
  FLOWER.x = branchX;
  FLOWER.z = treeZ;
  FLOWER.y = branchY + 0.1;
  FLOWER.treeX = treeX;
}

// giant mushroom: only a Boing-Boing jump reaches the top
function buildMushroom() {
  const gh = terrainHeight(MUSHROOM.x, MUSHROOM.z),
    stemHeight = 3.1;
  const stem = mesh(new THREE.CylinderGeometry(0.75, 1, stemHeight, 10), material(0xfff3df), {
    receiveShadow: true,
  });
  stem.position.set(MUSHROOM.x, gh + stemHeight / 2, MUSHROOM.z);
  scene.add(stem);
  const cap = mesh(
    new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    material(0xf2545b),
    { receiveShadow: true },
  );
  cap.scale.y = 0.55;
  cap.position.set(MUSHROOM.x, gh + stemHeight - 0.1, MUSHROOM.z);
  scene.add(cap);
  // white spots: one on the crown, six around it
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * 6.283,
      r = k ? 1.5 : 0;
    const spot = mesh(new THREE.SphereGeometry(0.26, 6, 5), material(0xffffff), {
      castShadow: false,
    });
    spot.scale.y = 0.4;
    spot.position.set(
      MUSHROOM.x + Math.cos(a) * r,
      gh + stemHeight - 0.1 + (k ? 1.0 : 1.3),
      MUSHROOM.z + Math.sin(a) * r,
    );
    scene.add(spot);
  }
  addCylinder(MUSHROOM.x, MUSHROOM.z, { r: 1, bottom: gh - 1, top: gh + stemHeight });
  addCylinder(MUSHROOM.x, MUSHROOM.z, {
    r: 2.3,
    bottom: gh + stemHeight - 0.3,
    top: gh + stemHeight + 1.2,
  });
  MUSHROOM.top = gh + stemHeight + 1.2;
}

// forest dressing is kept off the paths and puzzles
function isForestSpot(x, z) {
  const lx = x - CENTER_3.x,
    lz = z - CENTER_3.z;
  if (Math.hypot(lx, lz) > 19 || distToStream(x, z) < 3.2) return false;
  for (const tree of [seedTree, junctionTree, hiveTree, acornTree])
    if (Math.hypot(x - tree.x, z - tree.z) < 5) return false;
  if (
    Math.hypot(x - SPRING.x, z - SPRING.z) < 6 ||
    Math.hypot(x - GATE.x, z - GATE.z) < 6 ||
    Math.hypot(x - MUSHROOM.x, z - MUSHROOM.z) < 4 ||
    Math.hypot(x - FLOWER.treeX, z - FLOWER.z) < 3
  )
    return false;
  for (const bush of Object.values(FRUIT_BUSHES))
    if (Math.hypot(x - bush.x, z - bush.z) < 3.5) return false;
  return !(Math.abs(lx) < 4 && lz > 9); // the path up from the dock
}

function buildForest() {
  // try random spots until enough trees fit (or we give up)
  for (let i = 0, n = 0; i < 300 && n < (LOW_POWER ? 16 : 28); i++) {
    const a = rand() * 6.28,
      r = 3 + rand() * 16,
      x = CENTER_3.x + Math.cos(a) * r,
      z = CENTER_3.z + Math.sin(a) * r;
    if (!isForestSpot(x, z)) continue;
    n++;
    forestTree(x, z);
  }
  // little toadstools, mostly red, every third one orange
  for (let i = 0, n = 0; i < 200 && n < 24; i++) {
    const a = rand() * 6.28,
      r = 2 + rand() * 18,
      x = CENTER_3.x + Math.cos(a) * r,
      z = CENTER_3.z + Math.sin(a) * r;
    if (!isForestSpot(x, z)) continue;
    n++;
    const gh = terrainHeight(x, z);
    const stem = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 5), material(0xfff3df), {
      castShadow: false,
    });
    stem.position.set(x, gh + 0.15, z);
    scene.add(stem);
    const cap = mesh(
      new THREE.SphereGeometry(0.2, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      material(n % 3 ? 0xf2545b : 0xffa53d),
      { castShadow: false },
    );
    cap.position.set(x, gh + 0.28, z);
    scene.add(cap);
  }
  scatter(CENTER_3.x, CENTER_3.z, { radius: 18, allowed: isForestSpot, bushes: 10, flowers: 70 });
}

function build() {
  buildGround(CENTER_3.x, CENTER_3.z, {
    size: 68,
    segments: LOW_POWER ? 90 : 140,
    palette: { g: 0x4fa84a, g2: 0x6fbf55 },
  });
  island.spawn = vec3(CENTER_3.x, 0, CENTER_3.z + 15);
  island.spawn.y = terrainHeight(island.spawn.x, island.spawn.z);
  dock(CENTER_3.x, { zFrom: CENTER_3.z + 18, zTo: CENTER_3.z + 33 });
  // seedTree has a magic seed at its roots; the other three have bark too smooth to climb,
  // so you climb seedTree and zip seedTree -> junctionTree -> hiveTree
  seedTree = bigTree(-2, 2, { top: 10 });
  junctionTree = bigTree(6, -6, { top: 8.5, smoothBark: true });
  hiveTree = bigTree(-3, -13, { top: 7, smoothBark: true });
  acornTree = bigTree(15, -12, { top: 8, smoothBark: true });
  seedVine = climbVine(seedTree, island.spawn.x, island.spawn.z);
  zipVine(seedTree, junctionTree);
  zipVine(junctionTree, hiveTree);
  // bonus: Stretchy hook from junctionTree to acornTree (golden acorn on top)
  addHook(
    { x: junctionTree.x, y: junctionTree.top, z: junctionTree.z },
    { x: acornTree.x, y: acornTree.top, z: acornTree.z },
  );

  buildHive();
  buildGate();
  buildStream();
  buildFlowerTree();
  flowerMesh = makeFlower();
  flowerMesh.position.set(FLOWER.x, FLOWER.y, FLOWER.z);
  scene.add(flowerMesh);
  buildMushroom();
  buildForest();

  // golden acorns
  addPickup(seedTree.x - 1.5, seedTree.z + 0.4, { y: seedTree.top, island: 3 });
  addPickup(acornTree.x, acornTree.z, { y: acornTree.top, island: 3 });
  addPickup(MUSHROOM.x, MUSHROOM.z, { y: MUSHROOM.top, island: 3 });
  const buried = toWorld(-16, 9);
  addDig(buried.x, buried.z, {
    reward: (dig) => {
      addPickup(dig.x, dig.z, { y: dig.y, island: 3, pop: 0.6 });
      toast('A buried golden acorn!', 1800);
    },
  });
  wasabi.g.position.set(SPRING.x, 0.5, SPRING.z);
  wasabi.g.rotation.y = 0.6;
  onFontsReady(() => {
    thirstyLabel = textSprite('Thirsty…', '#7fd8ee');
    thirstyLabel.scale.set(3.2, 0.8, 1);
    thirstyLabel.material.depthTest = true;
    thirstyLabel.visible = false;
    scene.add(thirstyLabel);
  });
}
function buildLate() {
  for (const [type, pos] of Object.entries(FRUIT_BUSHES))
    addFruit(pos.x, pos.z, { type, y: terrainHeight(pos.x, pos.z), bush: true });
}

function giveFlower() {
  useUpCarried();
  sfx.buzz();
  HIVE.excite = 1.5;
  burst(vec3(HIVE.x, HIVE.y + 1.2, HIVE.z), {
    count: 24,
    color: [0xffd84d, 0xffffff, 0xff9fb2],
    speed: 4,
    up: 3,
    life: 1,
    size: 1,
  });
  setTimeout(() => {
    const key = addItem('key3', {
      model: makeKey(),
      pos: vec3(HIVE.x, HIVE.y + 0.6, HIVE.z),
      name: 'key',
    });
    if (!player.carrying && game.state === 'play') carryItem(key); // if busy, the key just waits on the hive
    toast('Bzz bzz! The bees give Spartacus their shiny key!', 3400);
    completeTask('trade');
  }, 700);
}
function openGate() {
  useUpCarried();
  GATE.open = 0.001; // just above 0 starts the swing in updateGate
  GATE.col.top = -99; // drop the door collider out of the way
  scene.remove(GATE.lock);
  sfx.creak();
  burst(vec3(GATE.x, GATE.y + 1.2, GATE.z + 0.5), {
    count: 24,
    color: [0xffd84d, 0x7fd8ee, 0xffffff],
    speed: 4,
    up: 3,
    life: 1,
    size: 1,
  });
  toast('The gate is open! Here comes the water!', 3000);
  completeTask('gate');
}

function updateBees(dt) {
  const time = game.time;
  HIVE.excite = Math.max(0, HIVE.excite - dt);
  // excited bees fly faster and in wider circles
  for (const bee of HIVE.bees) {
    const a = time * (2 + HIVE.excite) + bee.phase,
      r = bee.radius * (1 + HIVE.excite * 0.4);
    bee.g.position.set(
      HIVE.x + Math.cos(a) * r,
      HIVE.y + bee.height + Math.sin(time * 5 + bee.phase) * 0.12,
      HIVE.z + Math.sin(a) * r,
    );
    bee.g.rotation.y = -a;
  }
}
function updateGate(dt) {
  if (!(GATE.open > 0 && GATE.open < 1)) return;
  GATE.open = Math.min(1, GATE.open + dt / 1.1);
  for (const hinge of GATE.doors) hinge.rotation.y = hinge.userData.side * -1.6 * GATE.open;
}
// the water runs down the stream over 4 s; the spring fills during the middle half of that
function updateStreamFlow(dt) {
  if (!(GATE.open > 0 && flowProgress < 1)) return;
  flowProgress = Math.min(1, flowProgress + dt / 4);
  // draw range must be a whole number of triangles
  streamGeo.setDrawRange(0, Math.floor((streamGeo.index.count * flowProgress) / 3) * 3);
  const fill = clamp((flowProgress - 0.25) / 0.5, 0, 1);
  springWater.scale.setScalar(lerp(0.28, 1, fill));
  springWater.position.y = lerp(0.52, 0.82, fill);
  if (Math.random() < dt * 10) {
    const front = streamCurve.getPointAt(flowProgress);
    burst(vec3(front.x, 0.85, front.z), {
      count: 2,
      color: [0xffffff, 0xbff3ff],
      speed: 2,
      up: 2,
      life: 0.5,
      size: 0.8,
    });
  }
}

// Wasabi's part of the story: stuck -> happy (spring refilled) -> swim down the stream -> crew
function updateWasabiStory(dt) {
  const g = wasabi.g,
    time = game.time;
  if (thirstyLabel) thirstyLabel.visible = wasabi.state === 'stuck';
  if (wasabi.state === 'stuck') updateStuck(g, time);
  else if (wasabi.state === 'happy') updateHappy(g, dt);
  else if (wasabi.state === 'swim') updateSwim(g, { dt, time });
}
function updateStuck(g, time) {
  g.rotation.y = 0.6 + Math.sin(time * 0.8) * 0.4;
  g.position.y = 0.5;
  if (thirstyLabel)
    thirstyLabel.position.set(g.position.x, 1.9 + Math.sin(time * 2) * 0.1, g.position.z);
  if (flowProgress <= 0.75) return;
  wasabi.state = 'happy';
  wasabi.t = 0;
  sfx.splashy();
  toast('Splash! Wasabi’s spring is full again!', 3000);
}
// hop and spin in the refilled spring, then set off down the stream
function updateHappy(g, dt) {
  g.position.y = springWater.position.y - 0.05 + Math.abs(Math.sin(wasabi.t * 5)) * 0.7;
  g.rotation.y += dt * 4;
  if (Math.random() < dt * 6)
    burst(vec3(g.position.x, springWater.position.y, g.position.z), {
      count: 3,
      color: [0xffffff, 0x7fd8ee],
      speed: 2,
      up: 3,
      life: 0.5,
      size: 0.8,
    });
  if (wasabi.t <= 2.4) return;
  wasabi.state = 'swim';
  wasabi.t = 0;
  ship.updateMatrixWorld(true);
  const bucket = ship.localToWorld(vec3(0.65, 1.6, 1.4));
  wasabi.path = new THREE.CatmullRomCurve3([
    vec3(g.position.x, 0.8, g.position.z),
    vec3(STREAM[2].x, 0.8, STREAM[2].z),
    vec3(STREAM[3].x, 0.8, STREAM[3].z),
    vec3(STREAM[4].x, 0.15, STREAM[4].z),
    vec3(ship.position.x - 2.5, 0.1, ship.position.z),
    bucket,
  ]);
  toast('Wasabi is swimming down the stream to the ship!', 3200);
}
// follow the path to the ship's bucket over 9 s
function updateSwim(g, { dt, time }) {
  const u = Math.min(1, wasabi.t / 9),
    pos = wasabi.path.getPointAt(u),
    tangent = wasabi.path.getTangentAt(u);
  g.position.copy(pos);
  g.position.y += Math.sin(time * 6) * 0.05;
  g.rotation.y = Math.atan2(tangent.x, tangent.z);
  if (Math.random() < dt * 5)
    burst(vec3(pos.x, pos.y + 0.1, pos.z), {
      count: 1,
      color: 0xffffff,
      speed: 1,
      up: 1,
      life: 0.5,
      size: 0.6,
    });
  if (u >= 1) joinCrew(g);
}
function joinCrew(g) {
  scene.remove(g);
  ship.add(g);
  g.position.set(0.65, 1.55, 1.4);
  g.rotation.set(0, 0, 0);
  g.scale.setScalar(0.75);
  wasabi.state = 'crew';
  sfx.splashy();
  burst(ship.localToWorld(vec3(0.65, 2, 1.4)), {
    count: 24,
    color: [0x6fb6ff, 0xb59cff, 0xffffff],
    speed: 4,
    up: 3,
    life: 1,
    size: 1,
  });
  toast('Wasabi hopped into the bucket on the ship!', 3000);
  completeTask('wasabi');
}

const island = {
  id: 3,
  center: CENTER_3,
  name: 'Mossy Paw Woods',
  zMax: -245,
  height,
  tasks: {
    title: 'Mossy Paw Woods',
    list: [
      { id: 'grow', ic: '🌱', t: () => 'Eat a Grow-Grow fruit', power: 'grow' },
      { id: 'acorns', ic: '🌰', t: () => pickupText(3, 'golden acorns') },
      { id: 'flower', ic: '🌼', t: () => 'Get a flower for the bees' },
      { id: 'trade', ic: '🐝', t: () => 'Trade it for the bees’ key' },
      { id: 'gate', ic: '🚪', t: () => 'Open the water gate' },
      { id: 'wasabi', ic: '💧', t: () => 'Bring Wasabi to the ship' },
    ],
  },
  collect: {
    total: 4,
    count: 0,
    taskId: 'acorns',
    name: 'Golden acorn',
    all: 'All the golden acorns! Good boy, Spartacus!',
    model: makeAcorn,
  },
  intro: [[3400, 'Wasabi the axolotl’s spring has dried up!', 3400]],
  win: {
    title: 'Wasabi is home!',
    text: 'The spring is full again and Wasabi the axolotl joined the crew. Wasabi has a bubbly idea for the next adventure…',
    tip: 'You can also dive later from the end of the dock.',
    go: 'Dive in! 🫧',
  },
  exit: {
    label: 'Dive',
    at: (p) => p.z > CENTER_3.z + 27 && Math.abs(p.x - CENTER_3.x) < 1.6 && p.y > 0.5,
    run: () => startBubble(() => enterIsland(4, true)),
  },
  build,
  buildLate,
  enter() {
    ensureMangoCrew();
    addBucket();
  },
  update(dt) {
    updateBees(dt);
    updateGate(dt);
    updateStreamFlow(dt);
    updateWasabiStory(dt);
  },
  interact(p) {
    const carryingId = player.carrying?.id;
    if (wasabi.state === 'stuck' && distXZ(p, SPRING.x, SPRING.z) < 6)
      hintOnce('pool', 'Wasabi’s spring has dried up! The water gate upstream is locked.', 3800);
    if (!island.done.gate && distXZ(p, GATE.frontX, GATE.frontZ) < 3.5 && carryingId !== 'key3')
      hintOnce('gate', 'The water gate is locked. Who has the key?', 3200);
    if (player.power !== 'grow' && !seedVine.grown && distXZ(p, seedVine.x, seedVine.z) < 3)
      hintOnce('seed', 'A magic seed! A Grow-Grow fruit could wake it up.', 3400);
    if (
      seedVine.grown &&
      player.grounded &&
      distXZ(p, seedTree.x, seedTree.z) < 3.5 &&
      p.y < seedTree.gh + 1
    )
      hintOnce('climb', 'Walk into the vine to climb it!', 3000);
    for (const tree of [junctionTree, hiveTree, acornTree])
      if (player.grounded && p.y < tree.gh + 1 && distXZ(p, tree.x, tree.z) < 2.6)
        hintOnce('smooth', 'This bark is too smooth to climb. Try going tree to tree!', 3400);
    if (
      !island.done.trade &&
      distXZ(p, HIVE.x, HIVE.z) < 4 &&
      Math.abs(p.y - HIVE.y) < 2 &&
      carryingId !== 'flower'
    )
      hintOnce('bees', 'Bees: “Bzz! Bring us a flower and the shiny key is yours!”', 4000);
    if (!flowerCalled && distXZ(p, FLOWER.x, FLOWER.z) < 5.5)
      hintOnce('flower', 'That flower is too high… Bark to call Mango!', 3600);
    hintTooHigh(
      distXZ(p, MUSHROOM.x, MUSHROOM.z) < 4,
      'Too high! A Boing-Boing jump could reach it.',
    );
  },
  actions(p) {
    const carryingId = player.carrying?.id;
    if (
      carryingId === 'flower' &&
      !island.done.trade &&
      distXZ(p, HIVE.x, HIVE.z) < 2.8 &&
      Math.abs(p.y - HIVE.y) < 1.5
    )
      return { label: 'Give', run: giveFlower };
    if (
      carryingId === 'key3' &&
      !island.done.gate &&
      distXZ(p, GATE.frontX, GATE.frontZ) < 2.8 &&
      Math.abs(p.y - GATE.y) < 1.5
    )
      return { label: 'Open', run: openGate };
    return vineAction(p);
  },
  bark(p) {
    if (mango.state !== 'crew' || flowerCalled || distXZ(p, FLOWER.x, FLOWER.z) >= 5.5) return;
    flowerCalled = true;
    toast('Mango heard you! Here he comes…', 2400);
    mangoFetch(FLOWER, flowerMesh, (pos) => {
      addItem('flower', {
        model: flowerMesh,
        pos: vec3(pos.x, pos.y + 0.05, pos.z),
        name: 'flower',
        lift: 0.05,
      });
      toast(`Mango dropped the flower! Grab it with ${actionKeyName()}.`, 3200);
      completeTask('flower');
    });
  },
};
export default island;
