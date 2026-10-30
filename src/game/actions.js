import { $, clamp, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { game, currentIsland, isPlaying, isInCutscene } from '../core/state.js';
import { sfx, audioContext } from '../core/audio.js';
import { textSprite } from '../core/fx.js';
import { player } from '../player/player.js';
import { dropCarried, grabAction } from '../systems/items.js';
import { digAction } from '../systems/digs.js';
import { swingAction } from '../systems/hooks.js';
import { allTasksDone } from './tasks.js';

// The context button (F / green button). Whatever is first in this list wins:
//   1. the island's exit (Sail / Dive / Ride), once its to-do list is done
//   2. the island's own actions(p)  (give an item, open a gate, grow, chop…)
//   3. swing, drop, grab, dig
export function currentAction() {
  if (
    !isPlaying() ||
    player.digTimer > 0 ||
    player.placing ||
    player.swing ||
    player.climb ||
    player.zip
  )
    return null;
  const I = currentIsland(),
    p = player.pos;
  if (I.exit && allTasksDone(I) && I.exit.at(p)) return { label: I.exit.label, fn: I.exit.run };
  return (
    I.actions?.(p) ||
    swingAction() ||
    (player.carrying ? { label: 'Drop', fn: dropCarried } : null) ||
    grabAction(p) ||
    digAction(p)
  );
}
export function doAction() {
  if (game.state === 'start') return;
  audioContext();
  const a = currentAction();
  if (a) a.fn();
}

let lastLabel;
export function updatePrompt() {
  const a = currentAction(),
    label = a ? a.label : null;
  if (label !== lastLabel) {
    lastLabel = label;
    const pr = $('#prompt'),
      btn = $('#btnAct');
    if (label) {
      pr.firstChild.innerHTML = `<kbd>F</kbd> ${label}`;
      pr.classList.add('show');
      btn.textContent = label;
      btn.classList.remove('off');
    } else {
      pr.classList.remove('show');
      btn.textContent = player.carrying ? 'Drop' : 'Grab';
      btn.classList.add('off');
    }
  }
}

// Woof! Islands react in bark(p) (wake the gull, call Mango, find hidden crabs…)
let woof = null,
  woofT = 0;
export function bark() {
  if (game.state === 'start' || isInCutscene() || player.barkCooldown > 0) return;
  player.barkCooldown = 0.45;
  player.barkTimer = 0.35;
  sfx.bark();
  if (!woof) {
    woof = textSprite('WOOF!', '#ffd84d');
    woof.scale.set(3.2, 0.8, 1);
    scene.add(woof);
  }
  woofT = 0.8;
  currentIsland().bark?.(player.pos);
}
export function updateWoof(dt) {
  if (woof && woofT > 0) {
    woofT -= dt;
    woof.visible = true;
    woof.position.copy(player.pos).add(vec3(0, 2.6 + (0.8 - woofT) * 1.2, 0));
    woof.material.opacity = clamp(woofT / 0.4, 0, 1);
    const s = 1.6 + (0.8 - woofT);
    woof.scale.set(s * 2, s / 2, 1);
  } else if (woof) woof.visible = false;
}
