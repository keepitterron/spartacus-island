import * as THREE from 'three';
import {flat,lerp,smooth,rand,V} from '../../core/util.js';
import {scene,LOW} from '../../core/renderer.js';
import {mat,mesh} from '../../core/materials.js';
import {G} from '../../core/state.js';
import {sfx} from '../../core/audio.js';
import {burst} from '../../core/fx.js';
import {toast,hintOnce,actWord} from '../../core/ui.js';
import {addCyl,addBox} from '../../core/colliders.js';
import {terrainH,buildGround} from '../../world/terrain.js';
import {C1,C2} from '../../world/layout.js';
import {palm,rock,crate,scatter,dock} from '../../world/props.js';
import {makePlank,makeKey,makeBoot,makeBone} from '../../models/items.js';
import {P} from '../../player/player.js';
import {addItem,carry,useUp,placeItem} from '../../systems/items.js';
import {addPickup,pickupText} from '../../systems/collect.js';
import {addFruit} from '../../systems/powers.js';
import {addDig,digNear} from '../../systems/digs.js';
import {gull,perchGull,wakeGull} from '../../npcs/gull.js';
import {startSail} from '../../cutscenes/sail.js';
import {complete} from '../../game/tasks.js';
import {enterIsland} from '../../game/flow.js';
import {tooHigh} from '../../game/interact.js';

/* ============ Island 1: the starter island ============
   Bones, the Boing-Boing fruit, a sleepy seagull, the lighthouse bell, a broken bridge,
   a buried key and a treasure chest with the map to island 2. */

const POND={x:8,z:-8};
const HILL={x:-11,z:-15,r:9,h:4.5};
function edge(a){return 30+Math.sin(a*3)*1.8+Math.sin(a*5+1)*1.0;}
function height(x,z){
  const r=Math.hypot(x,z),a=Math.atan2(z,x),e=edge(a);
  let h=1.2+.35*Math.sin(x*.3)*Math.cos(z*.27)+.2*Math.sin(x*.7+z*.55);
  const hd=Math.hypot(x-HILL.x,z-HILL.z);if(hd<HILL.r){const t=1-hd/HILL.r;h+=HILL.h*t*t*(3-2*t);}
  const d=Math.hypot(x-POND.x,z-POND.z);
  if(d<14){let p;if(d<2.5)p=1;else if(d<3.5)p=lerp(1,-2,d-2.5);else if(d<12)p=-2;else p=lerp(-2,h,smooth(12,14,d));h=p;}
  h=lerp(h,.35,smooth(e-6,e-2.5,r));
  return lerp(h,-4,smooth(e,e+2.5,r));
}

const GPOST={x:-1.8,z:35.3,top:1.6};   // the seagull's post on the dock
const LH={x:-19,z:-3};                 // lighthouse
const FR={x:21,z:6};                   // rock with the Boing-Boing fruit
const BR={z:-8,y:1.3,gap0:-2.5,gap1:3.5}; // bridge over the pond and its broken gap
const CHEST={x:HILL.x,z:HILL.z};       // on top of the hill
const WOOD={x:-12,z:7};                // log pile (the plank)
const lilies=[];
let ghost,scroll;

const sailPath=new THREE.CatmullRomCurve3([V(5.6,0,33.5),V(14,0,47),V(40,0,32),V(48,0,-40),V(40,0,-108),V(22,0,-128),V(5.6,0,C2.z+26.5)]);

function build(){
  buildGround(0,0,100,LOW?120:200);
  I.spawn=V(0,0,21);I.spawn.y=terrainH(I.spawn.x,I.spawn.z);
  [[16,17],[21,12],[-6,21],[11,23],[-24,8],[-21,-12],[-2,-24],[12,-23],[25,-6],[25,3],[-14,20],[-26,-1],[7.2,-7.3],[-15,-9],[3,12],[-3,-4],[18,-16],[-9,4]].forEach(p=>palm(p[0],p[1]));
  scatter(0,0,20,(x,z)=>Math.hypot(x-POND.x,z-POND.z)>15&&Math.hypot(x+19,z+3)>5&&Math.hypot(x-HILL.x,z-HILL.z)>3&&!(Math.abs(x)<3&&z>17),26,140);
  dock(0,25,36);
  {const p=mesh(new THREE.CylinderGeometry(.24,.26,4,7),mat(0x8b5a3c));p.position.set(GPOST.x,GPOST.top-2,GPOST.z);scene.add(p);addCyl(GPOST.x,GPOST.z,.26,-3,GPOST.top);}
  perchGull(GPOST);
  crate(3.1,20.2);const crateTop=crate(4.35,19.8);

  /* lighthouse: climb the rock with Boing-Boing, then jump onto the deck to ring the bell */
  {
    const gh=terrainH(LH.x,LH.z),g=new THREE.Group();g.position.set(LH.x,gh,LH.z);g.rotation.y=Math.atan2(-LH.x,-LH.z);scene.add(g);
    for(let i=0;i<4;i++){const r0=lerp(1.9,1.5,i/4),r1=lerp(1.9,1.5,(i+1)/4);const m=mesh(new THREE.CylinderGeometry(r1,r0,2,16),mat(i%2?0xf2545b:0xfffaf0),true,true);m.position.y=2*i+1;g.add(m);}
    const door=mesh(new THREE.BoxGeometry(.8,1.3,.2),mat(0x2fa4c7));door.position.set(0,.65,1.86);g.add(door);
    for(const y of [3,5.2]){const w=mesh(new THREE.BoxGeometry(.45,.6,.2),mat(0x2b3a55));w.position.set(0,y,lerp(1.9,1.5,y/8)-.02);g.add(w);}
    const deck=mesh(new THREE.CylinderGeometry(2.3,2.3,.4,16),mat(0xc48a54),true,true);deck.position.y=8.2;g.add(deck);
    for(let k=0;k<14;k++){const a=k/14*6.283,p=mesh(new THREE.CylinderGeometry(.05,.05,.55,4),mat(0xfffaf0));p.position.set(Math.cos(a)*2.15,8.68,Math.sin(a)*2.15);g.add(p);}
    const rail=mesh(new THREE.TorusGeometry(2.15,.06,4,28),mat(0xfffaf0));rail.rotation.x=Math.PI/2;rail.position.y=8.95;g.add(rail);
    for(const k of [-1,1]){const p=mesh(new THREE.BoxGeometry(.16,1.95,.16),mat(0x7a4a2a));p.position.set(k*.78,8.4+.97,0);g.add(p);}
    const bar=mesh(new THREE.BoxGeometry(1.8,.16,.16),mat(0x7a4a2a));bar.position.y=10.35;g.add(bar);
    const roof=mesh(new THREE.ConeGeometry(1.25,.7,4),mat(0xf2545b));roof.position.y=10.8;roof.rotation.y=Math.PI/4;g.add(roof);
    const pts=[[.03,0],[.16,-.03],[.22,-.15],[.26,-.45],[.42,-.72],[.47,-.8]].map(p=>new THREE.Vector2(p[0],p[1]));
    LH.bell=new THREE.Group();LH.bell.position.y=10.25;g.add(LH.bell);
    LH.bell.add(mesh(new THREE.LatheGeometry(pts,12),mat(0xffc83d,{metalness:.35,roughness:.4,side:THREE.DoubleSide})));
    const cl=mesh(new THREE.SphereGeometry(.1,6,5),mat(0x7a4a2a));cl.position.y=-.7;LH.bell.add(cl);
    LH.deckTop=gh+8.4;LH.swing=0;
    addCyl(LH.x,LH.z,1.9,gh-2,gh+8);addCyl(LH.x,LH.z,2.3,gh+8,gh+8.4);
    const ca=Math.cos(g.rotation.y),sa=Math.sin(g.rotation.y);
    for(const k of [-1,1])addCyl(LH.x+k*.78*ca,LH.z-k*.78*sa,.12,gh+8.3,gh+10.4);
  }
  {const dx=-LH.x,dz=-LH.z,d=Math.hypot(dx,dz);LH.rockX=LH.x+dx/d*4.4;LH.rockZ=LH.z+dz/d*4.4;LH.rockTop=rock(LH.rockX,LH.rockZ,1.55,4.35);}
  FR.top=rock(FR.x,FR.z,1.1,1.15);
  rock(-23,18,1.3,.8);rock(14,20,.9,.6);rock(-6,-26,1.4,1.2);

  /* pond: a bridge with a gap (fix it with the plank) + lily pads to hop across */
  const bridgePart=(x0,x1)=>{
    const n=Math.round((x1-x0)/.55);
    for(let i=0;i<n;i++){const x=x0+(i+.5)*(x1-x0)/n;const p=mesh(new THREE.BoxGeometry((x1-x0)/n*.9,.16,1.8),mat(i%2?0xc48a54:0xb57b46),true,true);p.position.set(x,BR.y-.08,BR.z);p.rotation.x=(rand()-.5)*.04;scene.add(p);}
    for(const x of [x0+.2,x1-.2])for(const s of [-1,1]){const p=mesh(new THREE.CylinderGeometry(.11,.11,3.6,6),mat(0x7a4a2a));p.position.set(x,BR.y-1.4,BR.z+s*.95);scene.add(p);}
    for(const s of [-1,1]){const r=mesh(new THREE.CylinderGeometry(.04,.04,x1-x0,4),mat(0xe8d3a0));r.rotation.z=Math.PI/2;r.position.set((x0+x1)/2,BR.y+.55,BR.z+s*.95);scene.add(r);
      for(const x of [x0+.2,x1-.2]){const q=mesh(new THREE.CylinderGeometry(.06,.06,.6,5),mat(0x7a4a2a));q.position.set(x,BR.y+.3,BR.z+s*.95);scene.add(q);}}
    addBox((x0+x1)/2,BR.z,(x1-x0)/2,.9,-3,BR.y);
  };
  bridgePart(-7.5,BR.gap0);bridgePart(BR.gap1,6.2);
  ghost=mesh(new THREE.BoxGeometry(BR.gap1-BR.gap0,.16,1.6),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.28,depthWrite:false}),false);
  ghost.position.set((BR.gap0+BR.gap1)/2,BR.y-.08,BR.z);scene.add(ghost);
  [100,79,58,37,16,-5].forEach((deg,i,arr)=>{const a=deg*Math.PI/180,last=i===arr.length-1,r=last?1.15:.85;const x=POND.x+Math.cos(a)*10.5,z=POND.z+Math.sin(a)*10.5;
    const g=new THREE.Group();g.position.set(x,.16,z);
    g.add(mesh(new THREE.CylinderGeometry(r,r,.12,12,1,false,.4,5.8),mat(0x5fbf5a),true,true));
    if(i%2===0||last){const fl=mesh(new THREE.IcosahedronGeometry(.18,0),mat(0xff9fb2),false);fl.position.set(r*.4,.15,-r*.3);g.add(fl);}
    scene.add(g);lilies.push({g,phase:i});addCyl(x,z,r,-3,.22);});

  /* treasure chest on the hill */
  {
    const gh=terrainH(CHEST.x,CHEST.z);CHEST.y=gh;const g=new THREE.Group();g.position.set(CHEST.x,gh,CHEST.z);g.rotation.y=Math.atan2(-CHEST.x,-CHEST.z);scene.add(g);
    const base=mesh(new THREE.BoxGeometry(1.5,.85,1.05),mat(0xb5743e),true,true);base.position.y=.43;g.add(base);
    for(const x of [-.55,.55]){const b=mesh(new THREE.BoxGeometry(.14,.88,1.08),mat(0xffc83d,{metalness:.3,roughness:.5}));b.position.set(x,.43,0);g.add(b);}
    CHEST.lid=new THREE.Group();CHEST.lid.position.set(0,.85,-.52);g.add(CHEST.lid);
    const lg=new THREE.CylinderGeometry(.52,.52,1.5,10,1,false,0,Math.PI);lg.rotateZ(Math.PI/2);
    const lid=mesh(lg,mat(0xc4834a));lid.rotateX(-Math.PI/2);lid.position.set(0,0,.52);CHEST.lid.add(lid);
    const lock=mesh(new THREE.BoxGeometry(.28,.32,.1),mat(0xffc83d,{metalness:.3,roughness:.5}));lock.position.set(0,.72,.55);g.add(lock);
    CHEST.open=0;CHEST.opening=false;
    addBox(CHEST.x,CHEST.z,.8,.8,gh-1,gh+.9);
    const pole=mesh(new THREE.CylinderGeometry(.05,.05,2.4,5),mat(0x7a4a2a));pole.position.set(1.3,1.2,-.3);g.add(pole);
    const xf=mesh(new THREE.PlaneGeometry(.8,.5),new THREE.MeshStandardMaterial({color:0xf2545b,side:THREE.DoubleSide}));xf.position.set(1.7,2.1,-.3);g.add(xf);CHEST.flag=xf;
  }
  scroll=new THREE.Group();{const s=mesh(new THREE.CylinderGeometry(.16,.16,.9,10),mat(0xfff3d6));s.rotation.z=Math.PI/2;scroll.add(s);const b=mesh(new THREE.CylinderGeometry(.18,.18,.12,10),mat(0xf2545b));b.rotation.z=Math.PI/2;scroll.add(b);}
  scroll.visible=false;scene.add(scroll);
  {const gh=terrainH(WOOD.x,WOOD.z);for(let i=0;i<5;i++){const l=mesh(new THREE.CylinderGeometry(.28,.28,2.2,7),mat(i%2?0x9c6436:0x8b5a3c));l.rotation.x=Math.PI/2;const row=i<3?0:1;l.position.set(WOOD.x-1.2+(row?.3:0)+(i%3)*.58,gh+.28+row*.5,WOOD.z-2.2);scene.add(l);}
   addBox(WOOD.x-.6,WOOD.z-2.2,1,1.1,gh-1,gh+1.05);}

  addItem('plank',makePlank(BR.gap1-BR.gap0),V(WOOD.x+1.8,terrainH(WOOD.x+1.8,WOOD.z)+.1,WOOD.z),true,{name:'plank',yaw:.3,reach:2.6,lift:.1,carryPos:V(0,-.02,.18),
    onCarry:()=>hintOnce('plank','A long plank! It’s heavy, so Spartacus is slower.',3000)});
  addPickup(4.35,19.8,crateTop,1);addPickup(-12,13,undefined,1);addPickup(LH.rockX,LH.rockZ,LH.rockTop,1);
  {const l=lilies[lilies.length-1].g.position;addPickup(l.x,l.z,.22,1);}
}
// fruit and dig spots are added after every island is built (they don't affect scenery)
function buildLate(){
  addFruit('boing',FR.x,FR.z,FR.top,false);
  const bone=d=>{addPickup(d.x,d.z,d.y,1,.6);toast('A buried bone!',1800);};
  addDig(18,15,bone);addDig(-22,15,bone);
  addDig(POND.x+.6,POND.z-.6,d=>{const it=addItem('key',makeKey(),V(d.x,d.y+.2,d.z),false,{name:'key'});carry(it);toast('An old key! Where could it fit?',3200);complete('key');},true);
  addDig(-4,6,d=>{const it=addItem('boot',makeBoot(),V(d.x,d.y+.25,d.z),false,{name:'boot',lift:.15});carry(it);toast('Just an old boot. Silly Spartacus!',2800);});
  addDig(9,-22,bone);
}

function ringBell(){LH.swing=1;sfx.ding();if(!I.done.bell){toast('Ding dong! Everyone knows Spartacus is here.',3000);complete('bell');}}
function placePlank(){placeItem(ghost.position,()=>{addBox((BR.gap0+BR.gap1)/2,BR.z,(BR.gap1-BR.gap0)/2+.1,.9,-3,BR.y);sfx.thunk();burst(ghost.position.clone().add(V(0,.3,0)),20,[0xd09a5e,0xffd84d],4,3,.7,1);toast('The bridge is fixed!');complete('bridge');});}
function openChest(){useUp();CHEST.opening=true;sfx.creak();burst(V(CHEST.x,CHEST.y+1.2,CHEST.z),30,[0xffd84d,0xffffff,0xff9fb2],5,3,1,1);
  scroll.visible=true;scroll.position.set(CHEST.x,CHEST.y+1,CHEST.z);scroll.userData.t=0;
  setTimeout(()=>toast('A map to a new island! Where could it lead?',3600),500);complete('chest');}

const I={
  id:1,center:C1,name:'Spartacus’s Island',zMax:Infinity,height,
  tasks:{title:'Spartacus’s to-do list',list:[
    {id:'bones',ic:'🦴',t:()=>pickupText(1,'bones')},
    {id:'fruit',ic:'🌀',t:()=>'Eat the Boing-Boing fruit',power:'boing'},
    {id:'gull',ic:'🐦',t:()=>'Bark at the sleepy seagull'},
    {id:'bell',ic:'🔔',t:()=>'Ring the lighthouse bell'},
    {id:'bridge',ic:'🪵',t:()=>'Fix the broken bridge'},
    {id:'key',ic:'🗝️',t:()=>'Dig up the old key'},
    {id:'chest',ic:'🧰',t:()=>'Open the treasure chest'}]},
  collect:{total:6,count:0,taskId:'bones',name:'Bone',all:'All the bones! Good boy, Spartacus!',model:makeBone},
  intro:[[400,'Check the list. Let’s go, Spartacus!',2600]],
  win:{title:'Ready to sail!',text:'Spartacus found a map to a new island. All aboard!',tip:'You can also sail later from the end of the dock.',go:'Set sail! ⛵'},
  onAllDone(){G.flagUp=true;toast('Everything’s done! Time to sail!',3200);},
  sailPath,
  exit:{label:'Sail',at:p=>p.z>29&&Math.abs(p.x)<1.6&&p.y>.5,run:()=>startSail(sailPath,()=>enterIsland(2,true))},
  build,buildLate,
  update(dt){const T=G.T;
    CHEST.flag.rotation.y=Math.sin(T*3)*.3;
    for(const l of lilies){l.g.position.y=.16+Math.sin(T*1.6+l.phase)*.04;l.g.rotation.y=Math.sin(T*.5+l.phase)*.15;}
    ghost.material.opacity=I.done.bridge?0:.2+.12*Math.sin(T*4);
    if(CHEST.opening&&CHEST.open<1){CHEST.open=Math.min(1,CHEST.open+dt*1.4);CHEST.lid.rotation.x=-1.9*CHEST.open;}
    if(scroll.visible){scroll.userData.t+=dt;const t=scroll.userData.t;scroll.position.y=CHEST.y+1+Math.min(t,1)*1.6+Math.sin(t*3)*.1;scroll.rotation.y+=dt*2.5;}
    LH.swing*=Math.exp(-dt*1.2);LH.bell.rotation.x=Math.sin(T*8)*.5*LH.swing;},
  interact(p){
    if(p.y>LH.deckTop-.3&&flat(p,LH.x,LH.z)<1.55&&LH.swing<.25)ringBell();
    tooHigh(flat(p,LH.rockX,LH.rockZ)<3.2,'Too high to jump… find the swirly fruit!');
    if(!I.done.bridge&&!P.carry&&flat(p,BR.gap0-1,BR.z)<2.5&&p.y>1)hintOnce('bridge','The bridge is broken! Find a long plank.',3200);
    if(digNear(p,4))hintOnce('dig',`A sand mound! Dig it with ${actWord()}.`,3200);
    if(!I.done.chest&&flat(p,CHEST.x,CHEST.z)<3&&!(P.carry&&P.carry.id==='key'))hintOnce('chest','A locked treasure chest. It needs a key…',3200);},
  actions(p){const it=P.carry;if(!it)return null;
    if(it.id==='plank'&&!I.done.bridge&&p.y>BR.y-.3&&Math.abs(p.z-BR.z)<1.6&&(Math.abs(p.x-BR.gap0)<2.4||Math.abs(p.x-BR.gap1)<2.4))return{label:'Fix',fn:placePlank};
    if(it.id==='key'&&!I.done.chest&&flat(p,CHEST.x,CHEST.z)<2.4&&Math.abs(p.y-CHEST.y)<2)return{label:'Open',fn:openChest};
    return null;},
  bark(p){if(gull.state==='sleep'&&flat(p,GPOST.x,GPOST.z)<6.5){wakeGull();setTimeout(()=>toast('Squawk! The seagull flew away. Oops!'),300);complete('gull');}},
};
export default I;
