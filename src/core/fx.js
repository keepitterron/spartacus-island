import * as THREE from 'three';
import {clamp,V} from './util.js';
import {scene} from './renderer.js';

// Particles: little icosahedrons (or paper confetti). grav<0 makes them rise (bubbles).
const parts=[];const pGeo=new THREE.IcosahedronGeometry(.1,0),cGeo=new THREE.PlaneGeometry(.18,.28);
export function burst(p,n,color,speed,up,life,size=1,grav=1,confetti=false,dir=null){
  for(let i=0;i<n;i++){const col=Array.isArray(color)?color[i%color.length]:color;
    const m=new THREE.Mesh(confetti?cGeo:pGeo,new THREE.MeshBasicMaterial({color:col,transparent:true,side:THREE.DoubleSide}));
    m.position.copy(p);m.scale.setScalar(size*(.6+Math.random()*.8));
    const a=Math.random()*6.283,e=Math.random()*1.2-.2;const v=V(Math.cos(a)*Math.cos(e),Math.sin(e),Math.sin(a)*Math.cos(e)).multiplyScalar(speed*(.4+Math.random()*.6));v.y+=up;if(dir)v.addScaledVector(dir,speed);
    scene.add(m);parts.push({m,v,life,max:life,grav,spin:confetti?V(Math.random()*8,Math.random()*8,Math.random()*8):null});}
}
export function updParts(dt){for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;p.v.y-=20*p.grav*dt;if(p.spin){p.v.multiplyScalar(Math.exp(-dt*1.5));p.m.rotation.x+=p.spin.x*dt;p.m.rotation.y+=p.spin.y*dt;}
  p.m.position.addScaledVector(p.v,dt);p.m.material.opacity=clamp(p.life/p.max*1.5,0,1);if(p.life<=0){scene.remove(p.m);p.m.material.dispose();parts.splice(i,1);}}}

// A floating text label ("WOOF!", "Zzz"). Draws with the game font, so create labels
// inside onFontsReady() or they come out in a fallback font.
export function textSprite(text,fill){const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
  x.font="700 68px Fredoka, ui-rounded, system-ui, sans-serif";x.textAlign='center';x.textBaseline='middle';x.lineJoin='round';
  x.lineWidth=14;x.strokeStyle='#2b3a55';x.strokeText(text,256,66);x.fillStyle=fill;x.fillText(text,256,66);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false}));s.scale.set(4,1,1);s.renderOrder=10;return s;}

let fontsOk=false;const waiting=[];
export function onFontsReady(fn){if(fontsOk)fn();else waiting.push(fn);}
function fontsReady(){if(fontsOk)return;fontsOk=true;waiting.splice(0).forEach(f=>f());}
// load the bold weight explicitly: document.fonts.ready alone resolves before an unused font loads
(document.fonts?document.fonts.load('700 68px Fredoka'):Promise.resolve()).then(fontsReady,fontsReady);
setTimeout(fontsReady,1500);
