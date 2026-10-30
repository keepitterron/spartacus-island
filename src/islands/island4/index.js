import * as THREE from 'three';
import {
  lerpAngle,
  distXZ,
  lerp,
  smoothstep,
  rand,
  distToSegmentXZ,
  vec3,
} from '../../core/util.js';
import { scene, LOW_POWER } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game, followCam, isPlaying } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce } from '../../core/ui.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight, buildGround } from '../../world/terrain.js';
import { CENTER_4 } from '../../world/layout.js';
import { rock } from '../../world/props.js';
import { ship, shipBubble, shipState } from '../../world/ship.js';
import { makePillow } from '../../models/items.js';
import { player } from '../../player/player.js';
import { addItem } from '../../systems/items.js';
import { addFruit } from '../../systems/powers.js';
import { climbVine, vineAction, growers } from '../../systems/vines.js';
import { addChoppable, chopAction } from '../../systems/hat.js';
import { ensureMangoCrew } from '../../npcs/mango.js';
import { wasabiFollow } from '../../npcs/wasabi.js';
import { completeTask } from '../../game/tasks.js';
import { hintTooHigh } from '../../game/interact.js';
import {
  SEA_BED_Y,
  toWorld,
  LANE_START,
  LANE_DIR,
  LANE_NORMAL,
  LANE_LENGTH,
  lanePoint,
  OCTOPUS_SPOT,
  CANYON_START,
  CANYON_END,
  CANYON_DIR,
  CANYON_LENGTH,
  canyonPoint,
} from './geo.js';
import { octo, buildOcto, updateOcto, wakeOcto, givePillow } from './octopus.js';
import {
  CRABS_TOTAL,
  crabCount,
  addCrab,
  updateCrabs,
  barkCrabs,
  touchCrabs,
  crabNear,
  crabsParty,
} from './crabs.js';
import { eduardo, buildEduardo, updateEduardo, eek, eduardoToShip } from './eduardo.js';
import { buildWhale, startWhale } from './whale.js';

/* ============ Island 4: Bubbly Ocean (underwater) ============
   Wasabi's bubble lets Spartacus breathe. Chop-Chop fruit: throw the hat to cut seaweed.
   Find 5 red hermit crabs, chase Eduardo through the seaweed lane past the tentacle gates,
   fetch the octopus's pillow through the bubble vent canyon so he goes back to sleep,
   bring Eduardo to the ship. A whale pushes the ship back to the surface. */

// a gently rippled sea bed that curves up into walls past radius 28
function seabedHeight(x, z) {
  const r = Math.hypot(x - CENTER_4.x, z - CENTER_4.z);
  return (
    SEA_BED_Y +
    0.4 * Math.sin(x * 0.3) * Math.cos(z * 0.25) +
    0.25 * Math.sin(x * 0.7 + z * 0.5) +
    smoothstep(28, 40, r) * 16
  );
}

let surfaceGeo, breathBubble, KELP_PILLAR, LEDGE, SHELF;
const sunRays = [], // {m, phase}
  seaweeds = [], // every clump, see addSeaweed
  tentacleGates = [], // see buildTentacleGates
  vents = []; // see addVent
const FRUIT_BUSHES = { chop: toWorld(4, 9), grow: toWorld(-6, 7), boing: toWorld(9, 8) };
const SHIP_SPOT = toWorld(-10, 17);
const LIFT_VENT = toWorld(9, -1);
const SAND_CRAB = toWorld(-3, 6);
const CLUMP_CRAB = toWorld(-8, 11);

// seaweed: light clumps can be chopped, dark thick kelp can't.
// Thick walls look short but have a tall invisible collider (colliderHeight) so the camera can see over them.
// forest clumps wake the octopus when chopped.
// clump: {g, x, z, y, col, forest, crab, phase, cutT, onChop?, hidesEduardo?}; cutT = 0..1 shrink after a chop
function addSeaweed(
  x,
  z,
  { thick = false, height, radius = 1, colliderHeight, forest = false } = {},
) {
  const gh = terrainHeight(x, z),
    g = new THREE.Group();
  g.position.set(x, gh, z);
  const bladeHeight = height || (thick ? 7 : 3.2),
    blades = thick ? 4 : 6;
  const matA = material(thick ? 0x2f7f4f : 0xb8d84a),
    matB = material(thick ? 0x3a9a5a : 0x9ccf3a);
  for (let k = 0; k < blades; k++) {
    const a = (k / blades) * 6.283 + rand(),
      r = rand() * radius * 0.6,
      h = bladeHeight * (0.75 + rand() * 0.35);
    const geo = new THREE.BoxGeometry(thick ? 0.5 : 0.24, h, 0.06);
    geo.translate(0, h / 2, 0);
    const blade = mesh(geo, k % 2 ? matA : matB);
    blade.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    blade.rotation.y = rand() * 3;
    g.add(blade);
  }
  scene.add(g);
  const col = addCylinder(x, z, {
    r: radius,
    bottom: gh - 1,
    top: gh + (colliderHeight || bladeHeight),
  });
  const clump = { g, x, z, y: gh, col, forest, crab: null, phase: rand() * 6, cutT: 0 };
  if (!thick) {
    clump.onChop = onChopClump;
    addChoppable(clump);
  }
  seaweeds.push(clump);
  return clump;
}
function onChopClump(clump) {
  clump.cutT = 0.001; // starts the shrink animation in updateSeaweed
  clump.col.top = -999;
  if (clump.forest) wakeOcto(island.done.sleep);
  if (clump.crab) {
    clump.crab.state = 'hidden';
    clump.crab.g.visible = true;
  }
  if (clump.hidesEduardo && eduardo.state === 'inClump') {
    clump.hidesEduardo = false;
    eduardo.g.visible = true;
    eek();
  }
}

// a bubble vent on a timer. kind 'push' blows you back along dir; 'lift' launches you up.
function addVent(x, z, { kind, offset, dir }) {
  const gh = terrainHeight(x, z),
    isLift = kind === 'lift';
  const ring = mesh(new THREE.TorusGeometry(isLift ? 0.9 : 1.3, 0.25, 6, 16), material(0x6f7f94), {
    receiveShadow: true,
  });
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, gh + 0.15, z);
  scene.add(ring);
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(isLift ? 0.85 : 1.25, 14),
    material(0x2b3a55),
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(x, gh + 0.05, z);
  scene.add(hole);
  // bubbles for onDur seconds of every period; offset staggers the vents
  vents.push({
    x,
    z,
    y: gh,
    kind,
    offset,
    dir,
    radius: isLift ? 1.2 : 2.4,
    on: false,
    period: isLift ? 3.6 : 3.0,
    onDur: isLift ? 1.6 : 1.5,
  });
}

// a rock pillar you climb with a Grow-Grow kelp ladder (works like a tree, see systems/vines:
// it reads {x, z, gh, top, grown} and col.tree)
function addPillar(x, z, { height }) {
  const gh = terrainHeight(x, z),
    top = gh + height;
  const column = mesh(new THREE.CylinderGeometry(1.1, 1.35, height, 8), material(0x8fa0b4), {
    receiveShadow: true,
  });
  column.position.set(x, gh + height / 2, z);
  scene.add(column);
  const cap = mesh(new THREE.CylinderGeometry(2.2, 1.6, 0.5, 10), material(0x9fb3c6), {
    receiveShadow: true,
  });
  cap.position.set(x, top - 0.25, z);
  scene.add(cap);
  const pillar = { x, z, gh, top, grown: false };
  pillar.col = addCylinder(x, z, { r: 1.2, bottom: gh - 1, top: top - 0.6 });
  pillar.col.tree = pillar;
  addCylinder(x, z, { r: 2.2, bottom: top - 0.6, top });
  return pillar;
}

// a tentacle caught you: back to the gate's checkpoint, no harm done
function bonkPlayer(gate) {
  const { checkpoint } = gate;
  player.pos.set(checkpoint.x, terrainHeight(checkpoint.x, checkpoint.z), checkpoint.z);
  player.vel.set(0, 0, 0);
  player.squashVel = -6;
  sfx.boing();
  octo.hmphTimer = 1.2;
  burst(player.pos.clone().add(vec3(0, 1, 0)), {
    count: 10,
    color: [0xff7a59, 0xffffff],
    speed: 3,
    up: 2,
    life: 0.5,
    size: 0.8,
    gravity: -0.05,
  });
  hintOnce('bonk', 'Bonk! Wait for the tentacle to lift up, then run under.', 3200);
}

/* ---------------- build ----------------
   Build order matters: all scenery shares one seeded rand(), so these run in a fixed order. */

// the water surface seen from below, and sun rays
function buildSurface() {
  surfaceGeo = new THREE.PlaneGeometry(200, 200, LOW_POWER ? 16 : 28, LOW_POWER ? 16 : 28);
  surfaceGeo.rotateX(-Math.PI / 2);
  surfaceGeo.translate(CENTER_4.x, 0, CENTER_4.z);
  scene.add(
    new THREE.Mesh(
      surfaceGeo,
      new THREE.MeshStandardMaterial({
        color: 0x8fe3f5,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        flatShading: true,
        roughness: 0.3,
      }),
    ),
  );
  for (let i = 0; i < 7; i++) {
    const ray = new THREE.Mesh(
      new THREE.ConeGeometry(2.5 + rand() * 2, 26, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const w = toWorld(-22 + rand() * 44, -22 + rand() * 40);
    ray.position.set(w.x, -11, w.z);
    ray.rotation.z = 0.15;
    scene.add(ray);
    sunRays.push({ m: ray, phase: rand() * 6 });
  }
}

const KELP_WALL = { thick: true, radius: 1.1, height: 4, colliderHeight: 9 };

// the seaweed lane: kelp walls, a ring of kelp round the octopus, forest clumps at the
// entrance and Eduardo's hiding rows. Returns the clumps Eduardo hides in.
function buildSeaweedLane() {
  for (let along = -0.5; along <= LANE_LENGTH + 0.8; along += 1.7)
    for (const side of [-2.7, 2.7]) {
      const q = lanePoint(along, side);
      addSeaweed(q.x, q.z, KELP_WALL);
    }
  OCTOPUS_SPOT.y = terrainHeight(OCTOPUS_SPOT.x, OCTOPUS_SPOT.z);
  // 12 clumps every 24.5° round the octopus, leaving a gap facing back up the lane
  const backUpLane = Math.atan2(-LANE_DIR.z, -LANE_DIR.x);
  for (let k = 0; k < 12; k++) {
    const a = backUpLane + ((45 + k * 24.5) * Math.PI) / 180;
    addSeaweed(OCTOPUS_SPOT.x + Math.cos(a) * 3.6, OCTOPUS_SPOT.z + Math.sin(a) * 3.6, KELP_WALL);
  }
  for (const side of [-1.3, 0, 1.3]) {
    const q = lanePoint(0.6, side);
    addSeaweed(q.x, q.z, { forest: true, radius: 1 });
  }
  // Eduardo runs away and dives into these clumps; the middle one of each row hides him
  return [10, 16.5].map((along) => {
    let middle = null;
    for (const side of [-1.1, 0, 1.1]) {
      const q = lanePoint(along, side);
      const clump = addSeaweed(q.x, q.z, { forest: true, radius: 0.95, height: 3.4 });
      if (side === 0) middle = clump;
    }
    return middle;
  });
}

// tentacle gates: an arch of 12 segments across the lane that lifts and drops.
// gate: {along, center, groundY, segments, offset, checkpoint, danger}; checkpoint = where a bonk puts you back
function buildTentacleGates() {
  [6.5, 13.5, 20].forEach((along, i) => {
    const center = lanePoint(along, 0),
      groundY = terrainHeight(center.x, center.z),
      segments = [];
    for (let k = 0; k < 12; k++) {
      const segment = mesh(
        new THREE.SphereGeometry(0.5 - k * 0.03, 8, 6),
        material(k % 2 ? 0xff7a59 : 0xff8f6e),
      );
      scene.add(segment);
      segments.push(segment);
    }
    tentacleGates.push({
      along,
      center,
      groundY,
      segments,
      offset: i * 1.7,
      checkpoint: lanePoint(along - 2.4, 0),
      danger: false,
    });
  });
}

// bubble vent canyon: rock walls, three push vents and the pillow at the far end
function buildCanyon() {
  for (let along = 0; along <= CANYON_LENGTH + 1; along += 1.5)
    for (const side of [-2.9, 2.9]) {
      const q = canyonPoint(along, side);
      rock(q.x, q.z, { radius: 1.15, height: 6.2 + rand() * 1.5, color: 0x8fa0b4 });
    }
  for (const side of [-1.5, 0, 1.5]) {
    const q = canyonPoint(CANYON_LENGTH + 2, side);
    rock(q.x, q.z, { radius: 1.1, height: 6.5, color: 0x8fa0b4 });
  }
  [0.3, 0.55, 0.8].forEach((f, i) => {
    const q = canyonPoint(CANYON_LENGTH * f, 0);
    addVent(q.x, q.z, {
      kind: 'push',
      offset: i * 1.0,
      dir: vec3(-CANYON_DIR.x, 0, -CANYON_DIR.z),
    });
  });
  const q = canyonPoint(CANYON_LENGTH, 0);
  const top = rock(q.x, q.z, { radius: 0.85, height: 0.7, color: 0x9fb3c6 });
  addItem('pillow', {
    model: makePillow(),
    pos: vec3(q.x, top + 0.2, q.z),
    name: 'pillow',
    lift: 0.2,
    onCarry: () => {
      if (island.done.pillowFound) return;
      toast('A soft pink pillow! Whose could it be?', 3000);
      completeTask('pillowFound');
    },
  });
}

// high places, one per power: a lift vent by a ledge, a Boing-Boing shelf, a Grow-Grow pillar
function buildHighPlaces() {
  addVent(LIFT_VENT.x, LIFT_VENT.z, { kind: 'lift', offset: 0.4 });
  LEDGE = toWorld(10.9, 0.4);
  LEDGE.top = rock(LEDGE.x, LEDGE.z, { radius: 1.3, height: 6.3, color: 0x9fb3c6 });
  SHELF = toWorld(16, 8);
  SHELF.top = rock(SHELF.x, SHELF.z, { radius: 1.6, height: 4.6, color: 0xc9b48a });
  const pillarSpot = toWorld(-15, 4);
  KELP_PILLAR = addPillar(pillarSpot.x, pillarSpot.z, { height: 6.5 });
  climbVine(KELP_PILLAR, island.spawn.x, island.spawn.z);
}

// hermit crabs: on the sand, on top of the pillar, shelf and ledge, and inside a clump
function buildCrabs() {
  addCrab(SAND_CRAB.x, SAND_CRAB.z, { y: terrainHeight(SAND_CRAB.x, SAND_CRAB.z) });
  addCrab(KELP_PILLAR.x + 1.2, KELP_PILLAR.z, { y: KELP_PILLAR.top });
  addCrab(SHELF.x, SHELF.z, { y: SHELF.top });
  addCrab(LEDGE.x, LEDGE.z, { y: LEDGE.top });
  const clump = addSeaweed(CLUMP_CRAB.x, CLUMP_CRAB.z, { radius: 1.1 });
  addCrab(CLUMP_CRAB.x, CLUMP_CRAB.z, {
    y: terrainHeight(CLUMP_CRAB.x, CLUMP_CRAB.z),
    inClump: clump,
  });
}

// sea floor dressing is kept inside the basin and off the paths and puzzle spots
function isFreeSeaFloor(x, z) {
  if (Math.hypot(x - CENTER_4.x, z - CENTER_4.z) > 27) return false;
  const p = { x, z };
  if (distToSegmentXZ(p, lanePoint(-1, 0), OCTOPUS_SPOT) < 4.6) return false;
  if (distToSegmentXZ(p, CANYON_START, CANYON_END) < 4.4) return false;
  if (Math.hypot(x - SHIP_SPOT.x, z - SHIP_SPOT.z) < 6) return false;
  if (Math.hypot(x - island.spawn.x, z - island.spawn.z) < 3) return false;
  const spots = [
    ...Object.values(FRUIT_BUSHES),
    KELP_PILLAR,
    LEDGE,
    SHELF,
    LIFT_VENT,
    SAND_CRAB,
    CLUMP_CRAB,
  ];
  return spots.every((q) => Math.hypot(x - q.x, z - q.z) >= 3);
}
// a random spot in a ring round the island centre (uses two rand() calls)
function randomSeaSpot({ minR, spanR }) {
  const a = rand() * 6.28,
    r = minR + rand() * spanR;
  return { x: CENTER_4.x + Math.cos(a) * r, z: CENTER_4.z + Math.sin(a) * r };
}

function addBlobCoral(g, color) {
  const blob = mesh(new THREE.IcosahedronGeometry(0.6 + rand() * 0.4, 1), material(color), {
    receiveShadow: true,
  });
  blob.scale.y = 0.7;
  blob.position.y = 0.3;
  g.add(blob);
}
function addBranchCoral(g, color) {
  for (let k = 0; k < 4; k++) {
    const h = 0.6 + rand() * 1.3,
      bx = (rand() - 0.5) * 0.6,
      bz = (rand() - 0.5) * 0.6;
    const branch = mesh(new THREE.CylinderGeometry(0.07, 0.13, h, 5), material(color));
    branch.position.set(bx, h / 2, bz);
    branch.rotation.set((rand() - 0.5) * 0.7, 0, (rand() - 0.5) * 0.7);
    g.add(branch);
    const tip = mesh(new THREE.SphereGeometry(0.13, 6, 5), material(color));
    tip.position.set(bx * 1.6, h, bz * 1.6);
    g.add(tip);
  }
}
const CORAL_COLORS = [0xff8fb1, 0xffa53d, 0xb59cff, 0x5fd3c8, 0xff6b8a];
// coral: every 4th is a blob, the rest branchy. Up to 300 tries to place them.
function buildCoral() {
  for (let i = 0, n = 0; i < 300 && n < (LOW_POWER ? 18 : 32); i++) {
    const { x, z } = randomSeaSpot({ minR: 3, spanR: 24 });
    if (!isFreeSeaFloor(x, z)) continue;
    n++;
    const g = new THREE.Group(),
      color = CORAL_COLORS[n % CORAL_COLORS.length];
    g.position.set(x, terrainHeight(x, z), z);
    if (n % 4 === 0) addBlobCoral(g, color);
    else addBranchCoral(g, color);
    scene.add(g);
  }
}
function buildStarfish() {
  for (let i = 0, n = 0; i < 200 && n < 12; i++) {
    const { x, z } = randomSeaSpot({ minR: 3, spanR: 24 });
    if (!isFreeSeaFloor(x, z)) continue;
    n++;
    const g = new THREE.Group();
    g.position.set(x, terrainHeight(x, z) + 0.05, z);
    g.rotation.y = rand() * 6;
    for (let k = 0; k < 5; k++) {
      const arm = mesh(
        new THREE.ConeGeometry(0.12, 0.5, 4),
        material(n % 2 ? 0xffa53d : 0xff6b8a),
        { castShadow: false },
      );
      arm.rotation.z = -Math.PI / 2;
      arm.position.x = 0.25;
      const pivot = new THREE.Group();
      pivot.rotation.y = k * 1.2566; // 72° apart
      pivot.add(arm);
      g.add(pivot);
    }
    scene.add(g);
  }
}
function buildLooseKelp() {
  for (let i = 0, n = 0; i < 200 && n < 8; i++) {
    const { x, z } = randomSeaSpot({ minR: 6, spanR: 20 });
    if (!isFreeSeaFloor(x, z)) continue;
    n++;
    addSeaweed(x, z, { thick: true, height: 4 + rand() * 3, radius: 0.6 });
  }
}

// Wasabi's breathing bubble around Spartacus
function buildBreathBubble() {
  breathBubble = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 20, 14),
    new THREE.MeshStandardMaterial({
      color: 0xbff3ff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.1,
      metalness: 0.2,
      depthWrite: false,
    }),
  );
  breathBubble.visible = false;
  scene.add(breathBubble);
}

function build() {
  buildGround(CENTER_4.x, CENTER_4.z, {
    size: 92,
    segments: LOW_POWER ? 90 : 150,
    palette: { seabed: SEA_BED_Y },
  });
  island.spawn = vec3(CENTER_4.x, 0, CENTER_4.z + 10);
  island.spawn.y = terrainHeight(island.spawn.x, island.spawn.z);
  buildSurface();
  const hideClumps = buildSeaweedLane();
  buildTentacleGates();
  buildOcto();
  buildCanyon();
  buildHighPlaces();
  buildCrabs();
  buildEduardo(hideClumps);
  buildWhale();
  buildCoral();
  buildStarfish();
  buildLooseKelp();
  buildBreathBubble();
}
function buildLate() {
  for (const [type, w] of Object.entries(FRUIT_BUSHES))
    addFruit(w.x, w.z, { type, y: terrainHeight(w.x, w.z), bush: true });
}

// the ship rests on the sea floor inside its bubble
function placeShip() {
  ship.position.set(SHIP_SPOT.x, 0, SHIP_SPOT.z);
  ship.rotation.set(0, Math.PI * 0.9, 0);
  shipState.baseY = terrainHeight(SHIP_SPOT.x, SHIP_SPOT.z) + 0.75;
  shipState.depth = 0;
  shipBubble.visible = true;
  shipBubble.scale.setScalar(1);
  ship.updateMatrixWorld(true);
}

/* ---------------- update ---------------- */

function updateSurface(T) {
  const pos = surfaceGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i);
    pos.setY(i, 0.15 * Math.sin(x * 0.25 + T * 1.2) + 0.12 * Math.cos(z * 0.3 + T));
  }
  pos.needsUpdate = true;
  surfaceGeo.computeVertexNormals();
  for (const ray of sunRays) {
    ray.m.rotation.z = 0.15 + Math.sin(T * 0.3 + ray.phase) * 0.08;
    ray.m.material.opacity = 0.05 + 0.03 * Math.sin(T * 0.7 + ray.phase);
  }
}

// sway every clump; chopped ones shrink down over 0.4s
function updateSeaweed(dt, T) {
  for (const c of seaweeds) {
    c.g.rotation.z = Math.sin(T * 1.1 + c.phase) * 0.08;
    c.g.rotation.x = Math.cos(T * 0.9 + c.phase) * 0.06;
    if (c.cutT > 0 && c.cutT < 1) {
      c.cutT = Math.min(1, c.cutT + dt * 2.5);
      c.g.scale.y = lerp(1, 0.12, c.cutT);
    }
  }
}

// vents bubble on a timer; a few small bubbles warn just before they start
function updateVents(dt, T) {
  for (const v of vents) {
    const t = (T + v.offset) % v.period;
    v.on = t < v.onDur;
    const warn = !v.on && t > v.period - 0.7;
    if (v.on && Math.random() < dt * (v.kind === 'lift' ? 30 : 40))
      burst(
        vec3(
          v.x + (Math.random() - 0.5) * v.radius,
          v.y + 0.3,
          v.z + (Math.random() - 0.5) * v.radius,
        ),
        {
          count: 1,
          color: [0xffffff, 0xdff9ff],
          speed: 1,
          up: v.kind === 'lift' ? 9 : 7,
          life: 1,
          size: 1.3,
          gravity: -0.25,
        },
      );
    if (warn && Math.random() < dt * 10)
      burst(vec3(v.x, v.y + 0.2, v.z), {
        count: 1,
        color: 0xffffff,
        speed: 0.6,
        up: 2,
        life: 0.6,
        size: 0.6,
        gravity: -0.1,
      });
  }
}

// tentacles: while the octopus is awake they arch over the lane and drop every 3.4s
// (~60% of the time safe); asleep, they lie curled at the side of the lane
function updateTentacleGates(T) {
  const active = octo.awake && !island.done.sleep;
  for (const gate of tentacleGates) {
    const lift = 0.5 + 0.5 * Math.cos((2 * Math.PI * (T + gate.offset)) / 3.4),
      arch = lerp(0.5, 4.8, lift);
    for (let k = 0; k < 12; k++) {
      const u = k / 11; // 0..1 along the tentacle
      let q, y;
      if (active) {
        q = lanePoint(
          gate.along + Math.sin(u * Math.PI) * 0.3 * Math.sin(T * 3 + k),
          3.1 - 6.2 * u,
        );
        const tipWiggle = u > 0.85 ? Math.sin(T * 8) * 0.2 : 0;
        y = gate.groundY + 0.35 + arch * Math.sin(u * Math.PI) + tipWiggle;
      } else {
        const a = u * 4;
        q = lanePoint(gate.along + Math.sin(a) * 0.6 * u, 3.4 + Math.cos(a) * 0.6 * u);
        y = gate.groundY + 0.4 + u * 0.4;
      }
      gate.segments[k].position.set(q.x, y, q.z);
    }
    gate.danger = active && arch < 1.95;
  }
}

function updateBreathBubble(dt, T) {
  breathBubble.visible = game.state === 'play' || game.state === 'rescue';
  breathBubble.position.copy(player.pos).add(vec3(0, 1.1, 0));
  breathBubble.scale.setScalar(1 + Math.sin(T * 2.5) * 0.03);
  // stray bubbles rising around Spartacus
  if (isPlaying() && Math.random() < dt * 3)
    burst(player.pos.clone().add(vec3((Math.random() - 0.5) * 6, 0.2, (Math.random() - 0.5) * 6)), {
      count: 1,
      color: 0xdff9ff,
      speed: 0.5,
      up: 2,
      life: 2.5,
      size: 0.8,
      gravity: -0.15,
    });
}

function update(dt) {
  const T = game.time;
  updateSurface(T);
  updateSeaweed(dt, T);
  updateVents(dt, T);
  updateTentacleGates(T);
  updateOcto(dt);
  updateCrabs(dt);
  updateEduardo(dt);
  updateBreathBubble(dt, T);
}

/* ---------------- interact (every frame, p = player position) ---------------- */

// a bubbling vent launches you: lift vents up to 7 high, push vents back down the canyon
function pushByVents(p) {
  for (const v of vents) {
    const isLift = v.kind === 'lift';
    if (!v.on || distXZ(p, v.x, v.z) >= v.radius || p.y >= v.y + (isLift ? 7 : 3.5)) continue;
    if (isLift) {
      player.vel.y = Math.max(player.vel.y, 9);
    } else {
      player.vel.x = v.dir.x * 11;
      player.vel.z = v.dir.z * 11;
      player.vel.y = Math.max(player.vel.y, 3);
    }
    player.grounded = false;
  }
}

// a dropping tentacle bonks you if you're under it (2 wide along the lane, 5.6 across)
function checkTentacleGates(p) {
  for (const gate of tentacleGates) {
    if (!gate.danger) continue;
    const dx = p.x - gate.center.x,
      dz = p.z - gate.center.z,
      along = dx * LANE_DIR.x + dz * LANE_DIR.z,
      across = dx * LANE_NORMAL.x + dz * LANE_NORMAL.z;
    if (Math.abs(along) < 1 && Math.abs(across) < 2.8 && p.y < gate.groundY + 2.4) {
      bonkPlayer(gate);
      break;
    }
  }
}

function interact(p) {
  touchCrabs(p);
  if (crabNear(p, 7))
    hintOnce(
      'crabnear',
      'See the bubbles? A hermit crab is hiding there! Walk up close or bark.',
      3800,
    );
  if (eduardo.state === 'idle0' && distXZ(p, eduardo.g.position.x, eduardo.g.position.z) < 5) eek();
  if (
    !octo.awake &&
    !island.done.sleep &&
    distToSegmentXZ(p, lanePoint(-4, 0), lanePoint(0.5, 0)) < 3
  )
    hintOnce('sleepy', 'Shh… a big octopus is snoring deep in the seaweed.', 3200);
  pushByVents(p);
  checkTentacleGates(p);
  if (eduardo.state === 'riding' && distXZ(p, ship.position.x, ship.position.z) < 5.5) {
    eduardoToShip();
    toast('Eduardo hops aboard! The crabs are throwing a party!', 3200);
    crabsParty();
  }
  if (
    player.power !== 'chop' &&
    seaweeds.some((c) => !c.cut && c.onChop && distXZ(p, c.x, c.z) < 3)
  )
    hintOnce('chopneed', 'Seaweed in the way! A Chop-Chop fruit could cut through it.', 3400);
  if (distToSegmentXZ(p, CANYON_START, canyonPoint(3, 0)) < 2.5)
    hintOnce('vents', 'Bubble vents! Wait until they stop, then dash through.', 3400);
  if (distXZ(p, LIFT_VENT.x, LIFT_VENT.z) < 3)
    hintOnce('lift', 'This vent pushes UP! Stand on it when it bubbles.', 3200);
  if (octo.awake && distToSegmentXZ(p, LANE_START, lanePoint(4, 0)) < 2.5)
    hintOnce('tent', 'Grumpy tentacles! Run under them when they lift up.', 3400);
  if (
    octo.awake &&
    distXZ(p, OCTOPUS_SPOT.x, OCTOPUS_SPOT.z) < 5 &&
    player.carrying?.id !== 'pillow'
  )
    hintOnce('octo', 'Octopus: “Grumble… I can’t sleep without my pillow!”', 4000);
  hintTooHigh(distXZ(p, SHELF.x, SHELF.z) < 3.5, 'Too high! A Boing-Boing jump could reach it.');
  const kelpGrower = growers.find((g) => g.t === KELP_PILLAR);
  if (
    kelpGrower &&
    !kelpGrower.grown &&
    player.power !== 'grow' &&
    distXZ(p, kelpGrower.x, kelpGrower.z) < 3
  )
    hintOnce('seed4', 'A magic seed! Grow-Grow could make a kelp ladder.', 3400);
}

const island = {
  id: 4,
  center: CENTER_4,
  name: 'Bubbly Ocean',
  zMax: -600,
  height: seabedHeight,
  underwater: true,
  physics: {
    gravity: 16,
    maxFall: 9,
    speed: 0.85,
    jump: 0.72,
    water: false,
    bound: { x: CENTER_4.x, z: CENTER_4.z, r: 30 },
  },
  camera: {
    // stay below the surface and above the sand
    minY: (c) => Math.min(-1.5, terrainHeight(c.x, c.z) + 0.8),
    maxY: -1.2,
    // in the seaweed lane, gently turn to look down it (the walls would hide the dog)
    assist(dt) {
      if (distToSegmentXZ(player.pos, LANE_START, OCTOPUS_SPOT) < 2.6)
        followCam.yaw = lerpAngle(
          followCam.yaw,
          Math.atan2(-LANE_DIR.x, -LANE_DIR.z),
          Math.min(1, dt * 1.5),
        );
    },
  },
  tasks: {
    title: 'Bubbly Ocean',
    list: [
      { id: 'chop', ic: '✂️', t: () => 'Eat a Chop-Chop fruit', power: 'chop' },
      {
        id: 'crabs',
        ic: '🦀',
        t: () => `Find ${CRABS_TOTAL} red hermit crabs (${crabCount()}/${CRABS_TOTAL})`,
      },
      { id: 'eduardo', ic: '💜', t: () => 'Find Eduardo in the seaweed' },
      { id: 'pillowFound', ic: '🛏️', t: () => 'Find the octopus’s pillow' },
      { id: 'sleep', ic: '😴', t: () => 'Help the grumpy octopus sleep' },
      { id: 'ship4', ic: '⛵', t: () => 'Bring Eduardo to the ship' },
    ],
  },
  intro: [
    [3400, 'The red hermit crabs lost their friend Eduardo!', 3400],
    [7200, 'Mango: “I’ll guard the ship!” Wasabi’s bubble lets Spartacus breathe.', 3800],
    [11400, 'Tip: hidden hermit crabs blow bubbles. Follow the bubbles!', 3800],
  ],
  win: {
    title: 'Eduardo is safe!',
    text: 'Eduardo joined the crew, the octopus is snoring and the red hermit crabs are having a party. Here comes a big friendly whale…',
    tip: 'You can also ride the whale later from the ship.',
    go: 'Ride the whale! 🐋',
  },
  exit: {
    label: 'Ride',
    at: (p) => distXZ(p, ship.position.x, ship.position.z) < 5,
    run: startWhale,
  },
  build,
  buildLate,
  enter() {
    placeShip();
    ensureMangoCrew();
    wasabiFollow();
  },
  update,
  interact,
  actions(p) {
    if (
      player.carrying?.id === 'pillow' &&
      !island.done.sleep &&
      distXZ(p, OCTOPUS_SPOT.x, OCTOPUS_SPOT.z) < 4.4
    )
      return { label: 'Give', run: givePillow };
    return vineAction(p) || chopAction(p);
  },
  bark: barkCrabs,
};
export default island;
