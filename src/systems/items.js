import * as THREE from 'three';
import {clamp,angLerp,flat,V} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {sfx} from '../core/audio.js';
import {burst} from '../core/fx.js';
import {toast} from '../core/ui.js';
import {supportAt} from '../core/colliders.js';
import {P,fwd,physics} from '../player/player.js';
import {dog} from '../player/dog.js';

// Things Spartacus carries in his mouth. One at a time.
// state: ground | carried | floating (bubbling home) | placed | used
// opts: name (for messages), heavy (slower, lower jumps), reach, lift (height above ground
//       when dropped), carryPos/carryRot (in the mouth), yaw, onCarry(it)
export const items=[];
export function addItem(id,m,pos,heavy,opts={}){m.position.copy(pos);m.rotation.y=opts.yaw||0;scene.add(m);m.traverse(o=>{if(o.isMesh)o.castShadow=true;});
  const it=Object.assign({id,name:'thing',mesh:m,heavy,home:pos.clone(),homeYaw:opts.yaw||0,state:'ground',reach:1.6,lift:.12,carryPos:V(0,-.05,.12),carryRot:0},opts);items.push(it);return it;}

export function carry(it){it.state='carried';scene.remove(it.mesh);dog.mouth.add(it.mesh);it.mesh.position.copy(it.carryPos);it.mesh.rotation.set(0,it.carryRot,0);P.carry=it;sfx.grab();it.onCarry?.(it);}
// take the carried item out of the mouth (it stays where it was in the world)
export function release(){const it=P.carry;P.carry=null;const w=V();it.mesh.getWorldPosition(w);dog.mouth.remove(it.mesh);scene.add(it.mesh);it.mesh.position.copy(w);it.mesh.rotation.set(0,P.yaw,0);return it;}
// release and get rid of it (given to someone, used up)
export function useUp(){const it=release();scene.remove(it.mesh);it.state='used';return it;}
export function drop(){const it=release();const f=fwd();const x=P.pos.x+f.x*1.1,z=P.pos.z+f.z*1.1;const s=supportAt(x,z,P.pos.y+.6);sfx.drop();
  if(physics().water&&s<0){it.mesh.position.set(x,.2,z);floatBack(it);return;}
  it.mesh.position.set(x,s+it.lift,z);it.state='ground';}
export function grabAction(p){for(const it of items)if(it.state==='ground'&&flat(p,it.mesh.position.x,it.mesh.position.z)<it.reach&&Math.abs(p.y-it.mesh.position.y)<1.5)return{label:'Grab',fn:()=>carry(it)};return null;}

/* dropped in the water: a bubble floats it back to where it was found */
const floaters=[],beacons=[];
function floatBack(it){it.state='floating';
  const b=new THREE.Mesh(new THREE.SphereGeometry(it.heavy?2.2:1,16,12),new THREE.MeshStandardMaterial({color:0xbff3ff,transparent:true,opacity:.35,roughness:.1,depthWrite:false}));scene.add(b);
  floaters.push({it,b,t:0,from:it.mesh.position.clone()});sfx.splash();toast(`Splash! The ${it.name} floats away in a bubble…`,3000);}
export function updFloaters(dt){
  for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.t+=dt;const dur=clamp(f.from.distanceTo(f.it.home)/7,2,4.5),k=clamp(f.t/dur,0,1),e=k*k*(3-2*k),m=f.it.mesh;
    m.position.lerpVectors(f.from,f.it.home,e);m.position.y+=Math.sin(Math.PI*k)*6;m.rotation.y+=dt*1.5;f.b.position.copy(m.position);f.b.scale.setScalar(1+Math.sin(f.t*8)*.05);
    if(Math.random()<dt*10)burst(m.position.clone(),1,0xdff9ff,.5,1,.8,.7);
    if(k>=1){scene.remove(f.b);m.position.copy(f.it.home);m.rotation.set(0,f.it.homeYaw,0);f.it.state='ground';floaters.splice(i,1);sfx.pop();
      beacons.push({p:f.it.home.clone(),t:5});toast(`The ${f.it.name} floated back to where you found it. Look for the sparkles!`,3400);}}
  for(let i=beacons.length-1;i>=0;i--){const b=beacons[i];b.t-=dt;if(Math.random()<dt*25)burst(b.p.clone().add(V((Math.random()-.5)*.8,.2,(Math.random()-.5)*.8)),1,[0xffd84d,0xffffff],.6,6,1,.9,-.05);if(b.t<=0)beacons.splice(i,1);}}

/* put the carried item into place (e.g. the plank into the bridge); movement is locked meanwhile */
export function placeItem(to,onDone){const it=release();it.state='placed';P.placing={it,from:it.mesh.position.clone(),to:to.clone(),yaw0:it.mesh.rotation.y,t:0,onDone};}
export function updPlacing(dt){const pl=P.placing;if(!pl)return;pl.t+=dt;const k=clamp(pl.t/.7,0,1),e=1-Math.pow(1-k,3);const m=pl.it.mesh;m.position.lerpVectors(pl.from,pl.to,e);m.position.y+=Math.sin(Math.PI*k)*1.5;m.rotation.y=angLerp(pl.yaw0,0,e);
  if(k>=1){m.position.copy(pl.to);m.rotation.set(0,0,0);P.placing=null;pl.onDone?.(pl.it);}}
