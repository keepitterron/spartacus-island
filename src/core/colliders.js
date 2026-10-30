import {terrainH} from '../world/terrain.js';

// Everything you can stand on or bump into. Flat list, checked every frame:
//   {type:'cyl', x,z, r, bottom, top}   or   {type:'box', x,z, hw,hd, bottom, top}
// A cylinder with `.tree` set is climbable once tree.grown is true.
// To switch a collider off, set top=-999.
export const colliders=[];
export const addCyl=(x,z,r,bottom,top)=>{const c={type:'cyl',x,z,r,bottom,top};colliders.push(c);return c;};
export const addBox=(x,z,hw,hd,bottom,top)=>{const c={type:'box',x,z,hw,hd,bottom,top};colliders.push(c);return c;};

export function inFoot(c,x,z,pad){return c.type==='cyl'?Math.hypot(x-c.x,z-c.z)<c.r+pad:Math.abs(x-c.x)<c.hw+pad&&Math.abs(z-c.z)<c.hd+pad;}
// highest surface under (x,z) that is not above maxY
export function supportAt(x,z,maxY){let s=terrainH(x,z);for(const c of colliders)if(c.top<=maxY&&inFoot(c,x,z,0))s=Math.max(s,c.top);return s;}
// push a body of radius R at p out of collider c, cancelling velocity into it
export function pushOut(c,p,v,R){
  if(c.type==='cyl'){const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz)||1e-4,m=c.r+R;if(d<m){const nx=dx/d,nz=dz/d;p.x=c.x+nx*m;p.z=c.z+nz*m;const vn=v.x*nx+v.z*nz;if(vn<0){v.x-=vn*nx;v.z-=vn*nz;}}}
  else{const ex=c.hw+R,ez=c.hd+R,dx=p.x-c.x,dz=p.z-c.z;if(Math.abs(dx)<ex&&Math.abs(dz)<ez){if(ex-Math.abs(dx)<ez-Math.abs(dz)){const s=Math.sign(dx)||1;p.x=c.x+s*ex;if(v.x*s<0)v.x=0;}else{const s=Math.sign(dz)||1;p.z=c.z+s*ez;if(v.z*s<0)v.z=0;}}}
}
