// Grow-Grow: magic seeds grow either a climbing vine up a "tree" or a zipline vine
// between two tree tops. Also climbing and zipping themselves.
import * as THREE from 'three';
import { clamp, distXZ, rand, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';
import { moveAxis } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { toast, hintOnce, actionKeyName } from '../core/ui.js';
import { terrainHeight } from '../world/terrain.js';
import { leafGeo, makeSeed } from '../models/items.js';
import { player } from '../player/player.js';
import { POWERS } from './powers.js';

// A tree is {x,z,gh (ground height), top, grown} with a collider whose .tree points back at it
// (see bigTree in island 3, kelp pillar in island 4). Walking into it once grown = climb.
// A grower is a seed plus what it grows:
//   {kind:'climb'|'zip', x, z, y (the seed), seed, grown, growing, growth (0..1),
//    climb: t (the tree), vine;  zip: a, b (trees), tube, geo, curve, len, end (landing)}
export const growers = [];
const GROW_TIME = 1.3;
const SPIRAL_STEPS = 36;

// a seed at the foot of tree (on the side facing towardX, towardZ) that grows a vine spiralling up it
export function climbVine(tree, towardX, towardZ) {
  const dx = towardX - tree.x,
    dz = towardZ - tree.z,
    dist = Math.hypot(dx, dz),
    ux = dx / dist,
    uz = dz / dist;
  const seedX = tree.x + ux * 2.2,
    seedZ = tree.z + uz * 2.2,
    seedY = terrainHeight(seedX, seedZ);
  const seed = makeSeed();
  seed.position.set(seedX, seedY, seedZ);
  scene.add(seed);
  // grows by scaling up from the ground
  const vine = new THREE.Group();
  vine.position.set(tree.x, tree.gh, tree.z);
  vine.visible = false;
  vine.scale.y = 0.001;
  scene.add(vine);
  const height = tree.top - tree.gh,
    startAngle = Math.atan2(uz, ux),
    points = [];
  // wiggles around the seed's side, hugging the trunk tighter as it goes up
  for (let i = 0; i <= SPIRAL_STEPS; i++) {
    const y = (i / SPIRAL_STEPS) * (height - 0.3),
      r = 1.42 - 0.35 * (y / height),
      a = startAngle + Math.sin(i * 0.35) * 0.9;
    points.push(vec3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  vine.add(
    mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 60, 0.11, 5),
      material(0x3fae4f),
    ),
  );
  for (let i = 2; i < SPIRAL_STEPS; i += 2) {
    const leaf = mesh(leafGeo, material(i % 4 ? 0x6cd65a : 0x4cc05a), { castShadow: false });
    leaf.position.copy(points[i]).multiply(vec3(1.08, 1, 1.08));
    leaf.rotation.set(rand() * 2, rand() * 6, rand() * 2);
    vine.add(leaf);
  }
  const grower = {
    kind: 'climb',
    t: tree,
    x: seedX,
    z: seedZ,
    y: seedY,
    seed,
    vine,
    grown: false,
    growing: false,
    growth: 0,
  };
  growers.push(grower);
  return grower;
}

// a seed on top of tree a that grows a zipline to tree b
export function zipVine(a, b) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    dist = Math.hypot(dx, dz),
    ux = dx / dist,
    uz = dz / dist;
  const startX = a.x + ux * 2.4,
    startZ = a.z + uz * 2.4,
    endX = b.x - ux * 2.4,
    endZ = b.z - uz * 2.4;
  // a post on each tree top to hang the line from
  for (const [x, z, top] of [
    [startX, startZ, a.top],
    [endX, endZ, b.top],
  ]) {
    const post = mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.9, 6), material(0x6e4a30));
    post.position.set(x, top + 0.95, z);
    scene.add(post);
  }
  // sags 1.4 below the lower post
  const start = vec3(startX, a.top + 1.8, startZ),
    end = vec3(endX, b.top + 1.8, endZ),
    sag = vec3((startX + endX) / 2, Math.min(start.y, end.y) - 1.4, (startZ + endZ) / 2);
  const curve = new THREE.QuadraticBezierCurve3(start, sag, end);
  const geo = new THREE.TubeGeometry(curve, 60, 0.09, 5);
  // hidden until it grows: the draw range is revealed bit by bit
  geo.setDrawRange(0, 0);
  const tube = mesh(geo, material(0x3fae4f));
  scene.add(tube);
  const seed = makeSeed();
  const seedX = a.x + ux * 1.6,
    seedZ = a.z + uz * 1.6;
  seed.position.set(seedX, a.top, seedZ);
  scene.add(seed);
  const grower = {
    kind: 'zip',
    a,
    b,
    x: seedX,
    z: seedZ,
    y: a.top,
    seed,
    tube,
    geo,
    curve,
    len: curve.getLength(),
    end: vec3(b.x - ux * 1.3, b.top, b.z - uz * 1.3),
    grown: false,
    growing: false,
    growth: 0,
  };
  growers.push(grower);
  return grower;
}

export function vineAction(pos) {
  for (const grower of growers) {
    const heightOk = Math.abs(pos.y - grower.y) < 1.2;
    if (
      !grower.grown &&
      !grower.growing &&
      player.power === 'grow' &&
      distXZ(pos, grower.x, grower.z) < 1.4 &&
      heightOk
    )
      return { label: 'Grow', run: () => startGrow(grower) };
    if (grower.kind === 'zip' && grower.grown && distXZ(pos, grower.x, grower.z) < 1.6 && heightOk)
      return { label: 'Zip', run: () => startZip(grower) };
  }
  return null;
}

function startGrow(grower) {
  grower.growing = true;
  grower.growth = 0;
  grower.seed.visible = false;
  sfx.grow();
  burst(vec3(grower.x, grower.y + 0.4, grower.z), {
    count: 20,
    color: POWERS.grow.sparkleColors,
    speed: 3,
    up: 3,
    life: 0.8,
    size: 0.9,
  });
}

export function updateGrowers(dt) {
  const time = game.time;
  for (const grower of growers) {
    if (!grower.grown && !grower.growing) pulseSeed(grower, time);
    if (grower.growing) grow(grower, dt);
  }
}

// an unplanted seed bobs and glows
function pulseSeed(grower, time) {
  const ball = grower.seed.children[0];
  ball.position.y = 0.3 + Math.sin(time * 3 + grower.x) * 0.06;
  ball.material.emissiveIntensity = 0.4 + 0.4 * Math.sin(time * 4 + grower.z);
}

function grow(grower, dt) {
  grower.growth = Math.min(1, grower.growth + dt / GROW_TIME);
  const eased = 1 - Math.pow(1 - grower.growth, 2);
  if (grower.kind === 'climb') {
    grower.vine.visible = true;
    grower.vine.scale.y = Math.max(0.001, eased);
  } else {
    // whole triangles only (index count is a multiple of 3)
    grower.geo.setDrawRange(0, Math.floor((grower.geo.index.count * eased) / 3) * 3);
  }
  if (grower.growth < 1) return;
  grower.growing = false;
  grower.grown = true;
  if (grower.kind === 'climb') {
    grower.t.grown = true;
    toast('The vine grew! Walk into it to climb.', 3000);
  } else toast(`A vine to the next tree! Press ${actionKeyName()} to zip.`, 3000);
}

/* climbing: up/down moves along the trunk, left/right circles it, jump lets go */
export function startClimb(tree) {
  player.climb = { tree, angle: Math.atan2(player.pos.z - tree.z, player.pos.x - tree.x) };
  player.vel.set(0, 0, 0);
  player.grounded = false;
  sfx.grab();
}

export function updateClimb(dt) {
  const climb = player.climb,
    tree = climb.tree;
  let { f: up, r: around } = moveAxis();
  up = clamp(up, -1, 1);
  around = clamp(around, -1, 1);
  player.pos.y += up * 3.6 * dt;
  climb.angle -= around * 1.3 * dt;
  player.gaitPhase += (Math.abs(up) + Math.abs(around) * 0.5) * dt * 9;
  // the trunk tapers, so hug it a little tighter higher up
  const radius = 1.35 - 0.35 * clamp((player.pos.y - tree.gh) / (tree.top - tree.gh), 0, 1) + 0.5;
  player.pos.x = tree.x + Math.cos(climb.angle) * radius;
  player.pos.z = tree.z + Math.sin(climb.angle) * radius;
  player.yaw = Math.atan2(tree.x - player.pos.x, tree.z - player.pos.z);
  const groundY = terrainHeight(player.pos.x, player.pos.z);
  player.jumpBuffer -= dt;
  if (player.jumpBuffer > 0) {
    // jump off, away from the trunk
    player.jumpBuffer = 0;
    player.climb = null;
    player.vel.set(Math.cos(climb.angle) * 5, 7, Math.sin(climb.angle) * 5);
    sfx.jump();
    return;
  }
  if (player.pos.y <= groundY) {
    player.pos.y = groundY;
    // climbed back down to the ground: step off
    if (up < 0) {
      player.climb = null;
      player.pos.x += Math.cos(climb.angle) * 0.3;
      player.pos.z += Math.sin(climb.angle) * 0.3;
      player.grounded = true;
    }
  }
  if (player.pos.y >= tree.top - 1.1) climbOntoTop(tree, climb.angle);
}

function climbOntoTop(tree, angle) {
  player.climb = null;
  player.pos.set(tree.x + Math.cos(angle) * 1.7, tree.top, tree.z + Math.sin(angle) * 1.7);
  player.vel.set(0, 0, 0);
  player.grounded = true;
  player.squashVel = -4;
  sfx.pop();
  hintOnce('treetop', `Treetop! Another magic seed is up here…`, 3000);
}

/* zipline: ride the curve to the end, no input */
function startZip(grower) {
  player.zip = { grower, u: 0 };
  player.vel.set(0, 0, 0);
  player.grounded = false;
  sfx.zip();
}

// u is the 0..1 position along the curve; rides at 11 units/s, hanging 1.55 below the line
export function updateZip(dt) {
  const zip = player.zip,
    grower = zip.grower;
  zip.u = Math.min(1, zip.u + (11 / grower.len) * dt);
  const point = grower.curve.getPointAt(zip.u),
    tangent = grower.curve.getTangentAt(zip.u);
  player.pos.set(point.x, point.y - 1.55, point.z);
  player.yaw = Math.atan2(tangent.x, tangent.z);
  if (Math.random() < dt * 20)
    burst(point.clone(), {
      count: 1,
      color: POWERS.grow.sparkleColors,
      speed: 1,
      up: 0,
      life: 0.4,
      size: 0.6,
      gravity: 0.2,
    });
  if (zip.u < 1) return;
  player.zip = null;
  player.pos.copy(grower.end);
  player.vel.set(0, 0, 0);
  player.grounded = false;
  player.squashVel = -4;
  burst(player.pos.clone(), {
    count: 10,
    color: POWERS.grow.sparkleColors,
    speed: 2.5,
    up: 1.5,
    life: 0.5,
    size: 0.8,
  });
}
