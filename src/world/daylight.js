// Day and night. The 🌙 button (or L) fades between them over a couple of seconds:
// darker sky and fog, moonlight instead of sunshine, stars, fireflies (systems/critters.js),
// softer music (core/music.js) and presents that only show up at night (systems/secrets.js).
import * as THREE from 'three';
import { lerp } from '../core/util.js';
import { scene, camera, sun, hemi, ambience } from '../core/renderer.js';

// night: 0 = full day … 1 = full night (eased towards `target`)
export const daylight = { night: 0, target: 0 };
export const isNight = () => daylight.night > 0.5;

const FADE_TIME = 2.5;
const SKY = { day: new THREE.Color(0xa8e6f7), night: new THREE.Color(0x1d2b52) };
const SEA = { day: new THREE.Color(0x1a6f9e), night: new THREE.Color(0x0b2a48) };
const SUN = { day: new THREE.Color(0xfff2d6), night: new THREE.Color(0xa9bcff) };
const HEMI = { day: new THREE.Color(0xffffff), night: new THREE.Color(0x8fa6ff) };

let stars = null;
export function buildStars() {
  const count = 500,
    positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // random directions on the upper half of a big sphere round the camera
    const angle = Math.random() * Math.PI * 2,
      up = 0.08 + Math.random() * 0.92,
      flat = Math.sqrt(1 - up * up);
    positions.set([Math.cos(angle) * flat * 300, up * 300, Math.sin(angle) * flat * 300], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  stars = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      fog: false,
      depthWrite: false,
    }),
  );
  stars.visible = false;
  scene.add(stars);
}

export function setNight(night) {
  daylight.target = night ? 1 : 0;
}

export function updateDaylight(dt) {
  const step = dt / FADE_TIME;
  daylight.night += Math.max(-step, Math.min(step, daylight.target - daylight.night));
  const night = daylight.night,
    colors = ambience.under ? SEA : SKY;
  scene.background.copy(colors.day).lerp(colors.night, night);
  scene.fog.color.copy(scene.background);
  sun.intensity = lerp(2.3, 0.55, night);
  sun.color.copy(SUN.day).lerp(SUN.night, night);
  hemi.intensity = lerp(1.3, 0.55, night);
  hemi.color.copy(HEMI.day).lerp(HEMI.night, night);
  stars.visible = night > 0.01 && !ambience.under;
  stars.material.opacity = night;
  stars.position.copy(camera.position);
}
