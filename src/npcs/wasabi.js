import * as THREE from 'three';
import {lerp,angLerp,V} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {mat,mesh} from '../core/materials.js';
import {G} from '../core/state.js';
import {P} from '../player/player.js';

// Wasabi the blue axolotl. Rescued on island 3 (her spring dried up), rides in the bucket
// on deck, and underwater (island 4) floats next to Spartacus as his breathing bubble.
// state: stuck | happy | swim   (island 3's story, driven from islands/island3)
//        crew (in the bucket) | follow (swimming beside Spartacus)
export const wasabi={g:new THREE.Group(),state:'stuck',t:0};
{const B=mat(0x6fb6ff),D=mat(0x4a8fe0),Gl=mat(0xb59cff),I=mat(0x1c2333),Pk=mat(0xff8fa3),g=wasabi.g;
 const bd=mesh(new THREE.CapsuleGeometry(.2,.55,4,8),B);bd.rotation.x=Math.PI/2;bd.position.y=.22;g.add(bd);
 const hd=mesh(new THREE.SphereGeometry(.28,10,8),B);hd.scale.set(1.3,.85,1);hd.position.set(0,.3,.48);g.add(hd);
 for(const sd of [-1,1]){const e=mesh(new THREE.SphereGeometry(.05,6,5),I,false);e.position.set(sd*.2,.4,.68);g.add(e);
   const ck=mesh(new THREE.SphereGeometry(.05,6,5),Pk,false);ck.scale.set(1,.5,.5);ck.position.set(sd*.25,.3,.68);g.add(ck);
   for(let k=0;k<3;k++){const gl=mesh(new THREE.ConeGeometry(.06,.34,5),Gl);gl.position.set(sd*.36,.42+(1-k)*.11,.42);gl.rotation.z=-sd*(1.0+k*.35);g.add(gl);}
   for(const z of [.25,-.25]){const l=mesh(new THREE.SphereGeometry(.07,6,5),D);l.scale.set(1.5,.6,1);l.position.set(sd*.22,.08,z);g.add(l);}}
 wasabi.tail=new THREE.Group();wasabi.tail.position.set(0,.24,-.4);g.add(wasabi.tail);const tl=mesh(new THREE.BoxGeometry(.05,.24,.6),D);tl.position.z=-.28;wasabi.tail.add(tl);
 const smile=mesh(new THREE.TorusGeometry(.07,.015,4,8,Math.PI),I,false);smile.rotation.z=Math.PI;smile.position.set(0,.26,.74);g.add(smile);
 scene.add(g);}

// leave the bucket and swim beside Spartacus
export function wasabiFollow(){if(wasabi.g.parent)wasabi.g.parent.remove(wasabi.g);scene.add(wasabi.g);wasabi.g.scale.setScalar(1);wasabi.state='follow';wasabi.g.position.copy(P.pos).add(V(1,1.3,0));}

export function updWasabi(dt){const w=wasabi,g=w.g,T=G.T;w.t+=dt;
  w.tail.rotation.y=Math.sin(T*(w.state==='stuck'?3:9))*.45;
  if(w.state==='crew')g.rotation.y=Math.sin(T*.7)*.8;
  else if(w.state==='follow'){const sy=Math.sin(P.yaw),cy=Math.cos(P.yaw),kk=1-Math.exp(-dt*5);
    const tx=P.pos.x-sy*.9+cy*1.0,tz=P.pos.z-cy*.9-sy*1.0,ty=P.pos.y+1.3+Math.sin(T*2)*.15,ox=g.position.x,oz=g.position.z;
    g.position.x=lerp(g.position.x,tx,kk);g.position.y=lerp(g.position.y,ty,kk);g.position.z=lerp(g.position.z,tz,kk);
    const mx=g.position.x-ox,mz=g.position.z-oz;if(Math.hypot(mx,mz)>.01)g.rotation.y=angLerp(g.rotation.y,Math.atan2(mx,mz),Math.min(1,dt*8));}
}
