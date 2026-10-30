import * as THREE from 'three';
import {lerp} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {mat,mesh,canvasTex,paw} from '../core/materials.js';
import {G} from '../core/state.js';

// The crew's ship. It moves between islands; rescued friends ride on it.
export const ship=new THREE.Group();ship.position.set(5.6,-.15,33.5);scene.add(ship);
// baseY: resting height (bobs around it); depth: how far it has sunk (island 3 -> 4)
export const shipState={baseY:-.15,depth:0};
// deck spot where Spartacus stands during cutscenes (ship-local)
export const DECK=new THREE.Vector3(0,1.17,-.5);
let flag;
{
  const s=new THREE.Shape();s.moveTo(-3,1.1);s.lineTo(3.4,1.35);s.quadraticCurveTo(3.0,0,2.2,-.6);s.lineTo(-2.4,-.6);s.quadraticCurveTo(-3.1,-.2,-3,1.1);
  const hg=new THREE.ExtrudeGeometry(s,{depth:2.3,bevelEnabled:true,bevelSize:.15,bevelThickness:.15,bevelSegments:1,curveSegments:6});hg.translate(0,0,-1.15);hg.rotateY(-Math.PI/2);
  ship.add(mesh(hg,mat(0x8b5a3c),true,true));
  const stripe=mesh(new THREE.BoxGeometry(2.75,.18,5.4),mat(0xf2545b));stripe.position.set(0,.75,.1);ship.add(stripe);
  const deck=mesh(new THREE.BoxGeometry(2.2,.12,5.6),mat(0xd9a46a),true,true);deck.position.set(0,1.1,.1);ship.add(deck);
  const cab=mesh(new THREE.BoxGeometry(1.7,1,1.4),mat(0xfffaf0));cab.position.set(0,1.65,-1.8);ship.add(cab);
  const roof=mesh(new THREE.BoxGeometry(1.95,.18,1.65),mat(0x2fa4c7));roof.position.set(0,2.22,-1.8);ship.add(roof);
  const mast=mesh(new THREE.CylinderGeometry(.11,.14,6.4,6),mat(0x7a4a2a));mast.position.set(0,4.2,.4);ship.add(mast);
  const nest=mesh(new THREE.CylinderGeometry(.45,.35,.4,8),mat(0x9c6436));nest.position.set(0,6.4,.4);ship.add(nest);
  const sailTex=canvasTex(256,220,(x,w,h)=>{x.fillStyle='#fff6e2';x.fillRect(0,0,w,h);paw(x,w/2,h/2,52,'#f2545b');});
  const sail=mesh(new THREE.BoxGeometry(3,2.5,.06),new THREE.MeshStandardMaterial({map:sailTex,roughness:.9}));sail.position.set(0,4.1,.55);ship.add(sail);
  const yard=mesh(new THREE.CylinderGeometry(.07,.07,3.3,5),mat(0x7a4a2a));yard.rotation.z=Math.PI/2;yard.position.set(0,5.4,.55);ship.add(yard);
  const flagTex=canvasTex(128,86,(x,w,h)=>{x.fillStyle='#f2545b';x.fillRect(0,0,w,h);x.fillStyle='#fff';x.fillRect(34,38,60,12);[[34,38],[34,50],[94,38],[94,50]].forEach(([a,b])=>{x.beginPath();x.arc(a,b,9,0,7);x.fill();});paw(x,64,20,13,'#fff');});
  const fg=new THREE.PlaneGeometry(1.2,.8);fg.translate(.6,0,0);
  flag=new THREE.Mesh(fg,new THREE.MeshStandardMaterial({map:flagTex,side:THREE.DoubleSide,roughness:.9}));flag.position.set(.1,5.0,.4);flag.userData.y=5.0;ship.add(flag);
  // figurehead: a little Spartacus
  const fh=new THREE.Group();fh.position.set(0,1.55,3.55);ship.add(fh);
  fh.add(mesh(new THREE.SphereGeometry(.42,10,8),mat(0x2a2a33)));
  const bzf=mesh(new THREE.BoxGeometry(.027,.3,.05),mat(0xffffff));bzf.position.set(0,.16,.38);bzf.rotation.x=-.4;fh.add(bzf);
  const sn=mesh(new THREE.SphereGeometry(.22,8,6),mat(0x2a2a33));sn.position.set(0,-.1,.36);fh.add(sn);
  const nz=mesh(new THREE.SphereGeometry(.08,6,5),mat(0x0c0c10));nz.position.set(0,-.03,.58);fh.add(nz);
  for(const k of [-1,1]){const e=mesh(new THREE.BoxGeometry(.13,.42,.26),mat(0x1f1f27));e.position.set(k*.38,-.12,0);e.rotation.z=k*.3;fh.add(e);}
}
// the big air bubble around the ship underwater
export const shipBubble=new THREE.Mesh(new THREE.SphereGeometry(5.5,24,16),new THREE.MeshStandardMaterial({color:0xbff3ff,transparent:true,opacity:.28,roughness:.1,metalness:.2,depthWrite:false}));shipBubble.visible=false;scene.add(shipBubble);

// put the ship at t (0..1) along a sailing path, facing along it
export function placeShipAt(t,path){const e=t*t*(3-2*t),pt=path.getPointAt(e),tg=path.getTangentAt(e);ship.position.x=pt.x;ship.position.z=pt.z;ship.rotation.y=Math.atan2(tg.x,tg.z);ship.updateMatrixWorld(true);}
// where Spartacus stands while the ship moves
export const onDeck=()=>{ship.updateMatrixWorld(true);return ship.localToWorld(DECK.clone());};

// a water bucket on deck for Wasabi
export function addBucket(){if(ship.userData.bucket)return;const b=mesh(new THREE.CylinderGeometry(.36,.3,.45,10),mat(0x9aa6b8));b.position.set(.65,1.38,1.4);ship.add(b);
  const w=mesh(new THREE.CircleGeometry(.32,10),mat(0x4cc3e6),false);w.rotation.x=-Math.PI/2;w.position.set(.65,1.58,1.4);ship.add(w);ship.userData.bucket=b;}

export function updShip(dt,cutscene){const T=G.T;
  ship.position.y=shipState.baseY+Math.sin(T*1.2)*.12-shipState.depth;
  if(shipBubble.visible&&!cutscene)shipBubble.position.copy(ship.position).add(new THREE.Vector3(0,2.8,0));ship.rotation.z=Math.sin(T*.9)*.04;ship.rotation.x=Math.sin(T*.7)*.02;
  flag.rotation.y=Math.sin(T*4)*.25;flag.position.y=lerp(flag.position.y,G.flagUp?6.9:flag.userData.y,dt*1.2);
}
