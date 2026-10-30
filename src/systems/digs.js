import * as THREE from 'three';
import { distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { terrainHeight } from '../world/terrain.js';
import { player, forwardDir } from '../player/player.js';

// Sand mounds you dig up with the action button. reward(d) runs when digging finishes
// (spawn a pickup, hand Spartacus an item…). marked=true paints a red X on it.
const digs = [];
const holeMat = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 1 });
export function addDig(x, z, reward, marked, y) {
  y = y !== undefined ? y : terrainHeight(x, z);
  const m = mesh(new THREE.SphereGeometry(0.65, 9, 6), material(0xf0c86a), true, true);
  m.scale.set(1, 0.32, 1);
  m.position.set(x, y, z);
  scene.add(m);
  if (marked)
    for (const r of [0.7, -0.7]) {
      const b = mesh(new THREE.BoxGeometry(0.7, 0.06, 0.12), material(0xf2545b), false);
      b.rotation.y = r;
      b.position.set(x, y + 0.22, z);
      scene.add(b);
      m.userData.x = (m.userData.x || []).concat(b);
    }
  const d = { x, z, y, m, reward, dug: false };
  digs.push(d);
  return d;
}
export const digNear = (p, r) => digs.find((d) => !d.dug && distXZ(p, d.x, d.z) < r);
export function digAction(p) {
  for (const d of digs)
    if (!d.dug && distXZ(p, d.x, d.z) < 1.4 && Math.abs(p.y - d.y) < 1)
      return { label: 'Dig', fn: () => startDig(d) };
  return null;
}

function startDig(d) {
  player.digT = 1.1;
  player.dig = d;
  player.vel.x = player.vel.z = 0;
  player.yaw = Math.atan2(d.x - player.pos.x, d.z - player.pos.z) || player.yaw;
}
export function updateDigging(dt) {
  if (player.digT <= 0) return;
  player.digT -= dt;
  player.scratchT -= dt;
  if (player.scratchT <= 0) {
    player.scratchT = 0.16;
    sfx.scratch();
    const f = forwardDir();
    burst(
      player.pos.clone().add(vec3(f.x * 0.7, 0.3, f.z * 0.7)),
      4,
      [0xf0c86a, 0xffe08a],
      2,
      3,
      0.6,
      0.8,
      1,
      false,
      vec3(-f.x, 0, -f.z),
    );
  }
  if (player.digT <= 0) finishDig(player.dig);
}
function finishDig(d) {
  d.dug = true;
  scene.remove(d.m);
  (d.m.userData.x || []).forEach((b) => scene.remove(b));
  const h = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), holeMat);
  h.rotation.x = -Math.PI / 2;
  h.position.set(d.x, d.y + 0.03, d.z);
  h.receiveShadow = true;
  scene.add(h);
  burst(vec3(d.x, d.y + 0.3, d.z), 18, [0xf0c86a, 0xffe08a], 4, 4, 0.7, 1);
  d.reward(d);
}
// little sparkles so mounds are easy to spot
export function updateDigSpots(dt) {
  for (const d of digs)
    if (!d.dug && Math.random() < dt * 1.2 && Math.abs(d.z - player.pos.z) < 60)
      burst(
        vec3(d.x + (Math.random() - 0.5), d.y + 0.3, d.z + (Math.random() - 0.5)),
        1,
        0xffffff,
        0.6,
        1.2,
        0.6,
        0.6,
        0.1,
      );
}
