import { $ } from '../core/util.js';
import { game, currentIsland } from '../core/state.js';
import { sfx } from '../core/audio.js';

// Each island has tasks:{title, list:[{id, ic, t:()=>text, power?}]} and a matching
// done:{id:bool}. Task ids are unique across the whole game, so complete(id) finds its island.
export const allTasksDone = (isl) => Object.values(isl.done).every(Boolean);
export function initTasks(isl) {
  isl.done = {};
  for (const k of isl.tasks.list) isl.done[k.id] = false;
}

export function renderTasks(popId) {
  const I = currentIsland(),
    T = I.tasks;
  $('#listTitle').textContent = T.title;
  $('#tasks').innerHTML = T.list
    .map(
      (k) =>
        `<li class="task${I.done[k.id] ? ' done' : ''}${k.id === popId ? ' pop' : ''}"><span class="ic">${k.ic}</span><span class="t">${k.t()}</span><span class="ck">${I.done[k.id] ? '🐾' : ''}</span></li>`,
    )
    .join('');
  $('#count').textContent = `${Object.values(I.done).filter(Boolean).length}/${T.list.length}`;
}

export function completeTask(id) {
  const I = Object.values(game.islands).find((i) => id in i.done);
  if (!I || I.done[id]) return;
  I.done[id] = true;
  if (I === currentIsland()) renderTasks(id);
  if (allTasksDone(I)) {
    I.onAllDone?.();
    celebrate(I);
  }
}
// spin + confetti, then the island's win panel (shown from the main loop after ~2.8 s)
export function celebrate(I) {
  game.celebrateTime = 0;
  game.celebrateIsland = I;
  game.spinLeft = Math.PI * 4;
  sfx.win();
}

export function showWin(I) {
  const w = I.win;
  $('#winTitle').textContent = w.title;
  $('#winText').textContent = w.text;
  $('#winTip').textContent = w.tip || '';
  $('#winTip').classList.toggle('hidden', !w.tip);
  $('#winGo').textContent = w.go;
  $('#win').classList.remove('hidden');
  $('#winGo').focus();
}
export const hideWin = () => $('#win').classList.add('hidden');
