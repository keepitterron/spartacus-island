import {V} from '../core/util.js';
import {camera} from '../core/renderer.js';
import {G,cam,cur,playing} from '../core/state.js';
import {keys,drag} from '../core/input.js';
import {P} from '../player/player.js';

// Third-person follow camera. Q/E or dragging turns it (cam.yaw); islands can add
//   camera:{minY(pos), maxY, assist(dt)}   e.g. stay under the water surface, or turn
//   down a corridor. assist only runs while the player isn't turning the camera.
const target=V();
export function snapCamera(){target.copy(P.pos);camera.position.set(P.pos.x,P.pos.y+cam.h,P.pos.z+cam.dist);}
export function orbitCamera(){const a=G.T*.1;camera.position.set(Math.sin(a)*50,22,Math.cos(a)*50);camera.lookAt(0,2,0);}
export function updCamera(dt){const C=cur().camera||{};
  if(keys.q)cam.yaw+=1.8*dt;if(keys.e)cam.yaw-=1.8*dt;
  if(C.assist&&playing()&&drag.id===null&&!keys.q&&!keys.e)C.assist(dt);
  target.lerp(V().copy(P.pos).add(V(0,1.3,0)),1-Math.exp(-dt*(P.swing?5:8)));
  const want=V(target.x+Math.sin(cam.yaw)*cam.dist,target.y+cam.h,target.z+Math.cos(cam.yaw)*cam.dist);
  camera.position.lerp(want,1-Math.exp(-dt*6));
  const minY=C.minY?C.minY(camera.position):1.2;if(camera.position.y<minY)camera.position.y=minY;
  if(C.maxY!==undefined&&camera.position.y>C.maxY)camera.position.y=C.maxY;
  camera.lookAt(target);
}
