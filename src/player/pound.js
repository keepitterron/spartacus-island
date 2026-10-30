// Ground pound: high enough in the air, the action button makes Spartacus hang for a moment,
// flip, and slam straight down. Landing shakes things nearby, digs up a sand mound right
// underneath and kicks beach balls (systems/reactions.js).
import { vec3 } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { supportHeight } from '../core/colliders.js';
import { poundReactions } from '../systems/reactions.js';
import { player } from './player.js';

export const POUND_HANG = 0.2; // seconds he hangs in the air (the flip) before falling
const POUND_SPEED = 26;
const MIN_HEIGHT = 1.3; // above whatever is underneath, so tiny hops don't offer it

export function poundAction() {
  if (player.grounded || player.pounding || player.carrying?.heavy) return null;
  const pos = player.pos;
  if (pos.y - supportHeight(pos.x, pos.z, pos.y) < MIN_HEIGHT) return null;
  return { label: 'Slam', run: startPound };
}

function startPound() {
  player.pounding = true;
  player.poundHang = POUND_HANG;
  player.vel.set(0, 0, 0);
  sfx.zip();
}

// every step while pounding: no sideways movement; hang, then drop fast
export function holdPound(dt) {
  player.vel.x = 0;
  player.vel.z = 0;
  if (player.poundHang > 0) {
    player.poundHang -= dt;
    player.vel.y = 0;
  } else player.vel.y = -POUND_SPEED;
}

export function landPound() {
  player.pounding = false;
  player.squashVel = -12;
  sfx.pound();
  // a ring of sand flying out
  burst(player.pos.clone().add(vec3(0, 0.15, 0)), {
    count: 22,
    color: [0xfff0c8, 0xf0c86a],
    speed: 6,
    up: 1.5,
    life: 0.6,
    size: 1,
  });
  poundReactions(player.pos);
}

// stop a pound in progress (bubble rescue, cutscenes)
export function cancelPound() {
  player.pounding = false;
  player.poundHang = 0;
}
