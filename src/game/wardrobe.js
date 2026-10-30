// The wardrobe: the 👕 button opens a dress-up panel while the camera moves round to look at
// Spartacus. Slot tabs along the top, a grid of that slot's accessories (ones not found yet are
// "?"), a random-outfit button and Done. Changes show on the dog straight away.
import { $, lerpAngle, vec3 } from '../core/util.js';
import { camera, canvas } from '../core/renderer.js';
import { game, isPlaying } from '../core/state.js';
import { sfx, audioContext } from '../core/audio.js';
import { toast } from '../core/ui.js';
import { player } from '../player/player.js';
import { updatePowerHud } from '../systems/powers.js';
import {
  SLOTS,
  DEFAULT_HAT,
  outfit,
  itemsForSlot,
  wear,
  takeOff,
  randomOutfit,
} from '../systems/outfits.js';

// open: which tab is showing; viewAngle: the camera's angle round Spartacus (0 = facing him)
const wardrobe = { tab: 'head', viewAngle: 0 };

export function installWardrobe() {
  game.cutscenes.wardrobe = { update: updateWardrobeCamera, skip: closeWardrobe };
  $('#btnWardrobe').addEventListener('click', openWardrobe);
  $('#wardrobeDone').addEventListener('click', closeWardrobe);
  $('#wardrobeRandom').addEventListener('click', () => {
    randomOutfit();
    sfx.pop();
    renderWardrobe();
  });
}

export function openWardrobe() {
  if (game.state === 'wardrobe') return;
  audioContext();
  const busy = player.digTimer > 0 || player.placing || player.swing || player.climb || player.zip;
  if (!isPlaying() || busy || !player.grounded) {
    toast('Stand on the ground to dress up!', 2000);
    return;
  }
  game.state = 'wardrobe';
  player.vel.set(0, 0, 0);
  wardrobe.viewAngle = 0;
  updatePowerHud();
  renderWardrobe();
  $('#wardrobe').classList.remove('hidden');
  $('#wardrobeDone').focus();
}

function closeWardrobe() {
  if (game.state !== 'wardrobe') return;
  game.state = 'play';
  $('#wardrobe').classList.add('hidden');
  updatePowerHud();
  canvas.focus();
}

function renderWardrobe() {
  $('#wardrobeTabs').innerHTML = SLOTS.map(
    (slot) =>
      `<button class="tab${slot.id === wardrobe.tab ? ' on' : ''}" data-slot="${slot.id}" aria-label="${slot.name}">${slot.icon}</button>`,
  ).join('');
  for (const tab of $('#wardrobeTabs').children)
    tab.addEventListener('click', () => {
      wardrobe.tab = tab.dataset.slot;
      sfx.pop();
      renderWardrobe();
    });
  const items = itemsForSlot(wardrobe.tab);
  const cells = items.map((item) => itemCell(item));
  // every slot but the head can be left empty (the head falls back to the straw hat)
  if (wardrobe.tab !== 'head')
    cells.unshift(
      `<button class="cell${outfit.equipped[wardrobe.tab] ? '' : ' on'}" data-none="1" aria-label="Nothing"><span>✖️</span><small>None</small></button>`,
    );
  $('#wardrobeGrid').innerHTML = cells.join('');
  for (const cell of $('#wardrobeGrid').children) cell.addEventListener('click', () => pick(cell));
}

function itemCell(item) {
  if (!outfit.owned.has(item.id))
    return `<button class="cell locked" disabled aria-label="Not found yet"><span>?</span><small>Hidden</small></button>`;
  const on = outfit.equipped[item.slot] === item.id;
  return `<button class="cell${on ? ' on' : ''}" data-id="${item.id}" aria-label="${item.name}"><span>${item.icon}</span><small>${item.name}</small></button>`;
}

function pick(cell) {
  if (cell.dataset.none) takeOff(wardrobe.tab);
  else if (outfit.equipped[wardrobe.tab] === cell.dataset.id && wardrobe.tab !== 'head')
    takeOff(wardrobe.tab); // tapping what's worn takes it off
  else wear(cell.dataset.id || DEFAULT_HAT);
  sfx.pop();
  renderWardrobe();
}

// a close-up in front of Spartacus, swaying a little; back and tail tabs look from behind.
// The panel covers the bottom of the screen, so the camera looks a bit below him to keep
// him in the top half.
function updateWardrobeCamera(dt) {
  const fromBehind = wardrobe.tab === 'back' || wardrobe.tab === 'tail';
  const wanted = (fromBehind ? Math.PI * 0.8 : 0.35) + Math.sin(game.time * 0.6) * 0.35;
  wardrobe.viewAngle = lerpAngle(wardrobe.viewAngle, wanted, Math.min(1, dt * 3));
  const angle = player.yaw + wardrobe.viewAngle,
    pos = player.pos;
  // further back on tall (portrait) screens so he still fits above the panel
  const distance = camera.aspect < 1 ? 7.5 : 5;
  const target = vec3(
    pos.x + Math.sin(angle) * distance,
    pos.y + 2.4,
    pos.z + Math.cos(angle) * distance,
  );
  camera.position.lerp(target, 1 - Math.exp(-dt * 5));
  camera.lookAt(pos.x, pos.y - (camera.aspect < 1 ? 1.2 : 0.3), pos.z);
}
