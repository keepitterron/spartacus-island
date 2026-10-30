// Visual effects: particle bursts, floating text labels and the wait for the game font.
import * as THREE from 'three';
import { clamp, vec3 } from './util.js';
import { scene } from './renderer.js';

// Particles: little icosahedrons (or paper confetti). gravity<0 makes them rise (bubbles).
// Each live particle is {m: mesh, v: velocity, life, max: starting life, gravity, spin}.
const particles = [];
const particleGeo = new THREE.IcosahedronGeometry(0.1, 0);
const confettiGeo = new THREE.PlaneGeometry(0.18, 0.28);
// color can be one colour or an array that the particles cycle through
export function burst(
  pos,
  { count, color, speed, up, life, size = 1, gravity = 1, confetti = false, dir = null },
) {
  for (let i = 0; i < count; i++) {
    const col = Array.isArray(color) ? color[i % color.length] : color;
    const m = new THREE.Mesh(
      confetti ? confettiGeo : particleGeo,
      new THREE.MeshBasicMaterial({ color: col, transparent: true, side: THREE.DoubleSide }),
    );
    m.position.copy(pos);
    m.scale.setScalar(size * (0.6 + Math.random() * 0.8));
    // random direction: any heading, elevation from slightly down to well up
    const heading = Math.random() * 6.283;
    const elevation = Math.random() * 1.2 - 0.2;
    const v = vec3(
      Math.cos(heading) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(heading) * Math.cos(elevation),
    ).multiplyScalar(speed * (0.4 + Math.random() * 0.6));
    v.y += up;
    if (dir) v.addScaledVector(dir, speed);
    scene.add(m);
    particles.push({
      m,
      v,
      life,
      max: life,
      gravity,
      spin: confetti ? vec3(Math.random() * 8, Math.random() * 8, Math.random() * 8) : null,
    });
  }
}
export function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.v.y -= 20 * p.gravity * dt;
    if (p.spin) {
      // confetti: air drag slows it so it flutters down
      p.v.multiplyScalar(Math.exp(-dt * 1.5));
      p.m.rotation.x += p.spin.x * dt;
      p.m.rotation.y += p.spin.y * dt;
    }
    p.m.position.addScaledVector(p.v, dt);
    p.m.material.opacity = clamp((p.life / p.max) * 1.5, 0, 1);
    if (p.life <= 0) {
      scene.remove(p.m);
      p.m.material.dispose();
      particles.splice(i, 1);
    }
  }
}

// A floating text label ("WOOF!", "Zzz"). Draws with the game font, so create labels
// inside onFontsReady() or they come out in a fallback font.
export function textSprite(text, fill) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '700 68px Fredoka, ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#2b3a55';
  ctx.strokeText(text, 256, 66);
  ctx.fillStyle = fill;
  ctx.fillText(text, 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.scale.set(4, 1, 1);
  sprite.renderOrder = 10; // drawn on top of everything
  return sprite;
}

let fontsLoaded = false;
const waitingForFonts = [];
export function onFontsReady(fn) {
  if (fontsLoaded) fn();
  else waitingForFonts.push(fn);
}
function fontsReady() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  for (const fn of waitingForFonts.splice(0)) fn();
}
// load the bold weight explicitly: document.fonts.ready alone resolves before an unused font loads
(document.fonts ? document.fonts.load('700 68px Fredoka') : Promise.resolve()).then(
  fontsReady,
  fontsReady,
);
setTimeout(fontsReady, 1500); // don't wait forever if the font never loads
