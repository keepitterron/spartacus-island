import * as THREE from 'three';
import {clamp} from '../core/util.js';
import {scene,LOW} from '../core/renderer.js';
import {mesh} from '../core/materials.js';

// All islands live in one world, spread along -z. Each island registers a height
// function for its band of z: terrainH picks the band, so islands can't overlap in z.
const zones=[];
export function addTerrain(zMax,h){zones.push({zMax,h});zones.sort((a,b)=>b.zMax-a.zMax);}
export function terrainH(x,z){let h=zones[0].h;for(const e of zones)if(z<e.zMax)h=e.h;return h(x,z);}

// Island ground mesh. Colours are painted into a texture rather than vertex colours,
// because some phone GPUs drew vertex-coloured meshes black.
export function buildGround(cx,cz,S,N,pal={g:0x6ccb5f,g2:0x92dc6c}){
  const g=new THREE.PlaneGeometry(S,S,N,N);g.rotateX(-Math.PI/2);g.translate(cx,0,cz);
  const p=g.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,terrainH(p.getX(i),p.getZ(i)));
  g.computeVertexNormals();g.computeBoundingSphere();
  const TW=LOW?256:512,cv=document.createElement('canvas');cv.width=cv.height=TW;const cx2=cv.getContext('2d'),img=cx2.createImageData(TW,TW),D=img.data;
  const cg=new THREE.Color(pal.g),cg2=new THREE.Color(pal.g2),cs=new THREE.Color(0xffe08a),cw=new THREE.Color(0xe3bb6e),c=new THREE.Color(),o={r:0,g:0,b:0},cdeep=new THREE.Color(0x8fa7b8);
  const sea=pal.seabed!==undefined;
  for(let py=0;py<TW;py++)for(let px=0;px<TW;px++){const x=cx+(px+.5)/TW*S-S/2,z=cz+(py+.5)/TW*S-S/2,h=terrainH(x,z);
    if(sea){c.copy(cs).lerp(cw,.5+.5*Math.sin(x*.5)*Math.cos(z*.45));if(h>pal.seabed+3)c.lerp(cdeep,clamp((h-pal.seabed-3)/8,0,1));}
    else if(h>.75)c.copy(cg).lerp(cg2,.5+.5*Math.sin(x*.9)*Math.cos(z*.7));else if(h>.55)c.copy(cs).lerp(cg,(h-.55)/.2);else if(h>.05)c.copy(cs);else c.copy(cw);
    c.getRGB(o,THREE.SRGBColorSpace);const i=(py*TW+px)*4;D[i]=o.r*255;D[i+1]=o.g*255;D[i+2]=o.b*255;D[i+3]=255;}
  cx2.putImageData(img,0,0);const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  scene.add(mesh(g,new THREE.MeshStandardMaterial({map:tex,flatShading:true,roughness:.95}),false,true));
}
