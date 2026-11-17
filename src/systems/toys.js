// Toys: loose crates, barrels and buckets Spartacus can bowl over, moved by the Rapier physics
// engine (real tumbling, stacking and rolling). Only the toys use it: Spartacus keeps his own
// movement (player/player.js) and pushes toys as a moving body they can't push back, and a woof
// or a ground pound shoves them. The ground and the colliders round each toy area are copied into
// Rapier once, as a heightfield and fixed boxes and cylinders.
// Rapier is WebAssembly and loads in its own chunk the first time an island adds a toy area, so
// nothing waits for it at boot. Toys aren't saved: a reload puts them back where they started.
// A toy that falls in the sea bobs for a moment, then pops back where it started.
import * as THREE from 'three';
import { distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { canvasTexture, material, mesh } from '../core/materials.js';
import { game, ownerIsland } from '../core/state.js';
import { burst } from '../core/fx.js';
import { colliders } from '../core/colliders.js';
import { terrainHeight } from '../world/terrain.js';
import { player, RADIUS, BODY_HEIGHT } from '../player/player.js';

const GRAVITY = 22; // a bit floatier than Spartacus's 30, so tumbles are easy to watch
const STEP = 1 / 60; // fixed physics step (s)
const CELL = 0.5; // heightfield spacing, like the level's baked heights
const ACTIVE_RANGE = 45; // m past an area's edge: further away, its toys sleep
const FLOAT_TIME = 2.5; // s bobbing in the sea before popping back home
const SEA = 0; // the water surface

// physics: Rapier, its world and the body standing in for Spartacus, once loaded
const physics = { RAPIER: null, world: null, dog: null, loading: false, carry: 0 };
// {x, z, size, island}: squares where toys live (size: m across)
const areas = [];
// {mesh, kind, size, home: {pos, quat}, body, floatTime, island}
const toys = [];

/* models */

// one canvas texture per look, made the first time it's needed
const looks = {};
const crateLook = (color) =>
  (looks[color] ??= new THREE.MeshStandardMaterial({
    map: canvasTexture(64, 64, (ctx, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(70, 40, 20, 0.55)';
      ctx.lineWidth = 7;
      ctx.strokeRect(3.5, 3.5, w - 7, h - 7);
      ctx.beginPath();
      ctx.moveTo(6, h - 6);
      ctx.lineTo(w - 6, 6);
      ctx.stroke();
    }),
    roughness: 0.9,
  }));

function makeCrate(size, color) {
  return mesh(new THREE.BoxGeometry(size, size, size), crateLook(color), { receiveShadow: true });
}
function makeBarrel(size, color) {
  const g = new THREE.Group();
  const radius = size * 0.38;
  g.add(mesh(new THREE.CylinderGeometry(radius, radius, size, 12), material(color)));
  for (const y of [-0.3, 0.3]) {
    const band = mesh(
      new THREE.CylinderGeometry(radius + 0.015, radius + 0.015, size * 0.08, 12),
      material(0x5a4636),
    );
    band.position.y = y * size;
    g.add(band);
  }
  return g;
}
function makeBucket(size, color) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(size * 0.45, size * 0.34, size, 10), material(color)));
  const handle = mesh(
    new THREE.TorusGeometry(size * 0.4, 0.02, 4, 12, Math.PI),
    material(0x5a4636),
  );
  handle.position.y = size * 0.5;
  g.add(handle);
  return g;
}
const MODELS = { crate: makeCrate, barrel: makeBarrel, bucket: makeBucket };

/* setting up */

// a square, size m across, centred on (x, z), where toys tumble about
export function addToyArea(x, z, { size = 24 } = {}) {
  const area = { x, z, size, island: ownerIsland() };
  areas.push(area);
  if (physics.world) addGround(area);
  else loadPhysics();
}

// A toy at (x, z): kind crate | barrel | bucket, size (m), color; y is its bottom (the ground by
// default), yaw its turn. Sleeping until something bumps it, so a stack stays neat till then.
export function addToy(
  kind,
  { x, z, y = terrainHeight(x, z), size = 0.8, color = '#c48a54', yaw = 0 },
) {
  const model = MODELS[kind](size, color);
  model.position.set(x, y + size / 2, z);
  model.rotation.y = yaw;
  model.traverse((part) => {
    if (part.isMesh) part.castShadow = true;
  });
  scene.add(model);
  const toy = {
    mesh: model,
    kind,
    size,
    home: { pos: model.position.clone(), quat: model.quaternion.clone() },
    body: null,
    floatTime: 0,
    island: ownerIsland(),
  };
  toys.push(toy);
  if (physics.world) addBody(toy);
  return toy;
}

async function loadPhysics() {
  if (physics.loading) return;
  physics.loading = true;
  const { default: RAPIER } = await import('@dimforge/rapier3d-compat');
  await RAPIER.init();
  physics.RAPIER = RAPIER;
  physics.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
  physics.world.timestep = STEP;
  for (const area of areas) addGround(area);
  // Spartacus: a capsule that goes where he goes and pushes toys, but is never pushed back
  physics.dog = physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
  physics.world.createCollider(
    RAPIER.ColliderDesc.capsule(BODY_HEIGHT / 2 - RADIUS * 0.6, RADIUS * 0.9),
    physics.dog,
  );
  for (const toy of toys) addBody(toy);
}

// the ground under an area as a heightfield, and the colliders in it as fixed shapes
function addGround(area) {
  const { RAPIER, world } = physics;
  const cells = Math.ceil(area.size / CELL);
  const half = (cells * CELL) / 2;
  // Rapier wants the heights column by column: rows run along z, columns along x
  const heights = new Float32Array((cells + 1) * (cells + 1));
  for (let column = 0; column <= cells; column++)
    for (let row = 0; row <= cells; row++)
      heights[column * (cells + 1) + row] = terrainHeight(
        area.x - half + column * CELL,
        area.z - half + row * CELL,
      );
  const ground = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(area.x, 0, area.z),
  );
  world.createCollider(
    RAPIER.ColliderDesc.heightfield(cells, cells, heights, { x: half * 2, y: 1, z: half * 2 }),
    ground,
  );
  for (const c of colliders) {
    const reach = half + (c.r ?? Math.max(c.hw, c.hd));
    if (c.top < -100 || Math.abs(c.x - area.x) > reach || Math.abs(c.z - area.z) > reach) continue;
    const halfHeight = (c.top - c.bottom) / 2;
    const shape =
      c.type === 'cyl'
        ? RAPIER.ColliderDesc.cylinder(halfHeight, c.r)
        : RAPIER.ColliderDesc.cuboid(c.hw, halfHeight, c.hd);
    world.createCollider(shape.setTranslation(c.x, c.bottom + halfHeight, c.z));
  }
}

function addBody(toy) {
  const { RAPIER, world } = physics;
  const { pos, quat } = toy.home;
  toy.body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation(quat)
      .setSleeping(true)
      .setLinearDamping(0.15)
      .setAngularDamping(0.4),
  );
  const half = toy.size / 2;
  const shape =
    toy.kind === 'crate'
      ? RAPIER.ColliderDesc.cuboid(half, half, half)
      : RAPIER.ColliderDesc.cylinder(half, toy.size * (toy.kind === 'barrel' ? 0.38 : 0.42));
  world.createCollider(
    shape
      .setDensity(toy.kind === 'crate' ? 0.6 : 0.4)
      .setFriction(0.7)
      .setRestitution(0.15),
    toy.body,
  );
}

/* playing */

// woof / ground pound / Mega-Me stomp: toys within reach get shoved away from pos (and up)
export function shoveToys(pos, { reach, push, up }) {
  for (const toy of toys) {
    if (!toy.body || toy.island !== game.island) continue;
    const at = toy.body.translation();
    const dist = distXZ(at, pos.x, pos.z);
    if (dist > reach) continue;
    const away = vec3(at.x - pos.x, 0, at.z - pos.z).normalize();
    const strength = (1 - dist / reach) * 0.7 + 0.3; // gentler at the edge
    const mass = toy.body.mass();
    toy.body.applyImpulse(
      {
        x: away.x * push * strength * mass,
        y: up * strength * mass,
        z: away.z * push * strength * mass,
      },
      true,
    );
    toy.body.applyTorqueImpulse(
      { x: (Math.random() - 0.5) * mass, y: 0, z: (Math.random() - 0.5) * mass },
      true,
    );
  }
}

// is any toy within reach of p (for hints)
export const toysNear = (p, reach) =>
  toys.some((toy) => toy.island === game.island && distXZ(toy.mesh.position, p.x, p.z) < reach);

const nearAnArea = (p) =>
  areas.some(
    (area) =>
      area.island === game.island && distXZ(p, area.x, area.z) < area.size / 2 + ACTIVE_RANGE,
  );

// per frame: move the dog body, step the world, copy the toys' poses to their models
export function updateToys(dt) {
  const { world, dog } = physics;
  if (!world || !nearAnArea(player.pos)) return;
  physics.carry = Math.min(physics.carry + dt, STEP * 3);
  while (physics.carry >= STEP) {
    physics.carry -= STEP;
    const lift = (BODY_HEIGHT / 2) * player.size;
    dog.setNextKinematicTranslation({ x: player.pos.x, y: player.pos.y + lift, z: player.pos.z });
    world.step();
  }
  for (const toy of toys) if (toy.body && toy.island === game.island) updateToy(toy, dt);
}

function updateToy(toy, dt) {
  const at = toy.body.translation();
  toy.mesh.position.set(at.x, at.y, at.z);
  const turn = toy.body.rotation();
  toy.mesh.quaternion.set(turn.x, turn.y, turn.z, turn.w);
  const inSea = at.y < SEA + 0.1 && terrainHeight(at.x, at.z) < SEA;
  toy.floatTime = inSea ? toy.floatTime + dt : 0;
  if (toy.floatTime > FLOAT_TIME || at.y < -10) sendHome(toy);
}

// back where it started, with sparkles (failing costs seconds, never progress)
function sendHome(toy) {
  const { pos, quat } = toy.home;
  toy.floatTime = 0;
  toy.body.setTranslation(pos, true);
  toy.body.setRotation(quat, true);
  toy.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  toy.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  burst(pos.clone().add(vec3(0, toy.size / 2, 0)), {
    count: 14,
    color: [0xffffff, 0xbfe8ff],
    speed: 3,
    up: 2,
    life: 0.7,
    size: 0.8,
  });
}
