import * as THREE from 'three';
import {clamp,lerp,V} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {G,cam,cur} from '../core/state.js';
import {axis} from '../core/input.js';
import {sfx} from '../core/audio.js';
import {burst} from '../core/fx.js';
import {toast} from '../core/ui.js';
import {colliders,inFoot,pushOut} from '../core/colliders.js';
import {terrainH} from '../world/terrain.js';
import {startClimb} from '../systems/vines.js';
import {POWERS} from '../systems/powers.js';

// Spartacus's physical state. Sub-states: swing / climb / zip are set by their systems
// and replace normal walking while active; digT>0 or placing locks movement.
export const P={pos:V(),vel:V(),grounded:false,coyote:0,jumpBuf:0,yaw:Math.PI,power:null,super:false,stretch:false,phase:0,sq:1,sqv:0,barkT:0,barkCd:0,sparkT:0,
  carry:null,digT:0,dig:null,scratchT:0,swing:null,climb:null,zip:null,placing:null};
export const R=.45,STEP=.5,GRAV=30,SPEED=7,JUMP=10.5,SUPER=18.5;
// where a bubble rescue goes when there is no recent safe spot (set on entering an island)
export const SPAWN=V();
export const fwd=()=>V(Math.sin(P.yaw),0,Math.cos(P.yaw));
export const locked=()=>P.digT>0||!!P.placing;

// per-island tweaks; an island can override any of these with `physics:{…}`
const PHYS={gravity:GRAV,maxFall:Infinity,speed:1,jump:1,water:true,bound:null};
export const physics=()=>Object.assign({},PHYS,cur().physics);

const rescue={t:0,from:V(),to:V()};const safeHist=[];let safeT=0;
export const clearSafe=()=>{safeHist.length=0;};

export function stepPlayer(dt){
  const p=P.pos,v=P.vel,lk=locked(),ph=physics();
  let f=0,r=0;
  if(!lk)({f,r}=axis());
  const mag=Math.hypot(f,r);if(mag>1){f/=mag;r/=mag;}
  const heavy=P.carry&&P.carry.heavy,spd=SPEED*(heavy?.6:1)*ph.speed;
  // movement is relative to the camera
  const fx=-Math.sin(cam.yaw),fz=-Math.cos(cam.yaw),rx=Math.cos(cam.yaw),rz=-Math.sin(cam.yaw);
  const wx=(fx*f+rx*r)*spd,wz=(fz*f+rz*r)*spd,k=Math.min(1,dt*(P.grounded?12:4));
  v.x+=(wx-v.x)*k;v.z+=(wz-v.z)*k;v.y-=ph.gravity*dt;if(v.y<-ph.maxFall)v.y=-ph.maxFall;
  // coyote time + jump buffer make jumps forgiving
  P.coyote=P.grounded?.12:P.coyote-dt;P.jumpBuf-=dt;
  if(!lk&&P.jumpBuf>0&&P.coyote>0){const sup=P.super&&!heavy;v.y=(heavy?JUMP*.78:sup?SUPER:JUMP)*ph.jump;P.coyote=0;P.jumpBuf=0;P.grounded=false;P.sqv=4;
    if(sup){sfx.boing();burst(p.clone().add(V(0,.2,0)),14,POWERS.boing.col,4,1,.7,.9);}else sfx.jump();}
  const prevY=p.y;p.addScaledVector(v,dt);
  // sides: anything taller than a step pushes us out (or, if it's a grown vine we walk into, we climb)
  for(const c of colliders)if(c.top>prevY+STEP&&p.y+1.1>c.bottom){
    if(c.tree&&c.tree.grown&&mag>.4&&!heavy){const dx=c.x-p.x,dz=c.z-p.z,d=Math.hypot(dx,dz)||1;
      if(d<c.r+R+.08&&(((fx*f+rx*r)*dx+(fz*f+rz*r)*dz)/d)>.45*Math.min(1,mag)){startClimb(c.tree);return;}}
    pushOut(c,p,v,R);}
  // feet: terrain or the top of anything we stepped onto
  let sup=terrainH(p.x,p.z);for(const c of colliders)if(c.top<=prevY+STEP&&inFoot(c,p.x,p.z,.15))sup=Math.max(sup,c.top);
  if(p.y<=sup){if(v.y<=0){if(!P.grounded&&v.y<-9){P.sqv=-Math.min(9,-v.y*.45);burst(p.clone(),8,0xfff0c8,2.5,1.5,.5,.8);}p.y=sup;v.y=0;P.grounded=true;}else p.y=sup;}
  else if(P.grounded&&v.y<=0&&p.y-sup<.35){p.y=sup;v.y=0;}
  else P.grounded=false;
  // remember safe spots for bubble rescues
  if(P.grounded&&p.y>.25){safeT-=dt;if(safeT<=0){safeT=.3;safeHist.push(p.clone());if(safeHist.length>12)safeHist.shift();}}
  if(ph.bound){const b=ph.bound,lx=p.x-b.x,lz=p.z-b.z,rr=Math.hypot(lx,lz);if(rr>b.r){p.x=b.x+lx/rr*b.r;p.z=b.z+lz/rr*b.r;}}
  if(ph.water&&p.y<-.3)startRescue();
}

/* ---------- bubble rescue: falling in the water floats you back ~2 s ---------- */
const bubble=new THREE.Mesh(new THREE.SphereGeometry(1.1,20,14),new THREE.MeshStandardMaterial({color:0xbff3ff,transparent:true,opacity:.35,roughness:.1,metalness:.2}));bubble.visible=false;scene.add(bubble);
export function startRescue(){G.state='rescue';rescue.t=0;rescue.from.copy(P.pos);
  rescue.to.copy(safeHist.length?safeHist[Math.max(0,safeHist.length-6)]:SPAWN);safeHist.length=0;
  P.vel.set(0,0,0);sfx.splash();burst(V(P.pos.x,0,P.pos.z),22,[0xffffff,0xbff3ff,0x7fd8ee],5,5,.9,1.2);bubble.visible=true;
  toast(P.power?'Fruit pups can’t swim! Bubble rescue!':'Splash! Bubble rescue!');}
export function updRescue(dt){rescue.t+=dt;const dur=clamp(rescue.from.distanceTo(rescue.to)/6,1.2,2.6);const k=clamp(rescue.t/dur,0,1),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
  P.pos.lerpVectors(rescue.from,rescue.to,e);P.pos.y=lerp(rescue.from.y,rescue.to.y,e)+Math.sin(Math.PI*k)*3.5;
  bubble.position.copy(P.pos).add(V(0,.85,0));bubble.scale.setScalar(1+Math.sin(rescue.t*9)*.05);P.phase+=dt*18;
  if(k>=1){bubble.visible=false;sfx.pop();burst(bubble.position.clone(),16,0xdff9ff,4,2,.5,.9);P.grounded=false;P.vel.set(0,2,0);G.state='play';}}
