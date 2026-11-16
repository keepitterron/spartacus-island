// Treasures Spartacus keeps: bonus finds (island 1's amethyst, …) that aren't tasks, just things to
// be proud of. Once found, a treasure goes on display on the ship's deck and stays there, saved,
// for the rest of the game; starting over clears them (game/flow.js).
import { vec3 } from '../core/util.js';
import { loadSave, writeSave } from '../core/save.js';
import { ship } from '../world/ship.js';
import { makeAmethyst } from '../models/items.js';

// treasure id -> model; add new treasures here
const TREASURES = { amethyst: makeAmethyst };
// where they stand on deck (ship-local, by the rail), in the order they're found
const SLOTS = [vec3(-0.75, 1.38, 1.5), vec3(-0.75, 1.38, 0.8), vec3(0.75, 1.38, 0.6)];
const shown = {}; // id -> model on deck

const keptIds = () => loadSave().treasures ?? [];
export const hasTreasure = (id) => keptIds().includes(id);

function showOnDeck(id) {
  if (shown[id] || !TREASURES[id]) return;
  const model = TREASURES[id]();
  model.position.copy(SLOTS[Object.keys(shown).length % SLOTS.length]);
  ship.add(model);
  shown[id] = model;
}

// found one: save it and put it on the ship
export function keepTreasure(id) {
  if (!hasTreasure(id)) writeSave({ treasures: [...keptIds(), id] });
  showOnDeck(id);
}

// at boot: everything found in earlier visits is already on deck
export function showSavedTreasures() {
  for (const id of keptIds()) showOnDeck(id);
}
