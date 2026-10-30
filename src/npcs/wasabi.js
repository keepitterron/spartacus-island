import * as THREE from 'three';
import { lerp, lerpAngle, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';
import { player } from '../player/player.js';

// Wasabi the blue axolotl. Rescued on island 3 (her spring dried up), rides in the bucket
// on deck, and underwater (island 4) floats next to Spartacus as his breathing bubble.
// state: stuck | happy | swim   (island 3's story, driven from islands/island3)
//        crew (in the bucket) | follow (swimming beside Spartacus)
export const wasabi = { g: new THREE.Group(), state: 'stuck', t: 0 };
{
  const B = material(0x6fb6ff),
    D = material(0x4a8fe0),
    Gl = material(0xb59cff),
    I = material(0x1c2333),
    Pk = material(0xff8fa3),
    g = wasabi.g;
  const bd = mesh(new THREE.CapsuleGeometry(0.2, 0.55, 4, 8), B);
  bd.rotation.x = Math.PI / 2;
  bd.position.y = 0.22;
  g.add(bd);
  const hd = mesh(new THREE.SphereGeometry(0.28, 10, 8), B);
  hd.scale.set(1.3, 0.85, 1);
  hd.position.set(0, 0.3, 0.48);
  g.add(hd);
  for (const sd of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.05, 6, 5), I, { castShadow: false });
    e.position.set(sd * 0.2, 0.4, 0.68);
    g.add(e);
    const ck = mesh(new THREE.SphereGeometry(0.05, 6, 5), Pk, { castShadow: false });
    ck.scale.set(1, 0.5, 0.5);
    ck.position.set(sd * 0.25, 0.3, 0.68);
    g.add(ck);
    for (let k = 0; k < 3; k++) {
      const gl = mesh(new THREE.ConeGeometry(0.06, 0.34, 5), Gl);
      gl.position.set(sd * 0.36, 0.42 + (1 - k) * 0.11, 0.42);
      gl.rotation.z = -sd * (1.0 + k * 0.35);
      g.add(gl);
    }
    for (const z of [0.25, -0.25]) {
      const l = mesh(new THREE.SphereGeometry(0.07, 6, 5), D);
      l.scale.set(1.5, 0.6, 1);
      l.position.set(sd * 0.22, 0.08, z);
      g.add(l);
    }
  }
  wasabi.tail = new THREE.Group();
  wasabi.tail.position.set(0, 0.24, -0.4);
  g.add(wasabi.tail);
  const tl = mesh(new THREE.BoxGeometry(0.05, 0.24, 0.6), D);
  tl.position.z = -0.28;
  wasabi.tail.add(tl);
  const smile = mesh(new THREE.TorusGeometry(0.07, 0.015, 4, 8, Math.PI), I, { castShadow: false });
  smile.rotation.z = Math.PI;
  smile.position.set(0, 0.26, 0.74);
  g.add(smile);
  scene.add(g);
}

// leave the bucket and swim beside Spartacus
export function wasabiFollow() {
  if (wasabi.g.parent) wasabi.g.parent.remove(wasabi.g);
  scene.add(wasabi.g);
  wasabi.g.scale.setScalar(1);
  wasabi.state = 'follow';
  wasabi.g.position.copy(player.pos).add(vec3(1, 1.3, 0));
}

export function updateWasabi(dt) {
  const w = wasabi,
    g = w.g,
    T = game.time;
  w.t += dt;
  w.tail.rotation.y = Math.sin(T * (w.state === 'stuck' ? 3 : 9)) * 0.45;
  if (w.state === 'crew') g.rotation.y = Math.sin(T * 0.7) * 0.8;
  else if (w.state === 'follow') {
    const sy = Math.sin(player.yaw),
      cy = Math.cos(player.yaw),
      kk = 1 - Math.exp(-dt * 5);
    const tx = player.pos.x - sy * 0.9 + cy * 1.0,
      tz = player.pos.z - cy * 0.9 - sy * 1.0,
      ty = player.pos.y + 1.3 + Math.sin(T * 2) * 0.15,
      ox = g.position.x,
      oz = g.position.z;
    g.position.x = lerp(g.position.x, tx, kk);
    g.position.y = lerp(g.position.y, ty, kk);
    g.position.z = lerp(g.position.z, tz, kk);
    const mx = g.position.x - ox,
      mz = g.position.z - oz;
    if (Math.hypot(mx, mz) > 0.01)
      g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(mx, mz), Math.min(1, dt * 8));
  }
}
