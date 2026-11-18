// Frogs at the edge of ponds and streams: three sit by each spot, croak now and then, and when
// Spartacus comes close (or barks) they hop into the water with a plip, peek out with just their
// eyes, and climb back out once he's gone. Ambience only: nothing to catch.
// Islands list spots as data (or `frogs` markers in the level), island-local:
//   critters: { frogs: [[x, z], …] }
// Drawn with three InstancedMeshes (bodies, eyes, pupils) for every frog in the game.
import * as THREE from 'three';
import { distXZ, lerp, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { supportHeight } from '../core/colliders.js';
import { terrainHeight } from '../world/terrain.js';
import { player } from '../player/player.js';

const FROGS_PER_SPOT = 3;
const ACTIVE_RANGE = 60;
const SHY_DISTANCE = 3.2; // m: closer than this and they jump in
const HOP_TIME = 0.45; // s
const HOP_HEIGHT = 0.7;
const STAY_IN = 4; // s at least in the water before climbing out
const COME_OUT_DISTANCE = 6; // m: and only once Spartacus is this far from home
const WATER_DEPTH = -0.25; // ground lower than this is water a frog can dive into
const SIZE = 1.4;

const spots = []; // {x, z, frogs, croakTimer}
const meshes = {}; // body, eyes, pupils
const rig = makeRig();

export function buildFrogs(islands) {
  for (const island of islands)
    for (const [x, z] of island.critters?.frogs ?? [])
      spots.push(makeSpot(island.center.x + x, island.center.z + z));
  const count = Math.max(1, spots.length * FROGS_PER_SPOT);
  const body = new THREE.SphereGeometry(0.2, 8, 6);
  body.scale(1, 0.65, 1.15);
  meshes.body = instanced(body, { color: 0x5cbf4a, count });
  meshes.eyes = instanced(new THREE.SphereGeometry(0.065, 6, 5), {
    color: 0xffffff,
    count: count * 2,
  });
  meshes.pupils = instanced(new THREE.SphereGeometry(0.035, 5, 4), {
    color: 0x1f1f27,
    count: count * 2,
  });
}

function instanced(geometry, { color, count }) {
  const m = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.7 }),
    count,
  );
  m.frustumCulled = false; // instances are spread over the whole world
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // nothing drawn until a frog is posed (an instance matrix starts as the world's centre)
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < count; i++) m.setMatrixAt(i, hidden);
  scene.add(m);
  return m;
}

// a frog's body with its eyes on top, to work out each instance's matrices
function makeRig() {
  const body = new THREE.Object3D();
  body.scale.setScalar(SIZE);
  const eyes = [-1, 1].map((side) => {
    const eye = new THREE.Object3D();
    eye.position.set(side * 0.09, 0.11, 0.1);
    const pupil = new THREE.Object3D();
    pupil.position.set(0, 0.015, 0.05);
    eye.add(pupil);
    body.add(eye);
    return { eye, pupil };
  });
  return { body, eyes };
}

function makeSpot(x, z) {
  const frogs = [];
  for (let i = 0; i < FROGS_PER_SPOT; i++) {
    const angle = i * 2.1 + Math.random() * 0.5;
    const hx = x + Math.sin(angle) * 0.9,
      hz = z + Math.cos(angle) * 0.9;
    const home = vec3(hx, Math.max(0, supportHeight(hx, hz, Infinity)), hz);
    frogs.push({
      home,
      water: findWater(home, angle),
      // sit | hop (into the water) | swim | back (out of it)
      state: 'sit',
      t: 0,
      delay: 0,
      yaw: angle + Math.PI,
      puff: 0, // throat puff while croaking, 1 -> 0
    });
  }
  return { x, z, frogs, croakTimer: 3 + Math.random() * 6 };
}

// the nearest water within a few metres, looking outward from the spot first; null if none
function findWater(home, outward) {
  for (let dist = 1.6; dist <= 4.5; dist += 0.7)
    for (let k = 0; k < 16; k++) {
      const angle = outward + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.39;
      const x = home.x + Math.sin(angle) * dist,
        z = home.z + Math.cos(angle) * dist;
      if (terrainHeight(x, z) < WATER_DEPTH) return vec3(x, -0.05, z);
    }
  return null;
}

export function barkAtFrogs(pos) {
  for (const spot of spots) if (distXZ(pos, spot.x, spot.z) < 10) startle(spot);
}

// every frog still sitting hops in, one after another
function startle(spot) {
  spot.frogs.forEach((frog, i) => {
    if (frog.state !== 'sit' || !frog.water) return;
    frog.state = 'hop';
    frog.t = 0;
    frog.delay = i * 0.15;
  });
}

export function updateFrogs(dt) {
  spots.forEach((spot, s) => {
    if (distXZ(player.pos, spot.x, spot.z) > ACTIVE_RANGE) return;
    const close = spot.frogs.some(
      (frog) =>
        distXZ(player.pos, frog.home.x, frog.home.z) < SHY_DISTANCE &&
        Math.abs(player.pos.y - frog.home.y) < 2,
    );
    if (close) startle(spot);
    updateCroak(spot, dt);
    spot.frogs.forEach((frog, i) => {
      updateFrog(frog, dt);
      poseFrog(frog, s * FROGS_PER_SPOT + i);
    });
  });
  for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
}

// now and then one of the sitting frogs croaks (heard only nearby)
function updateCroak(spot, dt) {
  spot.croakTimer -= dt;
  if (spot.croakTimer > 0) return;
  spot.croakTimer = 5 + Math.random() * 6;
  const sitting = spot.frogs.filter((frog) => frog.state === 'sit');
  if (!sitting.length || distXZ(player.pos, spot.x, spot.z) > 16) return;
  sitting[Math.floor(Math.random() * sitting.length)].puff = 1;
  sfx.ribbit();
}

function updateFrog(frog, dt) {
  frog.puff = Math.max(0, frog.puff - dt * 2.5);
  if (frog.delay > 0) {
    frog.delay -= dt;
    return;
  }
  frog.t += dt;
  if (frog.state === 'hop' && frog.t >= HOP_TIME) {
    frog.state = 'swim';
    frog.t = 0;
    splash(frog.water);
  } else if (frog.state === 'swim' && frog.t > STAY_IN) {
    const away = distXZ(player.pos, frog.home.x, frog.home.z) > COME_OUT_DISTANCE;
    if (away) {
      frog.state = 'back';
      frog.t = 0;
    }
  } else if (frog.state === 'back' && frog.t >= HOP_TIME) {
    frog.state = 'sit';
    frog.t = 0;
  }
}

function splash(pos) {
  burst(vec3(pos.x, 0.05, pos.z), {
    count: 8,
    color: [0xffffff, 0xbfefff],
    speed: 1.6,
    up: 2.2,
    life: 0.5,
    size: 0.6,
  });
  if (distXZ(player.pos, pos.x, pos.z) < 20) sfx.plip();
}

function poseFrog(frog, index) {
  const { body } = rig;
  const { home, water } = frog;
  if (frog.state === 'sit' || frog.delay > 0) {
    // sits still, breathing; a croak puffs the throat out
    const breathe = 1 + Math.sin(game.time * 3 + home.x) * 0.03 + frog.puff * 0.25;
    body.position.copy(home);
    body.position.y += 0.12;
    body.rotation.set(0, frog.yaw, 0);
    body.scale.set(SIZE * breathe, SIZE * breathe, SIZE);
  } else if (frog.state === 'swim') {
    // only the eyes and the top of its head above the surface, bobbing
    body.position.set(water.x, -0.1 + Math.sin(game.time * 2.5 + home.z) * 0.03, water.z);
    body.rotation.set(0, Math.atan2(home.x - water.x, home.z - water.z), 0);
    body.scale.setScalar(SIZE);
  } else {
    const into = frog.state === 'hop';
    const from = into ? home : water,
      to = into ? water : home;
    const k = Math.min(1, frog.t / HOP_TIME);
    body.position.set(
      lerp(from.x, to.x, k),
      lerp(from.y + 0.12, to.y + 0.12, k) + Math.sin(Math.PI * k) * HOP_HEIGHT,
      lerp(from.z, to.z, k),
    );
    // stretched out in the air
    const stretch = Math.sin(Math.PI * k);
    body.rotation.set(-0.4 * Math.cos(Math.PI * k), Math.atan2(to.x - from.x, to.z - from.z), 0);
    body.scale.set(
      SIZE * (1 - stretch * 0.15),
      SIZE * (1 - stretch * 0.1),
      SIZE * (1 + stretch * 0.4),
    );
  }
  body.updateMatrixWorld(true);
  meshes.body.setMatrixAt(index, body.matrixWorld);
  rig.eyes.forEach(({ eye, pupil }, side) => {
    meshes.eyes.setMatrixAt(index * 2 + side, eye.matrixWorld);
    meshes.pupils.setMatrixAt(index * 2 + side, pupil.matrixWorld);
  });
}
