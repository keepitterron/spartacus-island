// Things that happen just by walking somewhere (no button): pickups, fruits, then the
// island's own interact(p, dt) for triggers and hints.
import { game, currentIsland } from '../core/state.js';
import { toast } from '../core/ui.js';
import { player } from '../player/player.js';
import { grabPickups } from '../systems/collect.js';
import { eatFruits } from '../systems/powers.js';

export function checkTriggers(dt) {
  const pos = player.pos;
  grabPickups(pos);
  eatFruits(pos);
  game.hintCooldown -= dt;
  currentIsland().interact?.(pos, dt);
}
// a repeating "too high" hint (at most every 10 s) while Spartacus stands near something
// he can't jump onto without Boing-Boing
export function hintTooHigh(near, msg) {
  if (!player.superJump && game.hintCooldown <= 0 && player.grounded && near) {
    game.hintCooldown = 10;
    toast(msg, 3000);
  }
}
