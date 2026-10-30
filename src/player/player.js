import * as THREE from 'three';
import { clamp, lerp, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { game, followCam, currentIsland } from '../core/state.js';
import { moveAxis } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { toast } from '../core/ui.js';
import { colliders, inFootprint, pushOut } from '../core/colliders.js';
import { terrainHeight } from '../world/terrain.js';
import { startClimb } from '../systems/vines.js';
import { POWERS } from '../systems/powers.js';

// Spartacus's physical state. Sub-states: swing / climb / zip are set by their systems
// and replace normal walking while active; digT>0 or placing locks movement.
export const player = {
  pos: vec3(),
  vel: vec3(),
  grounded: false,
  coyote: 0,
  jumpBuf: 0,
  yaw: Math.PI,
  power: null,
  super: false,
  stretch: false,
  phase: 0,
  sq: 1,
  sqv: 0,
  barkT: 0,
  barkCd: 0,
  sparkT: 0,
  carry: null,
  digT: 0,
  dig: null,
  scratchT: 0,
  swing: null,
  climb: null,
  zip: null,
  placing: null,
};
export const RADIUS = 0.45,
  STEP_HEIGHT = 0.5,
  GRAVITY = 30,
  SPEED = 7,
  JUMP_SPEED = 10.5,
  SUPER_JUMP_SPEED = 18.5;
// where a bubble rescue goes when there is no recent safe spot (set on entering an island)
export const SPAWN = vec3();
export const forwardDir = () => vec3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
export const isMovementLocked = () => player.digT > 0 || !!player.placing;

// per-island tweaks; an island can override any of these with `physics:{…}`
const PHYS = { gravity: GRAVITY, maxFall: Infinity, speed: 1, jump: 1, water: true, bound: null };
export const physics = () => Object.assign({}, PHYS, currentIsland().physics);

const rescue = { t: 0, from: vec3(), to: vec3() };
const safeHist = [];
let safeT = 0;
export const clearSafeSpots = () => {
  safeHist.length = 0;
};

export function stepPlayer(dt) {
  const p = player.pos,
    v = player.vel,
    lk = isMovementLocked(),
    ph = physics();
  let f = 0,
    r = 0;
  if (!lk) ({ f, r } = moveAxis());
  const mag = Math.hypot(f, r);
  if (mag > 1) {
    f /= mag;
    r /= mag;
  }
  const heavy = player.carry && player.carry.heavy,
    spd = SPEED * (heavy ? 0.6 : 1) * ph.speed;
  // movement is relative to the camera
  const fx = -Math.sin(followCam.yaw),
    fz = -Math.cos(followCam.yaw),
    rx = Math.cos(followCam.yaw),
    rz = -Math.sin(followCam.yaw);
  const wx = (fx * f + rx * r) * spd,
    wz = (fz * f + rz * r) * spd,
    k = Math.min(1, dt * (player.grounded ? 12 : 4));
  v.x += (wx - v.x) * k;
  v.z += (wz - v.z) * k;
  v.y -= ph.gravity * dt;
  if (v.y < -ph.maxFall) v.y = -ph.maxFall;
  // coyote time + jump buffer make jumps forgiving
  player.coyote = player.grounded ? 0.12 : player.coyote - dt;
  player.jumpBuf -= dt;
  if (!lk && player.jumpBuf > 0 && player.coyote > 0) {
    const sup = player.super && !heavy;
    v.y = (heavy ? JUMP_SPEED * 0.78 : sup ? SUPER_JUMP_SPEED : JUMP_SPEED) * ph.jump;
    player.coyote = 0;
    player.jumpBuf = 0;
    player.grounded = false;
    player.sqv = 4;
    if (sup) {
      sfx.boing();
      burst(p.clone().add(vec3(0, 0.2, 0)), {
        count: 14,
        color: POWERS.boing.col,
        speed: 4,
        up: 1,
        life: 0.7,
        size: 0.9,
      });
    } else sfx.jump();
  }
  const prevY = p.y;
  p.addScaledVector(v, dt);
  // sides: anything taller than a step pushes us out (or, if it's a grown vine we walk into, we climb)
  for (const c of colliders)
    if (c.top > prevY + STEP_HEIGHT && p.y + 1.1 > c.bottom) {
      if (c.tree && c.tree.grown && mag > 0.4 && !heavy) {
        const dx = c.x - p.x,
          dz = c.z - p.z,
          d = Math.hypot(dx, dz) || 1;
        if (
          d < c.r + RADIUS + 0.08 &&
          ((fx * f + rx * r) * dx + (fz * f + rz * r) * dz) / d > 0.45 * Math.min(1, mag)
        ) {
          startClimb(c.tree);
          return;
        }
      }
      pushOut(c, { pos: p, vel: v, radius: RADIUS });
    }
  // feet: terrain or the top of anything we stepped onto
  let sup = terrainHeight(p.x, p.z);
  for (const c of colliders)
    if (c.top <= prevY + STEP_HEIGHT && inFootprint(c, p, 0.15)) sup = Math.max(sup, c.top);
  if (p.y <= sup) {
    if (v.y <= 0) {
      if (!player.grounded && v.y < -9) {
        player.sqv = -Math.min(9, -v.y * 0.45);
        burst(p.clone(), { count: 8, color: 0xfff0c8, speed: 2.5, up: 1.5, life: 0.5, size: 0.8 });
      }
      p.y = sup;
      v.y = 0;
      player.grounded = true;
    } else p.y = sup;
  } else if (player.grounded && v.y <= 0 && p.y - sup < 0.35) {
    p.y = sup;
    v.y = 0;
  } else player.grounded = false;
  // remember safe spots for bubble rescues
  if (player.grounded && p.y > 0.25) {
    safeT -= dt;
    if (safeT <= 0) {
      safeT = 0.3;
      safeHist.push(p.clone());
      if (safeHist.length > 12) safeHist.shift();
    }
  }
  if (ph.bound) {
    const b = ph.bound,
      lx = p.x - b.x,
      lz = p.z - b.z,
      rr = Math.hypot(lx, lz);
    if (rr > b.r) {
      p.x = b.x + (lx / rr) * b.r;
      p.z = b.z + (lz / rr) * b.r;
    }
  }
  if (ph.water && p.y < -0.3) startRescue();
}

/* ---------- bubble rescue: falling in the water floats you back ~2 s ---------- */
const bubble = new THREE.Mesh(
  new THREE.SphereGeometry(1.1, 20, 14),
  new THREE.MeshStandardMaterial({
    color: 0xbff3ff,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
    metalness: 0.2,
  }),
);
bubble.visible = false;
scene.add(bubble);
export function startRescue() {
  game.state = 'rescue';
  rescue.t = 0;
  rescue.from.copy(player.pos);
  rescue.to.copy(safeHist.length ? safeHist[Math.max(0, safeHist.length - 6)] : SPAWN);
  safeHist.length = 0;
  player.vel.set(0, 0, 0);
  sfx.splash();
  burst(vec3(player.pos.x, 0, player.pos.z), {
    count: 22,
    color: [0xffffff, 0xbff3ff, 0x7fd8ee],
    speed: 5,
    up: 5,
    life: 0.9,
    size: 1.2,
  });
  bubble.visible = true;
  toast(player.power ? 'Fruit pups can’t swim! Bubble rescue!' : 'Splash! Bubble rescue!');
}
export function updateRescue(dt) {
  rescue.t += dt;
  const dur = clamp(rescue.from.distanceTo(rescue.to) / 6, 1.2, 2.6);
  const k = clamp(rescue.t / dur, 0, 1),
    e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  player.pos.lerpVectors(rescue.from, rescue.to, e);
  player.pos.y = lerp(rescue.from.y, rescue.to.y, e) + Math.sin(Math.PI * k) * 3.5;
  bubble.position.copy(player.pos).add(vec3(0, 0.85, 0));
  bubble.scale.setScalar(1 + Math.sin(rescue.t * 9) * 0.05);
  player.phase += dt * 18;
  if (k >= 1) {
    bubble.visible = false;
    sfx.pop();
    burst(bubble.position.clone(), {
      count: 16,
      color: 0xdff9ff,
      speed: 4,
      up: 2,
      life: 0.5,
      size: 0.9,
    });
    player.grounded = false;
    player.vel.set(0, 2, 0);
    game.state = 'play';
  }
}
