// Ambient life: bird flocks on the beaches that scatter when Spartacus runs at them or barks
// and land again later, butterflies dancing over the flowers (fireflies there at night), and
// fish schools underwater that dart away from a bark. No puzzles, just a world that notices you.
// Islands list spots as data, island-local:
//   critters: { birds: [[x, z], …], butterflies: [[x, z], …], fish: [[x, z, height], …] }
// Every kind is drawn with a few InstancedMeshes, so they cost a handful of draw calls in total.
import * as THREE from 'three';
import { distXZ, lerp, smoothstep } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { supportHeight } from '../core/colliders.js';
import { player } from '../player/player.js';
import { daylight } from '../world/daylight.js';

const ACTIVE_RANGE = 80; // flocks further away than this aren't animated
const BIRDS_PER_FLOCK = 6;
const BUTTERFLIES_PER_SPOT = 3;
const FISH_PER_SCHOOL = 8;
const FIREFLIES_PER_SPOT = 5;
const FLY_TIME = 7; // seconds a scared flock stays up before landing again
const BUTTERFLY_COLORS = [0xffa53d, 0xb59cff, 0xff9fb2, 0xffd84d, 0x7fd8ee];
const FISH_COLORS = [0xffa53d, 0xffd84d, 0x7fd8ee, 0xff8fb1];

// one part (body, left wing…) of every critter of a kind, as an InstancedMesh
function instanced(geometry, { color, count }) {
  const m = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8 }),
    count,
  );
  m.frustumCulled = false; // instances are spread over the whole world
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(m);
  return m;
}

// a dummy hierarchy (body with two wing pivots) used to work out each instance's matrices;
// size scales the whole critter
function makeRig(size) {
  const body = new THREE.Object3D();
  body.scale.setScalar(size);
  const wings = [-1, 1].map((side) => {
    const pivot = new THREE.Object3D();
    pivot.position.x = side * 0.06;
    body.add(pivot);
    const wing = new THREE.Object3D();
    wing.position.x = side * 0.14;
    pivot.add(wing);
    return { pivot, wing, side };
  });
  return { body, wings };
}

// write the rig's current pose into instance i of the body and wing meshes
function storeRig(rig, { meshes, i, flap }) {
  for (const { pivot, side } of rig.wings) pivot.rotation.z = side * flap;
  rig.body.updateMatrixWorld(true);
  meshes.body?.setMatrixAt(i, rig.body.matrixWorld);
  meshes.left.setMatrixAt(i, rig.wings[0].wing.matrixWorld);
  meshes.right.setMatrixAt(i, rig.wings[1].wing.matrixWorld);
}

const kinds = {
  birds: { flocks: [], meshes: null, rig: makeRig(1.8) },
  butterflies: { spots: [], meshes: null, rig: makeRig(1.3) },
  fish: { schools: [], mesh: null, dummy: new THREE.Object3D() },
  fireflies: { mesh: null, dummy: new THREE.Object3D() },
};

export function buildCritters() {
  for (const island of Object.values(game.islands)) {
    const { birds = [], butterflies = [], fish = [] } = island.critters || {};
    const world = ([x, z]) => ({ x: island.center.x + x, z: island.center.z + z });
    for (const spot of birds) kinds.birds.flocks.push(makeFlock(world(spot)));
    for (const spot of butterflies) kinds.butterflies.spots.push(makeButterflies(world(spot)));
    for (const spot of fish) kinds.fish.schools.push(makeSchool({ ...world(spot), y: spot[2] }));
  }
  buildBirdMeshes();
  buildButterflyMeshes();
  buildFishMesh();
  buildFireflyMesh();
}

/* ---------- birds ---------- */
function makeFlock({ x, z }) {
  const birds = [];
  for (let i = 0; i < BIRDS_PER_FLOCK; i++) {
    const bx = x + (Math.random() - 0.5) * 3,
      bz = z + (Math.random() - 0.5) * 3;
    birds.push({
      x: bx,
      z: bz,
      y: supportHeight(bx, bz, Infinity),
      yaw: Math.random() * 6.3,
      phase: Math.random() * 6.3,
    });
  }
  // state: ground | flying; t: seconds in that state; away: direction they fled in
  return { x, z, birds, state: 'ground', t: 0, away: 0 };
}

function buildBirdMeshes() {
  const count = Math.max(1, kinds.birds.flocks.length * BIRDS_PER_FLOCK);
  const bodyGeo = new THREE.SphereGeometry(0.13, 6, 5);
  bodyGeo.scale(0.9, 0.8, 1.5);
  const wingGeo = new THREE.BoxGeometry(0.28, 0.02, 0.16);
  kinds.birds.meshes = {
    body: instanced(bodyGeo, { color: 0xffffff, count }),
    left: instanced(wingGeo, { color: 0x9aa6b8, count }),
    right: instanced(wingGeo, { color: 0x9aa6b8, count }),
  };
}

// running at a flock (or ground-pounding near it) scares it; so does a bark
function scaresFlock(flock) {
  const dist = distXZ(player.pos, flock.x, flock.z);
  const fast = player.sprinting || player.pounding || Math.hypot(player.vel.x, player.vel.z) > 5;
  return dist < 4.5 && fast;
}

export function barkAtCritters(pos) {
  for (const flock of kinds.birds.flocks)
    if (distXZ(pos, flock.x, flock.z) < 10) scatterFlock(flock);
  for (const school of kinds.fish.schools)
    if (distXZ(pos, school.x, school.z) < 9) school.scared = 3;
}

function scatterFlock(flock) {
  if (flock.state === 'flying') return;
  flock.state = 'flying';
  flock.t = 0;
  flock.away = Math.atan2(flock.x - player.pos.x, flock.z - player.pos.z);
  sfx.flutter();
}

function updateBirds(dt) {
  const { flocks, meshes, rig } = kinds.birds;
  flocks.forEach((flock, f) => {
    if (distXZ(player.pos, flock.x, flock.z) > ACTIVE_RANGE) return;
    flock.t += dt;
    if (flock.state === 'ground' && scaresFlock(flock)) scatterFlock(flock);
    if (flock.state === 'flying' && flock.t > FLY_TIME + 2) flock.state = 'ground';
    flock.birds.forEach((bird, b) => {
      poseBird(bird, flock, rig);
      // on the ground the wings fold down along the body
      const flap = flock.state === 'flying' ? Math.sin(game.time * 28 + bird.phase) * 0.9 : -1.3;
      storeRig(rig, { meshes, i: f * BIRDS_PER_FLOCK + b, flap });
    });
  });
  for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
}

// on the ground they peck and hop; flying, they swirl up and away, then glide back down
function poseBird(bird, flock, rig) {
  const time = game.time,
    body = rig.body;
  if (flock.state === 'ground') {
    const hop = Math.max(0, Math.sin(time * 3 + bird.phase * 5)) ** 8 * 0.15;
    body.position.set(bird.x, bird.y + 0.2 + hop, bird.z);
    body.rotation.set(Math.max(0, Math.sin(time * 2 + bird.phase)) * 0.5, bird.yaw, 0);
    return;
  }
  // up and out (0 -> 1), circling, then back down for the last 2 s
  const out = smoothstep(0, 1.5, flock.t) * (1 - smoothstep(FLY_TIME, FLY_TIME + 2, flock.t));
  const angle = flock.away + bird.phase + time * 0.8;
  const radius = 2 + out * 6 + bird.phase * 0.3;
  const x = lerp(bird.x, flock.x + Math.sin(angle) * radius, out),
    z = lerp(bird.z, flock.z + Math.cos(angle) * radius, out);
  body.position.set(x, bird.y + 0.12 + out * (6 + bird.phase * 0.4), z);
  body.rotation.set(0, angle + Math.PI / 2, 0);
}

/* ---------- butterflies ---------- */
function makeButterflies({ x, z }) {
  const flies = [];
  for (let i = 0; i < BUTTERFLIES_PER_SPOT; i++)
    flies.push({
      phase: Math.random() * 6.3,
      color: BUTTERFLY_COLORS[Math.floor(Math.random() * BUTTERFLY_COLORS.length)],
    });
  return { x, z, y: supportHeight(x, z, Infinity), flies };
}

function buildButterflyMeshes() {
  const count = Math.max(1, kinds.butterflies.spots.length * BUTTERFLIES_PER_SPOT);
  const wingGeo = new THREE.CircleGeometry(0.13, 6);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.scale(1, 1, 1.3);
  const meshes = {
    left: instanced(wingGeo, { color: 0xffffff, count }),
    right: instanced(wingGeo, { color: 0xffffff, count }),
  };
  for (const m of Object.values(meshes)) m.material.side = THREE.DoubleSide;
  kinds.butterflies.spots.forEach((spot, s) =>
    spot.flies.forEach((fly, i) => {
      const color = new THREE.Color(fly.color);
      meshes.left.setColorAt(s * BUTTERFLIES_PER_SPOT + i, color);
      meshes.right.setColorAt(s * BUTTERFLIES_PER_SPOT + i, color);
    }),
  );
  kinds.butterflies.meshes = meshes;
}

// lazy loops over the flowers, fluttering up and away if Spartacus comes too close
function updateButterflies() {
  const { spots, meshes, rig } = kinds.butterflies,
    time = game.time;
  // butterflies go to sleep at night; the fireflies come out instead
  const awake = daylight.night < 0.5;
  meshes.left.visible = awake;
  meshes.right.visible = awake;
  if (!awake) return;
  spots.forEach((spot, s) => {
    if (distXZ(player.pos, spot.x, spot.z) > ACTIVE_RANGE) return;
    spot.flies.forEach((fly, i) => {
      const p = fly.phase;
      let x = spot.x + Math.sin(time * 0.5 + p) * 1.6 + Math.sin(time * 1.3 + p * 2) * 0.4,
        z = spot.z + Math.cos(time * 0.6 + p) * 1.6;
      let y = spot.y + 0.9 + Math.sin(time * 1.7 + p) * 0.35;
      const dist = distXZ(player.pos, x, z);
      if (dist < 2) {
        // shy: drift away and up
        const push = (2 - dist) * 1.2;
        x += ((x - player.pos.x) / (dist || 1)) * push;
        z += ((z - player.pos.z) / (dist || 1)) * push;
        y += push;
      }
      rig.body.position.set(x, y, z);
      rig.body.rotation.set(0, time * 0.4 + p, 0);
      storeRig(rig, {
        meshes,
        i: s * BUTTERFLIES_PER_SPOT + i,
        flap: 0.2 + Math.sin(time * 22 + p) * 0.9,
      });
    });
  });
  meshes.left.instanceMatrix.needsUpdate = true;
  meshes.right.instanceMatrix.needsUpdate = true;
}

/* ---------- fish ---------- */
function makeSchool({ x, z, y }) {
  const fish = [];
  for (let i = 0; i < FISH_PER_SCHOOL; i++)
    fish.push({
      phase: (i / FISH_PER_SCHOOL) * 6.3,
      radius: 1.5 + Math.random() * 1.5,
      dy: Math.random() * 1.2,
    });
  return { x, z, y: supportHeight(x, z, Infinity) + (y ?? 2), fish, scared: 0, spin: 0 };
}

function buildFishMesh() {
  const count = Math.max(1, kinds.fish.schools.length * FISH_PER_SCHOOL);
  const geometry = new THREE.ConeGeometry(0.14, 0.5, 5);
  geometry.rotateX(Math.PI / 2); // nose along +z
  geometry.scale(0.6, 1, 1);
  const mesh = instanced(geometry, { color: 0xffffff, count });
  kinds.fish.schools.forEach((school, s) =>
    school.fish.forEach((fish, i) =>
      mesh.setColorAt(
        s * FISH_PER_SCHOOL + i,
        new THREE.Color(FISH_COLORS[i % FISH_COLORS.length]),
      ),
    ),
  );
  kinds.fish.mesh = mesh;
}

// a school circles its spot; a bark makes it dart round fast and wide for a few seconds
function updateFish(dt) {
  const { schools, mesh, dummy } = kinds.fish;
  schools.forEach((school, s) => {
    if (distXZ(player.pos, school.x, school.z) > ACTIVE_RANGE) return;
    school.scared = Math.max(0, school.scared - dt);
    const fright = smoothstep(0, 1, school.scared);
    school.spin += dt * (0.6 + fright * 3);
    school.fish.forEach((fish, i) => {
      const angle = school.spin + fish.phase,
        radius = fish.radius * (1 + fright * 2.5);
      dummy.position.set(
        school.x + Math.sin(angle) * radius,
        school.y + fish.dy + Math.sin(game.time * 2 + fish.phase) * 0.2,
        school.z + Math.cos(angle) * radius,
      );
      dummy.rotation.set(0, angle + Math.PI / 2 + Math.sin(game.time * 12 + i) * 0.15, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(s * FISH_PER_SCHOOL + i, dummy.matrix);
    });
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/* ---------- fireflies (at night, over the butterfly spots) ---------- */
function buildFireflyMesh() {
  const count = Math.max(1, kinds.butterflies.spots.length * FIREFLIES_PER_SPOT);
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.07, 6, 4),
    new THREE.MeshBasicMaterial({ color: 0xeaff7a, fog: false }), // unlit, so they glow
    count,
  );
  mesh.frustumCulled = false;
  mesh.visible = false;
  scene.add(mesh);
  kinds.fireflies.mesh = mesh;
}

// slow wandering glows that blink on and off
function updateFireflies() {
  const { mesh, dummy } = kinds.fireflies,
    time = game.time;
  mesh.visible = daylight.night > 0.05;
  if (!mesh.visible) return;
  kinds.butterflies.spots.forEach((spot, s) => {
    if (distXZ(player.pos, spot.x, spot.z) > ACTIVE_RANGE) return;
    for (let i = 0; i < FIREFLIES_PER_SPOT; i++) {
      const p = i * 1.7 + s;
      dummy.position.set(
        spot.x + Math.sin(time * 0.3 + p) * 2.6,
        spot.y + 1 + Math.sin(time * 0.7 + p * 2) * 0.7,
        spot.z + Math.cos(time * 0.25 + p * 1.3) * 2.6,
      );
      const blink = Math.max(0, Math.sin(time * 2 + p * 3));
      dummy.scale.setScalar((0.3 + blink * 0.9) * daylight.night);
      dummy.updateMatrix();
      mesh.setMatrixAt(s * FIREFLIES_PER_SPOT + i, dummy.matrix);
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
}

export function updateCritters(dt) {
  updateBirds(dt);
  updateButterflies();
  updateFireflies();
  updateFish(dt);
}
