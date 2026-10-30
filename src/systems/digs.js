// Sand mounds you dig up with the action button. reward(dig) runs when digging finishes
// (spawn a pickup, hand Spartacus an item…). marked=true paints a red X on it.
import * as THREE from 'three';
import { distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { terrainHeight } from '../world/terrain.js';
import { player, forwardDir } from '../player/player.js';

// {x, z, y, mound, marks: [X bars], reward(dig), dug}; islands read x/y/z in reward
const digs = [];
const holeMaterial = new THREE.MeshStandardMaterial({ color: 0xb08a4a, roughness: 1 });
const DIG_TIME = 1.1;

export function addDig(x, z, { reward, marked = false, y = terrainHeight(x, z) }) {
  const mound = mesh(new THREE.SphereGeometry(0.65, 9, 6), material(0xf0c86a), {
    receiveShadow: true,
  });
  mound.scale.set(1, 0.32, 1);
  mound.position.set(x, y, z);
  scene.add(mound);
  const marks = [];
  if (marked)
    for (const angle of [0.7, -0.7]) {
      const bar = mesh(new THREE.BoxGeometry(0.7, 0.06, 0.12), material(0xf2545b), {
        castShadow: false,
      });
      bar.rotation.y = angle;
      bar.position.set(x, y + 0.22, z);
      scene.add(bar);
      marks.push(bar);
    }
  const dig = { x, z, y, mound, marks, reward, dug: false };
  digs.push(dig);
  return dig;
}

export const digNear = (pos, radius) =>
  digs.find((dig) => !dig.dug && distXZ(pos, dig.x, dig.z) < radius);

export function digAction(pos) {
  for (const dig of digs)
    if (!dig.dug && distXZ(pos, dig.x, dig.z) < 1.4 && Math.abs(pos.y - dig.y) < 1)
      return { label: 'Dig', run: () => startDig(dig) };
  return null;
}

// a ground pound right on top of a mound digs it up in one go
export function poundDig(pos) {
  const dig = digs.find((d) => !d.dug && distXZ(pos, d.x, d.z) < 1.5 && Math.abs(pos.y - d.y) < 1);
  if (dig) finishDig(dig);
}

function startDig(dig) {
  player.digTimer = DIG_TIME;
  player.digSpot = dig;
  player.vel.x = 0;
  player.vel.z = 0;
  // face the mound (atan2 of 0,0 gives 0, so keep the old yaw then)
  player.yaw = Math.atan2(dig.x - player.pos.x, dig.z - player.pos.z) || player.yaw;
}

export function updateDigging(dt) {
  if (player.digTimer <= 0) return;
  player.digTimer -= dt;
  player.scratchTimer -= dt;
  if (player.scratchTimer <= 0) {
    player.scratchTimer = 0.16;
    sfx.scratch();
    kickSand();
  }
  if (player.digTimer <= 0) finishDig(player.digSpot);
}

// sand flying back from between the front paws
function kickSand() {
  const fwd = forwardDir();
  burst(player.pos.clone().add(vec3(fwd.x * 0.7, 0.3, fwd.z * 0.7)), {
    count: 4,
    color: [0xf0c86a, 0xffe08a],
    speed: 2,
    up: 3,
    life: 0.6,
    size: 0.8,
    gravity: 1,
    confetti: false,
    dir: vec3(-fwd.x, 0, -fwd.z),
  });
}

function finishDig(dig) {
  dig.dug = true;
  scene.remove(dig.mound);
  for (const bar of dig.marks) scene.remove(bar);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), holeMaterial);
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(dig.x, dig.y + 0.03, dig.z);
  hole.receiveShadow = true;
  scene.add(hole);
  burst(vec3(dig.x, dig.y + 0.3, dig.z), {
    count: 18,
    color: [0xf0c86a, 0xffe08a],
    speed: 4,
    up: 4,
    life: 0.7,
    size: 1,
  });
  dig.reward(dig);
}

// little sparkles so mounds are easy to spot (only within 60 of the player, along z)
export function updateDigSpots(dt) {
  for (const dig of digs)
    if (!dig.dug && Math.random() < dt * 1.2 && Math.abs(dig.z - player.pos.z) < 60)
      burst(vec3(dig.x + (Math.random() - 0.5), dig.y + 0.3, dig.z + (Math.random() - 0.5)), {
        count: 1,
        color: 0xffffff,
        speed: 0.6,
        up: 1.2,
        life: 0.6,
        size: 0.6,
        gravity: 0.1,
      });
}
