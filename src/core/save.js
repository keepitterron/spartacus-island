import { clamp } from './util.js';

// The save: {v, island, owned: [accessory ids], equipped: {slot: id}, secrets: [secret ids], muted}.
// Bump VERSION when the shape changes and add a step to migrate() so older saves keep working.
const STORAGE_KEY = 'spartacus-save';
const VERSION = 4;

// v3 was island-only; everything else starts empty
function migrate(save) {
  if (save.v === VERSION) return save;
  if (save.v === 3) return { v: VERSION, island: save.island };
  return {};
}

// storage can be missing or blocked (private mode), so failures just mean "no save"
export function loadSave() {
  try {
    return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {});
  } catch (e) {
    return {};
  }
}
// merges `data` into the save, so each system only writes its own fields
export function writeSave(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSave(), ...data, v: VERSION }));
  } catch (e) {}
}

// Which island "Continue" goes to. #island2 … #islandN in the URL jump straight there (testing).
export function continueIsland(maxIsland) {
  const match = /^#island(\d+)$/.exec(location.hash);
  if (match) return clamp(Number(match[1]), 1, maxIsland);
  return clamp(loadSave().island || 1, 1, maxIsland);
}
