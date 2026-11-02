// Mid-island saves, for islands with `savesProgress: true` (big islands where losing a closed tab
// would hurt). Saved every few seconds, on every ticked task and when the page is hidden; put back
// on Continue. Each system saves its own part (pickups, digs, seeds, items), the island saves the
// rest (crew, opened gates…) with saveState()/loadState(state).
import { game, currentIsland, isPlaying } from '../core/state.js';
import { loadSave, writeSave } from '../core/save.js';
import { player } from '../player/player.js';
import { setPower } from '../systems/powers.js';
import { takenPickups, restorePickups } from '../systems/collect.js';
import { dugSpots, restoreDigs } from '../systems/digs.js';
import { grownSpots, restoreGrowers } from '../systems/vines.js';
import { itemSpots, restoreItems } from '../systems/items.js';
import { renderTasks } from './tasks.js';

const SAVE_EVERY = 5; // seconds
const autosave = { timeLeft: SAVE_EVERY, safePos: null };

// the save's `progress` field: {island, done, count, pickups, digs, growers, items, power, pos, state}
export function saveProgress() {
  const island = currentIsland();
  if (!island?.savesProgress || game.restoring || game.state === 'start') return;
  const id = island.id;
  writeSave({
    progress: {
      island: id,
      done: { ...island.done },
      count: island.collect?.count ?? 0,
      pickups: takenPickups(id),
      digs: dugSpots(id),
      growers: grownSpots(id),
      items: itemSpots(id),
      power: player.power,
      pos: autosave.safePos,
      state: island.saveState?.(),
    },
  });
}

// after enterIsland (Continue): put back what the save says happened on this island
export function restoreProgress(island) {
  const saved = loadSave().progress;
  if (!island.savesProgress || saved?.island !== island.id) return;
  game.restoring = true;
  try {
    for (const id of Object.keys(island.done)) island.done[id] = !!saved.done?.[id];
    // digs and the island's own state first: they may spawn the pickups and items restored next
    restoreDigs(island.id, saved.digs);
    island.loadState?.(saved.state ?? {});
    restorePickups(island.id, { taken: saved.pickups, count: saved.count });
    restoreGrowers(island.id, saved.growers);
    restoreItems(island.id, saved.items);
    if (saved.power) setPower(saved.power);
    if (saved.pos) player.pos.set(...saved.pos);
  } finally {
    game.restoring = false;
  }
  autosave.safePos = saved.pos;
  renderTasks();
}

// remember the last spot Spartacus stood on dry ground (not mid-jump, swinging or paddling),
// so a restored game never starts him in the air or out at sea
export function updateProgress(dt) {
  if (!isPlaying() || !currentIsland().savesProgress) return;
  const onDryGround =
    player.grounded && !player.wading && !player.swing && !player.climb && !player.zip;
  if (onDryGround) autosave.safePos = [player.pos.x, player.pos.y + 0.05, player.pos.z];
  autosave.timeLeft -= dt;
  if (autosave.timeLeft > 0) return;
  autosave.timeLeft = SAVE_EVERY;
  saveProgress();
}

// closing the tab or switching apps on a phone
export function bindProgressSaving() {
  addEventListener('pagehide', saveProgress);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveProgress();
  });
}

// arriving fresh by ship: forget any old progress for the island just left
export function clearProgress() {
  autosave.safePos = null;
  autosave.timeLeft = SAVE_EVERY;
  writeSave({ progress: null });
}
