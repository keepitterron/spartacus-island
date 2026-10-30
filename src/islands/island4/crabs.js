import * as THREE from 'three';
import { lerpAngle, distXZ, rand, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game, isPlaying } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast } from '../../core/ui.js';
import { terrainHeight } from '../../world/terrain.js';
import { ship } from '../../world/ship.js';
import { player } from '../../player/player.js';
import { completeTask, renderTasks } from '../../game/tasks.js';

// The red hermit crabs. Hidden ones blow bubbles; walk up or bark to find them, then
// they parade behind Spartacus (following his trail) and party round the ship at the end.
// state: inClump (inside seaweed, chop it first) | hidden | pop | follow | party
export const crabs = [];
export const CRABS_TOTAL = 5;
export const crabCount = () => crabs.filter((c) => c.found).length;
const trail = [];

// a hermit crab model; spots=true for Eduardo. inner = body/legs (hidden while in the shell)
export function makeCrab(body, shell, spots) {
  const g = new THREE.Group(),
    inner = new THREE.Group();
  g.add(inner);
  const B = material(body),
    S = material(shell),
    I = material(0x1c2333);
  const bd = mesh(new THREE.SphereGeometry(0.22, 10, 8), B);
  bd.scale.set(1.3, 0.7, 1);
  bd.position.set(0, 0.18, 0.15);
  inner.add(bd);
  for (const sd of [-1, 1]) {
    const st = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 4), B);
    st.position.set(sd * 0.09, 0.36, 0.28);
    inner.add(st);
    const e = mesh(new THREE.SphereGeometry(0.05, 6, 5), I, { castShadow: false });
    e.position.set(sd * 0.09, 0.48, 0.28);
    inner.add(e);
    const cl = mesh(new THREE.SphereGeometry(0.11, 7, 5), B);
    cl.scale.set(1, 0.7, 1.4);
    cl.position.set(sd * 0.26, 0.14, 0.38);
    inner.add(cl);
    for (let k = 0; k < 3; k++) {
      const l = mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), B, { castShadow: false });
      l.position.set(sd * 0.28, 0.08, 0.1 - k * 0.12);
      l.rotation.z = sd * -0.5;
      inner.add(l);
    }
  }
  const sh = mesh(new THREE.ConeGeometry(0.3, 0.6, 8), S);
  sh.rotation.x = -Math.PI / 2 + 0.5;
  sh.position.set(0, 0.3, -0.12);
  g.add(sh);
  const sw = mesh(new THREE.TorusGeometry(0.2, 0.06, 5, 10), S);
  sw.position.set(0, 0.3, -0.05);
  sw.rotation.y = Math.PI / 2;
  g.add(sw);
  if (spots)
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4,
        d = mesh(new THREE.SphereGeometry(0.045, 5, 4), I, { castShadow: false });
      if (k < 5)
        d.position.set(
          Math.cos(a) * 0.24,
          0.22 + Math.sin(a * 1.7) * 0.04,
          0.15 + Math.sin(a) * 0.17,
        );
      else d.position.set(Math.cos(a) * 0.16, 0.34 + (k - 5) * 0.03, -0.1 - (k - 5) * 0.06);
      (k < 5 ? inner : g).add(d);
    }
  return { g, inner };
}
// inClump: a seaweed clump that hides it (chop to reveal)
export function addCrab(x, z, { y, inClump }) {
  const c = makeCrab(0xf2545b, 0xf3d9a4, false);
  c.g.position.set(x, y, z);
  c.g.rotation.y = rand() * 6;
  scene.add(c.g);
  c.inner.visible = false;
  const cr = {
    g: c.g,
    inner: c.inner,
    x,
    z,
    y,
    state: inClump ? 'inClump' : 'hidden',
    t: 0,
    j: 0,
    found: false,
  };
  if (inClump) {
    c.g.visible = false;
    inClump.crab = cr;
  }
  crabs.push(cr);
  return cr;
}
export function popCrab(c) {
  c.state = 'pop';
  c.t = 0;
  c.inner.visible = true;
  c.found = true;
  const n = crabCount();
  c.j = n - 1;
  sfx.bone();
  burst(c.g.position.clone().add(vec3(0, 0.5, 0)), {
    count: 12,
    color: [0xf2545b, 0xffffff],
    speed: 3,
    up: 2,
    life: 0.6,
    size: 0.8,
    gravity: -0.05,
  });
  if (n >= CRABS_TOTAL) {
    toast('All the red hermit crabs found! Look at that parade!', 3200);
    completeTask('crabs');
  } else {
    toast(`A red hermit crab! ${n} of ${CRABS_TOTAL}`, 1800);
    renderTasks();
  }
}
// barking finds hidden crabs a little further away than walking up
export function barkCrabs(p) {
  for (const c of crabs)
    if (
      c.state === 'hidden' &&
      distXZ(p, c.g.position.x, c.g.position.z) < 5 &&
      Math.abs(p.y - c.y) < 2
    )
      popCrab(c);
}
export function touchCrabs(p) {
  for (const c of crabs)
    if (
      c.state === 'hidden' &&
      distXZ(p, c.g.position.x, c.g.position.z) < 2.2 &&
      Math.abs(p.y - c.y) < 1.6
    )
      popCrab(c);
}
export const crabNear = (p, r) =>
  crabs.some((c) => (c.state === 'hidden' || c.state === 'inClump') && distXZ(p, c.x, c.z) < r);
export function crabsParty() {
  for (const c of crabs) if (c.state === 'follow' || c.state === 'pop') c.state = 'party';
}

export function updateCrabs(dt) {
  const T = game.time;
  if (isPlaying() && (!trail.length || trail[trail.length - 1].distanceTo(player.pos) > 0.45)) {
    trail.push(player.pos.clone());
    if (trail.length > 90) trail.shift();
  }
  for (const c of crabs) {
    c.t += dt;
    if (c.state === 'inClump') {
      if (Math.random() < dt * 2.5)
        burst(vec3(c.x, c.y + 0.8, c.z), {
          count: 2,
          color: [0xffffff, 0xdff9ff],
          speed: 0.4,
          up: 3,
          life: 2.6,
          size: 0.9,
          gravity: -0.12,
        });
    } else if (c.state === 'hidden') {
      c.g.position.y = c.y + Math.abs(Math.sin(T * 2 + c.x)) * 0.03;
      c.g.rotation.z = Math.sin(T * 9 + c.x) * (Math.sin(T * 1.3 + c.x) > 0.5 ? 0.18 : 0);
      if (Math.random() < dt * 2.5)
        burst(c.g.position.clone().add(vec3(0, 0.4, 0)), {
          count: 2,
          color: [0xffffff, 0xdff9ff],
          speed: 0.4,
          up: 3,
          life: 2.6,
          size: 0.9,
          gravity: -0.12,
        });
    } else if (c.state === 'pop') {
      c.g.position.y = c.y + Math.sin(Math.min(1, c.t / 0.5) * Math.PI) * 0.8;
      if (c.t > 0.6) c.state = 'follow';
    } else if (c.state === 'follow') {
      const idx = trail.length - 1 - (c.j + 1) * 3,
        tp = trail[Math.max(0, idx)] || player.pos;
      const ox = c.g.position.x,
        oz = c.g.position.z;
      c.g.position.lerp(tp, 1 - Math.exp(-dt * 7));
      const mx = c.g.position.x - ox,
        mz = c.g.position.z - oz;
      if (Math.hypot(mx, mz) > 0.005)
        c.g.rotation.y = lerpAngle(c.g.rotation.y, Math.atan2(mx, mz), Math.min(1, dt * 10));
      c.inner.position.y = Math.abs(Math.sin(T * 12 + c.j)) * 0.04;
    } else if (c.state === 'party') {
      const a = T * 0.6 + (c.j * 6.283) / CRABS_TOTAL;
      c.g.position.set(
        ship.position.x + Math.cos(a) * 5.5,
        terrainHeight(ship.position.x + Math.cos(a) * 5.5, ship.position.z + Math.sin(a) * 5.5) +
          Math.abs(Math.sin(T * 6 + c.j)) * 0.5,
        ship.position.z + Math.sin(a) * 5.5,
      );
      c.g.rotation.y = -a;
    }
  }
}
