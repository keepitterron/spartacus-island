import * as THREE from 'three';
import {flat,lerp,smooth,V} from '../../core/util.js';
import {scene,LOW} from '../../core/renderer.js';
import {mat,mesh,canvasTex,paw} from '../../core/materials.js';
import {sfx} from '../../core/audio.js';
import {burst} from '../../core/fx.js';
import {toast,hintOnce,actWord} from '../../core/ui.js';
import {addCyl} from '../../core/colliders.js';
import {terrainH,buildGround} from '../../world/terrain.js';
import {C2,C3} from '../../world/layout.js';
import {palm,rock,rockTop,scatter,dock} from '../../world/props.js';
import {makeTin,makeBone} from '../../models/items.js';
import {P} from '../../player/player.js';
import {addItem,carry,useUp} from '../../systems/items.js';
import {addPickup,pickupText} from '../../systems/collect.js';
import {addFruit} from '../../systems/powers.js';
import {addDig} from '../../systems/digs.js';
import {addHook,swingOption} from '../../systems/hooks.js';
import {mango,placeMango,mangoHop,mangoToShip} from '../../npcs/mango.js';
import {startSail} from '../../cutscenes/sail.js';
import {complete} from '../../game/tasks.js';
import {enterIsland} from '../../game/flow.js';
import {tooHigh} from '../../game/interact.js';

/* ============ Island 2: Hook Rock Bay ============
   Stretchy fruit + golden hooks. Mango the parrot is stuck (too hungry to fly) on the
   tallest pillar in the lagoon; his snack is buried on a mesa only Boing-Boing reaches. */

const LG={x:C2.x+4,z:C2.z-5};          // the lagoon
const W2=(x,z)=>({x:C2.x+x,z:C2.z+z}); // island-local -> world
function edge(a){return 22+Math.sin(a*4)*1.5+Math.sin(a*2+.5)*1.2;}
function height(x,z){
  const lx=x-C2.x,lz=z-C2.z,r=Math.hypot(lx,lz),a=Math.atan2(lz,lx),e=edge(a);
  let h=1.1+.3*Math.sin(x*.4)*Math.cos(z*.33)+.15*Math.sin(x*.9-z*.5);
  const d=Math.hypot(x-LG.x,z-LG.z);if(d<13)h=d<11?-2:lerp(-2,h,smooth(11,13,d));
  h=lerp(h,.35,smooth(e-5,e-2,r));
  return lerp(h,-4,smooth(e,e+2.5,r));
}
const I2={};
const sailPath=new THREE.CatmullRomCurve3([V(5.6,0,C2.z+26.5),V(20,0,C2.z+37),V(42,0,C2.z),V(40,0,-240),V(24,0,-288),V(5.6,0,C3.z+32)]);

function build(){
  buildGround(C2.x,C2.z,64,LOW?90:140);
  const L=(x,z)=>W2(x,z);
  [[-16,4],[-4,15],[10,12],[14,7],[-10,-14],[-18,-3],[12,15],[-14,12],[6,-17],[-8,6]].forEach(([x,z])=>{const w=L(x,z);palm(w.x,w.z);});
  scatter(C2.x,C2.z,16,(x,z)=>Math.hypot(x-LG.x,z-LG.z)>14&&Math.hypot(x-(C2.x-12),z-(C2.z+7))>5&&!(Math.abs(x-C2.x)<3&&z>C2.z+12),16,90);
  dock(C2.x,C2.z+16.5,C2.z+27.5);
  I.spawn=V(C2.x,0,C2.z+13);I.spawn.y=terrainH(I.spawn.x,I.spawn.z);
  I2.dockZ=C2.z+20;
  // swing pads: two wooden launch platforms on the shore + rock pillars in the lagoon
  const platform=(x,z)=>{const gh=terrainH(x,z);const m=mesh(new THREE.CylinderGeometry(1.3,1.4,.3,12),mat(0xc48a54),true,true);m.position.set(x,gh+.15,z);scene.add(m);
    const pt=canvasTex(128,128,(c,w,h)=>{c.fillStyle='#c48a54';c.fillRect(0,0,w,h);paw(c,64,62,30,'#ffd84d');});
    const top=new THREE.Mesh(new THREE.CircleGeometry(1.25,16),new THREE.MeshStandardMaterial({map:pt,roughness:.9}));top.rotation.x=-Math.PI/2;top.position.set(x,gh+.31,z);top.receiveShadow=true;scene.add(top);
    addCyl(x,z,1.3,gh-1,gh+.3);return{x,z,y:gh+.3};};
  const pillar=(dx,dz,r,top)=>{const x=LG.x+dx,z=LG.z+dz;const y=rockTop(x,z,r,top,0x9aa6b8);return{x,z,y};};
  I2.S=platform(LG.x-13,LG.z);
  I2.P1=pillar(-6,0,1.4,3.2);
  I2.P2=pillar(-1,-7,1.3,5.2);
  I2.N=pillar(6,-3,1.8,11);   // Mango's pillar
  I2.E=platform(LG.x+13,LG.z+2);
  I2.B=pillar(4,6,1.05,6.6);
  // mesa: only reachable with a Boing-Boing jump
  const mx=C2.x-12,mz=C2.z+7;I2.mesa={x:mx,z:mz,y:rock(mx,mz,3.4,4.4,0xc9a27a)};
  const nest=mesh(new THREE.TorusGeometry(.6,.22,6,12),mat(0x9c6436));nest.rotation.x=Math.PI/2;nest.position.set(I2.N.x,I2.N.y+.15,I2.N.z);scene.add(nest);
  placeMango(I2.N,I2.P2,2);
  addHook(I2.S,I2.P1);addHook(I2.P1,I2.P2);addHook(I2.P2,I2.N);addHook(I2.N,I2.E);addHook(I2.P1,I2.B);
  addPickup(I2.P2.x,I2.P2.z,I2.P2.y,2);addPickup(I2.B.x,I2.B.z,I2.B.y,2);addPickup(I2.mesa.x+1.6,I2.mesa.z+.6,I2.mesa.y,2);
}
function buildLate(){
  {const w=W2(-6,11);addFruit('boing',w.x,w.z,terrainH(w.x,w.z),true);}
  {const w=W2(-12,-1);addFruit('stretch',w.x,w.z,terrainH(w.x,w.z),true);}
  addDig(I2.mesa.x-.5,I2.mesa.z-.5,d=>{const it=addItem('snack',makeTin(),V(d.x,d.y+.2,d.z),false,{name:'cracker tin',lift:.15});carry(it);toast('Mango’s cracker tin! Take it to the tall rock.',3400);complete('snack');},true,I2.mesa.y);
  {const w=W2(-15,-9);addDig(w.x,w.z,d=>{addPickup(d.x,d.z,d.y,2,.6);toast('A buried bone!',1800);});}
}

function feedMango(){useUp();sfx.parrot();
  burst(mango.g.position.clone().add(V(0,1,0)),24,[0xff9fb2,0xffd84d,0x3fbf5a],4,3,1,1);
  mangoHop();toast('Crunch! Mango hops onto Spartacus’s hat!',3000);complete('feed');}

const I={
  id:2,center:C2,name:'Hook Rock Bay',zMax:-85,height,
  tasks:{title:'Hook Rock Bay',list:[
    {id:'stretch',ic:'➰',t:()=>'Eat a Stretchy fruit',power:'stretch'},
    {id:'bones2',ic:'🦴',t:()=>pickupText(2,'bones')},
    {id:'snack',ic:'🍪',t:()=>'Dig up Mango’s snack'},
    {id:'feed',ic:'🦜',t:()=>'Feed Mango the parrot'},
    {id:'crew',ic:'⛵',t:()=>'Bring Mango to the ship'}]},
  collect:{total:4,count:0,taskId:'bones2',name:'Bone',all:'All the bones! Good boy, Spartacus!',model:makeBone},
  intro:[[3400,'Mango the parrot is stuck on the tallest rock!',3400]],
  win:{title:'New crew mate!',text:'Mango the parrot joined Spartacus’s crew! Next stop: a mysterious forest island.',tip:'You can also sail later from the end of the dock.',go:'Set sail! ⛵'},
  sailPath,
  exit:{label:'Sail',at:p=>p.z>C2.z+22&&Math.abs(p.x-C2.x)<1.6&&p.y>.5,run:()=>startSail(sailPath,()=>enterIsland(3,true))},
  build,buildLate,
  interact(p){
    tooHigh(flat(p,I2.mesa.x,I2.mesa.z)<5.5,'Too high! A Boing-Boing fruit grows nearby.');
    if(!P.stretch&&(flat(p,I2.S.x,I2.S.z)<3||flat(p,I2.E.x,I2.E.z)<3))hintOnce('hook','Golden hooks! Spartacus needs a Stretchy fruit to swing.',3400);
    if(P.stretch&&swingOption())hintOnce('swing',`Press ${actWord()} to swing!`,2400);
    if(mango.state==='hungry'&&flat(p,I2.N.x,I2.N.z)<3&&!(P.carry&&P.carry.id==='snack'))hintOnce('mango','Mango is too hungry to fly. Find his snack!',3200);
    // walking onto the dock with Mango on the hat: he flies up to the crow's nest
    if(mango.state==='riding'&&p.z>I2.dockZ&&Math.abs(p.x-C2.x)<1.6&&p.y>.5){mangoToShip(()=>complete('crew'));toast('Mango flies up to the crow’s nest!',3000);}},
  actions(p){const it=P.carry;
    if(it&&it.id==='snack'&&mango.state==='hungry'&&flat(p,I2.N.x,I2.N.z)<2.6&&Math.abs(p.y-I2.N.y)<1.5)return{label:'Give',fn:feedMango};
    return null;},
  bark(p){if(mango.state==='hungry'&&flat(p,I2.N.x,I2.N.z)<8){sfx.parrot();toast('Mango: “Snack? Snack?”',2000);}},
};
export default I;
