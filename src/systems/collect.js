import { distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { toast } from '../core/ui.js';
import { terrainHeight } from '../world/terrain.js';
import { completeTask, renderTasks } from '../game/tasks.js';

// Spinning collectibles (bones, golden acorns…). Each island describes its own in
//   collect:{total, taskId, name, all, model}
// and the count lives on collect.count. Walk into one to pick it up.
const pickups = [];
// pop>0 makes it jump out of the ground first (from a dig spot)
export function addPickup(x, z, y, isl, pop = 0) {
  const c = game.islands[isl].collect,
    g = c.model();
  const base = (y !== undefined ? y : terrainHeight(x, z)) + 0.6;
  g.position.set(x, base, z);
  scene.add(g);
  pickups.push({ g, x, z, y: base, got: false, pop, isl });
}

export function updatePickups(dt) {
  const T = game.T;
  for (const b of pickups)
    if (!b.got) {
      b.g.rotation.y += dt * 2;
      if (b.pop > 0) b.pop -= dt;
      b.g.position.y = b.y + Math.sin(T * 3 + b.x) * 0.12 + Math.max(0, b.pop) * 1.4;
    }
}
export function grabPickups(p) {
  for (const b of pickups)
    if (!b.got && b.pop <= 0 && distXZ(p, b.x, b.z) < 1.15 && Math.abs(p.y + 0.6 - b.y) < 1.3) {
      b.got = true;
      scene.remove(b.g);
      sfx.bone();
      burst(b.g.position.clone(), 14, [0xffd84d, 0xffffff], 4, 3, 0.7, 0.9);
      const c = game.islands[b.isl].collect,
        n = ++c.count;
      if (n >= c.total) {
        toast(c.all);
        completeTask(c.taskId);
      } else {
        toast(`${c.name}! ${n} of ${c.total}`, 1600);
        renderTasks();
      }
    }
}
// "Find 6 bones (2/6)" for the to-do list
export const pickupText = (isl, what) => {
  const c = game.islands[isl].collect;
  return `Find ${c.total} ${what} (${c.count}/${c.total})`;
};
