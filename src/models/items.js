import * as THREE from 'three';
import {mat,mesh} from '../core/materials.js';

// Small reusable models: carryable items and collectibles. Each returns a fresh Group.

export function makePlank(len){const g=new THREE.Group();g.add(mesh(new THREE.BoxGeometry(len+.3,.16,.75),mat(0xd09a5e)));
  for(const x of [-2,0,2]){const l=mesh(new THREE.BoxGeometry(.06,.17,.76),mat(0x9c6436),false);l.position.x=x;g.add(l);}return g;}
export function makeKey(){const g=new THREE.Group(),m=mat(0xffc83d,{metalness:.4,roughness:.35});const r=mesh(new THREE.TorusGeometry(.14,.05,6,12),m);r.position.x=-.3;g.add(r);
  g.add(mesh(new THREE.BoxGeometry(.45,.07,.07),m));for(const x of [.12,.2]){const t=mesh(new THREE.BoxGeometry(.05,.14,.06),m);t.position.set(x,-.08,0);g.add(t);}return g;}
export function makeBoot(){const g=new THREE.Group(),m=mat(0x6b4a2a);const l=mesh(new THREE.BoxGeometry(.28,.5,.3),m);l.position.y=.12;g.add(l);const f=mesh(new THREE.BoxGeometry(.28,.2,.5),m);f.position.set(0,-.05,.15);g.add(f);return g;}
export function makeTin(){const g=new THREE.Group();g.add(mesh(new THREE.CylinderGeometry(.22,.22,.24,12),mat(0xf2545b)));const l=mesh(new THREE.CylinderGeometry(.24,.24,.06,12),mat(0xffd84d));l.position.y=.13;g.add(l);
  for(let k=0;k<3;k++){const c=mesh(new THREE.CylinderGeometry(.09,.09,.03,8),mat(0xe0a95a),false);c.position.set(Math.cos(k*2.1)*.1,.18,Math.sin(k*2.1)*.1);g.add(c);}return g;}
export function makeBone(){const g=new THREE.Group(),m=mat(0xfff6e8);const s=mesh(new THREE.CylinderGeometry(.09,.09,.62,6),m);s.rotation.z=Math.PI/2;g.add(s);
  for(const a of [-.33,.33])for(const b of [-.09,.09]){const k=mesh(new THREE.SphereGeometry(.13,8,6),m);k.position.set(a,b,0);g.add(k);}return g;}
export function makeAcorn(){const g=new THREE.Group();const b=mesh(new THREE.SphereGeometry(.2,8,6),mat(0xffc83d,{metalness:.35,roughness:.4}));b.scale.y=1.25;g.add(b);
  const c=mesh(new THREE.SphereGeometry(.23,8,5,0,Math.PI*2,0,Math.PI/2),mat(0x9c6436));c.position.y=.1;g.add(c);
  const st=mesh(new THREE.CylinderGeometry(.03,.03,.12,4),mat(0x6e4a30));st.position.y=.3;g.add(st);return g;}
export function makeFlower(){const g=new THREE.Group();const st=mesh(new THREE.CylinderGeometry(.03,.03,.5,4),mat(0x3fae4f));st.position.y=.25;g.add(st);
  for(let k=0;k<6;k++){const a=k/6*6.283,pt=mesh(new THREE.SphereGeometry(.12,6,5),mat(0xffd84d));pt.scale.set(1,.4,1.3);pt.position.set(Math.cos(a)*.15,.52,Math.sin(a)*.15);pt.rotation.y=-a;g.add(pt);}
  const c=mesh(new THREE.SphereGeometry(.09,6,5),mat(0xff9a3d));c.position.y=.54;g.add(c);return g;}
export function makePillow(){const g=new THREE.Group(),pm=mat(0xffb3d1);g.add(mesh(new THREE.BoxGeometry(1.0,.35,.7),pm));
  for(const sx of [-1,1])for(const sz of [-1,1]){const c=mesh(new THREE.SphereGeometry(.18,6,5),pm);c.position.set(sx*.5,0,sz*.35);g.add(c);}
  const st=mesh(new THREE.OctahedronGeometry(.12,0),mat(0xffd84d),false);st.position.set(0,.19,0);g.add(st);return g;}
export const leafGeo=new THREE.SphereGeometry(.18,5,4);leafGeo.scale(1,.35,1.6);
// glowing magic seed on a little mound (Grow-Grow)
export function makeSeed(){const g=new THREE.Group();
  const s=mesh(new THREE.SphereGeometry(.24,10,8),new THREE.MeshStandardMaterial({color:0x9be38a,emissive:0x5fd35a,emissiveIntensity:.6,roughness:.4}));s.position.y=.3;g.add(s);
  for(const k of [-1,1]){const l=mesh(leafGeo,mat(0x4cc05a),false);l.position.set(k*.2,.5,0);l.rotation.z=k*.6;g.add(l);}
  const mound=mesh(new THREE.SphereGeometry(.45,8,5),mat(0x7a5a3a),false,true);mound.scale.y=.3;g.add(mound);return g;}
