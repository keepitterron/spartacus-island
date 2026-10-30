import * as THREE from 'three';
import { clamp, angLerp, flat, V } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { mat, mesh } from '../core/materials.js';
import { G, playing } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { P } from '../player/player.js';
import { dog } from '../player/dog.js';
import { POWERS } from './powers.js';

// Stretchy: golden hooks on poles between two landing spots a and b ({x,y,z}).
// With the Stretchy power, standing on either end offers "Swing" to the other.
export const hooks = [];
export function addHook(a, b) {
  const x = (a.x + b.x) / 2,
    z = (a.z + b.z) / 2,
    y = Math.max(a.y, b.y) + 3.6;
  const ph = y - 0.5 + 2;
  const pole = mesh(new THREE.CylinderGeometry(0.09, 0.12, ph, 6), mat(0x9ccf6a));
  pole.position.set(x, -2 + ph / 2, z);
  scene.add(pole);
  for (let k = 1; k < ph / 1.6; k++) {
    const n = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 6), mat(0x7fb456), false);
    n.position.set(x, -2 + k * 1.6, z);
    scene.add(n);
  }
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffc83d,
    emissive: 0xff9a00,
    emissiveIntensity: 0.15,
    metalness: 0.4,
    roughness: 0.35,
  });
  const ring = mesh(new THREE.TorusGeometry(0.5, 0.11, 8, 20), ringMat);
  ring.position.set(x, y, z);
  scene.add(ring);
  hooks.push({ x, y, z, a, b, ring });
}
// several hooks can start from the same rock: pick the one Spartacus is facing
export function swingOption() {
  if (!P.stretch || P.swing) return null;
  let best = null,
    bs = -1e9;
  const fx = Math.sin(P.yaw),
    fz = Math.cos(P.yaw);
  for (const h of hooks)
    for (const [from, to] of [
      [h.a, h.b],
      [h.b, h.a],
    ]) {
      const d = flat(P.pos, from.x, from.z);
      if (d < 2.3 && Math.abs(P.pos.y - from.y) < 1.6) {
        const dx = to.x - P.pos.x,
          dz = to.z - P.pos.z,
          L = Math.hypot(dx, dz) || 1,
          score = (dx * fx + dz * fz) / L - d * 0.05;
        if (score > bs) {
          bs = score;
          best = { h, to };
        }
      }
    }
  return best;
}
export function swingAction() {
  const sw = swingOption();
  return sw ? { label: 'Swing', fn: () => startSwing(sw) } : null;
}
function startSwing(o) {
  const from = P.pos.clone(),
    to = V(o.to.x, o.to.y + 0.05, o.to.z);
  P.swing = { h: o.h, from, to, t: 0, dur: clamp(from.distanceTo(to) / 8, 1, 1.7) };
  P.grounded = false;
  P.vel.set(0, 0, 0);
  sfx.stretch();
  burst(V(o.h.x, o.h.y, o.h.z), 10, POWERS.stretch.col, 3, 1, 0.5, 0.8, 0.3);
}
// a quadratic arc from start to landing, dipping under the hook
export function updSwing(dt) {
  const s = P.swing;
  s.t += dt;
  const k = clamp(s.t / s.dur, 0, 1),
    e = k * k * (3 - 2 * k);
  const c = V(s.h.x, Math.min(s.from.y, s.to.y) - 2.5, s.h.z),
    u = 1 - e;
  P.pos.set(
    u * u * s.from.x + 2 * u * e * c.x + e * e * s.to.x,
    u * u * s.from.y + 2 * u * e * c.y + e * e * s.to.y,
    u * u * s.from.z + 2 * u * e * c.z + e * e * s.to.z,
  );
  P.yaw = angLerp(P.yaw, Math.atan2(s.to.x - s.from.x, s.to.z - s.from.z), Math.min(1, dt * 10));
  if (k >= 1) {
    P.swing = null;
    P.vel.set(0, 0, 0);
    P.grounded = false;
    P.sqv = -4;
    burst(P.pos.clone(), 10, POWERS.stretch.col, 2.5, 1.5, 0.5, 0.8);
  }
}

// rings spin and the one you'd swing to glows
export function updHooks(dt) {
  const T = G.T,
    swOpt = playing() ? swingOption() : null;
  for (const h of hooks) {
    h.ring.rotation.y += dt * 1.2;
    h.ring.material.emissiveIntensity =
      swOpt && swOpt.h === h ? 0.8 + 0.5 * Math.sin(T * 8) : P.stretch ? 0.3 : 0.12;
  }
}

// the stretchy line from Spartacus's mouth to the hook
const lineGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6);
lineGeo.translate(0, 0.5, 0);
const swingLine = new THREE.Mesh(
  lineGeo,
  new THREE.MeshStandardMaterial({ color: 0xff9a3d, roughness: 0.6 }),
);
swingLine.visible = false;
scene.add(swingLine);
export function updSwingLine() {
  if (P.swing) {
    const s = P.swing,
      k = s.t / s.dur;
    if (k < 0.85) {
      const a = V();
      dog.mouth.getWorldPosition(a);
      const d = V(s.h.x, s.h.y, s.h.z).sub(a),
        L = d.length();
      swingLine.visible = true;
      swingLine.position.copy(a);
      swingLine.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
      swingLine.scale.set(1, L, 1);
    } else swingLine.visible = false;
  } else swingLine.visible = false;
}
