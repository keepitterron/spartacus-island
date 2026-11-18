// A patch of water that bubbles up and rings ripples: island 1's Bubbly Spring, and island 5's
// "something is stuck down there" spot where Wasabi fetches the lost ball. A small pool of meshes
// reused forever (no new objects while playing); it only animates while Spartacus is near enough
// to see it.
//
//   const spot = addBubbleSpot(pos, { size, spread, every, popReach })
//     pos: {x, y, z} the middle, at the water's surface
//     size: 1 is a spring's (bubbles 9 cm, ripples 0.8 m across); bigger is easier to spot from afar
//     spread: m across the patch where bubbles come up; every: s between bubbles
//     popReach: m within which surfacing bubbles make a soft pop (0: silent), a cue to look around
//     float: m the bubbles keep floating up into the air before they pop (0: they pop at the surface),
//       so the spot can be seen over a hedge or a rise
//   spot.update(dt, playerPos) every frame; spot.stop() when it's done (it stays hidden)
import * as THREE from 'three';
import { distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { mesh } from '../core/materials.js';
import { sfx } from '../core/audio.js';

const SEE_REACH = 60; // m: further away, nothing animates
const RISE_TIME = 1.2; // s from the bottom to the surface
const RIPPLE_TIME = 1.4; // s for a ripple to spread and fade
const POP_EVERY = 1.1; // s at least between two pops
const FLOAT_SPEED = 1.6; // m/s up into the air, with `float`

const unlit = (color, opacity) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

export function addBubbleSpot(
  pos,
  { size = 1, spread = 2.4, every = 0.5, popReach = 0, float = 0 } = {},
) {
  const spot = {
    pos: vec3(pos.x, pos.y, pos.z),
    size,
    spread,
    every,
    popReach,
    float,
    life: RISE_TIME + float / FLOAT_SPEED, // s from the bottom to popping
    timer: 0,
    popTimer: 0,
    near: false, // close enough to hear the pops
    stopped: false,
  };
  const bubbleMaterial = unlit(0xffffff, 0.75);
  const bubbleGeometry = new THREE.IcosahedronGeometry(0.09 * size, 1);
  // enough of each for the bubbles and ripples alive at once
  const pool = Math.ceil((RISE_TIME + float / FLOAT_SPEED) / every) + 2;
  spot.bubbles = Array.from({ length: pool }, () => {
    const m = mesh(bubbleGeometry, bubbleMaterial, { castShadow: false });
    m.visible = false;
    scene.add(m);
    return { m, age: Infinity, surfaced: false, x: 0, z: 0 };
  });
  const ringGeometry = new THREE.RingGeometry(0.85 * size, size, 24).rotateX(-Math.PI / 2);
  spot.ripples = Array.from({ length: Math.ceil(RIPPLE_TIME / every) + 2 }, () => {
    const m = mesh(ringGeometry, unlit(0xffffff, 0), { castShadow: false });
    m.visible = false;
    scene.add(m);
    return { m, age: Infinity };
  });
  return {
    update: (dt, playerPos) => updateSpot(spot, dt, playerPos),
    stop() {
      spot.stopped = true;
      for (const each of [...spot.bubbles, ...spot.ripples]) each.m.visible = false;
    },
  };
}

function updateSpot(spot, dt, playerPos) {
  if (spot.stopped) return;
  const dist = distXZ(playerPos, spot.pos.x, spot.pos.z);
  if (dist > SEE_REACH) return;
  spot.timer -= dt;
  spot.popTimer -= dt;
  if (spot.timer <= 0) {
    spot.timer = spot.every * (0.5 + Math.random());
    const bubble = spot.bubbles.find((each) => each.age === Infinity);
    if (bubble) {
      bubble.age = 0;
      bubble.surfaced = false;
      bubble.x = spot.pos.x + (Math.random() - 0.5) * spot.spread;
      bubble.z = spot.pos.z + (Math.random() - 0.5) * spot.spread;
      bubble.m.visible = true;
    }
  }
  spot.near = dist < spot.popReach;
  for (const bubble of spot.bubbles) updateBubble(spot, bubble, dt);
  for (const ripple of spot.ripples) updateRipple(spot, ripple, dt);
}

// from the bottom to the surface, wobbling: a ripple; then up into the air (with `float`) and a pop
function updateBubble(spot, bubble, dt) {
  if (bubble.age === Infinity) return;
  bubble.age += dt;
  if (!bubble.surfaced && bubble.age >= RISE_TIME) {
    bubble.surfaced = true;
    startRipple(spot, bubble);
  }
  if (bubble.age >= spot.life) {
    bubble.age = Infinity;
    bubble.m.visible = false;
    if (spot.near && spot.popTimer <= 0) {
      spot.popTimer = POP_EVERY;
      sfx.pop();
    }
    return;
  }
  const wobble = Math.sin(bubble.age * 14) * 0.04 * spot.size;
  const depth = 0.9 * spot.size;
  const rise = Math.min(1, bubble.age / RISE_TIME);
  const y = spot.pos.y - depth + rise * depth + Math.max(0, bubble.age - RISE_TIME) * FLOAT_SPEED;
  bubble.m.position.set(bubble.x + wobble, y, bubble.z);
  // they swell a little as they float up, so they still read from far away
  const floated = Math.max(0, bubble.age - RISE_TIME) / (spot.life - RISE_TIME || 1);
  bubble.m.scale.setScalar(0.6 + rise * 0.6 + floated * 1.2);
}

function startRipple(spot, bubble) {
  const ripple = spot.ripples.find((each) => each.age === Infinity);
  if (!ripple) return;
  ripple.age = 0;
  ripple.m.visible = true;
  ripple.m.position.set(bubble.x, spot.pos.y + 0.03, bubble.z);
}

// a ring spreading out and fading
function updateRipple(spot, ripple, dt) {
  if (ripple.age === Infinity) return;
  ripple.age += dt;
  const t = ripple.age / RIPPLE_TIME;
  if (t >= 1) {
    ripple.age = Infinity;
    ripple.m.visible = false;
    return;
  }
  ripple.m.scale.setScalar(0.15 + t * 0.65);
  ripple.m.material.opacity = (1 - t) * 0.6;
}
