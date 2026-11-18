// Ambient life: bird flocks on the beaches that scatter when Spartacus runs at them or barks
// and land again later, single birds perched up high (one may come and sit on his hat if he
// keeps still), butterflies dancing over the flowers (fireflies there at night), fish schools
// underwater that dart away from a bark, fish leaping out of the sea, and frogs (frogs.js).
// No puzzles, just a world that notices you. Islands list spots as data (or level markers),
// island-local:
//   critters: { birds: [[x, z], …], perches: [[x, z, y], …], butterflies: [[x, z], …],
//               fish: [[x, z, height], …], leaps: [[x, z], …], frogs: [[x, z], …] }
// Every kind is drawn with a few InstancedMeshes, so they cost a handful of draw calls in total.
import * as THREE from 'three';
import { distXZ, lerp, smoothstep, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { hintOnce } from '../core/ui.js';
import { supportHeight } from '../core/colliders.js';
import { player } from '../player/player.js';
import { dog } from '../player/dog.js';
import { terrainHeight } from '../world/terrain.js';
import { buildFrogs, updateFrogs, barkAtFrogs } from './frogs.js';
import { daylight } from '../world/daylight.js';

const ACTIVE_RANGE = 80; // flocks further away than this aren't animated
const BIRDS_PER_FLOCK = 6;
const BUTTERFLIES_PER_SPOT = 3;
const FISH_PER_SCHOOL = 8;
const FIREFLIES_PER_SPOT = 5;
const FLY_TIME = 7; // seconds a scared flock stays up before landing again
const PERCH_SHY = 2.5; // m: a perched bird flies off when Spartacus gets this close, even walking
const HAT_WAIT = 5; // s Spartacus has to keep still before a perched bird comes to his hat
const HAT_REACH = 15; // m: how far a perched bird will fly to his hat
const HAT_FLIGHT = 1.5; // s to the hat or back
const LEAP_RANGE = 35; // m: leaping fish only jump while Spartacus is this close
const LEAP_TIME = 0.9; // s in the air
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
  birds: { flocks: [], meshes: null, rig: makeRig(1.8), count: 0 },
  butterflies: { spots: [], meshes: null, rig: makeRig(1.3) },
  fish: { schools: [], mesh: null, dummy: new THREE.Object3D() },
  fireflies: { mesh: null, dummy: new THREE.Object3D() },
  leaps: { spots: [], mesh: null, dummy: new THREE.Object3D() },
};
// a perched bird visiting Spartacus's hat: {flock} while one is on its way, sitting or going back
const hatVisit = { flock: null, still: 0, headParts: null };

export function buildCritters() {
  for (const island of Object.values(game.islands)) {
    const {
      birds = [],
      perches = [],
      butterflies = [],
      fish = [],
      leaps = [],
    } = island.critters || {};
    const world = ([x, z]) => ({ x: island.center.x + x, z: island.center.z + z });
    for (const spot of birds) addFlock(world(spot));
    for (const spot of perches) addFlock(world(spot), { count: 1, y: spot[2] });
    for (const spot of leaps) kinds.leaps.spots.push(makeLeapSpot(world(spot)));
    for (const spot of butterflies) kinds.butterflies.spots.push(makeButterflies(world(spot)));
    for (const spot of fish) kinds.fish.schools.push(makeSchool({ ...world(spot), y: spot[2] }));
  }
  buildBirdMeshes();
  buildButterflyMeshes();
  buildFishMesh();
  buildFireflyMesh();
  buildLeapMesh();
  buildFrogs(Object.values(game.islands));
  // what his head carries when nothing's riding on the hat (Eduardo rides there on islands 4-5)
  hatVisit.headParts = new Set(dog.head.children);
}

/* ---------- birds ---------- */
// a flock on the ground, or (y given) one bird perched up there: on a mast, a post, a roof
function addFlock({ x, z }, { count = BIRDS_PER_FLOCK, y = null } = {}) {
  const perch = y !== null;
  // a perch snaps down onto whatever is just under it (a signpost's top is built late)
  const perchY = perch ? Math.max(supportHeight(x, z, y + 0.5), y - 0.6) : 0;
  const birds = [];
  for (let i = 0; i < count; i++) {
    const bx = perch ? x : x + (Math.random() - 0.5) * 3,
      bz = perch ? z : z + (Math.random() - 0.5) * 3;
    birds.push({
      x: bx,
      z: bz,
      y: perch ? perchY : supportHeight(bx, bz, Infinity),
      yaw: Math.random() * 6.3,
      phase: Math.random() * 6.3,
    });
  }
  // state: ground | flying | toHat | onHat | fromHat; t: seconds in that state;
  // away: direction they fled in; first: the first bird's instance; from: where a hat flight began
  const flock = { x, z, birds, perch, state: 'ground', t: 0, away: 0, first: kinds.birds.count };
  flock.from = vec3();
  kinds.birds.count += count;
  kinds.birds.flocks.push(flock);
}

function buildBirdMeshes() {
  const count = Math.max(1, kinds.birds.count);
  const bodyGeo = new THREE.SphereGeometry(0.13, 6, 5);
  bodyGeo.scale(0.9, 0.8, 1.5);
  const wingGeo = new THREE.BoxGeometry(0.28, 0.02, 0.16);
  kinds.birds.meshes = {
    body: instanced(bodyGeo, { color: 0xffffff, count }),
    left: instanced(wingGeo, { color: 0x9aa6b8, count }),
    right: instanced(wingGeo, { color: 0x9aa6b8, count }),
  };
}

// running at a flock (or ground-pounding near it) scares it; so does a bark. A perched bird
// also goes if he comes right up to it (climbing the mast, jumping onto the post).
function scaresFlock(flock) {
  const dist = distXZ(player.pos, flock.x, flock.z);
  const fast = player.sprinting || player.pounding || Math.hypot(player.vel.x, player.vel.z) > 5;
  const reached =
    flock.perch && dist < PERCH_SHY && Math.abs(player.pos.y - flock.birds[0].y) < 2.5;
  return (dist < 4.5 && fast) || reached;
}

export function barkAtCritters(pos) {
  for (const flock of kinds.birds.flocks)
    if (distXZ(pos, flock.x, flock.z) < 10) scatterFlock(flock);
  // a bird on his hat hops off home: a woof right under it is a bit much
  if (hatVisit.flock) leaveHat(hatVisit.flock);
  barkAtFrogs(pos);
  for (const school of kinds.fish.schools)
    if (distXZ(pos, school.x, school.z) < 9) school.scared = 3;
}

function scatterFlock(flock) {
  if (flock.state !== 'ground') return;
  flock.state = 'flying';
  flock.t = 0;
  flock.away = Math.atan2(flock.x - player.pos.x, flock.z - player.pos.z);
  sfx.flutter();
}

function updateBirds(dt) {
  const { flocks, meshes, rig } = kinds.birds;
  updateHatVisit(dt);
  for (const flock of flocks) {
    if (distXZ(player.pos, flock.x, flock.z) > ACTIVE_RANGE && !hatBound(flock)) continue;
    flock.t += dt;
    if (flock.state === 'ground' && scaresFlock(flock)) scatterFlock(flock);
    if (flock.state === 'flying' && flock.t > FLY_TIME + 2) flock.state = 'ground';
    flock.birds.forEach((bird, b) => {
      if (hatBound(flock)) poseHatBird(bird, flock, rig);
      else poseBird(bird, flock, rig);
      // sitting, the wings fold down along the body
      const sitting = flock.state === 'ground' || flock.state === 'onHat';
      const flap = sitting ? -1.3 : Math.sin(game.time * 28 + bird.phase) * 0.9;
      storeRig(rig, { meshes, i: flock.first + b, flap });
    });
  }
  for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true;
}

// on the ground they peck and hop; flying, they swirl up and away, then glide back down
function poseBird(bird, flock, rig) {
  const time = game.time,
    body = rig.body;
  if (flock.state === 'ground' && flock.perch) {
    // perched up high: sits still and looks about
    body.position.set(bird.x, bird.y + 0.2, bird.z);
    body.rotation.set(0, bird.yaw + Math.sin(time * 0.7 + bird.phase) * 0.8, 0);
    return;
  }
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

/* ---------- a perched bird visits the hat ---------- */
const hatBound = (flock) => ['toHat', 'onHat', 'fromHat'].includes(flock.state);
const hatFree = () =>
  dog.hat.parent === dog.head && dog.head.children.every((part) => hatVisit.headParts.has(part));
// the top of his hat, in the world
const hatTop = () => dog.head.localToWorld(vec3(0, 0.62, -0.05));

// Keep still for a while near a perched bird and it comes to sit on the hat; move and it goes home
function updateHatVisit(dt) {
  const still =
    game.state === 'play' &&
    player.grounded &&
    !player.wading &&
    !player.ride &&
    Math.hypot(player.vel.x, player.vel.z) < 0.3;
  hatVisit.still = still ? hatVisit.still + dt : 0;
  const visitor = hatVisit.flock;
  if (visitor) {
    if ((!still || !hatFree()) && visitor.state !== 'fromHat') leaveHat(visitor);
    return;
  }
  if (hatVisit.still < HAT_WAIT || !hatFree()) return;
  const flock = kinds.birds.flocks.find(
    (each) =>
      each.perch && each.state === 'ground' && distXZ(player.pos, each.x, each.z) < HAT_REACH,
  );
  if (!flock) return;
  hatVisit.flock = flock;
  flock.state = 'toHat';
  flock.t = 0;
  flock.from.set(flock.x, flock.birds[0].y + 0.2, flock.z);
}

function leaveHat(flock) {
  if (flock.state === 'fromHat') return;
  // from wherever it is now (on its way, or on the hat)
  flock.from.copy(flock.state === 'onHat' ? hatTop() : kinds.birds.rig.body.position);
  flock.state = 'fromHat';
  flock.t = 0;
  sfx.flutter();
}

// an arc to the hat (or home), then sitting on the hat facing the way he faces
function poseHatBird(bird, flock, rig) {
  const body = rig.body,
    home = vec3(bird.x, bird.y + 0.2, bird.z);
  const k = smoothstep(0, HAT_FLIGHT, flock.t);
  if (flock.state === 'toHat' && k >= 1) {
    flock.state = 'onHat';
    sfx.tweet();
    hintOnce('hatBird', 'Shh… a little bird is resting on Spartacus’s hat!');
  }
  if (flock.state === 'fromHat' && k >= 1) {
    flock.state = 'ground';
    hatVisit.flock = null;
  }
  if (flock.state === 'onHat') {
    const hop = Math.max(0, Math.sin(game.time * 2 + bird.phase)) ** 10 * 0.08;
    body.position.copy(hatTop());
    body.position.y += 0.12 + hop;
    body.rotation.set(0, player.yaw + Math.sin(game.time * 0.9) * 0.7, 0);
    return;
  }
  const from = flock.from,
    to = flock.state === 'toHat' ? hatTop().setY(hatTop().y + 0.12) : home;
  body.position.lerpVectors(from, to, k);
  body.position.y += Math.sin(Math.PI * k) * 1.5;
  body.rotation.set(0, Math.atan2(to.x - from.x, to.z - from.z), 0);
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

/* ---------- fish leaping out of the sea ---------- */
function makeLeapSpot({ x, z }) {
  return {
    x,
    z,
    wait: 1 + Math.random() * 4, // s until the next jump
    t: 0,
    from: vec3(),
    to: vec3(),
    leaping: false,
    color: FISH_COLORS[Math.floor(Math.random() * FISH_COLORS.length)],
  };
}

function buildLeapMesh() {
  const count = Math.max(1, kinds.leaps.spots.length);
  const geometry = new THREE.ConeGeometry(0.16, 0.6, 5);
  geometry.rotateX(Math.PI / 2); // nose along +z
  geometry.scale(0.6, 1, 1);
  const mesh = instanced(geometry, { color: 0xffffff, count });
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  kinds.leaps.spots.forEach((spot, i) => {
    mesh.setColorAt(i, new THREE.Color(spot.color));
    mesh.setMatrixAt(i, hidden);
  });
  kinds.leaps.mesh = mesh;
}

// every few seconds one fish jumps out of the water somewhere near its spot, with a plip
function updateLeaps(dt) {
  const { spots, mesh, dummy } = kinds.leaps;
  spots.forEach((spot, i) => {
    if (!spot.leaping) {
      spot.wait -= dt;
      if (spot.wait > 0 || distXZ(player.pos, spot.x, spot.z) > LEAP_RANGE) return;
      if (!startLeap(spot)) spot.wait = 1;
      return;
    }
    spot.t += dt;
    const k = Math.min(1, spot.t / LEAP_TIME);
    dummy.position.lerpVectors(spot.from, spot.to, k);
    dummy.position.y = -0.2 + Math.sin(Math.PI * k) * 1.4;
    // nose up on the way out, down on the way back in
    dummy.rotation.set(0, Math.atan2(spot.to.x - spot.from.x, spot.to.z - spot.from.z), 0);
    dummy.rotateX(-Math.cos(Math.PI * k) * 1.1);
    dummy.scale.setScalar(1);
    if (k >= 1) {
      spot.leaping = false;
      spot.wait = 3 + Math.random() * 5;
      dummy.scale.setScalar(0);
      leapSplash(spot.to);
    }
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  });
}

// from a random point near the spot, in water deep enough to hide a fish; false if none found
function startLeap(spot) {
  for (let tries = 0; tries < 6; tries++) {
    const angle = Math.random() * 6.3,
      dist = Math.random() * 3;
    const x = spot.x + Math.sin(angle) * dist,
      z = spot.z + Math.cos(angle) * dist;
    const heading = Math.random() * 6.3;
    const toX = x + Math.sin(heading) * 2.2,
      toZ = z + Math.cos(heading) * 2.2;
    if (terrainHeight(x, z) > -0.8 || terrainHeight(toX, toZ) > -0.8) continue;
    spot.from.set(x, 0, z);
    spot.to.set(toX, 0, toZ);
    spot.leaping = true;
    spot.t = 0;
    leapSplash(spot.from);
    return true;
  }
  return false;
}

function leapSplash(pos) {
  burst(vec3(pos.x, 0.05, pos.z), {
    count: 8,
    color: [0xffffff, 0xbfefff],
    speed: 1.8,
    up: 2.5,
    life: 0.5,
    size: 0.6,
  });
  if (distXZ(player.pos, pos.x, pos.z) < 20) sfx.plip();
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
  updateLeaps(dt);
  updateFrogs(dt);
}
