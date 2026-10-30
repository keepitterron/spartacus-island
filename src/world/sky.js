import * as THREE from 'three';
import {rand} from '../core/util.js';
import {scene} from '../core/renderer.js';
import {mat,mesh} from '../core/materials.js';

const clouds=[];
// called after the islands are built (it uses the shared random sequence)
export function buildSky(){
  for(let i=0;i<26;i++){const g=new THREE.Group();const n=3+Math.floor(rand()*3);for(let k=0;k<n;k++){const s=mesh(new THREE.IcosahedronGeometry(1.4+rand()*1.2,0),mat(0xffffff),false);s.position.set(k*1.6-n*.8,rand()*.6,rand()*1.2);g.add(s);}
    g.position.set(-110+rand()*220,18+rand()*10,-390+rand()*450);g.userData.s=.4+rand()*.6;scene.add(g);clouds.push(g);}
}
export function updSky(dt){for(const c of clouds){c.position.x+=c.userData.s*dt;if(c.position.x>115)c.position.x=-115;}}
