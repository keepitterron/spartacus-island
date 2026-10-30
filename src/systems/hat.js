// Chop-Chop: Spartacus throws his hat like a frisbee at the nearest choppable thing.
// Register things with addChoppable({x,y,z, onChop(c)}); everything within 1.9 of the
// target is cut too.
import { clamp, distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { player } from '../player/player.js';
import { dog } from '../player/dog.js';

const choppables = [];
export const addChoppable = (c) => {
  c.cut = false;
  choppables.push(c);
  return c;
};
// the hat in flight: from (world pos it left from), t (seconds), hit once it reached the target
const hatFlight = { flying: false, t: 0, target: null, from: null, hit: false };
const FLIGHT_TIME = 0.32; // each way

export function chopAction(pos) {
  if (player.power !== 'chop' || hatFlight.flying) return null;
  const target = nearestChoppable(pos);
  if (!target) return null;
  return {
    label: 'Chop',
    run: () => {
      player.yaw = Math.atan2(target.x - player.pos.x, target.z - player.pos.z);
      throwHat(target);
    },
  };
}

// within 3.4 sideways and 2.5 up/down
function nearestChoppable(pos) {
  let best = null,
    bestDist = 3.4;
  for (const c of choppables) {
    if (c.cut) continue;
    const dist = distXZ(pos, c.x, c.z);
    if (dist < bestDist && Math.abs(pos.y - c.y) < 2.5) {
      bestDist = dist;
      best = c;
    }
  }
  return best;
}

function throwHat(target) {
  if (hatFlight.flying) return;
  const hat = dog.hat;
  // remember where it sits on the head, then move it into world space for the flight
  hat.userData.home = { pos: hat.position.clone(), rot: hat.rotation.clone() };
  scene.attach(hat);
  Object.assign(hatFlight, {
    flying: true,
    t: 0,
    target,
    from: hat.position.clone(),
    hit: false,
  });
  sfx.zip();
}

export function updateHat(dt) {
  if (!hatFlight.flying) return;
  const hat = dog.hat,
    target = hatFlight.target;
  hatFlight.t += dt;
  hat.rotation.y += dt * 30;
  const aim = vec3(target.x, target.y + 1.2, target.z);
  if (hatFlight.t < FLIGHT_TIME) {
    hat.position.lerpVectors(hatFlight.from, aim, hatFlight.t / FLIGHT_TIME);
    return;
  }
  if (!hatFlight.hit) {
    hatFlight.hit = true;
    for (const c of choppables)
      if (!c.cut && Math.hypot(c.x - target.x, c.z - target.z) < 1.9) chop(c);
  }
  // fly back to the head (which may have moved meanwhile)
  const home = dog.head.localToWorld(hat.userData.home.pos.clone()),
    t = clamp((hatFlight.t - FLIGHT_TIME) / FLIGHT_TIME, 0, 1);
  hat.position.lerpVectors(aim, home, t);
  if (t >= 1) {
    dog.head.attach(hat);
    hat.position.copy(hat.userData.home.pos);
    hat.rotation.copy(hat.userData.home.rot);
    hatFlight.flying = false;
  }
}

function chop(c) {
  c.cut = true;
  sfx.chop();
  burst(vec3(c.x, c.y + 1.2, c.z), {
    count: 20,
    color: [0xb8d84a, 0x9ccf3a, 0xffffff],
    speed: 4,
    up: 2,
    life: 0.8,
    size: 0.9,
    gravity: -0.05,
  });
  c.onChop?.(c);
}
