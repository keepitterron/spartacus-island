import { clamp, flat, V } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { P } from '../player/player.js';
import { dog } from '../player/dog.js';

// Chop-Chop: Spartacus throws his hat like a frisbee at the nearest choppable thing.
// Register things with addChoppable({x,y,z, onChop(c)}); everything within 1.9 of the
// target is cut too.
const choppables = [];
export const addChoppable = (c) => {
  c.cut = false;
  choppables.push(c);
  return c;
};
const hatFly = { flying: false, t: 0, target: null, from: null, hit: false };

export function chopAction(p) {
  if (P.power !== 'chop' || hatFly.flying) return null;
  let best = null,
    bd = 3.4;
  for (const c of choppables)
    if (!c.cut) {
      const d = flat(p, c.x, c.z);
      if (d < bd && Math.abs(p.y - c.y) < 2.5) {
        bd = d;
        best = c;
      }
    }
  return best
    ? {
        label: 'Chop',
        fn: () => {
          P.yaw = Math.atan2(best.x - P.pos.x, best.z - P.pos.z);
          throwHat(best);
        },
      }
    : null;
}
function throwHat(c) {
  if (hatFly.flying) return;
  const h = dog.hat;
  h.userData.home = { p: h.position.clone(), r: h.rotation.clone() };
  scene.attach(h);
  Object.assign(hatFly, { flying: true, t: 0, target: c, from: h.position.clone(), hit: false });
  sfx.zip();
}
export function updHat(dt) {
  if (!hatFly.flying) return;
  const h = dog.hat,
    c = hatFly.target;
  hatFly.t += dt;
  h.rotation.y += dt * 30;
  const tp = V(c.x, c.y + 1.2, c.z),
    out = 0.32;
  if (hatFly.t < out) h.position.lerpVectors(hatFly.from, tp, hatFly.t / out);
  else {
    if (!hatFly.hit) {
      hatFly.hit = true;
      for (const o of choppables) if (!o.cut && Math.hypot(o.x - c.x, o.z - c.z) < 1.9) chop(o);
    }
    const home = dog.head.localToWorld(h.userData.home.p.clone()),
      k = clamp((hatFly.t - out) / out, 0, 1);
    h.position.lerpVectors(tp, home, k);
    if (k >= 1) {
      dog.head.attach(h);
      h.position.copy(h.userData.home.p);
      h.rotation.copy(h.userData.home.r);
      hatFly.flying = false;
    }
  }
}
function chop(c) {
  c.cut = true;
  sfx.chop();
  burst(V(c.x, c.y + 1.2, c.z), 20, [0xb8d84a, 0x9ccf3a, 0xffffff], 4, 2, 0.8, 0.9, -0.05);
  c.onChop?.(c);
}
