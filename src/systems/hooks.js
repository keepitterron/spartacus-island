// Stretchy: golden hooks on poles between two landing spots a and b ({x,y,z}).
// With the Stretchy power, standing on either end offers "Swing" to the other.
import * as THREE from 'three';
import { clamp, lerpAngle, distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game, isPlaying } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { player } from '../player/player.js';
import { dog } from '../player/dog.js';
import { POWERS } from './powers.js';

// {x, y, z (the ring), a, b (landing spots), ring}
export const hooks = [];
// the ring hangs 3.6 above the higher end, on a pole from the sea floor (y -2)
export function addHook(a, b) {
  const x = (a.x + b.x) / 2,
    z = (a.z + b.z) / 2,
    y = Math.max(a.y, b.y) + 3.6;
  const poleHeight = y - 0.5 + 2;
  const pole = mesh(new THREE.CylinderGeometry(0.09, 0.12, poleHeight, 6), material(0x9ccf6a));
  pole.position.set(x, -2 + poleHeight / 2, z);
  scene.add(pole);
  // bamboo-like joints every 1.6
  for (let k = 1; k < poleHeight / 1.6; k++) {
    const joint = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 6), material(0x7fb456), {
      castShadow: false,
    });
    joint.position.set(x, -2 + k * 1.6, z);
    scene.add(joint);
  }
  const ringMaterial = new THREE.MeshStandardMaterial({
    color: 0xffc83d,
    emissive: 0xff9a00,
    emissiveIntensity: 0.15,
    metalness: 0.4,
    roughness: 0.35,
  });
  const ring = mesh(new THREE.TorusGeometry(0.5, 0.11, 8, 20), ringMaterial);
  ring.position.set(x, y, z);
  scene.add(ring);
  hooks.push({ x, y, z, a, b, ring });
}

// the swing Spartacus could do right now, as {hook, to}, or null.
// Several hooks can start from the same rock: pick the one Spartacus is facing.
export function swingOption() {
  if (!player.canStretch || player.swing) return null;
  let best = null,
    bestScore = -1e9;
  const facingX = Math.sin(player.yaw),
    facingZ = Math.cos(player.yaw);
  for (const hook of hooks)
    for (const [from, to] of [
      [hook.a, hook.b],
      [hook.b, hook.a],
    ]) {
      const dist = distXZ(player.pos, from.x, from.z);
      if (dist >= 2.3 || Math.abs(player.pos.y - from.y) >= 1.6) continue;
      const dx = to.x - player.pos.x,
        dz = to.z - player.pos.z,
        len = Math.hypot(dx, dz) || 1,
        // mostly how much we face the far end; nearer start spots win ties
        score = (dx * facingX + dz * facingZ) / len - dist * 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = { hook, to };
      }
    }
  return best;
}

export function swingAction() {
  const option = swingOption();
  return option ? { label: 'Swing', run: () => startSwing(option) } : null;
}

function startSwing({ hook, to: landing }) {
  const from = player.pos.clone(),
    to = vec3(landing.x, landing.y + 0.05, landing.z);
  player.swing = { hook, from, to, t: 0, duration: clamp(from.distanceTo(to) / 8, 1, 1.7) };
  player.grounded = false;
  player.vel.set(0, 0, 0);
  sfx.stretch();
  burst(vec3(hook.x, hook.y, hook.z), {
    count: 10,
    color: POWERS.stretch.sparkleColors,
    speed: 3,
    up: 1,
    life: 0.5,
    size: 0.8,
    gravity: 0.3,
  });
}

// a quadratic Bézier arc from start to landing, dipping 2.5 under the lower end below the hook
export function updateSwing(dt) {
  const swing = player.swing;
  swing.t += dt;
  const t = clamp(swing.t / swing.duration, 0, 1),
    eased = t * t * (3 - 2 * t);
  const control = vec3(swing.hook.x, Math.min(swing.from.y, swing.to.y) - 2.5, swing.hook.z),
    rest = 1 - eased;
  const { from, to } = swing;
  player.pos.set(
    rest * rest * from.x + 2 * rest * eased * control.x + eased * eased * to.x,
    rest * rest * from.y + 2 * rest * eased * control.y + eased * eased * to.y,
    rest * rest * from.z + 2 * rest * eased * control.z + eased * eased * to.z,
  );
  player.yaw = lerpAngle(
    player.yaw,
    Math.atan2(to.x - from.x, to.z - from.z),
    Math.min(1, dt * 10),
  );
  if (t < 1) return;
  player.swing = null;
  player.vel.set(0, 0, 0);
  player.grounded = false;
  player.squashVel = -4;
  burst(player.pos.clone(), {
    count: 10,
    color: POWERS.stretch.sparkleColors,
    speed: 2.5,
    up: 1.5,
    life: 0.5,
    size: 0.8,
  });
}

// rings spin and the one you'd swing to glows
export function updateHooks(dt) {
  const time = game.time,
    option = isPlaying() ? swingOption() : null;
  for (const hook of hooks) {
    hook.ring.rotation.y += dt * 1.2;
    hook.ring.material.emissiveIntensity = ringGlow(hook, { option, time });
  }
}

function ringGlow(hook, { option, time }) {
  if (option && option.hook === hook) return 0.8 + 0.5 * Math.sin(time * 8);
  return player.canStretch ? 0.3 : 0.12;
}

// the stretchy line from Spartacus's mouth to the hook (a unit cylinder scaled to length)
const lineGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6);
lineGeo.translate(0, 0.5, 0);
const swingLine = new THREE.Mesh(
  lineGeo,
  new THREE.MeshStandardMaterial({ color: 0xff9a3d, roughness: 0.6 }),
);
swingLine.visible = false;
scene.add(swingLine);
export function updateSwingLine() {
  const swing = player.swing;
  // let go just before landing
  if (!swing || swing.t / swing.duration >= 0.85) {
    swingLine.visible = false;
    return;
  }
  const mouth = vec3();
  dog.mouth.getWorldPosition(mouth);
  const toHook = vec3(swing.hook.x, swing.hook.y, swing.hook.z).sub(mouth),
    len = toHook.length();
  swingLine.visible = true;
  swingLine.position.copy(mouth);
  swingLine.quaternion.setFromUnitVectors(vec3(0, 1, 0), toHook.normalize());
  swingLine.scale.set(1, len, 1);
}
