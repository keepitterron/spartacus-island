// Wasabi the blue axolotl: model and per-frame update. Rescued on island 3 (her spring dried up),
// rides in the bucket on deck, and underwater (island 4) floats next to Spartacus as his breathing bubble.
import * as THREE from 'three';
import { lerp, lerpAngle, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';
import { player } from '../player/player.js';

// state: stuck | happy | swim   (island 3's story, driven from islands/island3)
//        crew (in the bucket) | follow (swimming beside Spartacus)
export const wasabi = { g: new THREE.Group(), state: 'stuck', t: 0 };
{
  const blue = material(0x6fb6ff),
    darkBlue = material(0x4a8fe0),
    lilac = material(0xb59cff),
    ink = material(0x1c2333),
    pink = material(0xff8fa3),
    g = wasabi.g;
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.55, 4, 8), blue);
  body.rotation.x = Math.PI / 2;
  body.position.y = 0.22;
  g.add(body);
  const head = mesh(new THREE.SphereGeometry(0.28, 10, 8), blue);
  head.scale.set(1.3, 0.85, 1);
  head.position.set(0, 0.3, 0.48);
  g.add(head);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.05, 6, 5), ink, { castShadow: false });
    eye.position.set(side * 0.2, 0.4, 0.68);
    g.add(eye);
    const cheek = mesh(new THREE.SphereGeometry(0.05, 6, 5), pink, { castShadow: false });
    cheek.scale.set(1, 0.5, 0.5);
    cheek.position.set(side * 0.25, 0.3, 0.68);
    g.add(cheek);
    // three feathery gills fanning out on each side of the head
    for (let k = 0; k < 3; k++) {
      const gill = mesh(new THREE.ConeGeometry(0.06, 0.34, 5), lilac);
      gill.position.set(side * 0.36, 0.42 + (1 - k) * 0.11, 0.42);
      gill.rotation.z = -side * (1.0 + k * 0.35);
      g.add(gill);
    }
    for (const z of [0.25, -0.25]) {
      const leg = mesh(new THREE.SphereGeometry(0.07, 6, 5), darkBlue);
      leg.scale.set(1.5, 0.6, 1);
      leg.position.set(side * 0.22, 0.08, z);
      g.add(leg);
    }
  }
  // the tail is a pivot group so it can wag from its base
  wasabi.tail = new THREE.Group();
  wasabi.tail.position.set(0, 0.24, -0.4);
  g.add(wasabi.tail);
  const tailFin = mesh(new THREE.BoxGeometry(0.05, 0.24, 0.6), darkBlue);
  tailFin.position.z = -0.28;
  wasabi.tail.add(tailFin);
  const smile = mesh(new THREE.TorusGeometry(0.07, 0.015, 4, 8, Math.PI), ink, {
    castShadow: false,
  });
  smile.rotation.z = Math.PI;
  smile.position.set(0, 0.26, 0.74);
  g.add(smile);
  scene.add(g);
}

// leave the bucket and swim beside Spartacus
export function wasabiFollow() {
  wasabi.g.parent?.remove(wasabi.g);
  scene.add(wasabi.g);
  wasabi.g.scale.setScalar(1);
  wasabi.state = 'follow';
  wasabi.g.position.copy(player.pos).add(vec3(1, 1.3, 0));
}

// swim to a spot just ahead and to the side of Spartacus, bobbing, facing the way she moves
function updateFollowing(dt) {
  const g = wasabi.g;
  const sinYaw = Math.sin(player.yaw),
    cosYaw = Math.cos(player.yaw),
    ease = 1 - Math.exp(-dt * 5);
  const targetX = player.pos.x - sinYaw * 0.9 + cosYaw * 1.0,
    targetZ = player.pos.z - cosYaw * 0.9 - sinYaw * 1.0,
    targetY = player.pos.y + 1.3 + Math.sin(game.time * 2) * 0.15,
    oldX = g.position.x,
    oldZ = g.position.z;
  g.position.x = lerp(g.position.x, targetX, ease);
  g.position.y = lerp(g.position.y, targetY, ease);
  g.position.z = lerp(g.position.z, targetZ, ease);
  const moveX = g.position.x - oldX,
    moveZ = g.position.z - oldZ;
  if (Math.hypot(moveX, moveZ) > 0.01)
    g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(moveX, moveZ), Math.min(1, dt * 8));
}

export function updateWasabi(dt) {
  const time = game.time;
  wasabi.t += dt;
  wasabi.tail.rotation.y = Math.sin(time * (wasabi.state === 'stuck' ? 3 : 9)) * 0.45;
  if (wasabi.state === 'crew') wasabi.g.rotation.y = Math.sin(time * 0.7) * 0.8;
  else if (wasabi.state === 'follow') updateFollowing(dt);
}
