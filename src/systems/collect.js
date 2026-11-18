// Spinning collectibles (bones, golden acorns…) that Spartacus picks up by walking into them.
import { distXZ, spotKey, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { toast, hintOnce } from '../core/ui.js';
import { terrainHeight } from '../world/terrain.js';
import { completeTask, renderTasks } from '../game/tasks.js';
import { player } from '../player/player.js';
import { undugPickupDigs } from './digs.js';

// the last few of an island's collectibles sparkle (and so do mounds with one inside), so the
// final hunt is about getting there, not about spotting a tiny bone from across the island
const SPARKLE_WHEN_LEFT = 2;
const SPARKLE_EVERY = 1.2; // s
const SPARKLE_REACH = 45; // m: further away, no sparkles (nobody would see them)
const sparkle = { timer: 0 };

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
  sparkleLastOnes(dt);
}

function sparkleLastOnes(dt) {
  const collect = game.islands[game.island]?.collect;
  if (!collect || collect.total <= SPARKLE_WHEN_LEFT) return;
  const left = collect.total - collect.count;
  if (left <= 0 || left > SPARKLE_WHEN_LEFT) return;
  sparkle.timer -= dt;
  if (sparkle.timer > 0) return;
  sparkle.timer = SPARKLE_EVERY;
  // (one that isn't out yet, like Juf Anne's thank-you bone, can't sparkle)
  const spots = [
    ...pickups
      .filter((pickup) => pickup.island === game.island && !pickup.taken)
      .map((pickup) => pickup.model.position),
    ...undugPickupDigs(game.island).map((dig) => ({ x: dig.x, y: dig.y + 0.3, z: dig.z })),
  ];
  if (!spots.length) return;
  hintOnce(
    `lastOnes${game.island}`,
    `Only ${left === 1 ? 'one' : 'two'} left to find! Look for the golden sparkles ✨`,
    3400,
  );
  for (const spot of spots) {
    if (distXZ(player.pos, spot.x, spot.z) > SPARKLE_REACH) continue;
    burst(vec3(spot.x, spot.y, spot.z), {
      count: 6,
      color: [0xffd84d, 0xffffff, 0xfff3a8],
      speed: 1.2,
      up: 4,
      life: 1.1,
      size: 1.3,
    });
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
    toast(`${collect.name}! ${count} of ${collect.total}`, 1600, { id: 'pickups' });
    renderTasks();
  }
}

// mid-island saves (game/progress.js): which pickups are gone, by spot
export const takenPickups = (island) =>
  pickups
    .filter((pickup) => pickup.island === island && pickup.taken)
    .map((p) => spotKey(p.x, p.z));
export function restorePickups(island, { taken = [], count = 0 }) {
  for (const pickup of pickups)
    if (pickup.island === island && taken.includes(spotKey(pickup.x, pickup.z))) {
      pickup.taken = true;
      scene.remove(pickup.model);
    }
  const collect = game.islands[island].collect;
  if (collect) collect.count = count;
}

// the pickups of an island that are still out there (island 7: Leo flies to the nearest one)
export const remainingPickups = (island) =>
  pickups.filter((pickup) => pickup.island === island && !pickup.taken);

// "Find 6 bones (2/6)" for the to-do list
export const pickupText = (island, what) => {
  const collect = game.islands[island].collect;
  return `Find ${collect.total} ${what} (${collect.count}/${collect.total})`;
};
