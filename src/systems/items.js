// Things Spartacus carries in his mouth, one at a time: grab, drop, give/use up, place,
// and the bubble that floats an item home when it's dropped in the water.
import * as THREE from 'three';
import { clamp, lerpAngle, distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { toast } from '../core/ui.js';
import { supportHeight } from '../core/colliders.js';
import { player, forwardDir, physics } from '../player/player.js';
import { dog } from '../player/dog.js';

// item.state: ground | carried | floating (bubbling home) | placed | used
// opts: name (for messages), heavy (slower, lower jumps), reach, lift (height above ground
//       when dropped), carryPos/carryRot (in the mouth), yaw, onCarry(it)
export const items = [];
// opts can override any field of the item record below (name, reach, carryPos, onGrab…)
export function addItem(id, { model, pos, heavy = false, ...opts }) {
  model.position.copy(pos);
  model.rotation.y = opts.yaw || 0;
  scene.add(model);
  model.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const it = {
    id,
    name: 'thing',
    mesh: model,
    heavy,
    home: pos.clone(),
    homeYaw: opts.yaw || 0,
    state: 'ground',
    reach: 1.6,
    lift: 0.12,
    carryPos: vec3(0, -0.05, 0.12),
    carryRot: 0,
    ...opts,
  };
  items.push(it);
  return it;
}

export function carryItem(it) {
  it.state = 'carried';
  scene.remove(it.mesh);
  dog.mouth.add(it.mesh);
  it.mesh.position.copy(it.carryPos);
  it.mesh.rotation.set(0, it.carryRot, 0);
  player.carrying = it;
  sfx.grab();
  it.onCarry?.(it);
}
// take the carried item out of the mouth (it stays where it was in the world)
export function releaseCarried() {
  const it = player.carrying;
  player.carrying = null;
  const worldPos = vec3();
  it.mesh.getWorldPosition(worldPos);
  dog.mouth.remove(it.mesh);
  scene.add(it.mesh);
  it.mesh.position.copy(worldPos);
  it.mesh.rotation.set(0, player.yaw, 0);
  return it;
}
// release and get rid of it (given to someone, used up)
export function useUpCarried() {
  const it = releaseCarried();
  scene.remove(it.mesh);
  it.state = 'used';
  return it;
}
// drop it 1.1 in front of Spartacus, on whatever is there (or into the water)
export function dropCarried() {
  const it = releaseCarried();
  const fwd = forwardDir();
  const x = player.pos.x + fwd.x * 1.1,
    z = player.pos.z + fwd.z * 1.1;
  const groundY = supportHeight(x, z, player.pos.y + 0.6);
  sfx.drop();
  if (physics().water && groundY < 0) {
    it.mesh.position.set(x, 0.2, z);
    floatBack(it);
    return;
  }
  it.mesh.position.set(x, groundY + it.lift, z);
  it.state = 'ground';
}
export function grabAction(pos) {
  for (const it of items)
    if (
      it.state === 'ground' &&
      distXZ(pos, it.mesh.position.x, it.mesh.position.z) < it.reach &&
      Math.abs(pos.y - it.mesh.position.y) < 1.5
    )
      return { label: 'Grab', run: () => carryItem(it) };
  return null;
}

/* dropped in the water: a bubble floats it back to where it was found */
// floaters: {it, bubble, t, from}; beacons: sparkle columns {pos, timeLeft} where it landed
const floaters = [],
  beacons = [];
function floatBack(it) {
  it.state = 'floating';
  const bubble = new THREE.Mesh(
    new THREE.SphereGeometry(it.heavy ? 2.2 : 1, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xbff3ff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      depthWrite: false,
    }),
  );
  scene.add(bubble);
  floaters.push({ it, bubble, t: 0, from: it.mesh.position.clone() });
  sfx.splash();
  toast(`Splash! The ${it.name} floats away in a bubble…`, 3000);
}
export function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    if (updateFloater(floaters[i], dt)) floaters.splice(i, 1);
  }
  for (let i = beacons.length - 1; i >= 0; i--) {
    const beacon = beacons[i];
    beacon.timeLeft -= dt;
    if (Math.random() < dt * 25)
      burst(
        beacon.pos.clone().add(vec3((Math.random() - 0.5) * 0.8, 0.2, (Math.random() - 0.5) * 0.8)),
        {
          count: 1,
          color: [0xffd84d, 0xffffff],
          speed: 0.6,
          up: 6,
          life: 1,
          size: 0.9,
          gravity: -0.05,
        },
      );
    if (beacon.timeLeft <= 0) beacons.splice(i, 1);
  }
}

// moves one floater along a 6-high arc home; returns true once it has arrived
function updateFloater(floater, dt) {
  const it = floater.it,
    model = it.mesh;
  floater.t += dt;
  const duration = clamp(floater.from.distanceTo(it.home) / 7, 2, 4.5),
    t = clamp(floater.t / duration, 0, 1),
    eased = t * t * (3 - 2 * t);
  model.position.lerpVectors(floater.from, it.home, eased);
  model.position.y += Math.sin(Math.PI * t) * 6;
  model.rotation.y += dt * 1.5;
  floater.bubble.position.copy(model.position);
  floater.bubble.scale.setScalar(1 + Math.sin(floater.t * 8) * 0.05);
  if (Math.random() < dt * 10)
    burst(model.position.clone(), {
      count: 1,
      color: 0xdff9ff,
      speed: 0.5,
      up: 1,
      life: 0.8,
      size: 0.7,
    });
  if (t < 1) return false;
  scene.remove(floater.bubble);
  model.position.copy(it.home);
  model.rotation.set(0, it.homeYaw, 0);
  it.state = 'ground';
  sfx.pop();
  beacons.push({ pos: it.home.clone(), timeLeft: 5 });
  toast(`The ${it.name} floated back to where you found it. Look for the sparkles!`, 3400);
  return true;
}

/* put the carried item into place (e.g. the plank into the bridge); movement is locked meanwhile */
export function placeItem(to, onDone) {
  const it = releaseCarried();
  it.state = 'placed';
  player.placing = {
    it,
    from: it.mesh.position.clone(),
    to: to.clone(),
    yaw0: it.mesh.rotation.y,
    t: 0,
    onDone,
  };
}
// a 0.7 s hop along a 1.5 high arc, ending square (yaw 0)
export function updatePlacing(dt) {
  const placing = player.placing;
  if (!placing) return;
  placing.t += dt;
  const t = clamp(placing.t / 0.7, 0, 1),
    eased = 1 - Math.pow(1 - t, 3);
  const model = placing.it.mesh;
  model.position.lerpVectors(placing.from, placing.to, eased);
  model.position.y += Math.sin(Math.PI * t) * 1.5;
  model.rotation.y = lerpAngle(placing.yaw0, 0, eased);
  if (t < 1) return;
  model.position.copy(placing.to);
  model.rotation.set(0, 0, 0);
  player.placing = null;
  placing.onDone?.(placing.it);
}
