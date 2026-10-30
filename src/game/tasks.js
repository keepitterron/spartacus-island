// Each island's to-do list: rendering it, ticking tasks off, and the celebration + win panel.
import { $ } from '../core/util.js';
import { game, currentIsland } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { secretProgress } from '../systems/secrets.js';

// Each island has tasks:{title, list:[{id, ic, t:()=>text, power?}]} and a matching
// done:{id:bool}. Task ids are unique across the whole game, so completeTask(id) finds its island.
export const allTasksDone = (island) => Object.values(island.done).every(Boolean);
export function initTasks(island) {
  island.done = {};
  for (const task of island.tasks.list) island.done[task.id] = false;
}

// popId: a task that was just ticked, so it gets the pop animation
export function renderTasks(popId) {
  const island = currentIsland(),
    tasks = island.tasks;
  $('#listTitle').textContent = tasks.title;
  $('#tasks').innerHTML =
    tasks.list.map((task) => taskHtml(task, { island, popId })).join('') + secretsHtml(island);
  $('#count').textContent =
    `${Object.values(island.done).filter(Boolean).length}/${tasks.list.length}`;
}

function taskHtml(task, { island, popId }) {
  const done = island.done[task.id];
  return `<li class="task${done ? ' done' : ''}${task.id === popId ? ' pop' : ''}"><span class="ic">${task.ic}</span><span class="t">${task.t()}</span><span class="ck">${done ? '🐾' : ''}</span></li>`;
}

// an extra line for the island's hidden presents; it never blocks finishing the island
function secretsHtml(island) {
  const { found, total } = secretProgress(island.id);
  if (!total) return '';
  const all = found === total;
  return `<li class="task secrets${all ? ' done' : ''}"><span class="ic">🎁</span><span class="t">Secrets ${found}/${total}</span><span class="ck">${all ? '🐾' : ''}</span></li>`;
}

export function completeTask(id) {
  const island = Object.values(game.islands).find((isl) => id in isl.done);
  if (!island || island.done[id]) return;
  island.done[id] = true;
  if (island === currentIsland()) renderTasks(id);
  if (allTasksDone(island)) {
    island.onAllDone?.();
    celebrate(island);
  }
}
// spin + confetti, then the island's win panel (shown from the main loop after ~2.8 s)
export function celebrate(island) {
  game.celebrateTime = 0;
  game.celebrateIsland = island;
  game.spinLeft = Math.PI * 4;
  sfx.win();
}

export function showWin(island) {
  const win = island.win;
  $('#winTitle').textContent = win.title;
  $('#winText').textContent = win.text;
  $('#winTip').textContent = win.tip || '';
  $('#winTip').classList.toggle('hidden', !win.tip);
  $('#winGo').textContent = win.go;
  $('#win').classList.remove('hidden');
  $('#winGo').focus();
}
export const hideWin = () => $('#win').classList.add('hidden');
