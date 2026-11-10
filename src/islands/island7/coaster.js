// Loop-de-Woof, the rollercoaster: a cart on rails from the Sky Deck down through a full loop
// and round the east side of the fair to a little station by the plaza. It's a ride
// (systems/rides.js): Spartacus sits in the cart, which follows a curve; its speed comes from
// how far it has dropped, like a real coaster, and in the loop he really does go upside down.
import * as THREE from 'three';
import { clamp, lerp, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { hintOnce } from '../../core/ui.js';
import { terrainHeight } from '../../world/terrain.js';
import { player } from '../../player/player.js';
import { startRide, endRide, cameraBehind } from '../../systems/rides.js';

const START_SPEED = 5; // rolling off the deck
const PULL = 8; // how hard the drop speeds the cart up (a gentler "gravity")
const END_SPEED = 3; // it brakes down to this over the last stretch
const BRAKE_FROM = 0.93; // share of the track where the brakes start
const RAIL_GAP = 0.5; // each rail is this far from the middle of the track
const SLEEPER_EVERY = 1.2;
const PILLAR_EVERY = 7;
const CLACK_EVERY = 2.4; // units of track between rail-joint clacks
const SEAT_HEIGHT = 0.45; // his feet above the rails
const RETURN_TIME = 1.5; // seconds after a ride before the cart is back at the top
const REACH = 3;
const CAMERA_SIDE = 0.7; // radians round from straight behind the cart

// inPoints / outPoints: world Vector3s before and after the loop; loop: {center: Vector3 (the
// middle of the circle), radius, shift}, entered heading +x. Returns {loopTop: Vector3 (the
// top of the loop, on the track), pointAt(u), update(dt), action(p), interact(p)}.
export function buildCoaster({ inPoints, outPoints, loop }) {
  const loopPoints = [];
  for (let k = 0; k <= 8; k++) {
    const angle = (k / 8) * Math.PI * 2;
    loopPoints.push(
      vec3(
        loop.center.x + Math.sin(angle) * loop.radius,
        loop.center.y - Math.cos(angle) * loop.radius,
        loop.center.z + lerp(-loop.shift, loop.shift, k / 8),
      ),
    );
  }
  const curve = new THREE.CatmullRomCurve3(
    [...inPoints, ...loopPoints, ...outPoints],
    false,
    'centripetal',
  );
  curve.arcLengthDivisions = 900;
  const length = curve.getLength();
  // where along the track (0..1) the loop starts and ends
  const loopFrom = nearestU(curve, loopPoints[0]),
    loopTo = nearestU(curve, loopPoints[8]);

  // the track's position and directions at u (0..1 along it). In the loop "up" points at the
  // loop's middle, so the cart goes round the inside; everywhere else it's as upright as it can be.
  const frameAt = (u) => {
    const pos = curve.getPointAt(u),
      forward = curve.getTangentAt(u).normalize(),
      up = vec3(0, 1, 0);
    if (u > loopFrom && u < loopTo) up.set(loop.center.x - pos.x, loop.center.y - pos.y, 0);
    up.addScaledVector(forward, -up.dot(forward)).normalize();
    const right = vec3().crossVectors(up, forward).normalize();
    return { pos, forward, up, right };
  };

  buildTrack({ frameAt, length, loopFrom, loopTo });
  const cart = makeCart();
  // state: waiting (at the top) | riding | returning (empty, on its way back up)
  const coaster = { curve, length, frameAt, cart, state: 'waiting', timeLeft: 0 };
  placeCart(coaster, 0);
  const startPos = frameAt(0).pos;
  const near = (p) =>
    coaster.state === 'waiting' &&
    p.distanceTo(startPos) < REACH &&
    Math.abs(p.y - startPos.y) < 1.5;

  return {
    loopTop: loopPoints[4].clone(),
    pointAt: (u) => frameAt(u).pos,
    update(dt) {
      if (coaster.state !== 'returning') return;
      coaster.timeLeft -= dt;
      if (coaster.timeLeft > 0) return;
      coaster.state = 'waiting';
      placeCart(coaster, 0);
      burst(cart.position.clone(), {
        count: 12,
        color: [0xffffff, 0xffd84d],
        speed: 3,
        up: 2,
        life: 0.6,
      });
    },
    action: (p) => (near(p) && !player.giant ? { label: 'Ride', run: () => ride(coaster) } : null),
    interact(p) {
      if (near(p))
        hintOnce('coaster', 'The Loop-de-Woof! Hop in the cart and hold on tight!', 3400);
    },
  };
}

// how far along the curve (0..1) the point closest to `target` is
function nearestU(curve, target) {
  let best = 0,
    bestDist = Infinity;
  for (let i = 0; i <= 900; i++) {
    const dist = curve.getPointAt(i / 900).distanceTo(target);
    if (dist < bestDist) {
      bestDist = dist;
      best = i / 900;
    }
  }
  return best;
}

// two rails (tubes), wooden sleepers and striped pillars, a few draw calls for the whole track
function buildTrack({ frameAt, length, loopFrom, loopTo }) {
  const samples = Math.round(length * 2.5),
    left = [],
    right = [];
  for (let i = 0; i <= samples; i++) {
    const frame = frameAt(i / samples);
    left.push(frame.pos.clone().addScaledVector(frame.right, -RAIL_GAP));
    right.push(frame.pos.clone().addScaledVector(frame.right, RAIL_GAP));
  }
  const railMaterial = material(0xf2545b, { roughness: 0.4, metalness: 0.2 });
  for (const points of [left, right]) {
    const rail = mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), samples, 0.09, 5),
      railMaterial,
      { castShadow: false },
    );
    scene.add(rail);
  }
  const sleepers = [],
    pillars = [],
    basis = new THREE.Matrix4();
  for (let d = 0; d < length; d += SLEEPER_EVERY) {
    const { pos, forward, up, right: side } = frameAt(d / length);
    basis.makeBasis(side, up, forward).setPosition(pos.clone().addScaledVector(up, -0.1));
    sleepers.push(basis.clone());
  }
  for (let d = PILLAR_EVERY / 2; d < length; d += PILLAR_EVERY) {
    const u = d / length,
      { pos } = frameAt(u),
      ground = Math.max(terrainHeight(pos.x, pos.z), 0),
      height = pos.y - 0.2 - ground,
      inLoop = u > loopFrom && u < loopTo;
    if (inLoop || height < 1) continue;
    pillars.push(
      new THREE.Matrix4().compose(
        vec3(pos.x, ground + height / 2, pos.z),
        new THREE.Quaternion(),
        vec3(1, height, 1),
      ),
    );
  }
  addInstanced(new THREE.BoxGeometry(RAIL_GAP * 2 + 0.4, 0.1, 0.28), material(0xb57b46), sleepers);
  addInstanced(new THREE.CylinderGeometry(0.16, 0.2, 1, 6), material(0xfffaf0), pillars);
}

function addInstanced(geometry, mat, matrices) {
  const instanced = new THREE.InstancedMesh(geometry, mat, matrices.length);
  matrices.forEach((matrix, i) => instanced.setMatrixAt(i, matrix));
  instanced.instanceMatrix.needsUpdate = true;
  instanced.computeBoundingSphere();
  scene.add(instanced);
}

// a little red cart with gold trim; its origin sits on the rails, +z is the front
function makeCart() {
  const g = new THREE.Group(),
    red = material(0xe8332f, { roughness: 0.5 }),
    gold = material(0xffc93c, { metalness: 0.3, roughness: 0.4 });
  const tub = mesh(new THREE.BoxGeometry(1.5, 0.6, 2.2), red);
  tub.position.y = 0.45;
  g.add(tub);
  const nose = mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 12, 1, false, 0, Math.PI), red);
  nose.rotation.z = Math.PI / 2;
  nose.rotation.y = Math.PI / 2;
  nose.position.set(0, 0.45, 1.1);
  g.add(nose);
  const trim = mesh(new THREE.BoxGeometry(1.56, 0.1, 2.26), gold, { castShadow: false });
  trim.position.y = 0.75;
  g.add(trim);
  const back = mesh(new THREE.BoxGeometry(1.5, 0.7, 0.14), red);
  back.position.set(0, 1.05, -1.05);
  g.add(back);
  for (const sideX of [-1, 1])
    for (const sideZ of [-1, 1]) {
      const wheel = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 10), gold);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sideX * RAIL_GAP, 0.14, sideZ * 0.75);
      g.add(wheel);
    }
  scene.add(g);
  return g;
}

// put the cart on the track at u, the right way round and the right way up; returns that frame
function placeCart(coaster, u) {
  const frame = coaster.frameAt(u);
  coaster.cart.position.copy(frame.pos);
  coaster.cart.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.forward),
  );
  return frame;
}

function ride(coaster) {
  const { cart, length } = coaster,
    startY = coaster.frameAt(0).pos.y;
  coaster.state = 'riding';
  // u: 0..1 along the track; sinceClack: track covered since the last clack
  const state = { u: 0, sinceClack: 0 };
  const trip = {
    quaternion: cart.quaternion,
    update(dt) {
      const frame = placeCart(coaster, state.u),
        { pos, forward, up } = frame;
      // the lower the cart is than where it started, the faster it goes
      let speed = Math.sqrt(START_SPEED ** 2 + 2 * PULL * Math.max(0, startY - pos.y));
      if (state.u > BRAKE_FROM)
        speed = lerp(speed, END_SPEED, (state.u - BRAKE_FROM) / (1 - BRAKE_FROM));
      player.pos.copy(pos).addScaledVector(up, SEAT_HEIGHT);
      player.vel.copy(forward).multiplyScalar(speed); // his ears flap with it
      // look where the cart is going, except while it's standing on its tail or upside down
      const level = up.y > 0.5 && Math.abs(forward.y) < 0.75;
      if (level) {
        player.yaw = Math.atan2(forward.x, forward.z);
        // from behind and a little to one side, so the track itself never blocks the view
        cameraBehind(player.yaw - CAMERA_SIDE, dt);
      }
      rattle(state, { speed, dt, pos });
      state.u = clamp(state.u + (speed * dt) / length, 0, 1);
      if (state.u >= 1) arrive(coaster, forward);
    },
  };
  startRide(trip);
  sfx.creak();
}

// clacks over the rail joints (faster as the cart speeds up) and a few sparks from the wheels
function rattle(state, { speed, dt, pos }) {
  state.sinceClack += speed * dt;
  if (state.sinceClack < CLACK_EVERY) return;
  state.sinceClack = 0;
  sfx.clack();
  if (speed > 12)
    burst(pos.clone(), {
      count: 2,
      color: [0xffd84d, 0xffffff],
      speed: 1.5,
      up: 1,
      life: 0.4,
      size: 0.7,
    });
}

// the end of the line: he hops out forwards, and the empty cart goes back to the top
function arrive(coaster, forward) {
  endRide(vec3(forward.x * 4, 7, forward.z * 4));
  sfx.boing();
  coaster.state = 'returning';
  coaster.timeLeft = RETURN_TIME;
  burst(player.pos.clone().add(vec3(0, 1, 0)), {
    count: 20,
    color: [0xff5a5a, 0xffd84d, 0x5aa8ff, 0xffffff],
    speed: 5,
    up: 4,
    life: 1.2,
    size: 1.1,
    confetti: true,
  });
  hintOnce('coasterDone', 'WOOF-HOO! The cart rolls back up for another go.', 3200);
}
