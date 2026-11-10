// The Kaboom Cannons: hop in, the fuse fizzes, BOOM, and Spartacus flies in a big arc over the
// fair to a fixed landing spot (no aiming, so it can't go wrong). It's a ride (systems/rides.js):
// load, fuse, then the flight, somersaulting, with the camera swinging round behind him.
import * as THREE from 'three';
import { lerp, smoothstep, vec3, distXZ } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight } from '../../world/terrain.js';
import { player } from '../../player/player.js';
import { dog } from '../../player/dog.js';
import { startRide, endRide, cameraBehind } from '../../systems/rides.js';

const LOAD_TIME = 0.5; // seconds to hop into the barrel
const FUSE_TIME = 1.6; // seconds of fizzing before the bang
const FLIGHT_SPEED = 23; // units per second along the ground
const TILT = 0.85; // how far the barrel leans back from straight up (radians)
const REACH = 4.4; // how close to the cannon the button shows

// A cannon at (x, z) that fires to `to` ({x, y, z}), rising `apex` above the straight line.
// Returns {x, z, y, action(p), near(p), arc(s)}; onLand() runs when he touches down.
export function addCannon(x, z, { to, apex, onLand }) {
  const ground = terrainHeight(x, z),
    heading = Math.atan2(to.x - x, to.z - z);
  const { barrel } = makeCannon({ x, ground, z, heading });
  addCylinder(x, z, { r: 1.5, bottom: ground - 1, top: ground + 1.5 });
  // the muzzle: where he pops out
  const from = vec3(x + Math.sin(heading) * 2.2, ground + 3.4, z + Math.cos(heading) * 2.2),
    duration = Math.hypot(to.x - from.x, to.z - from.z) / FLIGHT_SPEED;
  // s: 0..1 along the flight
  const arc = (s) =>
    vec3(
      lerp(from.x, to.x, s),
      lerp(from.y, to.y, s) + apex * 4 * s * (1 - s),
      lerp(from.z, to.z, s),
    );
  const cannon = { x, z, y: ground, barrel, heading, from, to, duration, arc, onLand };
  const near = (p) => distXZ(p, x, z) < REACH && Math.abs(p.y - ground) < 1.8;
  return {
    x,
    z,
    y: ground,
    arc,
    near,
    action: (p) => (near(p) && !player.giant ? { label: 'Hop in', run: () => fire(cannon) } : null),
  };
}

// a fat barrel with gold bands on a wooden carriage, pointing along `heading`
function makeCannon({ x, ground, z, heading }) {
  const g = new THREE.Group();
  g.position.set(x, ground, z);
  g.rotation.y = heading;
  scene.add(g);
  const wood = material(0xb57b46),
    navy = material(0x2c3e73, { roughness: 0.5 }),
    gold = material(0xffc93c, { metalness: 0.3, roughness: 0.4 });
  const carriage = mesh(new THREE.BoxGeometry(2.2, 0.7, 2.8), wood);
  carriage.position.y = 0.75;
  g.add(carriage);
  for (const side of [-1, 1]) {
    const wheel = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.3, 14), material(0x7a4a2a));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.25, 0.85, -0.2);
    g.add(wheel);
    const hub = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.36, 8), gold);
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(wheel.position);
    g.add(hub);
  }
  // the barrel pivots at its back end and leans towards the target
  const barrel = new THREE.Group();
  barrel.position.set(0, 1.3, -0.6);
  barrel.rotation.x = TILT;
  g.add(barrel);
  const tube = mesh(new THREE.CylinderGeometry(0.95, 1.15, 3.6, 16), navy);
  tube.position.y = 1.8;
  barrel.add(tube);
  for (const y of [0.5, 2, 3.5]) {
    const band = mesh(new THREE.TorusGeometry(y > 3 ? 1.0 : 1.1, 0.13, 6, 18), gold);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    barrel.add(band);
  }
  const breech = mesh(new THREE.SphereGeometry(1.15, 14, 10), navy);
  barrel.add(breech);
  const mouth = mesh(new THREE.CircleGeometry(0.85, 16), material(0x10131f), { castShadow: false });
  mouth.rotation.x = -Math.PI / 2;
  mouth.position.y = 3.61;
  barrel.add(mouth);
  return { barrel };
}

function fire(cannon) {
  const start = player.pos.clone(),
    heading = cannon.heading;
  // t: seconds since hopping in; fired: the bang has happened
  const ride = { t: 0, fired: false, ticks: 0, spin: 0 };
  ride.update = (dt) => {
    ride.t += dt;
    player.yaw = heading;
    cameraBehind(heading, dt);
    if (ride.t < LOAD_TIME) loadIn(cannon, { start, t: ride.t / LOAD_TIME });
    else if (ride.t < LOAD_TIME + FUSE_TIME) fizz(cannon, ride);
    else fly(cannon, ride, dt);
  };
  // two somersaults on the way, legs out
  ride.pose = () => (ride.fired ? { pitch: ride.spin, stretch: 1.1 } : null);
  startRide(ride);
  sfx.grab();
}

// a little hop from where he stood up into the muzzle
function loadIn(cannon, { start, t }) {
  player.pos.lerpVectors(start, cannon.from, smoothstep(0, 1, t));
  player.pos.y += Math.sin(Math.PI * t) * 1.5;
}

// inside the barrel: sparks at the back, three ticks, and the barrel swells before the bang
function fizz(cannon, ride) {
  dog.root.visible = false;
  player.pos.copy(cannon.from);
  const t = (ride.t - LOAD_TIME) / FUSE_TIME;
  if (t * 3 > ride.ticks) {
    ride.ticks += 1;
    sfx.tick();
  }
  const swell = 1 + t * 0.18 + Math.sin(ride.t * 40) * 0.02;
  cannon.barrel.scale.set(swell, 1 - t * 0.12, swell);
  if (Math.random() < 0.5)
    burst(vec3(cannon.x, cannon.y + 1.6, cannon.z), {
      count: 1,
      color: [0xffd84d, 0xff9a3d, 0xffffff],
      speed: 2,
      up: 2,
      life: 0.4,
      size: 0.8,
    });
}

function fly(cannon, ride, dt) {
  if (!ride.fired) bang(cannon, ride);
  const s = (ride.t - LOAD_TIME - FUSE_TIME) / cannon.duration;
  // the barrel springs back to its shape
  cannon.barrel.scale.lerp(vec3(1, 1, 1), Math.min(1, dt * 6));
  if (s >= 1) {
    land(cannon);
    return;
  }
  const before = player.pos.clone();
  player.pos.copy(cannon.arc(s));
  player.vel.copy(player.pos).sub(before).divideScalar(dt); // his ears flap with it
  ride.spin = smoothstep(0, 1, s) * Math.PI * 4;
  burst(player.pos.clone(), {
    count: 1,
    color: [0xffd84d, 0xffffff, 0xff9fb2],
    speed: 0.5,
    up: 0.5,
    life: 0.6,
    size: 0.9,
    gravity: 0.1,
  });
}

function bang(cannon, ride) {
  ride.fired = true;
  dog.root.visible = true;
  sfx.boom();
  cannon.barrel.scale.set(1.3, 0.7, 1.3);
  burst(cannon.from.clone(), {
    count: 30,
    color: [0xffffff, 0xdfe6f0, 0xffd84d],
    speed: 7,
    up: 2,
    life: 1,
    size: 1.6,
    gravity: 0.1,
    dir: vec3(Math.sin(cannon.heading), 0.8, Math.cos(cannon.heading)).multiplyScalar(0.6),
  });
}

// touchdown: a squash, a puff and some confetti
function land(cannon) {
  player.pos.copy(cannon.to);
  endRide(vec3());
  player.squashVel = -9;
  sfx.pound();
  burst(player.pos.clone().add(vec3(0, 0.3, 0)), {
    count: 24,
    color: [0xffd84d, 0xff9fb2, 0x7fd8ee, 0xffffff],
    speed: 5,
    up: 3,
    life: 1,
    size: 1.1,
    confetti: true,
  });
  cannon.onLand?.();
}
