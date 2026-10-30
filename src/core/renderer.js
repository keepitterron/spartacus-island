import * as THREE from 'three';
import { $ } from './util.js';

export const canvas = $('#c');
// phones/tablets get a lighter renderer: lower pixel ratio, smaller shadows, coarser meshes
export const LOW =
  matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 800;
export let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !LOW,
    powerPreference: LOW ? 'default' : 'high-performance',
  });
} catch (e) {
  window.__showErr('This device couldn’t start 3D graphics (WebGL).');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.25 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  window.__showErr('The graphics stopped (the device ran low on memory). Tap reload to try again.');
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8e6f7);
scene.fog = new THREE.Fog(0xa8e6f7, 60, 170);
export const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
function resize() {
  const w = innerWidth,
    h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 68 : 55;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

scene.add(new THREE.HemisphereLight(0xffffff, 0x8fcf7a, 1.3));
export const sun = new THREE.DirectionalLight(0xfff2d6, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 110 });
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);
// the shadow camera is small, so it follows whatever we're looking at
export function followSun(p) {
  sun.position.set(p.x + 18, p.y + 34, p.z + 14);
  sun.target.position.copy(p);
}

export const ambience = { under: false };
export function setAmbience(u) {
  ambience.under = u;
  scene.background.set(u ? 0x1a6f9e : 0xa8e6f7);
  scene.fog.color.set(u ? 0x1a6f9e : 0xa8e6f7);
  scene.fog.near = u ? 16 : 60;
  scene.fog.far = u ? 85 : 170;
}
