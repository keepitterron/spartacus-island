// What Spartacus owns and wears. One accessory per slot; the head slot swaps out the straw
// hat (which is always owned). The catalog is models/accessories.js.
import * as THREE from 'three';
import { game } from '../core/state.js';
import { loadSave, writeSave } from '../core/save.js';
import { dog } from '../player/dog.js';
import { ACCESSORIES, accessory } from '../models/accessories.js';

export const SLOTS = [
  { id: 'head', icon: '🎩', name: 'Hats' },
  { id: 'face', icon: '🕶️', name: 'Face' },
  { id: 'neck', icon: '🧣', name: 'Neck' },
  { id: 'back', icon: '🎒', name: 'Back' },
  { id: 'tail', icon: '🐾', name: 'Tail' },
];
export const DEFAULT_HAT = 'straw-hat';

// owned: accessory ids; equipped: slot -> id; worn: slot -> the group on the dog right now
export const outfit = { owned: new Set([DEFAULT_HAT]), equipped: { head: DEFAULT_HAT }, worn: {} };

let anchors = null;
// where each slot hangs on the dog; built on first use so the dog model exists by then
function anchor(name) {
  if (!anchors) {
    const neck = new THREE.Group();
    neck.position.set(0, 1.02, 0.5);
    dog.body.add(neck);
    const back = new THREE.Group();
    back.position.set(0, 1.12, -0.15);
    dog.body.add(back);
    const tail = new THREE.Group();
    tail.position.y = 0.4;
    dog.tail.add(tail);
    // ears[1] is the dog's left ear (on +x)
    anchors = { head: dog.hat, face: dog.head, neck, back, tail, ear: dog.ears[1] };
  }
  return anchors[name];
}

export const itemsForSlot = (slot) => ACCESSORIES.filter((item) => item.slot === slot);

// put on accessory `id` (replacing whatever is in its slot); false if it isn't owned
export function wear(id) {
  const item = accessory(id);
  if (!item || !outfit.owned.has(id)) return false;
  takeOff(item.slot);
  outfit.equipped[item.slot] = id;
  if (id === DEFAULT_HAT) dog.strawHat.visible = true;
  else {
    if (item.slot === 'head') dog.strawHat.visible = false;
    const group = item.build();
    anchor(item.anchor || item.slot).add(group);
    outfit.worn[item.slot] = group;
  }
  saveOutfit();
  return true;
}

// empty a slot; the head slot goes back to the straw hat
export function takeOff(slot) {
  outfit.worn[slot]?.removeFromParent();
  delete outfit.worn[slot];
  delete outfit.equipped[slot];
  if (slot === 'head') {
    dog.strawHat.visible = true;
    outfit.equipped.head = DEFAULT_HAT;
  }
  saveOutfit();
}

export function giveAccessory(id) {
  if (!accessory(id)) return;
  outfit.owned.add(id);
  saveOutfit();
}

// a random outfit from what's owned; each slot may stay empty
export function randomOutfit() {
  for (const { id: slot } of SLOTS) {
    const choices = itemsForSlot(slot).filter((item) => outfit.owned.has(item.id));
    const pick = choices[Math.floor(Math.random() * (choices.length + 1))];
    if (pick) wear(pick.id);
    else takeOff(slot);
  }
}

// wings flap, capes flutter
export function updateOutfit() {
  for (const group of Object.values(outfit.worn)) group.userData.animate?.(group, game.time);
}

function saveOutfit() {
  writeSave({ owned: [...outfit.owned], equipped: outfit.equipped });
}

export function loadOutfit() {
  const save = loadSave();
  for (const id of save.owned || []) if (accessory(id)) outfit.owned.add(id);
  for (const id of Object.values(save.equipped || {})) wear(id);
}
