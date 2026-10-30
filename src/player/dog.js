import * as THREE from 'three';
import {clamp,lerp} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {mat,mesh} from '../core/materials.js';
import {G} from '../core/state.js';
import {P,SPEED} from './player.js';

// Spartacus: half pitbull, half labrador. Shiny black coat, thin white stripe down the
// muzzle, white chest patch and paw tips, floppy ears, straw hat with a red band.
// Friends who ride along are added to dog.head; carried items go in dog.mouth.
function makeDog(){
  const fur=mat(0x2a2a33),cream=mat(0xffffff),brown=mat(0x1f1f27),ink=mat(0x0c0c10,{roughness:.35}),pink=mat(0xff8fa3),straw=mat(0xf2d27a),ribbon=mat(0xd9343f),iris=mat(0x7a4a22,{roughness:.3});
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const torso=mesh(new THREE.CapsuleGeometry(.4,.75,4,10),fur);torso.rotation.x=Math.PI/2;torso.position.y=.78;body.add(torso);
  const belly=mesh(new THREE.SphereGeometry(.34,10,8),cream);belly.scale.set(1.08,1.1,1.15);belly.position.set(0,.74,.42);body.add(belly);
  const head=new THREE.Group();head.position.set(0,1.25,.62);body.add(head);
  {const sk=mesh(new THREE.SphereGeometry(.44,12,10),fur);sk.scale.set(1.12,.95,1);head.add(sk);}
  const bz1=mesh(new THREE.BoxGeometry(.03,.28,.06),cream,false);bz1.position.set(0,.2,.4);bz1.rotation.x=-.4;head.add(bz1);
  const bz2=mesh(new THREE.BoxGeometry(.027,.04,.26),cream,false);bz2.position.set(0,.06,.47);bz2.rotation.x=.28;head.add(bz2);
  const mz=mesh(new THREE.SphereGeometry(.24,10,8),fur);mz.scale.set(1.1,.8,1.1);mz.position.set(0,-.12,.36);head.add(mz);
  const nose=mesh(new THREE.SphereGeometry(.085,8,6),ink);nose.position.set(0,-.04,.6);head.add(nose);
  const shine=new THREE.MeshBasicMaterial({color:0xffffff});
  for(const s of [-1,1]){const e=mesh(new THREE.SphereGeometry(.08,8,6),iris,false);e.position.set(s*.17,.07,.37);head.add(e);
    const sh=new THREE.Mesh(new THREE.SphereGeometry(.026,6,4),shine);sh.position.set(s*.17+.025,.1,.44);head.add(sh);
    const ch=mesh(new THREE.SphereGeometry(.07,6,5),pink,false);ch.scale.set(1,.5,.6);ch.position.set(s*.27,-.09,.3);head.add(ch);}
  const tongue=mesh(new THREE.BoxGeometry(.13,.03,.2),pink,false);tongue.position.set(0,-.26,.46);tongue.visible=false;head.add(tongue);
  const mouth=new THREE.Group();mouth.position.set(0,-.24,.62);head.add(mouth);
  const ears=[-1,1].map(s=>{const p=new THREE.Group();p.position.set(s*.34,.18,-.02);const e=mesh(new THREE.BoxGeometry(.13,.26,.22),brown);e.position.set(s*.03,.04,0);e.rotation.x=-.5;p.add(e);p.rotation.z=s*.25;head.add(p);p.userData.s=s;return p;});
  const hat=new THREE.Group();hat.position.set(0,.36,-.03);hat.rotation.x=-.15;hat.rotation.z=.08;head.add(hat);
  hat.add(mesh(new THREE.CylinderGeometry(.68,.72,.05,18),straw));
  const crown=mesh(new THREE.CylinderGeometry(.3,.33,.24,14),straw);crown.position.y=.14;hat.add(crown);
  const hatTop=mesh(new THREE.SphereGeometry(.3,14,6,0,Math.PI*2,0,Math.PI/2),straw);hatTop.scale.y=.45;hatTop.position.y=.26;hat.add(hatTop);
  const band=mesh(new THREE.CylinderGeometry(.335,.335,.09,14),ribbon);band.position.y=.08;hat.add(band);
  const legs=[[-1,1],[1,1],[-1,-1],[1,-1]].map(([sx,sz])=>{const p=new THREE.Group();p.position.set(sx*.22,.55,sz*.38);
    const l=mesh(new THREE.CylinderGeometry(.1,.11,.42,6),fur);l.position.y=-.2;p.add(l);
    const pw=mesh(new THREE.SphereGeometry(.13,8,6),cream);pw.scale.set(1,.7,1.2);pw.position.set(0,-.43,.03);p.add(pw);body.add(p);return p;});
  const tail=new THREE.Group();tail.position.set(0,.95,-.72);tail.rotation.x=-.6;body.add(tail);
  const tc=mesh(new THREE.ConeGeometry(.1,.55,6),fur);tc.position.y=.25;tail.add(tc);
  const tt=mesh(new THREE.SphereGeometry(.07,6,5),fur);tt.position.y=.5;tail.add(tt);
  return{root,body,head,ears,legs,tail,tongue,mouth,hat};
}
export const dog=makeDog();scene.add(dog.root);

// pose the model from P every frame; sp = horizontal speed
export function animDog(dt,sp){
  const d=dog,T=G.T;d.root.position.copy(P.pos);
  if(G.spin>0){const s=Math.min(G.spin,dt*10);G.spin-=s;P.yaw+=s;}
  d.root.rotation.y=P.yaw;
  const moving=clamp(sp/SPEED,0,1);P.phase+=dt*(4+sp*1.9);
  const sw=Math.sin(P.phase)*.75*moving,digging=P.digT>0;
  if(G.state==='rescue'){const pd=Math.sin(P.phase)*.8;d.legs.forEach((l,i)=>l.rotation.x=(i%2?pd:-pd));}
  else if(digging){const q=Math.sin(T*28)*1.1;d.legs[0].rotation.x=-.6+q;d.legs[1].rotation.x=-.6-q;d.legs[2].rotation.x=.2;d.legs[3].rotation.x=.2;}
  else if(P.climb){const q=Math.sin(P.phase)*.9;d.legs[0].rotation.x=-.9+q;d.legs[1].rotation.x=-.9-q;d.legs[2].rotation.x=.3-q;d.legs[3].rotation.x=.3+q;}
  else if(P.zip){d.legs.forEach((l,i)=>l.rotation.x=.25+Math.sin(T*6+i)*.25);}
  else if(P.swing){const q=Math.sin(T*20)*.5;d.legs.forEach((l,i)=>l.rotation.x=(i<2?-1:1)*(.7+q*(i%2?1:-1)));}
  else if(!P.grounded){d.legs.forEach((l,i)=>l.rotation.x=(i<2?-.6:.6));}
  else{d.legs[0].rotation.x=sw;d.legs[3].rotation.x=sw;d.legs[1].rotation.x=-sw;d.legs[2].rotation.x=-sw;}
  d.body.rotation.x=lerp(d.body.rotation.x,digging?.32:P.climb?-1.3:P.zip?-.35:P.swing?-.25:0,Math.min(1,dt*10));
  // squash & stretch spring
  P.sqv+=(1-P.sq)*140*dt;P.sqv*=Math.exp(-dt*9);P.sq+=P.sqv*dt;P.sq=clamp(P.sq,.6,1.4);
  const bob=P.grounded?Math.abs(Math.sin(P.phase))*.08*moving:0;
  const stretchY=P.swing?1.12:1;
  d.body.scale.set(1/Math.sqrt(P.sq),P.sq*stretchY,1/Math.sqrt(P.sq));d.body.position.y=bob;
  d.tail.rotation.z=Math.sin(T*(G.celebT>=0||digging||P.swing?22:12))*(.5+moving*.2);
  const vy=G.state==='rescue'||P.swing?6:P.vel.y;
  d.ears.forEach(e=>{e.rotation.x=clamp(vy*.05,-.9,.9)+Math.sin(P.phase*2)*.15*moving;e.rotation.z=e.userData.s*(.25+clamp(-vy*.03,-.2,.5));});
  const bk=P.barkT>0;d.tongue.visible=bk&&!P.carry;d.head.rotation.x=bk?-Math.sin((.35-P.barkT)/.35*Math.PI)*.35:(P.carry&&P.carry.heavy?.12:Math.sin(T*1.3)*.04);
  d.head.rotation.z=Math.sin(T*.9)*.05;
}
