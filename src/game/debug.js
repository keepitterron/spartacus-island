import { game, followCam, currentIsland } from '../core/state.js';
import { colliders } from '../core/colliders.js';
import { terrainHeight } from '../world/terrain.js';
import { player } from '../player/player.js';
import { setPower } from '../systems/powers.js';
import { completeTask, renderTasks } from './tasks.js';
import { currentAction, doAction } from './actions.js';
import { startGame, enterIsland } from './flow.js';

// Loaded with ?debug (and always in `npm run dev`). Use from the browser console:
//   __g.go(3)               jump to island 3
//   __g.tp(x, z)            teleport (island-local coordinates of the current island)
//   __g.power('boing')      give a power
//   __g.done('bones')       tick a task; __g.doneAll() ticks the whole list
//   __g.act()               press the action button; __g.action() shows what it would do
//   __g.where()             current island-local position
export function installDebug() {
  const local = () => {
    const c = currentIsland().center;
    return { ox: c.x, oz: c.z };
  };
  window.__g = {
    game,
    player,
    followCam,
    colliders,
    go(n) {
      if (game.state === 'start') startGame(n);
      else enterIsland(n, false);
    },
    tp(x, z, y) {
      const { ox, oz } = local();
      player.pos.set(ox + x, y ?? terrainHeight(ox + x, oz + z) + 0.05, oz + z);
      player.vel.set(0, 0, 0);
    },
    where() {
      const { ox, oz } = local();
      return {
        x: +(player.pos.x - ox).toFixed(2),
        y: +player.pos.y.toFixed(2),
        z: +(player.pos.z - oz).toFixed(2),
        state: game.state,
        island: game.island,
      };
    },
    power: setPower,
    done: completeTask,
    doneAll() {
      for (const k of currentIsland().tasks.list) completeTask(k.id);
      renderTasks();
    },
    action() {
      const a = currentAction();
      return a && a.label;
    },
    act: doAction,
  };
  console.info(
    '[debug] window.__g ready: go(n), tp(x,z), power(t), done(id), doneAll(), act(), where()',
  );
}
