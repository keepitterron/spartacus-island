// Spartacus's state and movement physics: walk, run, jump, collide, land, wade and paddle.
// There's no drowning and no bubble: in water he paddles at the surface, and the open sea
// gently carries him back towards the island (Zoë found the bubble rescue frustrating).
import { clamp, vec3 } from '../core/util.js';
import { followCam, currentIsland } from '../core/state.js';
import { keys, moveAxis, isJumpHeld } from '../core/input.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { hintOnce, actionKeyName } from '../core/ui.js';
import { colliders, inFootprint, pushOut } from '../core/colliders.js';
import { terrainHeight } from '../world/terrain.js';
import { startClimb } from '../systems/vines.js';
import { POWERS } from '../systems/powers.js';
import { poundAction, holdPound, landPound, updatePoundRecovery } from './pound.js';
import { megaSize, updateMega } from './mega.js';

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
  runTime: 0, // seconds the stick has been pushed all the way (a long push turns into a run)
  sprinting: false,
  dustTimer: 0,
  wading: false, // in the water at all: slower, paddling
  swimming: false, // in water too deep to stand: floating at the surface
  airTime: 0,
  pounding: false, // ground pound in progress (player/pound.js)
  poundTime: 0, // seconds since the pound started
  poundRecover: 0, // landing pause left (movement is locked meanwhile)
  flapsLeft: 0, // flaps left before landing again (sky island)
  tiny: false, // Mini-Me power: shrinks him to TINY.size (one power at a time)
  size: 1, // 1 = full size, eases to TINY.size and back; scales his body, radius and height
  canSmash: false, // Smash-Smash power: running curls him into a rolling ball
  rolling: false, // rolling as a ball right now (breaks cracked walls he rolls into)
  giant: false, // Mega-Me power: grows him to MEGA.size until megaTime runs out
  megaTime: 0, // seconds of Mega-Me left
  // a fairground ride carrying him (cannon, gondola, coaster cart): {update(dt), pose?(),
  // quaternion?}. While set it replaces normal walking, like swing / climb / zip.
  ride: null,
};
export const RADIUS = 0.45,
  BODY_HEIGHT = 1.1, // what can bump his head: a wall lower than this above his feet stops him
  STEP_HEIGHT = 0.5,
  GRAVITY = 30,
  SPEED = 7,
  JUMP_SPEED = 10.5,
  SUPER_JUMP_SPEED = 18.5;
// Movement tuning in one place, so it can be tweaked live with Zoë (__g.move in debug).
//   sprint: speed multiplier while running; runAfter: seconds of a full push before running
//   starts (Shift runs straight away); fullPush: how far the stick counts as "all the way";
//   wadeSpeed: speed multiplier in water; current: how fast the open sea carries him back;
//   rollAfter: with Smash-Smash, the run (and the roll) starts sooner, so short run-ups work
export const MOVE = {
  sprint: 1.5,
  runAfter: 1.1,
  fullPush: 0.9,
  wadeSpeed: 0.55,
  current: 4.5,
  rollAfter: 0.4,
};
// Mini-Me: how small he gets (a full-size dog is too tall for the little gaps), and how much
// lighter he is on Lina's wind (he floats a bit higher)
export const TINY = { size: 0.45, gravity: 0.8 };
// Mega-Me: how big he gets and for how long (seconds), and what being huge changes: longer
// strides, a higher jump, and he steps up onto anything up to `step` tall (hedges, stalls)
export const MEGA = { size: 3.5, time: 30, speed: 1.35, jump: 1.5, step: 3 };
// Floating on Lina's wind (islands with physics.flap), also live-tweakable (__g.fly):
//   flapSpeed: the upward kick of a flap; flaps: how many before landing again;
//   glideFall: top fall speed while Jump is held. Gentle on purpose (Rayman, not Flappy Bird).
export const FLY = { flapSpeed: 5.5, flaps: 2, glideFall: 3 };
// in deep water his feet float this far below the surface (head and back stay dry)
const SWIM_Y = -0.55;
// sea floor deeper than this is open sea (ponds and lagoons are shallower)
const OPEN_SEA = -3.5;
export const forwardDir = () => vec3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
export const isMovementLocked = () =>
  player.digTimer > 0 || !!player.placing || player.poundRecover > 0;

// per-island tweaks; an island can override any of these with `physics:{…}`
// bound: {x, z, r} circle the player can't leave; flap: Jump in the air flaps, holding it glides;
// floor: a dropped item with nothing above this underneath floats home (the sky island)
const DEFAULT_PHYSICS = {
  gravity: GRAVITY,
  maxFall: Infinity,
  speed: 1,
  jump: 1,
  water: true,
  bound: null,
  flap: false,
  floor: -Infinity,
};
export const physics = () => ({ ...DEFAULT_PHYSICS, ...currentIsland().physics });

// one physics step of normal walking (not swinging, climbing or zipping)
export function stepPlayer(dt) {
  const pos = player.pos,
    vel = player.vel,
    locked = isMovementLocked(),
    phys = physics();
  updatePoundRecovery(dt);
  const { forward, right, amount } = readMoveInput(locked);
  const heavy = player.carrying?.heavy;
  updateSize(dt);
  updateMega(dt);
  player.wading = phys.water && pos.y < 0;
  const current = player.wading ? seaCurrent(pos) : null;
  updateSprint(dt, { amount, heavy });
  const speed =
    SPEED *
    (heavy ? 0.6 : 1) *
    (player.sprinting ? MOVE.sprint : 1) *
    (player.wading ? MOVE.wadeSpeed : 1) *
    (player.giant ? MEGA.speed : 1) *
    phys.speed;
  const move = cameraRelative(forward, right);
  // ease towards the wanted velocity: snappy on the ground, floatier in the air
  const ease = Math.min(1, dt * (player.grounded ? 12 : 4));
  vel.x += (move.x * speed + (current?.x ?? 0) - vel.x) * ease;
  vel.z += (move.z * speed + (current?.z ?? 0) - vel.z) * ease;
  vel.y -= phys.gravity * (player.tiny ? TINY.gravity : 1) * dt;
  if (vel.y < -phys.maxFall) vel.y = -phys.maxFall;
  updateJump(dt, { locked, heavy, phys });
  if (phys.flap) updateFlap(locked);
  if (player.pounding) holdPound(dt);
  const prevY = pos.y;
  pos.addScaledVector(vel, dt);
  if (collideSides(prevY, { move, amount, heavy })) return;
  const wasSwimming = player.swimming,
    fallSpeed = -vel.y;
  // in water deeper than he can stand in, the surface holds him up like ground
  // (a giant dog's legs are longer, so he wades where a small one has to paddle)
  const ground = groundHeightUnder(pos, prevY),
    swimY = SWIM_Y * (player.giant ? player.size : 1),
    deep = phys.water && ground < swimY;
  landOn(deep ? swimY : ground);
  player.swimming = deep && player.grounded;
  if (player.swimming && !wasSwimming && fallSpeed > 4) splashDown();
  if (phys.bound) keepInBound(pos, phys.bound);
  hintPound(dt);
  if (player.wading) splashAround(dt, amount);
}

// out over the open sea, a gentle current towards the island centre, faster than he paddles
function seaCurrent(pos) {
  if (terrainHeight(pos.x, pos.z) > OPEN_SEA) return null;
  hintOnce('current', 'The waves carry Spartacus back to the island.', 2800);
  const center = currentIsland().center,
    dx = center.x - pos.x,
    dz = center.z - pos.z,
    dist = Math.hypot(dx, dz) || 1;
  return { x: (dx / dist) * MOVE.current, z: (dz / dist) * MOVE.current };
}

// falling into deep water: a big splash, then he bobs up and paddles
function splashDown() {
  sfx.splash();
  player.squashVel = -6;
  burst(vec3(player.pos.x, 0, player.pos.z), {
    count: 22,
    color: [0xffffff, 0xbff3ff, 0x7fd8ee],
    speed: 5,
    up: 5,
    life: 0.9,
    size: 1.2,
  });
}

// the first time he's up high for a while, tell her about the ground pound
function hintPound(dt) {
  player.airTime = player.grounded ? 0 : player.airTime + dt;
  if (player.airTime > 0.4 && poundAction())
    hintOnce('pound', `Up high? Press ${actionKeyName()} to SLAM down!`, 3000);
}

// little splashes round his legs while wading
function splashAround(dt, amount) {
  hintOnce('wade', 'Splish splash! Spartacus can paddle.', 2600);
  player.dustTimer -= dt;
  if (player.dustTimer > 0 || amount < 0.2) return;
  player.dustTimer = 0.12;
  burst(vec3(player.pos.x, 0.05, player.pos.z), {
    count: 3,
    color: [0xffffff, 0xbff3ff],
    speed: 1.5,
    up: 2,
    life: 0.4,
    size: 0.8,
  });
}

// running: Shift, or keep the stick pushed all the way for a moment. Carrying something heavy
// never runs. Once running he keeps going until the push eases off, even in the air.
function updateSprint(dt, { amount, heavy }) {
  const fullPush = amount >= MOVE.fullPush,
    runAfter = player.canSmash ? MOVE.rollAfter : MOVE.runAfter;
  player.runTime = fullPush ? player.runTime + dt : 0;
  player.sprinting =
    !heavy && !player.wading && amount > 0.3 && (keys.shift || player.runTime > runAfter);
  player.rolling = player.canSmash && player.sprinting;
  if (!player.sprinting) return;
  hintOnce('run', 'Zoom! Keep pushing to run fast!', 2400);
  if (player.grounded) kickDust(dt);
}

// shrinking (Mini-Me) and growing back take about a third of a second; Mega-Me half a second
function updateSize(dt) {
  const target = megaSize() ?? (player.tiny ? TINY.size : 1),
    step = dt * (Math.abs(target - player.size) > 0.6 ? 5 : 2);
  player.size = clamp(player.size + clamp(target - player.size, -step, step), TINY.size, MEGA.size);
}

// anything up to this high above his feet is a step, not a wall
const stepHeight = () => (player.giant ? MEGA.step : STEP_HEIGHT);

// little sand puffs from the back paws while running
function kickDust(dt) {
  player.dustTimer -= dt;
  if (player.dustTimer > 0) return;
  player.dustTimer = 0.07;
  const back = vec3(-Math.sin(player.yaw) * 0.6, 0.15, -Math.cos(player.yaw) * 0.6);
  burst(player.pos.clone().add(back), {
    count: 2,
    color: [0xfff0c8, 0xf0dcb0],
    speed: 1.2,
    up: 1.2,
    life: 0.45,
    size: 0.8,
    gravity: 0.2,
  });
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
  // no Boing-Boing from the water: the hops out are ordinary ones
  const boing = player.superJump && !heavy && !player.swimming;
  player.vel.y = jumpSpeed(heavy, boing) * phys.jump * (player.giant ? MEGA.jump : 1);
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

// In the air on Lina's wind: a Jump press (one the ordinary jump didn't use) flaps him up a
// little, and holding Jump down glides, falling slower
function updateFlap(locked) {
  if (player.grounded) {
    player.flapsLeft = FLY.flaps;
    return;
  }
  if (isJumpHeld() && player.vel.y < -FLY.glideFall) player.vel.y = -FLY.glideFall;
  if (locked || player.jumpBuffer <= 0 || player.flapsLeft <= 0) return;
  player.flapsLeft -= 1;
  player.jumpBuffer = 0;
  player.vel.y = Math.max(player.vel.y, FLY.flapSpeed);
  player.squashVel = 3;
  sfx.flutter();
  burst(player.pos.clone(), {
    count: 8,
    color: [0xffffff, 0xf3ecff, 0xffd84d],
    speed: 2,
    up: -1,
    life: 0.5,
    size: 0.8,
  });
}

// sides: anything taller than a step pushes us out, unless it's a grown vine we walk
// into, which starts a climb (returns true then)
function collideSides(prevY, { move, amount, heavy }) {
  const pos = player.pos;
  const radius = RADIUS * player.size,
    height = BODY_HEIGHT * player.size;
  for (const c of colliders)
    if (c.top > prevY + stepHeight() && pos.y + height > c.bottom) {
      if (isWalkingIntoVine(c, { move, amount, heavy })) {
        startClimb(c.tree);
        return true;
      }
      pushOut(c, { pos, vel: player.vel, radius });
    }
  return false;
}

// touching a grown vine's trunk while pushing the stick roughly towards it
function isWalkingIntoVine(c, { move, amount, heavy }) {
  if (!c.tree?.grown || amount <= 0.4 || heavy || player.pounding) return false;
  const dx = c.x - player.pos.x,
    dz = c.z - player.pos.z,
    dist = Math.hypot(dx, dz) || 1;
  return (
    dist < c.r + RADIUS * player.size + 0.08 &&
    (move.x * dx + move.z * dz) / dist > 0.45 * Math.min(1, amount)
  );
}

// feet: the terrain, or the top of anything low enough that we stepped onto it
function groundHeightUnder(pos, prevY) {
  let support = terrainHeight(pos.x, pos.z);
  for (const c of colliders)
    if (c.top <= prevY + stepHeight() && inFootprint(c, pos, 0.15))
      support = Math.max(support, c.top);
  return support;
}

function landOn(support) {
  const pos = player.pos,
    vel = player.vel;
  if (pos.y <= support) {
    if (vel.y <= 0) {
      if (player.pounding) landPound();
      // a hard landing squashes him and puffs some dust
      else if (!player.grounded && vel.y < -9) {
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

function keepInBound(pos, bound) {
  const dx = pos.x - bound.x,
    dz = pos.z - bound.z,
    dist = Math.hypot(dx, dz);
  if (dist > bound.r) {
    pos.x = bound.x + (dx / dist) * bound.r;
    pos.z = bound.z + (dz / dist) * bound.r;
  }
}
