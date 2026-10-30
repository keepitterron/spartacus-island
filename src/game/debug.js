import {G,cam,cur} from '../core/state.js';
import {colliders} from '../core/colliders.js';
import {terrainH} from '../world/terrain.js';
import {P} from '../player/player.js';
import {setPower} from '../systems/powers.js';
import {complete,renderTasks} from './tasks.js';
import {currentAction,doAction} from './actions.js';
import {startGame,enterIsland} from './flow.js';

// Loaded with ?debug (and always in `npm run dev`). Use from the browser console:
//   __g.go(3)               jump to island 3
//   __g.tp(x, z)            teleport (island-local coordinates of the current island)
//   __g.power('boing')      give a power
//   __g.done('bones')       tick a task; __g.doneAll() ticks the whole list
//   __g.act()               press the action button; __g.action() shows what it would do
//   __g.where()             current island-local position
export function installDebug(){
  const local=()=>{const c=cur().center;return{ox:c.x,oz:c.z};};
  window.__g={G,P,cam,colliders,
    go(n){if(G.state==='start')startGame(n);else enterIsland(n,false);},
    tp(x,z,y){const {ox,oz}=local();P.pos.set(ox+x,y??terrainH(ox+x,oz+z)+.05,oz+z);P.vel.set(0,0,0);},
    where(){const {ox,oz}=local();return{x:+(P.pos.x-ox).toFixed(2),y:+P.pos.y.toFixed(2),z:+(P.pos.z-oz).toFixed(2),state:G.state,island:G.island};},
    power:setPower,
    done:complete,
    doneAll(){for(const k of cur().tasks.list)complete(k.id);renderTasks();},
    action(){const a=currentAction();return a&&a.label;},
    act:doAction,
  };
  console.info('[debug] window.__g ready: go(n), tp(x,z), power(t), done(id), doneAll(), act(), where()');
}
