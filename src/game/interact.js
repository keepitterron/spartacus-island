import { G, cur } from '../core/state.js';
import { toast } from '../core/ui.js';
import { P } from '../player/player.js';
import { grabPickups } from '../systems/collect.js';
import { eatFruits } from '../systems/powers.js';

// Things that happen just by walking somewhere (no button): pickups, fruits, then the
// island's own interact(p, dt) for triggers and hints.
export function interact(dt) {
  const p = P.pos;
  grabPickups(p);
  eatFruits(p);
  G.hintT -= dt;
  cur().interact?.(p, dt);
}
// a repeating "too high" hint (at most every 10 s) while Spartacus stands near something
// he can't jump onto without Boing-Boing
export function tooHigh(near, msg) {
  if (!P.super && G.hintT <= 0 && P.grounded && near) {
    G.hintT = 10;
    toast(msg, 3000);
  }
}
