// Spinning collectibles (bones, golden acorns…) that Spartacus picks up by walking into them.
import { distXZ } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { toast } from '../core/ui.js';
import { terrainHeight } from '../world/terrain.js';
import { completeTask, renderTasks } from '../game/tasks.js';

// Each island describes its own in
//   collect:{total, taskId, name, all, model}
// and the count lives on collect.count.
// {model, x, z, y (rest height), taken, pop, island}
const pickups = [];
// pop>0 makes it jump out of the ground first (from a dig spot)
export function addPickup(x, z, { y = terrainHeight(x, z), island, pop = 0 }) {
  const model = game.islands[island].collect.model();
  const restY = y + 0.6;
  model.position.set(x, restY, z);
  scene.add(model);
  pickups.push({ model, x, z, y: restY, taken: false, pop, island });
}

export function updatePickups(dt) {
  const time = game.time;
  for (const pickup of pickups) {
    if (pickup.taken) continue;
    pickup.model.rotation.y += dt * 2;
    if (pickup.pop > 0) pickup.pop -= dt;
    pickup.model.position.y =
      pickup.y + Math.sin(time * 3 + pickup.x) * 0.12 + Math.max(0, pickup.pop) * 1.4;
  }
}

export function grabPickups(pos) {
  for (const pickup of pickups) {
    if (pickup.taken || pickup.pop > 0) continue;
    if (distXZ(pos, pickup.x, pickup.z) >= 1.15 || Math.abs(pos.y + 0.6 - pickup.y) >= 1.3)
      continue;
    pickup.taken = true;
    scene.remove(pickup.model);
    sfx.bone();
    burst(pickup.model.position.clone(), {
      count: 14,
      color: [0xffd84d, 0xffffff],
      speed: 4,
      up: 3,
      life: 0.7,
      size: 0.9,
    });
    countPickup(game.islands[pickup.island].collect);
  }
}

function countPickup(collect) {
  const count = ++collect.count;
  if (count >= collect.total) {
    toast(collect.all);
    completeTask(collect.taskId);
  } else {
    toast(`${collect.name}! ${count} of ${collect.total}`, 1600);
    renderTasks();
  }
}

// "Find 6 bones (2/6)" for the to-do list
export const pickupText = (island, what) => {
  const collect = game.islands[island].collect;
  return `Find ${collect.total} ${what} (${collect.count}/${collect.total})`;
};
