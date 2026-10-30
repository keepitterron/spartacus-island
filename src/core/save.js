import { clamp } from './util.js';

// Island-level save: {v, island}. Bump VERSION when old saves could strand a player
// (e.g. islands reordered); older saves are then ignored and the game starts at island 1.
const KEY = 'spartacus-save',
  VERSION = 3;
export function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    return s.v === VERSION ? s : {};
  } catch (e) {
    return {};
  }
}
export function writeSave(o) {
  try {
    localStorage.setItem(KEY, JSON.stringify(Object.assign({ v: VERSION }, o)));
  } catch (e) {}
}

// Which island "Continue" goes to. #island2 … #islandN in the URL jump straight there (testing).
export function continueIsland(maxIsland) {
  const m = /^#island(\d+)$/.exec(location.hash);
  if (m) return clamp(+m[1], 1, maxIsland);
  return clamp(loadSave().island || 1, 1, maxIsland);
}
