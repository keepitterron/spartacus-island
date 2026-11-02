// Ground pound: high enough in the air, the action button makes Spartacus slam down.
// Three beats, slow enough to read: a wind-up (he rises a little and does one smooth
// somersault), the drop (stretched, with a puff trail), and a short landing pause (squash,
// sand ring). Landing shakes things nearby, digs up a sand mound right underneath and kicks
// beach balls (systems/reactions.js). player/dog.js poses the body from poundPose().
import { smoothstep, vec3 } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { supportHeight } from '../core/colliders.js';
import { currentIsland } from '../core/state.js';
import { poundReactions } from '../systems/reactions.js';
import { player } from './player.js';

const WINDUP = 0.45; // seconds of rise + somersault before the drop
const RISE_SPEED = 3; // upwards speed at the start of the wind-up, easing to 0
const DROP_SPEED = 18;
const LANDING_PAUSE = 0.3; // seconds he stays squashed on the ground before he can move
const MIN_HEIGHT = 1.3; // above whatever is underneath, so tiny hops don't offer it

export function poundAction() {
  if (player.grounded || player.pounding || player.carrying?.heavy) return null;
  const pos = player.pos;
  if (pos.y - supportHeight(pos.x, pos.z, pos.y) < MIN_HEIGHT) return null;
  return { label: 'Slam', run: startPound };
}

function startPound() {
  player.pounding = true;
  player.poundTime = 0;
  player.vel.set(0, 0, 0);
  sfx.boing();
}

// every step while pounding: no sideways movement; rise and flip, then drop
export function holdPound(dt) {
  player.poundTime += dt;
  player.vel.x = 0;
  player.vel.z = 0;
  const t = player.poundTime / WINDUP;
  if (t < 1) {
    player.vel.y = RISE_SPEED * (1 - t);
    return;
  }
  if (player.vel.y > -DROP_SPEED) sfx.zip(); // the moment the drop starts
  player.vel.y = -DROP_SPEED;
  burst(player.pos.clone().add(vec3(0, 1.4, 0)), {
    count: 1,
    color: 0xffffff,
    speed: 0.3,
    up: 1,
    life: 0.35,
    size: 0.9,
    gravity: 0,
  });
}

export function landPound() {
  player.pounding = false;
  player.poundRecover = LANDING_PAUSE;
  player.squashVel = -10;
  sfx.pound();
  // a ring of sand flying out
  burst(player.pos.clone().add(vec3(0, 0.15, 0)), {
    count: 26,
    color: [0xfff0c8, 0xf0c86a],
    speed: 6,
    up: 1.5,
    life: 0.7,
    size: 1.1,
  });
  poundReactions(player.pos);
  currentIsland().pound?.(player.pos); // islands react too (island 5: breaking a crate)
}

// the landing pause counts down even when he isn't walking (it locks movement meanwhile)
export function updatePoundRecovery(dt) {
  player.poundRecover = Math.max(0, player.poundRecover - dt);
}

// how the body should look: {pitch, stretch} while pounding, null otherwise.
// The somersault eases in and out and ends at exactly one turn, then the drop is nose-down.
export function poundPose() {
  if (!player.pounding) return null;
  const t = player.poundTime / WINDUP;
  if (t < 1) return { pitch: smoothstep(0, 1, t) * Math.PI * 2, stretch: 0.85 };
  return { pitch: 0.35, stretch: 1.25 };
}
