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

// Grow-Grow: magic seeds grow either a climbing vine up a "tree" or a zipline vine
// between two tree tops.
// A tree is {x,z,gh (ground), top, grown} with a collider whose .tree points back at it
// (see bigTree in island 3, kelp pillar in island 4). Walking into it once grown = climb.
export const growers = [];

// a seed at the foot of tree t (on the side facing tx,tz) that grows a vine spiralling up it
export function climbVine(t, tx, tz) {
  const dx = tx - t.x,
    dz = tz - t.z,
    d = Math.hypot(dx, dz),
    ux = dx / d,
    uz = dz / d;
  const sx = t.x + ux * 2.2,
    sz = t.z + uz * 2.2,
    sy = terrainHeight(sx, sz);
  const seed = makeSeed();
  seed.position.set(sx, sy, sz);
  scene.add(seed);
  const vine = new THREE.Group();
  vine.position.set(t.x, t.gh, t.z);
  vine.visible = false;
  vine.scale.y = 0.001;
  scene.add(vine);
  const H = t.top - t.gh,
    a0 = Math.atan2(uz, ux),
    pts = [];
  for (let i = 0; i <= 36; i++) {
    const y = (i / 36) * (H - 0.3),
      r = 1.42 - 0.35 * (y / H),
      a = a0 + Math.sin(i * 0.35) * 0.9;
    pts.push(vec3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  vine.add(
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.11, 5), material(0x3fae4f)),
  );
  for (let i = 2; i < 36; i += 2) {
    const l = mesh(leafGeo, material(i % 4 ? 0x6cd65a : 0x4cc05a), { castShadow: false });
    l.position.copy(pts[i]).multiply(vec3(1.08, 1, 1.08));
    l.rotation.set(rand() * 2, rand() * 6, rand() * 2);
    vine.add(l);
  }
  const g = {
    kind: 'climb',
    t,
    x: sx,
    z: sz,
    y: sy,
    seed,
    vine,
    grown: false,
    growing: false,
    k: 0,
  };
  growers.push(g);
  return g;
}
// a seed on top of tree a that grows a zipline to tree b
export function zipVine(a, b) {
  const dx = b.x - a.x,
    dz = b.z - a.z,
    d = Math.hypot(dx, dz),
    ux = dx / d,
    uz = dz / d;
  const sx = a.x + ux * 2.4,
    sz = a.z + uz * 2.4,
    ex = b.x - ux * 2.4,
    ez = b.z - uz * 2.4;
  for (const [px, pz, py] of [
    [sx, sz, a.top],
    [ex, ez, b.top],
  ]) {
    const pl = mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.9, 6), material(0x6e4a30));
    pl.position.set(px, py + 0.95, pz);
    scene.add(pl);
  }
  const p0 = vec3(sx, a.top + 1.8, sz),
    p2 = vec3(ex, b.top + 1.8, ez),
    p1 = vec3((sx + ex) / 2, Math.min(p0.y, p2.y) - 1.4, (sz + ez) / 2);
  const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
  const geo = new THREE.TubeGeometry(curve, 60, 0.09, 5);
  geo.setDrawRange(0, 0);
  const tube = mesh(geo, material(0x3fae4f));
  scene.add(tube);
  const seed = makeSeed();
  const sdx = a.x + ux * 1.6,
    sdz = a.z + uz * 1.6;
  seed.position.set(sdx, a.top, sdz);
  scene.add(seed);
  const g = {
    kind: 'zip',
    a,
    b,
    x: sdx,
    z: sdz,
    y: a.top,
    seed,
    tube,
    geo,
    curve,
    len: curve.getLength(),
    end: vec3(b.x - ux * 1.3, b.top, b.z - uz * 1.3),
    grown: false,
    growing: false,
    k: 0,
  };
  growers.push(g);
  return g;
}

export function vineAction(p) {
  for (const g of growers) {
    if (
      !g.grown &&
      !g.growing &&
      player.power === 'grow' &&
      distXZ(p, g.x, g.z) < 1.4 &&
      Math.abs(p.y - g.y) < 1.2
    )
      return { label: 'Grow', fn: () => startGrow(g) };
    if (g.kind === 'zip' && g.grown && distXZ(p, g.x, g.z) < 1.6 && Math.abs(p.y - g.y) < 1.2)
      return { label: 'Zip', fn: () => startZip(g) };
  }
  return null;
}
function startGrow(g) {
  g.growing = true;
  g.k = 0;
  g.seed.visible = false;
  sfx.grow();
  burst(vec3(g.x, g.y + 0.4, g.z), {
    count: 20,
    color: POWERS.grow.col,
    speed: 3,
    up: 3,
    life: 0.8,
    size: 0.9,
  });
}
export function updateGrowers(dt) {
  const T = game.time;
  for (const g of growers) {
    if (!g.grown && !g.growing) {
      g.seed.children[0].position.y = 0.3 + Math.sin(T * 3 + g.x) * 0.06;
      g.seed.children[0].material.emissiveIntensity = 0.4 + 0.4 * Math.sin(T * 4 + g.z);
    }
    if (g.growing) {
      g.k = Math.min(1, g.k + dt / 1.3);
      const e = 1 - Math.pow(1 - g.k, 2);
      if (g.kind === 'climb') {
        g.vine.visible = true;
        g.vine.scale.y = Math.max(0.001, e);
      } else g.geo.setDrawRange(0, Math.floor((g.geo.index.count * e) / 3) * 3);
      if (g.k >= 1) {
        g.growing = false;
        g.grown = true;
        if (g.kind === 'climb') {
          g.t.grown = true;
          toast('The vine grew! Walk into it to climb.', 3000);
        } else toast(`A vine to the next tree! Press ${actionKeyName()} to zip.`, 3000);
      }
    }
  }
}

/* climbing: up/down moves along the trunk, left/right circles it, jump lets go */
export function startClimb(t) {
  player.climb = { t, a: Math.atan2(player.pos.z - t.z, player.pos.x - t.x) };
  player.vel.set(0, 0, 0);
  player.grounded = false;
  sfx.grab();
}
export function updateClimb(dt) {
  const c = player.climb,
    t = c.t;
  let { f, r } = moveAxis();
  f = clamp(f, -1, 1);
  r = clamp(r, -1, 1);
  player.pos.y += f * 3.6 * dt;
  c.a -= r * 1.3 * dt;
  player.gaitPhase += (Math.abs(f) + Math.abs(r) * 0.5) * dt * 9;
  const rad = 1.35 - 0.35 * clamp((player.pos.y - t.gh) / (t.top - t.gh), 0, 1) + 0.5;
  player.pos.x = t.x + Math.cos(c.a) * rad;
  player.pos.z = t.z + Math.sin(c.a) * rad;
  player.yaw = Math.atan2(t.x - player.pos.x, t.z - player.pos.z);
  const gy = terrainHeight(player.pos.x, player.pos.z);
  player.jumpBuffer -= dt;
  if (player.jumpBuffer > 0) {
    player.jumpBuffer = 0;
    player.climb = null;
    player.vel.set(Math.cos(c.a) * 5, 7, Math.sin(c.a) * 5);
    sfx.jump();
    return;
  }
  if (player.pos.y <= gy) {
    player.pos.y = gy;
    if (f < 0) {
      player.climb = null;
      player.pos.x += Math.cos(c.a) * 0.3;
      player.pos.z += Math.sin(c.a) * 0.3;
      player.grounded = true;
    }
  }
  if (player.pos.y >= t.top - 1.1) {
    player.climb = null;
    player.pos.set(t.x + Math.cos(c.a) * 1.7, t.top, t.z + Math.sin(c.a) * 1.7);
    player.vel.set(0, 0, 0);
    player.grounded = true;
    player.squashVel = -4;
    sfx.pop();
    hintOnce('treetop', `Treetop! Another magic seed is up here…`, 3000);
  }
}

/* zipline: ride the curve to the end, no input */
function startZip(g) {
  player.zip = { g, u: 0 };
  player.vel.set(0, 0, 0);
  player.grounded = false;
  sfx.zip();
}
export function updateZip(dt) {
  const z = player.zip,
    g = z.g;
  z.u = Math.min(1, z.u + (11 / g.len) * dt);
  const pt = g.curve.getPointAt(z.u),
    tg = g.curve.getTangentAt(z.u);
  player.pos.set(pt.x, pt.y - 1.55, pt.z);
  player.yaw = Math.atan2(tg.x, tg.z);
  if (Math.random() < dt * 20)
    burst(pt.clone(), {
      count: 1,
      color: POWERS.grow.col,
      speed: 1,
      up: 0,
      life: 0.4,
      size: 0.6,
      gravity: 0.2,
    });
  if (z.u >= 1) {
    player.zip = null;
    player.pos.copy(g.end);
    player.vel.set(0, 0, 0);
    player.grounded = false;
    player.squashVel = -4;
    burst(player.pos.clone(), {
      count: 10,
      color: POWERS.grow.col,
      speed: 2.5,
      up: 1.5,
      life: 0.5,
      size: 0.8,
    });
  }
}
