import * as THREE from 'three';
import {clamp,V} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {mat,mesh} from '../core/materials.js';
import {G} from '../core/state.js';
import {sfx} from '../core/audio.js';
import {textSprite,onFontsReady} from '../core/fx.js';
import {supportAt} from '../core/colliders.js';
import {ship} from '../world/ship.js';
import {P,fwd} from '../player/player.js';
import {dog} from '../player/dog.js';

// Mango the parrot. Rescued on island 2 (too hungry to fly), lives in the crow's nest,
// and on later islands fetches things for Spartacus.
// state: hungry | hop (onto the hat) | riding | fly (to the ship) | crew
//        | fetchGo | fetchDrop | fetchHome   (a fetch errand, see mangoFetch)
export const mango={g:new THREE.Group(),state:'hungry',t:0,nest:null,island:0,fetch:null};
const NEST=V(0,6.6,.4); // crow's nest, ship-local
let hungry=null;
{
  const Gr=mat(0x3fbf5a),R=mat(0xf2545b),Y=mat(0xffd84d),O=mat(0xffa53d),I=mat(0x2b2b38),Wt=new THREE.MeshBasicMaterial({color:0xffffff});
  const b=mesh(new THREE.SphereGeometry(.3,10,8),Gr);b.scale.set(1,1.15,1);b.position.y=.35;mango.g.add(b);
  const bl=mesh(new THREE.SphereGeometry(.2,8,6),Y);bl.scale.set(1,1.2,.6);bl.position.set(0,.3,.17);mango.g.add(bl);
  const h=mesh(new THREE.SphereGeometry(.23,10,8),Gr);h.position.set(0,.72,.05);mango.g.add(h);
  const bk=mesh(new THREE.ConeGeometry(.08,.22,6),O);bk.rotation.x=Math.PI/2+.5;bk.position.set(0,.65,.27);mango.g.add(bk);
  for(const s of [-1,1]){const e=new THREE.Mesh(new THREE.SphereGeometry(.065,8,6),Wt);e.position.set(s*.1,.77,.18);mango.g.add(e);const pu=mesh(new THREE.SphereGeometry(.035,6,5),I,false);pu.position.set(s*.1,.77,.235);mango.g.add(pu);}
  const tuft=mesh(new THREE.ConeGeometry(.07,.22,5),Y);tuft.position.set(0,.98,0);tuft.rotation.x=-.4;mango.g.add(tuft);
  mango.wings=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.27,.5,0);const w=mesh(new THREE.BoxGeometry(.12,.44,.32),R);w.position.y=-.14;p.add(w);mango.g.add(p);p.userData.s=s;return p;});
  const tl=mesh(new THREE.BoxGeometry(.14,.05,.5),R);tl.position.set(0,.18,-.36);tl.rotation.x=.55;mango.g.add(tl);
  scene.add(mango.g);
}
onFontsReady(()=>{hungry=textSprite('Hungry!','#ffd84d');hungry.scale.set(3.2,.8,1);hungry.material.depthTest=true;hungry.visible=false;scene.add(hungry);});

// sit hungry on a nest {x,y,z} on island `isl`, looking towards `look` {x,z}
export function placeMango(nest,look,isl){mango.nest=nest;mango.island=isl;mango.g.position.set(nest.x,nest.y+.2,nest.z);mango.g.rotation.y=Math.atan2(look.x-nest.x,look.z-nest.z);}
// after being fed: hop onto Spartacus's hat
export function mangoHop(){mango.state='hop';mango.t=0;mango.from=mango.g.position.clone();}
// riding the hat -> fly up to the crow's nest; onArrive when he lands
function detach(){const w=V();mango.g.getWorldPosition(w);mango.g.parent.remove(mango.g);scene.add(mango.g);mango.g.position.copy(w);mango.from=w;mango.t=0;}
export function mangoToShip(onArrive){detach();mango.g.scale.setScalar(1);mango.state='fly';mango.onArrive=onArrive;sfx.parrot();}
// arriving on a later island directly (Continue): put him in the crow's nest
export function ensureMangoCrew(){if(mango.state==='crew')return;if(mango.g.parent)mango.g.parent.remove(mango.g);ship.add(mango.g);mango.g.position.copy(NEST);mango.g.rotation.set(0,0,0);mango.g.scale.setScalar(1);mango.state='crew';if(hungry)hungry.visible=false;}
// errand: fly to `to`, pick up `mesh`, bring it to just in front of Spartacus, then onDrop(pos, groundY)
export function mangoFetch(to,m,onDrop){detach();mango.fetch={to,mesh:m,onDrop};mango.state='fetchGo';sfx.parrot();}

function landOnShip(){const g=mango.g;scene.remove(g);ship.add(g);g.position.copy(NEST);g.rotation.set(0,0,0);mango.state='crew';}
export function updMango(dt){
  const g=mango.g,T=G.T;mango.t+=dt;
  const flap=a=>mango.wings.forEach(w=>w.rotation.z=w.userData.s*(.2+Math.abs(Math.sin(T*18))*a));
  const flyTo=(to,dur,arc)=>{const k=clamp(mango.t/dur,0,1);g.position.lerpVectors(mango.from,to,k);g.position.y+=Math.sin(Math.PI*k)*arc;flap(1.2);g.rotation.y=Math.atan2(to.x-mango.from.x,to.z-mango.from.z);return k;};
  if(mango.state==='hungry'){const n=mango.nest;g.position.y=n.y+.2+Math.abs(Math.sin(T*2.2))*.08;flap(.1);
    if(hungry){hungry.visible=G.island===mango.island;hungry.position.set(n.x,n.y+2+Math.sin(T*2)*.1,n.z);}}
  else if(mango.state==='hop'){if(hungry)hungry.visible=false;const k=clamp(mango.t/.8,0,1);const to=V();dog.head.localToWorld(to.set(0,.75,-.05));
    g.position.lerpVectors(mango.from,to,k);g.position.y+=Math.sin(Math.PI*k)*1.2;flap(1.2);
    if(k>=1){scene.remove(g);dog.head.add(g);g.position.set(0,.66,-.05);g.rotation.set(0,0,0);g.scale.setScalar(.62);mango.state='riding';}}
  else if(mango.state==='riding'){flap(P.grounded?.05:.9);g.position.y=.66+(P.grounded?Math.abs(Math.sin(P.phase))*.03:0);}
  else if(mango.state==='fly'){if(flyTo(ship.localToWorld(NEST.clone().setY(6.65)),1.6,3)>=1){landOnShip();sfx.parrot();mango.onArrive?.();}}
  else if(mango.state==='crew'){flap(.08);g.rotation.y=Math.sin(T*.6)*.8;}
  else if(mango.state==='fetchGo'){const f=mango.fetch;if(flyTo(V(f.to.x,f.to.y+.25,f.to.z),2.2,3)>=1){scene.remove(f.mesh);g.add(f.mesh);f.mesh.position.set(0,-.15,.3);mango.state='fetchDrop';mango.t=0;mango.from=g.position.clone();sfx.parrot();}}
  else if(mango.state==='fetchDrop'){const f=mango.fetch,k=clamp(mango.t/1.6,0,1),fw=fwd(),to=V(P.pos.x+fw.x*1.2,P.pos.y+2.2,P.pos.z+fw.z*1.2);g.position.lerpVectors(mango.from,to,k);g.position.y+=Math.sin(Math.PI*k)*1.5;flap(1.2);
    g.rotation.y=Math.atan2(to.x-g.position.x,to.z-g.position.z)||g.rotation.y;
    if(k>=1){g.remove(f.mesh);const sy=Math.max(supportAt(to.x,to.z,P.pos.y+.6),P.pos.y);f.onDrop(V(to.x,sy,to.z));mango.state='fetchHome';mango.t=0;mango.from=g.position.clone();}}
  else if(mango.state==='fetchHome'){if(flyTo(ship.localToWorld(NEST.clone().setY(6.65)),2.4,3)>=1)landOnShip();}
}
