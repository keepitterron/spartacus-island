import * as THREE from 'three';
import {$,angLerp,V} from '../../core/util.js';
import {scene,camera,ambience,setAmbience} from '../../core/renderer.js';
import {mat,mesh} from '../../core/materials.js';
import {G,playing} from '../../core/state.js';
import {sfx} from '../../core/audio.js';
import {burst} from '../../core/fx.js';
import {ship,shipBubble,shipState,onDeck} from '../../world/ship.js';
import {P} from '../../player/player.js';
import {useUp} from '../../systems/items.js';
import {updPower} from '../../systems/powers.js';
import {hideWin} from '../../game/tasks.js';

// Ending of island 4: a big friendly whale swims under the ship and pushes it back up
// to the surface, the bubble pops, then "To be continued…".
const whale=new THREE.Group();
export function buildWhale(){const Bl=mat(0x3d6fd6),Bel=mat(0xbfd6ff),I=mat(0x1c2333);
  const body=mesh(new THREE.CapsuleGeometry(3,9,6,14),Bl);body.rotation.x=Math.PI/2;whale.add(body);
  const belly=mesh(new THREE.CapsuleGeometry(2.4,8,6,12),Bel);belly.rotation.x=Math.PI/2;belly.position.set(0,-1.1,.4);whale.add(belly);
  whale.userData.tail=new THREE.Group();whale.userData.tail.position.set(0,0,-7.2);whale.add(whale.userData.tail);
  for(const sd of [-1,1]){const f=mesh(new THREE.BoxGeometry(3.2,.35,1.8),Bl);f.position.set(sd*1.6,0,-.6);f.rotation.y=sd*.35;whale.userData.tail.add(f);
    const fin=mesh(new THREE.BoxGeometry(2.4,.3,1.2),Bl);fin.position.set(sd*3.2,-1,1.5);fin.rotation.z=sd*-.4;whale.add(fin);
    const e=mesh(new THREE.SphereGeometry(.32,8,6),I,false);e.position.set(sd*2.3,.3,4.6);whale.add(e);}
  const sm=mesh(new THREE.TorusGeometry(1,.1,5,14,Math.PI),I,false);sm.rotation.z=Math.PI;sm.position.set(0,-.3,5.85);whale.add(sm);
  whale.visible=false;scene.add(whale);}

const wh={t:0,shown:false,popped:false,popT:0};
export function startWhale(){if(!playing())return;hideWin();if(P.carry)useUp();
  P.climb=P.zip=P.swing=null;G.state='whale';wh.t=0;whale.visible=true;whale.position.set(ship.position.x-45,shipState.baseY-4,ship.position.z+12);sfx.whale();updPower();}

G.cutscenes.whale={update(dt){const T=G.T;wh.t+=dt;const tgt=V(ship.position.x,shipState.baseY-4.6,ship.position.z);whale.userData.tail.rotation.x=Math.sin(T*2.5)*.35;
  if(wh.t<5){whale.position.lerp(tgt,1-Math.exp(-dt*.9));whale.rotation.y=angLerp(whale.rotation.y,Math.atan2(tgt.x-whale.position.x,tgt.z-whale.position.z),Math.min(1,dt*2));}
  else{if(shipState.baseY<-.15)shipState.baseY=Math.min(-.15,shipState.baseY+dt*3.2);whale.position.lerp(V(ship.position.x,shipState.baseY-4.6,ship.position.z),1-Math.exp(-dt*4));}
  P.pos.copy(onDeck());P.yaw=ship.rotation.y;
  if(ambience.under&&shipState.baseY>-3)setAmbience(false);
  if(!wh.popped&&shipState.baseY>=-.15){wh.popped=true;wh.popT=0;shipBubble.visible=false;sfx.pop();burst(ship.position.clone().add(V(0,3,0)),40,[0xdff9ff,0xffffff],7,4,1.2,1.3);sfx.splashy();}
  if(wh.popped){wh.popT+=dt;if(Math.random()<dt*14)burst(V(whale.position.x,.3,whale.position.z+5),2,[0xffffff,0xbff3ff],2,9,1,1);
    if(wh.popT>2.5&&!wh.shown){wh.shown=true;sfx.win();$('#end').classList.remove('hidden');}}
  const a=T*.2,want=V(ship.position.x+Math.sin(a)*18,ship.position.y+5,ship.position.z+Math.cos(a)*18);
  camera.position.lerp(want,1-Math.exp(-dt*2.5));camera.lookAt(ship.position.x,ship.position.y,ship.position.z);
}};
