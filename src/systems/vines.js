import * as THREE from 'three';
import {clamp,flat,rand,V} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {mat,mesh} from '../core/materials.js';
import {G} from '../core/state.js';
import {axis} from '../core/input.js';
import {sfx} from '../core/audio.js';
import {burst} from '../core/fx.js';
import {toast,hintOnce,actWord} from '../core/ui.js';
import {terrainH} from '../world/terrain.js';
import {leafGeo,makeSeed} from '../models/items.js';
import {P} from '../player/player.js';
import {POWERS} from './powers.js';

// Grow-Grow: magic seeds grow either a climbing vine up a "tree" or a zipline vine
// between two tree tops.
// A tree is {x,z,gh (ground), top, grown} with a collider whose .tree points back at it
// (see bigTree in island 3, kelp pillar in island 4). Walking into it once grown = climb.
export const growers=[];

// a seed at the foot of tree t (on the side facing tx,tz) that grows a vine spiralling up it
export function climbVine(t,tx,tz){
  const dx=tx-t.x,dz=tz-t.z,d=Math.hypot(dx,dz),ux=dx/d,uz=dz/d;const sx=t.x+ux*2.2,sz=t.z+uz*2.2,sy=terrainH(sx,sz);
  const seed=makeSeed();seed.position.set(sx,sy,sz);scene.add(seed);
  const vine=new THREE.Group();vine.position.set(t.x,t.gh,t.z);vine.visible=false;vine.scale.y=.001;scene.add(vine);
  const H=t.top-t.gh,a0=Math.atan2(uz,ux),pts=[];
  for(let i=0;i<=36;i++){const y=i/36*(H-.3),r=1.42-.35*(y/H),a=a0+Math.sin(i*.35)*.9;pts.push(V(Math.cos(a)*r,y,Math.sin(a)*r));}
  vine.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),60,.11,5),mat(0x3fae4f)));
  for(let i=2;i<36;i+=2){const l=mesh(leafGeo,mat(i%4?0x6cd65a:0x4cc05a),false);l.position.copy(pts[i]).multiply(V(1.08,1,1.08));l.rotation.set(rand()*2,rand()*6,rand()*2);vine.add(l);}
  const g={kind:'climb',t,x:sx,z:sz,y:sy,seed,vine,grown:false,growing:false,k:0};growers.push(g);return g;}
// a seed on top of tree a that grows a zipline to tree b
export function zipVine(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),ux=dx/d,uz=dz/d;
  const sx=a.x+ux*2.4,sz=a.z+uz*2.4,ex=b.x-ux*2.4,ez=b.z-uz*2.4;
  for(const [px,pz,py] of [[sx,sz,a.top],[ex,ez,b.top]]){const pl=mesh(new THREE.CylinderGeometry(.12,.15,1.9,6),mat(0x6e4a30));pl.position.set(px,py+.95,pz);scene.add(pl);}
  const p0=V(sx,a.top+1.8,sz),p2=V(ex,b.top+1.8,ez),p1=V((sx+ex)/2,Math.min(p0.y,p2.y)-1.4,(sz+ez)/2);
  const curve=new THREE.QuadraticBezierCurve3(p0,p1,p2);
  const geo=new THREE.TubeGeometry(curve,60,.09,5);geo.setDrawRange(0,0);const tube=mesh(geo,mat(0x3fae4f));scene.add(tube);
  const seed=makeSeed();const sdx=a.x+ux*1.6,sdz=a.z+uz*1.6;seed.position.set(sdx,a.top,sdz);scene.add(seed);
  const g={kind:'zip',a,b,x:sdx,z:sdz,y:a.top,seed,tube,geo,curve,len:curve.getLength(),end:V(b.x-ux*1.3,b.top,b.z-uz*1.3),grown:false,growing:false,k:0};growers.push(g);return g;}

export function vineAction(p){
  for(const g of growers){
    if(!g.grown&&!g.growing&&P.power==='grow'&&flat(p,g.x,g.z)<1.4&&Math.abs(p.y-g.y)<1.2)return{label:'Grow',fn:()=>startGrow(g)};
    if(g.kind==='zip'&&g.grown&&flat(p,g.x,g.z)<1.6&&Math.abs(p.y-g.y)<1.2)return{label:'Zip',fn:()=>startZip(g)};}
  return null;}
function startGrow(g){g.growing=true;g.k=0;g.seed.visible=false;sfx.grow();burst(V(g.x,g.y+.4,g.z),20,POWERS.grow.col,3,3,.8,.9);}
export function updGrowers(dt){const T=G.T;
  for(const g of growers){
    if(!g.grown&&!g.growing){g.seed.children[0].position.y=.3+Math.sin(T*3+g.x)*.06;g.seed.children[0].material.emissiveIntensity=.4+.4*Math.sin(T*4+g.z);}
    if(g.growing){g.k=Math.min(1,g.k+dt/1.3);const e=1-Math.pow(1-g.k,2);
      if(g.kind==='climb'){g.vine.visible=true;g.vine.scale.y=Math.max(.001,e);}
      else g.geo.setDrawRange(0,Math.floor(g.geo.index.count*e/3)*3);
      if(g.k>=1){g.growing=false;g.grown=true;if(g.kind==='climb'){g.t.grown=true;toast('The vine grew! Walk into it to climb.',3000);}
        else toast(`A vine to the next tree! Press ${actWord()} to zip.`,3000);}}}}

/* climbing: up/down moves along the trunk, left/right circles it, jump lets go */
export function startClimb(t){P.climb={t,a:Math.atan2(P.pos.z-t.z,P.pos.x-t.x)};P.vel.set(0,0,0);P.grounded=false;sfx.grab();}
export function updClimb(dt){const c=P.climb,t=c.t;
  let {f,r}=axis();f=clamp(f,-1,1);r=clamp(r,-1,1);
  P.pos.y+=f*3.6*dt;c.a-=r*1.3*dt;P.phase+=(Math.abs(f)+Math.abs(r)*.5)*dt*9;
  const rad=1.35-.35*clamp((P.pos.y-t.gh)/(t.top-t.gh),0,1)+.5;
  P.pos.x=t.x+Math.cos(c.a)*rad;P.pos.z=t.z+Math.sin(c.a)*rad;P.yaw=Math.atan2(t.x-P.pos.x,t.z-P.pos.z);
  const gy=terrainH(P.pos.x,P.pos.z);
  P.jumpBuf-=dt;
  if(P.jumpBuf>0){P.jumpBuf=0;P.climb=null;P.vel.set(Math.cos(c.a)*5,7,Math.sin(c.a)*5);sfx.jump();return;}
  if(P.pos.y<=gy){P.pos.y=gy;if(f<0){P.climb=null;P.pos.x+=Math.cos(c.a)*.3;P.pos.z+=Math.sin(c.a)*.3;P.grounded=true;}}
  if(P.pos.y>=t.top-1.1){P.climb=null;P.pos.set(t.x+Math.cos(c.a)*1.7,t.top,t.z+Math.sin(c.a)*1.7);P.vel.set(0,0,0);P.grounded=true;P.sqv=-4;sfx.pop();
    hintOnce('treetop',`Treetop! Another magic seed is up here…`,3000);}}

/* zipline: ride the curve to the end, no input */
function startZip(g){P.zip={g,u:0};P.vel.set(0,0,0);P.grounded=false;sfx.zip();}
export function updZip(dt){const z=P.zip,g=z.g;z.u=Math.min(1,z.u+11/g.len*dt);const pt=g.curve.getPointAt(z.u),tg=g.curve.getTangentAt(z.u);
  P.pos.set(pt.x,pt.y-1.55,pt.z);P.yaw=Math.atan2(tg.x,tg.z);
  if(Math.random()<dt*20)burst(pt.clone(),1,POWERS.grow.col,1,0,.4,.6,.2);
  if(z.u>=1){P.zip=null;P.pos.copy(g.end);P.vel.set(0,0,0);P.grounded=false;P.sqv=-4;burst(P.pos.clone(),10,POWERS.grow.col,2.5,1.5,.5,.8);}}
