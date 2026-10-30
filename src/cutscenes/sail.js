import {$,V} from '../core/util.js';
import {camera} from '../core/renderer.js';
import {G,playing} from '../core/state.js';
import {sfx} from '../core/audio.js';
import {toast} from '../core/ui.js';
import {ship,placeShipAt,onDeck} from '../world/ship.js';
import {P} from '../player/player.js';
import {useUp} from '../systems/items.js';
import {updPower} from '../systems/powers.js';
import {hideWin} from '../game/tasks.js';
import {gull,wakeGull} from '../npcs/gull.js';

// Sailing cutscene: the ship follows a Catmull-Rom path (~13 s, skippable) to the next island.
const sail={t:0,path:null,onArrive:null};
export function startSail(path,onArrive){if(!playing())return;hideWin();
  if(P.carry)useUp();
  Object.assign(sail,{t:0,path,onArrive});G.state='sail';P.swing=null;$('#skip').classList.remove('hidden');updPower();sfx.horn();
  if(gull.state==='sleep')wakeGull();
  toast('Anchors up! Off to the next island…',3000);}
export const skipSail=()=>{sail.t=1;};
$('#skip').addEventListener('click',skipSail);

G.cutscenes.sail={update(dt){
  sail.t=Math.min(1,sail.t+dt/13);placeShipAt(sail.t,sail.path);
  P.pos.copy(onDeck());P.yaw=ship.rotation.y;P.vel.set(0,0,0);P.grounded=true;
  const yw=ship.rotation.y+2.3,want=V(ship.position.x+Math.sin(yw)*16,9,ship.position.z+Math.cos(yw)*16);
  camera.position.lerp(want,1-Math.exp(-dt*2.5));camera.lookAt(ship.position.x,2,ship.position.z);
  if(sail.t>=1){$('#skip').classList.add('hidden');sail.onArrive();}
},skip:skipSail};
