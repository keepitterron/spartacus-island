import * as THREE from 'three';
import {lerp,V} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {mat,mesh} from '../core/materials.js';
import {G} from '../core/state.js';
import {sfx} from '../core/audio.js';
import {burst,textSprite,onFontsReady} from '../core/fx.js';
import {ship} from '../world/ship.js';

// The sleepy seagull on island 1. Barking wakes it; after that it circles the ship.
// state: sleep | startle | fly
export const gull={g:new THREE.Group(),state:'sleep',t:0,ang:0,post:null};
let zzz=null;
{
  const W=mat(0xffffff),Gr=mat(0xb8c2cc),O=mat(0xffa53d),I=mat(0x2b2b38);
  const b=mesh(new THREE.SphereGeometry(.3,10,8),W);b.scale.set(1,.85,1.4);b.position.y=.32;gull.g.add(b);
  const h=mesh(new THREE.SphereGeometry(.2,10,8),W);h.position.set(0,.6,.3);gull.g.add(h);
  const bk=mesh(new THREE.ConeGeometry(.07,.26,6),O);bk.rotation.x=Math.PI/2;bk.position.set(0,.56,.56);gull.g.add(bk);
  gull.wings=[-1,1].map(k=>{const p=new THREE.Group();p.position.set(k*.24,.4,0);const w=mesh(new THREE.BoxGeometry(.55,.06,.42),Gr);w.position.x=k*.27;p.add(w);gull.g.add(p);return p;});
  const tl=mesh(new THREE.BoxGeometry(.25,.05,.25),Gr);tl.position.set(0,.35,-.45);gull.g.add(tl);
  gull.closed=[-1,1].map(k=>{const e=mesh(new THREE.BoxGeometry(.09,.02,.02),I,false);e.position.set(k*.1,.64,.47);gull.g.add(e);return e;});
  gull.open=[-1,1].map(k=>{const e=mesh(new THREE.SphereGeometry(.04,6,5),I,false);e.position.set(k*.1,.65,.46);e.visible=false;gull.g.add(e);return e;});
  for(const k of [-1,1]){const l=mesh(new THREE.CylinderGeometry(.02,.02,.2,4),O);l.position.set(k*.08,.08,0);gull.g.add(l);}
  gull.g.rotation.y=Math.PI*.8;scene.add(gull.g);
}
onFontsReady(()=>{zzz=textSprite('Zzz','#ffffff');zzz.scale.set(2.4,.6,1);scene.add(zzz);});
// perch on a post {x,z,top}
export function perchGull(post){gull.post=post;gull.g.position.set(post.x,post.top,post.z);}
const openEyes=()=>{gull.closed.forEach(e=>e.visible=false);gull.open.forEach(e=>e.visible=true);if(zzz)zzz.visible=false;};
export function wakeGull(){gull.state='startle';gull.t=0;sfx.gull();openEyes();burst(gull.g.position.clone().add(V(0,.5,0)),14,0xffffff,4,3,.8,.8);}
// if it's still asleep when we leave, it just appears circling the ship
export function gullJoinsShip(){if(gull.state!=='sleep')return;gull.state='fly';openEyes();gull.g.position.set(ship.position.x,8,ship.position.z);}

export function updGull(dt){
  const g=gull.g,T=G.T,post=gull.post;gull.t+=dt;
  if(gull.state==='sleep'){g.position.y=post.top+Math.sin(T*1.5)*.02;
    if(zzz){zzz.visible=true;const c=(T*.5)%1;zzz.position.set(post.x+c*.4,post.top+1.1+c*.9,post.z);zzz.material.opacity=Math.sin(c*Math.PI);}}
  else if(gull.state==='startle'){const k=Math.min(1,gull.t/.7);g.position.y=post.top+k*3;gull.wings.forEach((w,i)=>w.rotation.z=(i?1:-1)*Math.sin(T*22)*.9);if(k>=1){gull.state='fly';gull.ang=Math.atan2(g.position.z-ship.position.z,g.position.x-ship.position.x);}}
  else{gull.ang+=dt*.7;const cx=ship.position.x,cz=ship.position.z;const nx=cx+Math.cos(gull.ang)*5,nz=cz+Math.sin(gull.ang)*5,ny=8+Math.sin(T)*.5;
    g.position.x=lerp(g.position.x,nx,Math.min(1,dt*2));g.position.z=lerp(g.position.z,nz,Math.min(1,dt*2));g.position.y=lerp(g.position.y,ny,Math.min(1,dt*1.5));
    g.rotation.y=Math.atan2(-Math.sin(gull.ang),Math.cos(gull.ang))+Math.PI;gull.wings.forEach((w,i)=>w.rotation.z=(i?1:-1)*Math.sin(T*10)*.7);}
}
