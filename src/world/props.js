import * as THREE from 'three';
import {rand} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {mat,mesh} from '../core/materials.js';
import {addCyl,addBox} from '../core/colliders.js';
import {terrainH} from './terrain.js';

// Reusable scenery. Each one sits on the terrain and adds its own collider.

export function palm(x,z){
  const gh=terrainH(x,z),g=new THREE.Group();g.position.set(x,gh,z);g.rotation.y=rand()*6.28;
  const lean=.15+rand()*.2;let px=0;
  for(let i=0;i<6;i++){const s=mesh(new THREE.CylinderGeometry(.2-i*.012,.24-i*.012,.82,6),mat(i%2?0xb98250:0xa8723f));px+=lean*i*.04;s.position.set(px,.41+i*.78,0);s.rotation.z=-lean*.25;g.add(s);}
  const crown=new THREE.Group();crown.position.set(px,4.7,0);g.add(crown);
  const lg=new THREE.ConeGeometry(.5,2.6,4);lg.scale(1,1,.25);
  for(let k=0;k<7;k++){const piv=new THREE.Group();piv.rotation.y=k*Math.PI*2/7;const l=mesh(lg,mat(k%2?0x3fae4f:0x4cc05a));l.rotation.z=-Math.PI/2-.45;l.position.set(1.15,-.35,0);piv.add(l);crown.add(piv);}
  for(let k=0;k<3;k++){const c=mesh(new THREE.IcosahedronGeometry(.17,0),mat(0x7a4a2a));c.position.set(Math.cos(k*2.1)*.25,-.2,Math.sin(k*2.1)*.25);crown.add(c);}
  scene.add(g);addCyl(x,z,.35,gh-1,gh+4.8);
}
// a mossy rock h tall; returns its top height (something to stand on)
export function rock(x,z,r,h,col=0xa3acb8){
  const gh=terrainH(x,z);
  const m=mesh(new THREE.CylinderGeometry(r*.88,r*1.12,h,7),mat(col),true,true);m.position.set(x,gh+h/2,z);m.rotation.y=rand()*3;scene.add(m);
  const moss=mesh(new THREE.CylinderGeometry(r*.9,r*.9,.14,7),mat(0x7cc86a),false,true);moss.position.set(x,gh+h+.03,z);moss.rotation.y=m.rotation.y;scene.add(moss);
  addCyl(x,z,r*.95,gh-1,gh+h+.1);return gh+h+.1;
}
// a rock whose top is at an absolute height
export const rockTop=(x,z,r,top,col)=>rock(x,z,r,top-terrainH(x,z)-.1,col);
export function crate(x,z,s=1.1){
  const gh=terrainH(x,z);const m=mesh(new THREE.BoxGeometry(s,s,s),mat(0xd4955a),true,true);m.position.set(x,gh+s/2,z);scene.add(m);
  for(const k of [-1,1]){const sl=mesh(new THREE.BoxGeometry(s*1.03,.14,s*1.03),mat(0x9c6436));sl.position.set(x,gh+s/2+k*s*.36,z);scene.add(sl);}
  addBox(x,z,s/2,s/2,gh-1,gh+s);return gh+s;
}
// bushes and flowers around (cx,cz); ok(x,z) keeps them off paths and puzzles
export function scatter(cx,cz,maxR,ok,nBush,nFlower){
  for(let i=0,n=0;i<nBush*4&&n<nBush;i++){const a=rand()*6.28,r=3+rand()*maxR,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(!ok(x,z)||terrainH(x,z)<.6)continue;n++;
    const b=mesh(new THREE.IcosahedronGeometry(.5+rand()*.4,0),mat(0x54b84f));b.position.set(x,terrainH(x,z)+.3,z);b.scale.y=.75;scene.add(b);}
  const fcols=[0xff9fb2,0xffd84d,0xffffff,0xb59cff];
  for(let i=0,n=0;i<nFlower*3&&n<nFlower;i++){const a=rand()*6.28,r=2+rand()*maxR,x=cx+Math.cos(a)*r,z=cz+Math.sin(a)*r;if(!ok(x,z)||terrainH(x,z)<.6)continue;n++;
    const f=mesh(new THREE.IcosahedronGeometry(.11,0),mat(fcols[n%4]),false);f.position.set(x,terrainH(x,z)+.12,z);scene.add(f);}
}
// a wooden dock along +z at x=cx, deck height .78
export function dock(cx,z0,z1){
  const top=.78;
  for(let z=z0,i=0;z<z1;z+=.9,i++){const p=mesh(new THREE.BoxGeometry(2.4,.14,.82),mat(i%2?0xc48a54:0xb57b46),true,true);p.position.set(cx,top-.07,z+.45);scene.add(p);}
  for(let z=z0+1;z<=z1;z+=2.5)for(const x of [-1.15,1.15]){const p=mesh(new THREE.CylinderGeometry(.13,.13,3.2,6),mat(0x7a4a2a));p.position.set(cx+x,-.75,z);scene.add(p);}
  addBox(cx,(z0+z1)/2,1.2,(z1-z0)/2,-3,top);
}
