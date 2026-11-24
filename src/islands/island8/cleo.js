// Cleo, the school dog: a corgi on the school trip who joins Spartacus in the temple. She follows
// along his own path (a trail of the spots he walked, so she goes round walls the way he did and
// hops where he jumped), sits on a paw plate when he says "Stay, Cleo", trots through little
// tunnels he's too tall for, and yips when he woofs. Nothing here can lose her: if she's ever far
// behind, she comes running and pops up next to him.
//
// state: camp (sitting with the class) | follow | going (trotting to a spot) | stay (sitting on a
// spot, `stayAt`) | tunnel (walking a fixed path, `route`) | class (back with the class)
import * as THREE from 'three';
import { clamp, distXZ, lerp, lerpAngle, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mergeParts, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { supportHeight } from '../../core/colliders.js';
import { player, forwardDir } from '../../player/player.js';

const FOLLOW_GAP = 2.2; // m of path she keeps between herself and Spartacus
const TROT = 6.5; // m/s
const DASH = 11; // m/s when she has fallen behind
const TRAIL_STEP = 0.35; // m between trail points
const TRAIL_MAX = 240;
const TOO_FAR = 28; // m: further than this, she runs to catch up and pops up next to him
const HOP_GAP = 1.4; // m between two trail points (a swing, a ride): she hops over it

export const cleo = {
  g: null,
  body: null,
  head: null,
  ears: [],
  legs: [],
  state: 'camp',
  pos: vec3(),
  yaw: 0,
  speed: 0, // how fast she's moving this frame (legs)
  sit: 0, // 0 standing .. 1 sitting
  hop: null, // {from, to, t, time}: a hop through the air
  trail: [], // [{x, y, z, hop}] the way Spartacus went, oldest first
  stayAt: null, // where she sits ({x, y, z})
  onArrive: null,
  route: null, // tunnel: [{x, y, z}] still to walk
  sniff: false, // nose down, tail going
  yipTimer: -1,
  happy: 0, // seconds of happy wiggling left
};

const FUR = 0xe8913a,
  CREAM = 0xfff4e4,
  INK = 0x2b2b38;

// a corgi: long low body, short legs, big pointy ears, a white chest and a fluffy white bottom
function makeCorgi() {
  const g = new THREE.Group(),
    body = new THREE.Group();
  g.add(body);
  const fur = material(FUR),
    cream = material(CREAM),
    ink = material(INK),
    pink = material(0xff8fa3);
  const torso = mesh(new THREE.CapsuleGeometry(0.26, 0.6, 4, 10), fur);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 0.42;
  body.add(torso);
  const chest = mesh(new THREE.SphereGeometry(0.24, 10, 8), cream);
  chest.scale.set(1, 1.05, 0.9);
  chest.position.set(0, 0.4, 0.33);
  body.add(chest);
  const fluff = mesh(new THREE.SphereGeometry(0.25, 10, 8), cream);
  fluff.position.set(0, 0.44, -0.42);
  body.add(fluff);
  const tail = mesh(new THREE.SphereGeometry(0.1, 8, 6), fur);
  tail.position.set(0, 0.6, -0.6);
  body.add(tail);
  mergeParts(body);
  const head = new THREE.Group();
  head.position.set(0, 0.74, 0.5);
  body.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.24, 12, 10), fur);
  skull.scale.set(1.05, 0.95, 1);
  head.add(skull);
  const muzzle = mesh(new THREE.SphereGeometry(0.15, 10, 8), cream);
  muzzle.scale.set(0.9, 0.75, 1.2);
  muzzle.position.set(0, -0.07, 0.2);
  head.add(muzzle);
  const blaze = mesh(new THREE.BoxGeometry(0.06, 0.2, 0.05), cream, { castShadow: false });
  blaze.position.set(0, 0.08, 0.22);
  blaze.rotation.x = -0.3;
  head.add(blaze);
  const nose = mesh(new THREE.SphereGeometry(0.05, 8, 6), ink);
  nose.position.set(0, -0.02, 0.38);
  head.add(nose);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.045, 8, 6), ink, { castShadow: false });
    eye.position.set(side * 0.1, 0.05, 0.2);
    head.add(eye);
    const cheek = mesh(new THREE.SphereGeometry(0.045, 6, 5), pink, { castShadow: false });
    cheek.scale.set(1, 0.5, 0.6);
    cheek.position.set(side * 0.15, -0.08, 0.17);
    head.add(cheek);
  }
  const tongue = mesh(new THREE.BoxGeometry(0.07, 0.02, 0.12), pink, { castShadow: false });
  tongue.position.set(0, -0.16, 0.28);
  head.add(tongue);
  mergeParts(head);
  // big pointy ears, each on a pivot so they can perk up and droop
  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group();
    ear.position.set(side * 0.13, 0.17, -0.02);
    const outer = mesh(new THREE.ConeGeometry(0.11, 0.3, 4), fur);
    outer.position.y = 0.14;
    ear.add(outer);
    const inner = mesh(new THREE.ConeGeometry(0.06, 0.2, 4), material(0xffc4c4), {
      castShadow: false,
    });
    inner.position.set(0, 0.11, 0.04);
    ear.add(inner);
    ear.rotation.z = side * -0.25;
    head.add(ear);
    return ear;
  });
  // short legs: hip pivots, front pair first
  const legs = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ].map(([sideX, sideZ]) => {
    const hip = new THREE.Group();
    hip.position.set(sideX * 0.14, 0.26, sideZ * 0.3);
    const leg = mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.2, 6), fur);
    leg.position.y = -0.09;
    hip.add(leg);
    const paw = mesh(new THREE.SphereGeometry(0.075, 8, 6), cream);
    paw.scale.set(1, 0.7, 1.2);
    paw.position.set(0, -0.21, 0.02);
    hip.add(paw);
    body.add(hip);
    return hip;
  });
  return { g, body, head, ears, legs };
}

// pos: {x, y, z} where she sits at the camp; faceTo: who she's looking at
export function addCleo(pos, { faceTo }) {
  Object.assign(cleo, makeCorgi());
  cleo.pos.set(pos.x, pos.y, pos.z);
  cleo.yaw = Math.atan2(faceTo.x - pos.x, faceTo.z - pos.z);
  cleo.sit = 1;
  cleo.g.position.copy(cleo.pos);
  scene.add(cleo.g);
}

export const isFollowing = () => cleo.state === 'follow';
export const isStaying = () => cleo.state === 'stay';
export const cleoNear = (p, reach) =>
  distXZ(p, cleo.pos.x, cleo.pos.z) < reach && Math.abs(p.y - cleo.pos.y) < 2.5;
// is she sitting on this spot (within reach)?
export const cleoSitsOn = (spot, reach = 1) =>
  cleo.state === 'stay' && distXZ(cleo.pos, spot.x, spot.z) < reach;

/* commands */

export function cleoFollow() {
  cleo.state = 'follow';
  cleo.stayAt = null;
  cleo.sniff = false;
  resetTrail();
}

// trot to a spot and sit there (a paw plate, a sniffed-out mound); onArrive once she's there
export function cleoStay(spot, { onArrive, sniff = false } = {}) {
  cleo.state = 'going';
  cleo.stayAt = vec3(spot.x, spot.y, spot.z);
  cleo.onArrive = onArrive;
  cleo.sniff = sniff;
  yip();
}

// walk a fixed way (a tunnel): a list of {x, y, z}, then sit at the last one
export function cleoWalk(route, { onArrive } = {}) {
  cleo.state = 'tunnel';
  cleo.route = route.map((spot) => vec3(spot.x, spot.y, spot.z));
  cleo.onArrive = onArrive;
  cleo.stayAt = cleo.route.at(-1);
  yip();
}

// back to the class (the end of the trip), sitting at spot facing faceTo
export function cleoToClass(spot, { faceTo }) {
  cleo.state = 'class';
  cleo.stayAt = vec3(spot.x, spot.y, spot.z);
  cleo.faceTo = faceTo;
  cleo.hop = null;
  appearAt(cleo.stayAt);
}

// she copies his woof a moment later
export function cleoHeardWoof() {
  if (cleo.state === 'camp' || cleo.state === 'class') return;
  cleo.yipTimer = 0.4;
}

export function yip() {
  sfx.yip();
  cleo.happy = 0.8;
}

/* the trail she follows */

function resetTrail() {
  cleo.trail.length = 0;
  cleo.trail.push({ x: cleo.pos.x, y: cleo.pos.y, z: cleo.pos.z, hop: false });
  cleo.gap = true; // the next point he walks is a hop from where she is
}

// where Spartacus is going: one more point every TRAIL_STEP; swinging, climbing and riding
// leave a gap she hops over afterwards
function recordTrail() {
  const busy = player.swing || player.climb || player.zip || player.ride;
  if (busy || game.state !== 'play') {
    cleo.gap = true;
    return;
  }
  const last = cleo.trail.at(-1),
    p = player.pos;
  if (last && Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) < TRAIL_STEP) return;
  const far = last && Math.hypot(p.x - last.x, p.z - last.z) > HOP_GAP;
  cleo.trail.push({ x: p.x, y: p.y, z: p.z, hop: cleo.gap || far });
  cleo.gap = false;
  if (cleo.trail.length > TRAIL_MAX) cleo.trail.shift();
}

// how far it is along the trail from point i to Spartacus
function pathLeft(from) {
  let total = 0,
    previous = from;
  for (const point of cleo.trail) {
    total += Math.hypot(point.x - previous.x, point.z - previous.z);
    previous = point;
  }
  return total + distXZ(player.pos, previous.x, previous.z);
}

function updateFollow(dt) {
  recordTrail();
  if (distXZ(player.pos, cleo.pos.x, cleo.pos.z) > TOO_FAR) {
    catchUp();
    return;
  }
  const left = pathLeft(cleo.pos);
  if (left <= FOLLOW_GAP || !cleo.trail.length) {
    cleo.speed = 0;
    faceTowards(player.pos, dt);
    return;
  }
  const next = cleo.trail[0];
  if (next.hop) {
    startHop(next);
    cleo.trail.shift();
    return;
  }
  const speed = left > 7 ? DASH : TROT;
  if (stepTowards(next, { speed, dt })) cleo.trail.shift();
}

// pops up just behind Spartacus, with a puff, and follows from there
function catchUp() {
  const back = forwardDir().multiplyScalar(-1.6);
  const spot = player.pos.clone().add(back);
  spot.y = supportHeight(spot.x, spot.z, player.pos.y + 1);
  appearAt(spot);
  resetTrail();
}
function appearAt(spot) {
  cleo.pos.copy(spot);
  burst(spot.clone().add(vec3(0, 0.4, 0)), {
    count: 12,
    color: [0xffffff, 0xfff0c8],
    speed: 2,
    up: 2,
    life: 0.6,
    size: 1,
  });
}

/* moving */

// a step towards a point at speed; true once she's there
function stepTowards(point, { speed, dt }) {
  const dx = point.x - cleo.pos.x,
    dz = point.z - cleo.pos.z,
    dist = Math.hypot(dx, dz),
    step = speed * dt;
  if (dist > 0.01) cleo.yaw = lerpAngle(cleo.yaw, Math.atan2(dx, dz), Math.min(1, dt * 10));
  if (dist <= step) {
    cleo.pos.set(point.x, point.y, point.z);
    cleo.speed = speed;
    return true;
  }
  const t = step / dist;
  cleo.pos.x += dx * t;
  cleo.pos.z += dz * t;
  cleo.pos.y = lerp(cleo.pos.y, point.y, t);
  cleo.speed = speed;
  return false;
}

function startHop(to) {
  const from = cleo.pos.clone(),
    target = vec3(to.x, to.y, to.z),
    dist = from.distanceTo(target);
  cleo.hop = { from, to: target, t: 0, time: clamp(dist / 9, 0.3, 0.9), high: 0.6 + dist * 0.15 };
  cleo.yaw = Math.atan2(target.x - from.x, target.z - from.z);
  sfx.jump();
}
function updateHop(dt) {
  const hop = cleo.hop;
  hop.t += dt;
  const t = Math.min(1, hop.t / hop.time);
  cleo.pos.lerpVectors(hop.from, hop.to, t);
  cleo.pos.y += Math.sin(t * Math.PI) * hop.high;
  cleo.speed = 0;
  if (t === 1) cleo.hop = null;
}

function faceTowards(spot, dt) {
  const toSpot = Math.atan2(spot.x - cleo.pos.x, spot.z - cleo.pos.z);
  cleo.yaw = lerpAngle(cleo.yaw, toSpot, Math.min(1, dt * 5));
}

function updateGoing(dt) {
  if (!stepTowards(cleo.stayAt, { speed: TROT, dt })) return;
  arrive();
}
function updateRoute(dt) {
  if (!stepTowards(cleo.route[0], { speed: TROT * 0.7, dt })) return;
  cleo.route.shift();
  if (!cleo.route.length) arrive();
}
function arrive() {
  cleo.state = 'stay';
  cleo.speed = 0;
  yip();
  const onArrive = cleo.onArrive;
  cleo.onArrive = null;
  onArrive?.();
}

/* every frame */

export function updateCleo(dt) {
  if (!cleo.g) return;
  if (cleo.hop) updateHop(dt);
  else if (cleo.state === 'follow') updateFollow(dt);
  else if (cleo.state === 'going') updateGoing(dt);
  else if (cleo.state === 'tunnel') updateRoute(dt);
  else {
    cleo.speed = 0;
    if (cleo.state === 'class' && cleo.faceTo) faceTowards(cleo.faceTo, dt);
    else if (!cleo.sniff) faceTowards(player.pos, dt);
  }
  if (cleo.yipTimer > 0) {
    cleo.yipTimer -= dt;
    if (cleo.yipTimer <= 0) yip();
  }
  cleo.happy = Math.max(0, cleo.happy - dt);
  pose(dt);
}

// legs, sitting, wiggling, ears
function pose(dt) {
  const time = game.time,
    moving = cleo.speed > 0.5 || cleo.hop;
  const sitting = !moving && cleo.state !== 'going' && cleo.state !== 'tunnel';
  cleo.sit = lerp(cleo.sit, sitting ? 1 : 0, Math.min(1, dt * 6));
  cleo.g.position.copy(cleo.pos);
  cleo.g.rotation.y = cleo.yaw;
  const gait = time * (cleo.speed > 8 ? 22 : 16);
  cleo.legs.forEach((leg, i) => {
    const swing =
      moving && !cleo.hop ? Math.sin(gait + (i % 2 ? Math.PI : 0) + (i > 1 ? 1 : 0)) : 0;
    leg.rotation.x = swing * 0.8;
    // sitting: the back legs fold forward
    if (i > 1) leg.rotation.x += cleo.sit * -1.2;
  });
  // sit back on her fluffy bottom; bounce when trotting; a wiggle when she's happy or sniffing
  cleo.body.rotation.x = -cleo.sit * 0.45;
  cleo.body.position.y =
    (moving ? Math.abs(Math.sin(gait)) * 0.06 : 0) - cleo.sit * 0.08 + (cleo.hop ? 0.05 : 0);
  const wiggle = cleo.happy > 0 || cleo.sniff ? Math.sin(time * 26) * 0.18 : 0;
  cleo.body.rotation.z = wiggle * 0.4;
  cleo.body.rotation.y = wiggle;
  cleo.head.rotation.x = cleo.sniff ? 0.55 + Math.sin(time * 9) * 0.12 : cleo.sit * 0.35;
  for (const [i, ear] of cleo.ears.entries())
    ear.rotation.x = cleo.happy > 0 ? Math.sin(time * 18 + i) * 0.2 : -0.1;
}

/* mid-island saves */
// following is saved as following (she pops up next to him); staying, going or walking a tunnel
// all come back as following, since whatever she was holding down is saved by the island
export const cleoState = () =>
  cleo.state === 'camp' || cleo.state === 'class' ? cleo.state : 'follow';
export function restoreCleo(state) {
  if (state === 'follow') {
    cleo.state = 'follow';
    catchUp();
  }
}
