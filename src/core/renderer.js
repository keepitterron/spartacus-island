// The WebGL renderer, scene, camera and lights, plus the surface/underwater look.
import * as THREE from 'three';
import { $ } from './util.js';

export const canvas = $('#c');
// phones/tablets get a lighter renderer: lower pixel ratio, smaller shadows, coarser meshes
export const LOW_POWER =
  matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 800;
export let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !LOW_POWER,
    powerPreference: LOW_POWER ? 'default' : 'high-performance',
  });
} catch (e) {
  window.__showErr('This device couldn’t start 3D graphics (WebGL).');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW_POWER ? 1.25 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = LOW_POWER ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
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
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 68 : 55; // wider view in portrait
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

export const hemi = new THREE.HemisphereLight(0xffffff, 0x8fcf7a, 1.3);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xfff2d6, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(LOW_POWER ? 1024 : 2048, LOW_POWER ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 110 });
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);
// the shadow camera is small, so it follows whatever we're looking at
export function followSun(target) {
  sun.position.set(target.x + 18, target.y + 34, target.z + 14);
  sun.target.position.copy(target);
}

export const ambience = { under: false }; // under: we're on the sea floor
// underwater: deep blue and much thicker fog (world/daylight.js darkens the colours at night)
export function setUnderwater(underwater) {
  ambience.under = underwater;
  scene.background.set(underwater ? 0x1a6f9e : 0xa8e6f7);
  scene.fog.color.set(underwater ? 0x1a6f9e : 0xa8e6f7);
  scene.fog.near = underwater ? 16 : 60;
  scene.fog.far = underwater ? 85 : 170;
}
