// Spartacus's state and movement physics (walk, jump, collide, land), plus the bubble rescue
// that floats him back to dry land when he falls in the water.
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
// and replace normal walking while active; digTimer>0 or placing locks movement.
export const player = {
  pos: vec3(),
  vel: vec3(),
  grounded: false,
  coyoteTimer: 0,
  jumpBuffer: 0,
  yaw: Math.PI,
  power: null,
  superJump: false,
  canStretch: false,
  gaitPhase: 0,
  squash: 1,
  squashVel: 0,
  barkTimer: 0,
  barkCooldown: 0,
  sparkTimer: 0,
  carrying: null,
  digTimer: 0,
  digSpot: null,
  scratchTimer: 0,
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
export const isMovementLocked = () => player.digTimer > 0 || !!player.placing;

// per-island tweaks; an island can override any of these with `physics:{…}`
// bound: {x, z, r} circle the player can't leave
const DEFAULT_PHYSICS = {
  gravity: GRAVITY,
  maxFall: Infinity,
  speed: 1,
  jump: 1,
  water: true,
  bound: null,
};
export const physics = () => ({ ...DEFAULT_PHYSICS, ...currentIsland().physics });

const rescue = { t: 0, from: vec3(), to: vec3() };
// recent spots where Spartacus stood on dry ground (a rescue goes back to one of these)
const safeSpots = [];
let safeSpotTimer = 0;
export const clearSafeSpots = () => {
  safeSpots.length = 0;
};

// one physics step of normal walking (not swinging, climbing or zipping)
export function stepPlayer(dt) {
  const pos = player.pos,
    vel = player.vel,
    locked = isMovementLocked(),
    phys = physics();
  const { forward, right, amount } = readMoveInput(locked);
  const heavy = player.carrying?.heavy;
  const speed = SPEED * (heavy ? 0.6 : 1) * phys.speed;
  const move = cameraRelative(forward, right);
  // ease towards the wanted velocity: snappy on the ground, floatier in the air
  const ease = Math.min(1, dt * (player.grounded ? 12 : 4));
  vel.x += (move.x * speed - vel.x) * ease;
  vel.z += (move.z * speed - vel.z) * ease;
  vel.y -= phys.gravity * dt;
  if (vel.y < -phys.maxFall) vel.y = -phys.maxFall;
  updateJump(dt, { locked, heavy, phys });
  const prevY = pos.y;
  pos.addScaledVector(vel, dt);
  if (collideSides(prevY, { move, amount, heavy })) return;
  landOn(groundHeightUnder(pos, prevY));
  rememberSafeSpot(dt);
  if (phys.bound) keepInBound(pos, phys.bound);
  if (phys.water && pos.y < -0.3) startRescue();
}

// stick/keys as forward/right in -1..1; amount is the stick strength before limiting it to 1
function readMoveInput(locked) {
  let forward = 0,
    right = 0;
  if (!locked) ({ f: forward, r: right } = moveAxis());
  const amount = Math.hypot(forward, right);
  if (amount > 1) {
    forward /= amount;
    right /= amount;
  }
  return { forward, right, amount };
}

// movement is relative to the camera: turn forward/right into a ground direction {x, z}
function cameraRelative(forward, right) {
  const fwdX = -Math.sin(followCam.yaw),
    fwdZ = -Math.cos(followCam.yaw),
    rightX = Math.cos(followCam.yaw),
    rightZ = -Math.sin(followCam.yaw);
  return { x: fwdX * forward + rightX * right, z: fwdZ * forward + rightZ * right };
}

function jumpSpeed(heavy, boing) {
  if (heavy) return JUMP_SPEED * 0.78;
  return boing ? SUPER_JUMP_SPEED : JUMP_SPEED;
}

// coyote time (0.12 s after leaving a ledge) + a jump buffer make jumps forgiving
function updateJump(dt, { locked, heavy, phys }) {
  player.coyoteTimer = player.grounded ? 0.12 : player.coyoteTimer - dt;
  player.jumpBuffer -= dt;
  if (locked || player.jumpBuffer <= 0 || player.coyoteTimer <= 0) return;
  const boing = player.superJump && !heavy;
  player.vel.y = jumpSpeed(heavy, boing) * phys.jump;
  player.coyoteTimer = 0;
  player.jumpBuffer = 0;
  player.grounded = false;
  player.squashVel = 4;
  if (!boing) {
    sfx.jump();
    return;
  }
  sfx.boing();
  burst(player.pos.clone().add(vec3(0, 0.2, 0)), {
    count: 14,
    color: POWERS.boing.sparkleColors,
    speed: 4,
    up: 1,
    life: 0.7,
    size: 0.9,
  });
}

// sides: anything taller than a step pushes us out, unless it's a grown vine we walk
// into, which starts a climb (returns true then)
function collideSides(prevY, { move, amount, heavy }) {
  const pos = player.pos;
  for (const c of colliders)
    if (c.top > prevY + STEP_HEIGHT && pos.y + 1.1 > c.bottom) {
      if (isWalkingIntoVine(c, { move, amount, heavy })) {
        startClimb(c.tree);
        return true;
      }
      pushOut(c, { pos, vel: player.vel, radius: RADIUS });
    }
  return false;
}

// touching a grown vine's trunk while pushing the stick roughly towards it
function isWalkingIntoVine(c, { move, amount, heavy }) {
  if (!c.tree?.grown || amount <= 0.4 || heavy) return false;
  const dx = c.x - player.pos.x,
    dz = c.z - player.pos.z,
    dist = Math.hypot(dx, dz) || 1;
  return (
    dist < c.r + RADIUS + 0.08 && (move.x * dx + move.z * dz) / dist > 0.45 * Math.min(1, amount)
  );
}

// feet: the terrain, or the top of anything low enough that we stepped onto it
function groundHeightUnder(pos, prevY) {
  let support = terrainHeight(pos.x, pos.z);
  for (const c of colliders)
    if (c.top <= prevY + STEP_HEIGHT && inFootprint(c, pos, 0.15))
      support = Math.max(support, c.top);
  return support;
}

function landOn(support) {
  const pos = player.pos,
    vel = player.vel;
  if (pos.y <= support) {
    if (vel.y <= 0) {
      // a hard landing squashes him and puffs some dust
      if (!player.grounded && vel.y < -9) {
        player.squashVel = -Math.min(9, -vel.y * 0.45);
        burst(pos.clone(), {
          count: 8,
          color: 0xfff0c8,
          speed: 2.5,
          up: 1.5,
          life: 0.5,
          size: 0.8,
        });
      }
      pos.y = support;
      vel.y = 0;
      player.grounded = true;
    } else pos.y = support;
  } else if (player.grounded && vel.y <= 0 && pos.y - support < 0.35) {
    // stick to the ground when walking down slopes and small steps
    pos.y = support;
    vel.y = 0;
  } else player.grounded = false;
}

// remember the last 12 safe spots (one every 0.3 s) for bubble rescues
function rememberSafeSpot(dt) {
  if (!player.grounded || player.pos.y <= 0.25) return;
  safeSpotTimer -= dt;
  if (safeSpotTimer > 0) return;
  safeSpotTimer = 0.3;
  safeSpots.push(player.pos.clone());
  if (safeSpots.length > 12) safeSpots.shift();
}

function keepInBound(pos, bound) {
  const dx = pos.x - bound.x,
    dz = pos.z - bound.z,
    dist = Math.hypot(dx, dz);
  if (dist > bound.r) {
    pos.x = bound.x + (dx / dist) * bound.r;
    pos.z = bound.z + (dz / dist) * bound.r;
  }
}

/* ---------- bubble rescue: falling in the water floats you back ~2 s ---------- */
const rescueBubble = new THREE.Mesh(
  new THREE.SphereGeometry(1.1, 20, 14),
  new THREE.MeshStandardMaterial({
    color: 0xbff3ff,
    transparent: true,
    opacity: 0.35,
    roughness: 0.1,
    metalness: 0.2,
  }),
);
rescueBubble.visible = false;
scene.add(rescueBubble);
export function startRescue() {
  game.state = 'rescue';
  rescue.t = 0;
  rescue.from.copy(player.pos);
  // a spot from ~1.5 s ago, so we don't land right back on the edge we fell off
  rescue.to.copy(safeSpots.length ? safeSpots[Math.max(0, safeSpots.length - 6)] : SPAWN);
  safeSpots.length = 0;
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
  rescueBubble.visible = true;
  toast(player.power ? 'Fruit pups can’t swim! Bubble rescue!' : 'Splash! Bubble rescue!');
}
export function updateRescue(dt) {
  rescue.t += dt;
  const duration = clamp(rescue.from.distanceTo(rescue.to) / 6, 1.2, 2.6);
  // ease in-out, plus a 3.5 high arc
  const t = clamp(rescue.t / duration, 0, 1),
    eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  player.pos.lerpVectors(rescue.from, rescue.to, eased);
  player.pos.y = lerp(rescue.from.y, rescue.to.y, eased) + Math.sin(Math.PI * t) * 3.5;
  rescueBubble.position.copy(player.pos).add(vec3(0, 0.85, 0));
  rescueBubble.scale.setScalar(1 + Math.sin(rescue.t * 9) * 0.05);
  player.gaitPhase += dt * 18;
  if (t < 1) return;
  rescueBubble.visible = false;
  sfx.pop();
  burst(rescueBubble.position.clone(), {
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
