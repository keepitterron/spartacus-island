// Visual effects: particle bursts, floating text labels and the wait for the game font.
import * as THREE from 'three';
import { clamp, vec3 } from './util.js';
import { scene } from './renderer.js';

// Particles: little icosahedrons (or paper confetti). gravity<0 makes them rise (bubbles).
// All of them are drawn by two instanced meshes (one per shape), so a burst of sparkles costs no
// extra draw calls and makes no new objects: phones were drawing every particle on its own.
// A particle shrinks away as its life runs out.
// Each live particle is {pos, v, life, max, gravity, size, color, spin, rotation}.
const MAX_PARTICLES = 700; // per shape; past this the oldest go first
const particleGeo = new THREE.IcosahedronGeometry(0.1, 0);
const confettiGeo = new THREE.PlaneGeometry(0.18, 0.28);
const pools = { bits: null, confetti: null }; // {mesh, live: [particle]}, made on first use
const placer = new THREE.Object3D();

function pool(confetti) {
  const key = confetti ? 'confetti' : 'bits';
  if (pools[key]) return pools[key];
  const mesh = new THREE.InstancedMesh(
    confetti ? confettiGeo : particleGeo,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    MAX_PARTICLES,
  );
  mesh.setColorAt(0, new THREE.Color()); // so the material uses each particle's colour
  mesh.count = 0;
  mesh.frustumCulled = false; // particles fly everywhere; the bounds would always be stale
  scene.add(mesh);
  pools[key] = { mesh, live: [] };
  return pools[key];
}

// color can be one colour or an array that the particles cycle through
export function burst(
  pos,
  { count, color, speed, up, life, size = 1, gravity = 1, confetti = false, dir = null },
) {
  const { live } = pool(confetti);
  for (let i = 0; i < count; i++) {
    const hex = Array.isArray(color) ? color[i % color.length] : color;
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
    live.push({
      pos: vec3(pos.x, pos.y, pos.z),
      v,
      life,
      max: life,
      gravity,
      size: size * (0.6 + Math.random() * 0.8),
      color: new THREE.Color(hex),
      spin: confetti ? vec3(Math.random() * 8, Math.random() * 8, Math.random() * 8) : null,
      rotation: new THREE.Euler(),
    });
    if (live.length > MAX_PARTICLES) live.shift();
  }
}

export function updateParticles(dt) {
  for (const each of Object.values(pools)) if (each) updatePool(each, dt);
}

function updatePool({ mesh, live }, dt) {
  for (let i = live.length - 1; i >= 0; i--) {
    const p = live[i];
    p.life -= dt;
    if (p.life <= 0) {
      live.splice(i, 1);
      continue;
    }
    p.v.y -= 20 * p.gravity * dt;
    if (p.spin) {
      // confetti: air drag slows it so it flutters down
      p.v.multiplyScalar(Math.exp(-dt * 1.5));
      p.rotation.x += p.spin.x * dt;
      p.rotation.y += p.spin.y * dt;
    }
    p.pos.addScaledVector(p.v, dt);
  }
  live.forEach((p, i) => {
    placer.position.copy(p.pos);
    placer.rotation.copy(p.rotation);
    placer.scale.setScalar(p.size * clamp((p.life / p.max) * 1.5, 0, 1));
    placer.updateMatrix();
    mesh.setMatrixAt(i, placer.matrix);
    mesh.setColorAt(i, p.color);
  });
  mesh.count = live.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
