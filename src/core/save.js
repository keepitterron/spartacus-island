import { clamp } from './util.js';

// Island-level save: {v, island}. Bump VERSION when old saves could strand a player
// (e.g. islands reordered); older saves are then ignored and the game starts at island 1.
const STORAGE_KEY = 'spartacus-save';
const VERSION = 3;
// storage can be missing or blocked (private mode), so failures just mean "no save"
export function loadSave() {
  try {
    const save = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    return save.v === VERSION ? save : {};
  } catch (e) {
    return {};
  }
}
export function writeSave(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: VERSION, ...data }));
  } catch (e) {}
}

// Which island "Continue" goes to. #island2 … #islandN in the URL jump straight there (testing).
export function continueIsland(maxIsland) {
  const match = /^#island(\d+)$/.exec(location.hash);
  if (match) return clamp(Number(match[1]), 1, maxIsland);
  return clamp(loadSave().island || 1, 1, maxIsland);
}
