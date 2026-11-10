// Mega-Me: for a little while Spartacus is GIANT. player.js makes him big (size, strides, step
// height); this module runs the timer, the wobble before it wears off, and the stomps.
// Unlike the other powers it runs out by itself, so a giant dog never gets stuck being too big
// for the rides: the bush has always regrown by then.
import { vec3 } from '../core/util.js';
import { currentIsland } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { toast } from '../core/ui.js';
import { clearPower, updatePowerHud } from '../systems/powers.js';
import { stompReactions } from '../systems/reactions.js';
import { player, MEGA } from './player.js';

const WARNING_TIME = 4; // seconds before the end that he starts to wobble
const WOBBLE = 0.82; // how far he shrinks on each wobble (share of full Mega size)

// the size he should be while Mega-Me is on (null when it's off): full size, or pulsing
// smaller and back in the last few seconds so the end never comes as a surprise
export function megaSize() {
  if (!player.giant) return null;
  const wobbling = player.megaTime < WARNING_TIME && Math.sin(player.megaTime * 9) > 0.3;
  return MEGA.size * (wobbling ? WOBBLE : 1);
}

// counts Mega-Me down; the power badge shows the seconds left
export function updateMega(dt) {
  if (!player.giant) return;
  const before = Math.ceil(player.megaTime);
  player.megaTime -= dt;
  const now = Math.ceil(player.megaTime);
  if (now === before) return;
  updatePowerHud();
  if (now > 0 && now <= WARNING_TIME) sfx.tick();
  if (player.megaTime <= 0) endMega();
}

function endMega() {
  clearPower();
  sfx.pop();
  burst(player.pos.clone().add(vec3(0, 2, 0)), {
    count: 30,
    color: [0xffc21f, 0xfff3b0, 0xffffff],
    speed: 6,
    up: 3,
    life: 0.9,
    size: 1.4,
  });
  toast('Pop! Back to normal. The Mega-Me bush has more!', 3000);
}

// every giant footstep: a thump, a ring of dust, palms shake, and the island reacts
// (island.stomp(pos): the Fuzzles hop)
export function megaStomp() {
  sfx.stomp();
  player.squashVel = -2.5;
  burst(player.pos.clone().add(vec3(0, 0.2, 0)), {
    count: 10,
    color: [0xfff0c8, 0xf0dcb0],
    speed: 5,
    up: 1,
    life: 0.6,
    size: 1.6,
    gravity: 0.3,
  });
  stompReactions(player.pos);
  currentIsland().stomp?.(player.pos);
}
