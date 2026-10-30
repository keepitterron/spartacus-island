// Little things the world does when Spartacus barks or ground-pounds nearby, on every island:
// palms shake their fronds and drop a coconut, which bounces and later pops back up into the
// tree; beach balls get shoved (systems/balls.js); birds and fish scatter (systems/critters.js).
// A ground pound also digs up a sand mound right underneath.
import { distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { terrainHeight } from '../world/terrain.js';
import { palms } from '../world/props.js';
import { poundDig } from './digs.js';
import { shoveBalls } from './balls.js';
import { barkAtCritters } from './critters.js';

const BARK_REACH = 7;
const COCONUT_RADIUS = 0.17;
const REGROW_TIME = 12; // seconds a coconut lies on the ground before it's back in its tree
// coconuts out of their tree: {coconut, palm, home (its spot in the crown), vel, ground, restTime}
const fallen = [];

export function barkReactions(pos) {
  shakePalms(pos, BARK_REACH);
  shoveBalls(pos, { reach: 6, push: 6, up: 3 });
  barkAtCritters(pos);
}

export function poundReactions(pos) {
  shakePalms(pos, 5);
  poundDig(pos);
  shoveBalls(pos, { reach: 5, push: 3, up: 10 });
}

function shakePalms(pos, reach) {
  for (const palm of palms) {
    if (distXZ(pos, palm.x, palm.z) > reach || Math.abs(pos.y - palm.ground) > 4) continue;
    palm.shake = 1;
    burst(palm.crown.getWorldPosition(vec3()), {
      count: 8,
      color: [0x3fae4f, 0x4cc05a],
      speed: 2.5,
      up: 0.5,
      life: 0.9,
      size: 1,
      gravity: 0.3,
    });
    const coconut = palm.coconuts.find((c) => c.parent === palm.crown);
    if (coconut && Math.random() < 0.7) dropCoconut(palm, coconut);
  }
}

function dropCoconut(palm, coconut) {
  const home = coconut.position.clone();
  scene.attach(coconut); // keep where it is in the world, but stop moving with the tree
  const { x, z } = coconut.position;
  fallen.push({
    coconut,
    palm,
    home,
    vel: vec3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2),
    ground: terrainHeight(x, z) + COCONUT_RADIUS,
    restTime: 0,
  });
}

export function updateReactions(dt) {
  for (const palm of palms) {
    if (palm.shake < 0.01) continue;
    palm.shake *= Math.exp(-dt * 2.5);
    palm.crown.rotation.z = Math.sin(palm.shake * 40) * 0.12 * palm.shake;
  }
  for (let i = fallen.length - 1; i >= 0; i--) {
    const drop = fallen[i];
    if (updateFallingCoconut(drop, dt)) continue;
    drop.restTime += dt;
    if (drop.restTime < REGROW_TIME) continue;
    // back up into the tree
    drop.palm.crown.add(drop.coconut);
    drop.coconut.position.copy(drop.home);
    fallen.splice(i, 1);
  }
}

// gravity and a couple of bounces; returns true while it's still moving
function updateFallingCoconut(drop, dt) {
  const { coconut, vel } = drop;
  if (vel.lengthSq() === 0) return false;
  vel.y -= 20 * dt;
  coconut.position.addScaledVector(vel, dt);
  coconut.rotation.x += vel.z * dt * 3;
  coconut.rotation.z -= vel.x * dt * 3;
  if (coconut.position.y > drop.ground) return true;
  coconut.position.y = drop.ground;
  if (vel.y < -3) {
    if (vel.y < -8) sfx.bonk();
    vel.y *= -0.4;
    vel.x *= 0.6;
    vel.z *= 0.6;
    return true;
  }
  vel.set(0, 0, 0);
  return false;
}
