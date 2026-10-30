import * as THREE from 'three';
import {flat,V} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {mat,mesh} from '../core/materials.js';
import {sfx} from '../core/audio.js';
import {burst} from '../core/fx.js';
import {terrainH} from '../world/terrain.js';
import {P,fwd} from '../player/player.js';

// Sand mounds you dig up with the action button. reward(d) runs when digging finishes
// (spawn a pickup, hand Spartacus an item…). marked=true paints a red X on it.
const digs=[];
const holeMat=new THREE.MeshStandardMaterial({color:0xb08a4a,roughness:1});
export function addDig(x,z,reward,marked,y){y=y!==undefined?y:terrainH(x,z);const m=mesh(new THREE.SphereGeometry(.65,9,6),mat(0xf0c86a),true,true);m.scale.set(1,.32,1);m.position.set(x,y,z);scene.add(m);
  if(marked)for(const r of [.7,-.7]){const b=mesh(new THREE.BoxGeometry(.7,.06,.12),mat(0xf2545b),false);b.rotation.y=r;b.position.set(x,y+.22,z);scene.add(b);m.userData.x=(m.userData.x||[]).concat(b);}
  const d={x,z,y,m,reward,dug:false};digs.push(d);return d;}
export const digNear=(p,r)=>digs.find(d=>!d.dug&&flat(p,d.x,d.z)<r);
export function digAction(p){for(const d of digs)if(!d.dug&&flat(p,d.x,d.z)<1.4&&Math.abs(p.y-d.y)<1)return{label:'Dig',fn:()=>startDig(d)};return null;}

function startDig(d){P.digT=1.1;P.dig=d;P.vel.x=P.vel.z=0;P.yaw=Math.atan2(d.x-P.pos.x,d.z-P.pos.z)||P.yaw;}
export function updDigging(dt){if(P.digT<=0)return;P.digT-=dt;P.scratchT-=dt;
  if(P.scratchT<=0){P.scratchT=.16;sfx.scratch();const f=fwd();burst(P.pos.clone().add(V(f.x*.7,.3,f.z*.7)),4,[0xf0c86a,0xffe08a],2,3,.6,.8,1,false,V(-f.x,0,-f.z));}
  if(P.digT<=0)finishDig(P.dig);}
function finishDig(d){d.dug=true;scene.remove(d.m);(d.m.userData.x||[]).forEach(b=>scene.remove(b));
  const h=new THREE.Mesh(new THREE.CircleGeometry(.5,10),holeMat);h.rotation.x=-Math.PI/2;h.position.set(d.x,d.y+.03,d.z);h.receiveShadow=true;scene.add(h);
  burst(V(d.x,d.y+.3,d.z),18,[0xf0c86a,0xffe08a],4,4,.7,1);
  d.reward(d);}
// little sparkles so mounds are easy to spot
export function updDigs(dt){for(const d of digs)if(!d.dug&&Math.random()<dt*1.2&&Math.abs(d.z-P.pos.z)<60)burst(V(d.x+(Math.random()-.5),d.y+.3,d.z+(Math.random()-.5)),1,0xffffff,.6,1.2,.6,.6,.1);}
