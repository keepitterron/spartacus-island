// The context button (F / green button) and what it would do right now, plus barking.
import { $, clamp, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { game, currentIsland, isPlaying, isInCutscene } from '../core/state.js';
import { sfx, audioContext } from '../core/audio.js';
import { textSprite } from '../core/fx.js';
import { player } from '../player/player.js';
import { dropCarried, grabAction } from '../systems/items.js';
import { digAction } from '../systems/digs.js';
import { swingAction } from '../systems/hooks.js';
import { barkReactions } from '../systems/reactions.js';
import { poundAction } from '../player/pound.js';
import { allTasksDone } from './tasks.js';

// Returns {label, fn} or null. Whatever is first in this list wins:
//   1. the island's exit (Sail / Dive / Ride), once its to-do list is done
//   2. the island's own actions(p)  (give an item, open a gate, grow, chop…)
//   3. swing, drop, grab, dig, and in the air the ground pound
export function currentAction() {
  const busy = player.digTimer > 0 || player.placing || player.swing || player.climb || player.zip;
  if (!isPlaying() || busy) return null;
  const island = currentIsland(),
    pos = player.pos;
  if (island.exit && allTasksDone(island) && island.exit.at(pos))
    return { label: island.exit.label, run: island.exit.run };
  return (
    island.actions?.(pos) ||
    swingAction() ||
    (player.carrying ? { label: 'Drop', run: dropCarried } : null) ||
    grabAction(pos) ||
    digAction(pos) ||
    poundAction()
  );
}
export function doAction() {
  if (game.state === 'start') return;
  audioContext();
  currentAction()?.run();
}

// show the prompt / button label, touching the DOM only when it changes
let lastLabel;
export function updatePrompt() {
  const action = currentAction(),
    label = action ? action.label : null;
  if (label === lastLabel) return;
  lastLabel = label;
  const prompt = $('#prompt'),
    button = $('#btnAct');
  if (label) {
    prompt.firstChild.innerHTML = `<kbd>F</kbd> ${label}`;
    prompt.classList.add('show');
    button.textContent = label;
    button.classList.remove('off');
  } else {
    prompt.classList.remove('show');
    button.textContent = player.carrying ? 'Drop' : 'Grab';
    button.classList.add('off');
  }
}

// Woof! Islands react in bark(p) (wake the gull, call Mango, find hidden crabs…)
const WOOF_TIME = 0.8;
let woofSprite = null,
  woofTimer = 0;
export function bark() {
  if (game.state === 'start' || isInCutscene() || player.barkCooldown > 0) return;
  player.barkCooldown = 0.45;
  player.barkTimer = 0.35;
  sfx.bark();
  if (!woofSprite) {
    woofSprite = textSprite('WOOF!', '#ffd84d');
    woofSprite.scale.set(3.2, 0.8, 1);
    scene.add(woofSprite);
  }
  woofTimer = WOOF_TIME;
  barkReactions(player.pos);
  currentIsland().bark?.(player.pos);
}
// the WOOF! floats up, grows and fades out over the last 0.4 s
export function updateWoof(dt) {
  if (!woofSprite) return;
  if (woofTimer <= 0) {
    woofSprite.visible = false;
    return;
  }
  woofTimer -= dt;
  woofSprite.visible = true;
  woofSprite.position.copy(player.pos).add(vec3(0, 2.6 + (WOOF_TIME - woofTimer) * 1.2, 0));
  woofSprite.material.opacity = clamp(woofTimer / 0.4, 0, 1);
  const size = 1.6 + (WOOF_TIME - woofTimer);
  woofSprite.scale.set(size * 2, size / 2, 1);
}
