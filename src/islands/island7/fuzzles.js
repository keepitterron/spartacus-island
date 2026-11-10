// The Fuzzles: the funfair's tiny fluffy folk in party hats, and Pip, their ringmaster. They
// hop about near their spots, turn to watch Spartacus, scoot out from under his paws, squeak
// and jump when he woofs, and fly up giggling when a giant dog stomps or barks (they love it:
// nobody at this fair is ever scared). For the fireworks they gather in front of the stand.
// All of them are drawn with four instanced meshes (body, eyes, feet, hat).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lerpAngle, seededRandom, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { textSprite, onFontsReady } from '../../core/fx.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { player, RADIUS } from '../../player/player.js';

const COLORS = [0xff8fd0, 0xffd84d, 0x7fd8ee, 0xb59cff, 0x9be36c, 0xffa86b];
const GRAVITY = 16;
const WATCH_RANGE = 12; // they turn to look at Spartacus within this
const ROAM = 1.6; // how far from its spot a Fuzzle wanders
// its own random sequence, so the Fuzzles never move the scenery that uses the shared rand()
const fuzzRand = seededRandom(707);

// {home: {x, z}, target: {x, z}, pos, vel, yaw, size, hopIn (seconds to the next hop), squash}
const fuzzles = [];
const crowd = { meshes: [], gathered: false };
// scratch objects for placing the instances
const matrix = new THREE.Matrix4(),
  turn = new THREE.Quaternion(),
  scale = new THREE.Vector3(),
  UP = new THREE.Vector3(0, 1, 0);

// a Fuzzle living at world (x, z)
export function addFuzzle(x, z) {
  fuzzles.push({
    home: { x, z },
    target: { x, z },
    pos: vec3(x, terrainHeight(x, z), z),
    vel: vec3(),
    yaw: fuzzRand() * 6.28,
    size: 0.85 + fuzzRand() * 0.4,
    hopIn: fuzzRand() * 2,
    squash: 1,
    color: COLORS[fuzzles.length % COLORS.length],
  });
}

// a little crowd of `count` round (x, z)
export function addFuzzles(x, z, { count, spread = 3 }) {
  for (let i = 0; i < count; i++) {
    const angle = fuzzRand() * 6.28,
      dist = 0.8 + fuzzRand() * spread;
    addFuzzle(x + Math.cos(angle) * dist, z + Math.sin(angle) * dist);
  }
}

// a left and a right one of something (eyes, feet) as one geometry; make(side) builds one
const pair = (make) => mergeGeometries([-1, 1].map((side) => make(side)));

// once every Fuzzle is added: the four instanced meshes they share
export function finishFuzzles() {
  const body = new THREE.IcosahedronGeometry(0.34, 2);
  body.translate(0, 0.36, 0);
  const eyes = pair((side) =>
    new THREE.SphereGeometry(0.055, 6, 5).translate(side * 0.12, 0.44, 0.3),
  );
  const feet = pair((side) =>
    new THREE.SphereGeometry(0.1, 6, 5).scale(1, 0.6, 1.4).translate(side * 0.14, 0.05, 0.06),
  );
  const hat = new THREE.ConeGeometry(0.14, 0.34, 8);
  hat.rotateZ(0.25).translate(-0.08, 0.82, 0);
  const parts = [
    [body, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), true],
    [eyes, material(0x1c2333), false],
    [feet, material(0xff9a3d), false],
    [hat, new THREE.MeshStandardMaterial({ roughness: 0.6 }), true],
  ];
  const color = new THREE.Color();
  for (const [geometry, mat, coloured] of parts) {
    const instanced = new THREE.InstancedMesh(geometry, mat, fuzzles.length);
    instanced.frustumCulled = false; // they move every frame
    instanced.castShadow = geometry === body;
    if (coloured)
      fuzzles.forEach((fuzzle, i) => {
        // the hat is the next colour along, so it never matches the fluff
        const hue = geometry === body ? fuzzle.color : COLORS[(i + 2) % COLORS.length];
        instanced.setColorAt(i, color.set(hue));
      });
    scene.add(instanced);
    crowd.meshes.push(instanced);
  }
  placeFuzzles();
}

function placeFuzzles() {
  fuzzles.forEach((fuzzle, i) => {
    const tall = fuzzle.size * fuzzle.squash,
      wide = fuzzle.size / Math.sqrt(fuzzle.squash);
    matrix.compose(fuzzle.pos, turn.setFromAxisAngle(UP, fuzzle.yaw), scale.set(wide, tall, wide));
    for (const instanced of crowd.meshes) instanced.setMatrixAt(i, matrix);
  });
  for (const instanced of crowd.meshes) instanced.instanceMatrix.needsUpdate = true;
}

export function updateFuzzles(dt) {
  for (const fuzzle of fuzzles) updateFuzzle(fuzzle, dt);
  placeFuzzles();
}

function updateFuzzle(fuzzle, dt) {
  const { pos, vel } = fuzzle,
    ground = terrainHeight(pos.x, pos.z),
    onGround = pos.y <= ground + 0.001 && vel.y <= 0;
  if (onGround) {
    pos.y = ground;
    vel.set(0, 0, 0);
    fuzzle.hopIn -= dt;
    if (fuzzle.hopIn <= 0) hop(fuzzle);
  } else {
    vel.y -= GRAVITY * dt;
    pos.addScaledVector(vel, dt);
    if (pos.y < ground) pos.y = ground;
  }
  // stretched going up, squashed just after landing
  const wanted = onGround ? 1 : 1 + Math.min(0.35, Math.abs(vel.y) * 0.05);
  fuzzle.squash += (wanted - fuzzle.squash) * Math.min(1, dt * 14);
  moveAside(fuzzle);
  const toPlayer = Math.atan2(player.pos.x - pos.x, player.pos.z - pos.z),
    watching = pos.distanceTo(player.pos) < WATCH_RANGE * Math.max(1, player.size * 0.6);
  if (watching) fuzzle.yaw = lerpAngle(fuzzle.yaw, toPlayer, Math.min(1, dt * 5));
}

// a little hop towards its target (a spot near home, picked again now and then)
function hop(fuzzle) {
  fuzzle.hopIn = crowd.gathered ? 0.2 + fuzzRand() * 0.5 : 0.5 + fuzzRand() * 2.2;
  if (!crowd.gathered && fuzzRand() < 0.3) {
    const angle = fuzzRand() * 6.28;
    fuzzle.target = {
      x: fuzzle.home.x + Math.cos(angle) * ROAM * fuzzRand(),
      z: fuzzle.home.z + Math.sin(angle) * ROAM * fuzzRand(),
    };
  }
  const dx = fuzzle.target.x - fuzzle.pos.x,
    dz = fuzzle.target.z - fuzzle.pos.z,
    dist = Math.hypot(dx, dz),
    // far from where it wants to be (after a giant woof, or gathering for the show): big hops
    stride = Math.min(dist, dist > 4 ? 7 : 1.6);
  fuzzle.vel.set(
    (dx / (dist || 1)) * stride * 2,
    3 + fuzzRand() * 1.5,
    (dz / (dist || 1)) * stride * 2,
  );
  fuzzle.pos.y += 0.01;
  if (dist > 0.3) fuzzle.yaw = Math.atan2(dx, dz);
}

// never under his paws: a Fuzzle too close is nudged out sideways
function moveAside(fuzzle) {
  const reach = RADIUS * player.size + 0.35,
    dx = fuzzle.pos.x - player.pos.x,
    dz = fuzzle.pos.z - player.pos.z,
    dist = Math.hypot(dx, dz);
  if (dist >= reach || Math.abs(fuzzle.pos.y - player.pos.y) > 1.5 * player.size) return;
  fuzzle.pos.x = player.pos.x + (dx / (dist || 1)) * reach;
  fuzzle.pos.z = player.pos.z + (dz / (dist || 1)) * reach;
}

// Fuzzles within `reach` of pos jump `up` and are pushed `away`; returns how many did.
// A woof makes them hop, a giant's stomp or woof sends them flying.
export function exciteFuzzles(pos, { reach, up, away = 0 }) {
  let count = 0;
  for (const fuzzle of fuzzles) {
    const dx = fuzzle.pos.x - pos.x,
      dz = fuzzle.pos.z - pos.z,
      dist = Math.hypot(dx, dz);
    if (dist > reach || Math.abs(fuzzle.pos.y - pos.y) > 6) continue;
    const near = 1 - dist / reach;
    fuzzle.vel.set(
      (dx / (dist || 1)) * away * near,
      up * (0.5 + near * 0.5),
      (dz / (dist || 1)) * away * near,
    );
    fuzzle.pos.y += 0.02;
    fuzzle.hopIn = 0.3 + fuzzRand() * 0.6;
    count += 1;
  }
  if (count) sfx.squeak();
  return count;
}

// for the fireworks: everyone hops over to stand in three rows, the front one centred on (x, z)
export function gatherFuzzles(x, z) {
  crowd.gathered = true;
  fuzzles.forEach((fuzzle, i) => {
    const row = i % 3,
      along = Math.floor(i / 3) - fuzzles.length / 6;
    fuzzle.target = { x: x + along * 1.25 + row * 0.4, z: z + row * 1.3 };
    fuzzle.hopIn = fuzzRand() * 0.8;
  });
}
// the show is over: back to their own spots
export function scatterFuzzles() {
  crowd.gathered = false;
  for (const fuzzle of fuzzles) fuzzle.target = { ...fuzzle.home };
}

/* ---------------- Pip the ringmaster ---------------- */

// A bigger Fuzzle in a top hat, standing on a drum. Returns {pos, update(dt), hop()}.
export function addPip(x, z) {
  const ground = terrainHeight(x, z),
    drumTop = ground + 0.7,
    g = new THREE.Group();
  const drum = mesh(new THREE.CylinderGeometry(1, 1, 0.7, 16), material(0xe8463f), {
    receiveShadow: true,
  });
  drum.position.set(x, ground + 0.35, z);
  scene.add(drum);
  for (const y of [0.04, 0.66]) {
    const hoop = mesh(new THREE.TorusGeometry(1, 0.06, 5, 20), material(0xffd84d), {
      castShadow: false,
    });
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(x, ground + y, z);
    scene.add(hoop);
  }
  addCylinder(x, z, { r: 1, bottom: ground - 1, top: drumTop });
  const fluff = mesh(
    new THREE.IcosahedronGeometry(0.6, 2),
    material(0xb06cff, { roughness: 0.95 }),
  );
  fluff.position.y = 0.62;
  g.add(fluff);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.09, 8, 6), material(0x1c2333), {
      castShadow: false,
    });
    eye.position.set(side * 0.2, 0.76, 0.53);
    g.add(eye);
    const foot = mesh(new THREE.SphereGeometry(0.17, 8, 6), material(0xff9a3d));
    foot.scale.set(1, 0.6, 1.4);
    foot.position.set(side * 0.25, 0.08, 0.1);
    g.add(foot);
  }
  const black = material(0x1c2333);
  const brim = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 14), black);
  brim.position.y = 1.2;
  g.add(brim);
  const hat = mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.6, 14), black);
  hat.position.y = 1.5;
  g.add(hat);
  const band = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.12, 14), material(0xe8463f));
  band.position.y = 1.3;
  g.add(band);
  const bow = mesh(new THREE.BoxGeometry(0.36, 0.14, 0.08), material(0xffd84d), {
    castShadow: false,
  });
  bow.position.set(0, 0.42, 0.56);
  g.add(bow);
  g.position.set(x, drumTop, z);
  scene.add(g);
  const pip = { g, hopTime: 0, name: null };
  onFontsReady(() => {
    pip.name = textSprite('Pip', '#d9b8ff');
    pip.name.scale.set(2.4, 0.6, 1);
    pip.name.position.set(x, drumTop + 2.4, z);
    pip.name.visible = false;
    scene.add(pip.name);
  });
  return {
    pos: vec3(x, drumTop, z),
    hop() {
      pip.hopTime = 0.5;
    },
    // he bobs, turns to watch Spartacus, and his name shows when you're near
    update(dt) {
      const dx = player.pos.x - x,
        dz = player.pos.z - z;
      g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 4));
      pip.hopTime = Math.max(0, pip.hopTime - dt);
      const lift = Math.sin((pip.hopTime / 0.5) * Math.PI) * 0.7,
        bob = Math.abs(Math.sin(game.time * 3)) * 0.08;
      g.position.y = drumTop + lift + bob;
      if (pip.name) pip.name.visible = Math.hypot(dx, dz) < 16;
    },
  };
}
