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
// crab: {g, inner, x, z, y, state, t, slot, found}; slot = place in the parade (0 = first found)
// state: inClump (inside seaweed, chop it first) | hidden | pop | follow | party
const crabs = [];
export const CRABS_TOTAL = 5;
export const crabCount = () => crabs.filter((c) => c.found).length;
const trail = []; // Spartacus's recent positions, oldest first; the parade walks along it

// a hermit crab model; spots for Eduardo. inner = body/legs (hidden while in the shell)
export function makeCrab(bodyColor, { shellColor, spots = false }) {
  const g = new THREE.Group(),
    inner = new THREE.Group();
  g.add(inner);
  const bodyMat = material(bodyColor),
    shellMat = material(shellColor),
    inkMat = material(0x1c2333);
  const body = mesh(new THREE.SphereGeometry(0.22, 10, 8), bodyMat);
  body.scale.set(1.3, 0.7, 1);
  body.position.set(0, 0.18, 0.15);
  inner.add(body);
  for (const side of [-1, 1]) {
    const stalk = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 4), bodyMat);
    stalk.position.set(side * 0.09, 0.36, 0.28);
    inner.add(stalk);
    const eye = mesh(new THREE.SphereGeometry(0.05, 6, 5), inkMat, { castShadow: false });
    eye.position.set(side * 0.09, 0.48, 0.28);
    inner.add(eye);
    const claw = mesh(new THREE.SphereGeometry(0.11, 7, 5), bodyMat);
    claw.scale.set(1, 0.7, 1.4);
    claw.position.set(side * 0.26, 0.14, 0.38);
    inner.add(claw);
    for (let k = 0; k < 3; k++) {
      const leg = mesh(new THREE.BoxGeometry(0.22, 0.04, 0.04), bodyMat, { castShadow: false });
      leg.position.set(side * 0.28, 0.08, 0.1 - k * 0.12);
      leg.rotation.z = side * -0.5;
      inner.add(leg);
    }
  }
  const shell = mesh(new THREE.ConeGeometry(0.3, 0.6, 8), shellMat);
  shell.rotation.x = -Math.PI / 2 + 0.5;
  shell.position.set(0, 0.3, -0.12);
  g.add(shell);
  const rim = mesh(new THREE.TorusGeometry(0.2, 0.06, 5, 10), shellMat);
  rim.position.set(0, 0.3, -0.05);
  rim.rotation.y = Math.PI / 2;
  g.add(rim);
  if (spots)
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4,
        spot = mesh(new THREE.SphereGeometry(0.045, 5, 4), inkMat, { castShadow: false });
      // the first 5 spots go on the body, the rest on the shell
      if (k < 5) {
        spot.position.set(
          Math.cos(a) * 0.24,
          0.22 + Math.sin(a * 1.7) * 0.04,
          0.15 + Math.sin(a) * 0.17,
        );
        inner.add(spot);
      } else {
        spot.position.set(Math.cos(a) * 0.16, 0.34 + (k - 5) * 0.03, -0.1 - (k - 5) * 0.06);
        g.add(spot);
      }
    }
  return { g, inner };
}

// inClump: a seaweed clump that hides it (chop to reveal)
export function addCrab(x, z, { y, inClump }) {
  const { g, inner } = makeCrab(0xf2545b, { shellColor: 0xf3d9a4 });
  g.position.set(x, y, z);
  g.rotation.y = rand() * 6;
  scene.add(g);
  inner.visible = false;
  const crab = {
    g,
    inner,
    x,
    z,
    y,
    state: inClump ? 'inClump' : 'hidden',
    t: 0,
    slot: 0,
    found: false,
  };
  if (inClump) {
    g.visible = false;
    inClump.crab = crab;
  }
  crabs.push(crab);
  return crab;
}

function popCrab(c) {
  c.state = 'pop';
  c.t = 0;
  c.inner.visible = true;
  c.found = true;
  const found = crabCount();
  c.slot = found - 1;
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
  if (found >= CRABS_TOTAL) {
    toast('All the red hermit crabs found! Look at that parade!', 3200);
    completeTask('crabs');
  } else {
    toast(`A red hermit crab! ${found} of ${CRABS_TOTAL}`, 1800);
    renderTasks();
  }
}

// pops every hidden crab within `reach` of p (and roughly at the same height)
function findHiddenCrabs(p, { reach, maxDy }) {
  for (const c of crabs)
    if (
      c.state === 'hidden' &&
      distXZ(p, c.g.position.x, c.g.position.z) < reach &&
      Math.abs(p.y - c.y) < maxDy
    )
      popCrab(c);
}
// barking finds hidden crabs a little further away than walking up
export const barkCrabs = (p) => findHiddenCrabs(p, { reach: 5, maxDy: 2 });
export const touchCrabs = (p) => findHiddenCrabs(p, { reach: 2.2, maxDy: 1.6 });

export const crabNear = (p, r) =>
  crabs.some((c) => (c.state === 'hidden' || c.state === 'inClump') && distXZ(p, c.x, c.z) < r);

export function crabsParty() {
  for (const c of crabs) if (c.state === 'follow' || c.state === 'pop') c.state = 'party';
}

// the bubbles that give a hiding crab away
function blowBubbles(pos) {
  burst(pos, {
    count: 2,
    color: [0xffffff, 0xdff9ff],
    speed: 0.4,
    up: 3,
    life: 2.6,
    size: 0.9,
    gravity: -0.12,
  });
}

// walk along Spartacus's trail, 3 trail points further back per parade slot
function followTrail(c, { dt, T }) {
  const idx = trail.length - 1 - (c.slot + 1) * 3,
    target = trail[Math.max(0, idx)] || player.pos;
  const oldX = c.g.position.x,
    oldZ = c.g.position.z;
  c.g.position.lerp(target, 1 - Math.exp(-dt * 7));
  const mx = c.g.position.x - oldX,
    mz = c.g.position.z - oldZ;
  if (Math.hypot(mx, mz) > 0.005)
    c.g.rotation.y = lerpAngle(c.g.rotation.y, Math.atan2(mx, mz), Math.min(1, dt * 10));
  c.inner.position.y = Math.abs(Math.sin(T * 12 + c.slot)) * 0.04;
}

// dance in a ring round the ship, evenly spaced by parade slot
function partyRoundShip(c, T) {
  const a = T * 0.6 + (c.slot * 6.283) / CRABS_TOTAL,
    x = ship.position.x + Math.cos(a) * 5.5,
    z = ship.position.z + Math.sin(a) * 5.5;
  c.g.position.set(x, terrainHeight(x, z) + Math.abs(Math.sin(T * 6 + c.slot)) * 0.5, z);
  c.g.rotation.y = -a;
}

export function updateCrabs(dt) {
  const T = game.time;
  // drop a breadcrumb every 0.45 units Spartacus moves, keeping the last 90
  if (isPlaying() && (!trail.length || trail.at(-1).distanceTo(player.pos) > 0.45)) {
    trail.push(player.pos.clone());
    if (trail.length > 90) trail.shift();
  }
  for (const c of crabs) {
    c.t += dt;
    switch (c.state) {
      case 'inClump':
        if (Math.random() < dt * 2.5) blowBubbles(vec3(c.x, c.y + 0.8, c.z));
        break;
      case 'hidden':
        // the shell jiggles now and then
        c.g.position.y = c.y + Math.abs(Math.sin(T * 2 + c.x)) * 0.03;
        c.g.rotation.z = Math.sin(T * 9 + c.x) * (Math.sin(T * 1.3 + c.x) > 0.5 ? 0.18 : 0);
        if (Math.random() < dt * 2.5) blowBubbles(c.g.position.clone().add(vec3(0, 0.4, 0)));
        break;
      case 'pop':
        c.g.position.y = c.y + Math.sin(Math.min(1, c.t / 0.5) * Math.PI) * 0.8;
        if (c.t > 0.6) c.state = 'follow';
        break;
      case 'follow':
        followTrail(c, { dt, T });
        break;
      case 'party':
        partyRoundShip(c, T);
        break;
    }
  }
}
