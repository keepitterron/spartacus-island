// Little things that make island 1 feel alive: the campfire at Lost & Found Camp flickers, glows
// (more at night), crackles softly and puffs smoke; Bubbly Spring bubbles up and rings ripples.
// Each effect is a small pool of meshes reused forever (no new objects while playing), and only
// runs while Spartacus is near enough to see it.
import * as THREE from 'three';
import { distXZ, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { canvasTexture, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { daylight } from '../../world/daylight.js';

const SEE_REACH = 60; // m: further away, nothing here animates
const CRACKLE_REACH = 6; // m: close enough to hear the fire
const SMOKE_EVERY = 0.45; // s between puffs
const BUBBLE_EVERY = 0.5; // s between bubbles
const WIND = vec3(0.35, 0, -0.2); // smoke drifts a little this way (m/s)

// fire: {pos, flames: [{m, phase}], glow, smoke: [{m, age}], smokeTimer, crackleTimer, sparkTimer}
const fire = { pos: null };
// spring: {pos, bubbles: [{m, age, x, z}], ripples: [{m, age}], bubbleTimer}
const spring = { pos: null };

const unlit = (color, opacity = 1) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity === 1,
  });

// a soft round glow, drawn once
const glowTexture = () =>
  canvasTexture(64, 64, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(255, 200, 90, 1)');
    gradient.addColorStop(1, 'rgba(255, 140, 40, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });

// pos: {x, y, z} the middle of the fire pit, on the ground
export function addCampfire(pos) {
  fire.pos = vec3(pos.x, pos.y, pos.z);
  // three flames that flicker on top of the model's own (they're merged with the scenery)
  fire.flames = [
    [0xff8a3d, 0.24, 0.9, 0],
    [0xffb347, 0.17, 0.7, 2.1],
    [0xffe08a, 0.1, 0.5, 4.2],
  ].map(([color, radius, tall, phase]) => {
    const m = mesh(new THREE.ConeGeometry(radius, tall, 6), unlit(color), { castShadow: false });
    m.geometry.translate(0, tall / 2, 0); // grows from its base
    m.position.copy(fire.pos).add(vec3(0, 0.2, 0));
    scene.add(m);
    return { m, phase };
  });
  fire.glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  fire.glow.position.copy(fire.pos).add(vec3(0, 0.6, 0));
  scene.add(fire.glow);
  const smokeGeometry = new THREE.IcosahedronGeometry(0.22, 0);
  fire.smoke = Array.from({ length: 10 }, () => {
    const m = mesh(smokeGeometry, unlit(0xe8e4dc, 0), { castShadow: false });
    m.visible = false;
    scene.add(m);
    return { m, age: Infinity };
  });
  fire.smokeTimer = 0;
  fire.crackleTimer = 0;
  fire.sparkTimer = 0;
}

// pos: {x, y, z} the middle of the spring, at the water's surface
export function addSpringBubbles(pos) {
  spring.pos = vec3(pos.x, pos.y, pos.z);
  const bubbleMaterial = unlit(0xffffff, 0.75);
  const bubbleGeometry = new THREE.IcosahedronGeometry(0.09, 1);
  spring.bubbles = Array.from({ length: 8 }, () => {
    const m = mesh(bubbleGeometry, bubbleMaterial, { castShadow: false });
    m.visible = false;
    scene.add(m);
    return { m, age: Infinity, x: 0, z: 0 };
  });
  const ringGeometry = new THREE.RingGeometry(0.85, 1, 24).rotateX(-Math.PI / 2);
  spring.ripples = Array.from({ length: 4 }, () => {
    const m = mesh(ringGeometry, unlit(0xffffff, 0), { castShadow: false });
    m.visible = false;
    scene.add(m);
    return { m, age: Infinity };
  });
  spring.bubbleTimer = 0;
}

export function updateAmbience(dt, p) {
  if (fire.pos && distXZ(p, fire.pos.x, fire.pos.z) < SEE_REACH) updateFire(dt, p);
  if (spring.pos && distXZ(p, spring.pos.x, spring.pos.z) < SEE_REACH) updateSpring(dt);
}

/* the campfire */

function updateFire(dt, p) {
  const time = game.time;
  for (const { m, phase } of fire.flames) {
    // two sines out of step read as flicker
    const flicker =
      0.75 + 0.18 * Math.sin(time * 11 + phase) + 0.12 * Math.sin(time * 17.3 + phase * 2);
    m.scale.set(1 - (flicker - 0.75) * 0.6, flicker, 1 - (flicker - 0.75) * 0.6);
    m.rotation.y = time * 0.7 + phase;
  }
  const glowSize = (1.6 + 1.4 * daylight.night) * (0.94 + 0.06 * Math.sin(time * 13));
  fire.glow.scale.set(glowSize, glowSize, 1);
  fire.glow.material.opacity = 0.35 + 0.45 * daylight.night;
  fire.smokeTimer -= dt;
  if (fire.smokeTimer <= 0) {
    fire.smokeTimer = SMOKE_EVERY;
    puffSmoke();
  }
  for (const puff of fire.smoke) updatePuff(puff, dt);
  fire.sparkTimer -= dt;
  if (fire.sparkTimer <= 0) {
    fire.sparkTimer = 0.6 + Math.random() * 0.9;
    burst(fire.pos.clone().add(vec3(0, 0.7, 0)), {
      count: 1,
      color: [0xffb347, 0xffe08a],
      speed: 0.6,
      up: 2.2,
      life: 0.9,
      size: 0.35,
      gravity: 0.15,
    });
  }
  fire.crackleTimer -= dt;
  if (fire.crackleTimer <= 0 && distXZ(p, fire.pos.x, fire.pos.z) < CRACKLE_REACH) {
    fire.crackleTimer = 0.12 + Math.random() * 0.5;
    sfx.crackle();
  }
}

function puffSmoke() {
  const puff = fire.smoke.find((each) => each.age === Infinity);
  if (!puff) return;
  puff.age = 0;
  puff.m.visible = true;
  puff.m.position
    .copy(fire.pos)
    .add(vec3((Math.random() - 0.5) * 0.3, 1, (Math.random() - 0.5) * 0.3));
  puff.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
}

// rises, drifts with the wind, grows and fades over 3.5 s
function updatePuff(puff, dt) {
  if (puff.age === Infinity) return;
  puff.age += dt;
  const t = puff.age / 3.5;
  if (t >= 1) {
    puff.age = Infinity;
    puff.m.visible = false;
    return;
  }
  puff.m.position.y += dt * 0.9;
  puff.m.position.addScaledVector(WIND, dt * t * 2);
  puff.m.scale.setScalar(0.6 + t * 2.4);
  puff.m.material.opacity = Math.sin(t * Math.PI) * 0.45;
}

/* the spring */

function updateSpring(dt) {
  spring.bubbleTimer -= dt;
  if (spring.bubbleTimer <= 0) {
    spring.bubbleTimer = BUBBLE_EVERY * (0.5 + Math.random());
    const bubble = spring.bubbles.find((each) => each.age === Infinity);
    if (bubble) {
      bubble.age = 0;
      bubble.x = spring.pos.x + (Math.random() - 0.5) * 2.4;
      bubble.z = spring.pos.z + (Math.random() - 0.5) * 2.4;
      bubble.m.visible = true;
    }
  }
  for (const bubble of spring.bubbles) updateBubble(bubble, dt);
  for (const ripple of spring.ripples) updateRipple(ripple, dt);
}

// from the bottom of the pool to the surface in 1.2 s, wobbling, then a ripple
function updateBubble(bubble, dt) {
  if (bubble.age === Infinity) return;
  bubble.age += dt;
  const t = bubble.age / 1.2;
  if (t >= 1) {
    bubble.age = Infinity;
    bubble.m.visible = false;
    startRipple(bubble);
    return;
  }
  const wobble = Math.sin(bubble.age * 14) * 0.04;
  bubble.m.position.set(bubble.x + wobble, spring.pos.y - 0.9 + t * 0.9, bubble.z);
  bubble.m.scale.setScalar(0.6 + t * 0.6);
}

function startRipple(bubble) {
  const ripple = spring.ripples.find((each) => each.age === Infinity);
  if (!ripple) return;
  ripple.age = 0;
  ripple.m.visible = true;
  ripple.m.position.set(bubble.x, spring.pos.y + 0.03, bubble.z);
}

// a ring spreading out to 0.8 m and fading over 1.4 s
function updateRipple(ripple, dt) {
  if (ripple.age === Infinity) return;
  ripple.age += dt;
  const t = ripple.age / 1.4;
  if (t >= 1) {
    ripple.age = Infinity;
    ripple.m.visible = false;
    return;
  }
  ripple.m.scale.setScalar(0.15 + t * 0.65);
  ripple.m.material.opacity = (1 - t) * 0.6;
}
