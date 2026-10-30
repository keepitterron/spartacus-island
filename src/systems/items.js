import * as THREE from 'three';
import { clamp, lerpAngle, distXZ, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { sfx } from '../core/audio.js';
import { burst } from '../core/fx.js';
import { toast } from '../core/ui.js';
import { supportHeight } from '../core/colliders.js';
import { player, forwardDir, physics } from '../player/player.js';
import { dog } from '../player/dog.js';

// Things Spartacus carries in his mouth. One at a time.
// state: ground | carried | floating (bubbling home) | placed | used
// opts: name (for messages), heavy (slower, lower jumps), reach, lift (height above ground
//       when dropped), carryPos/carryRot (in the mouth), yaw, onCarry(it)
export const items = [];
// opts can override any field of the item record below (name, reach, carryPos, onGrab…)
export function addItem(id, { model: m, pos, heavy = false, ...opts }) {
  m.position.copy(pos);
  m.rotation.y = opts.yaw || 0;
  scene.add(m);
  m.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const it = {
    id,
    name: 'thing',
    mesh: m,
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
  player.carry = it;
  sfx.grab();
  it.onCarry?.(it);
}
// take the carried item out of the mouth (it stays where it was in the world)
export function releaseCarried() {
  const it = player.carry;
  player.carry = null;
  const w = vec3();
  it.mesh.getWorldPosition(w);
  dog.mouth.remove(it.mesh);
  scene.add(it.mesh);
  it.mesh.position.copy(w);
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
export function dropCarried() {
  const it = releaseCarried();
  const f = forwardDir();
  const x = player.pos.x + f.x * 1.1,
    z = player.pos.z + f.z * 1.1;
  const s = supportHeight(x, z, player.pos.y + 0.6);
  sfx.drop();
  if (physics().water && s < 0) {
    it.mesh.position.set(x, 0.2, z);
    floatBack(it);
    return;
  }
  it.mesh.position.set(x, s + it.lift, z);
  it.state = 'ground';
}
export function grabAction(p) {
  for (const it of items)
    if (
      it.state === 'ground' &&
      distXZ(p, it.mesh.position.x, it.mesh.position.z) < it.reach &&
      Math.abs(p.y - it.mesh.position.y) < 1.5
    )
      return { label: 'Grab', fn: () => carryItem(it) };
  return null;
}

/* dropped in the water: a bubble floats it back to where it was found */
const floaters = [],
  beacons = [];
function floatBack(it) {
  it.state = 'floating';
  const b = new THREE.Mesh(
    new THREE.SphereGeometry(it.heavy ? 2.2 : 1, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0xbff3ff,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      depthWrite: false,
    }),
  );
  scene.add(b);
  floaters.push({ it, b, t: 0, from: it.mesh.position.clone() });
  sfx.splash();
  toast(`Splash! The ${it.name} floats away in a bubble…`, 3000);
}
export function updateFloaters(dt) {
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.t += dt;
    const dur = clamp(f.from.distanceTo(f.it.home) / 7, 2, 4.5),
      k = clamp(f.t / dur, 0, 1),
      e = k * k * (3 - 2 * k),
      m = f.it.mesh;
    m.position.lerpVectors(f.from, f.it.home, e);
    m.position.y += Math.sin(Math.PI * k) * 6;
    m.rotation.y += dt * 1.5;
    f.b.position.copy(m.position);
    f.b.scale.setScalar(1 + Math.sin(f.t * 8) * 0.05);
    if (Math.random() < dt * 10)
      burst(m.position.clone(), {
        count: 1,
        color: 0xdff9ff,
        speed: 0.5,
        up: 1,
        life: 0.8,
        size: 0.7,
      });
    if (k >= 1) {
      scene.remove(f.b);
      m.position.copy(f.it.home);
      m.rotation.set(0, f.it.homeYaw, 0);
      f.it.state = 'ground';
      floaters.splice(i, 1);
      sfx.pop();
      beacons.push({ p: f.it.home.clone(), t: 5 });
      toast(`The ${f.it.name} floated back to where you found it. Look for the sparkles!`, 3400);
    }
  }
  for (let i = beacons.length - 1; i >= 0; i--) {
    const b = beacons[i];
    b.t -= dt;
    if (Math.random() < dt * 25)
      burst(b.p.clone().add(vec3((Math.random() - 0.5) * 0.8, 0.2, (Math.random() - 0.5) * 0.8)), {
        count: 1,
        color: [0xffd84d, 0xffffff],
        speed: 0.6,
        up: 6,
        life: 1,
        size: 0.9,
        gravity: -0.05,
      });
    if (b.t <= 0) beacons.splice(i, 1);
  }
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
export function updatePlacing(dt) {
  const pl = player.placing;
  if (!pl) return;
  pl.t += dt;
  const k = clamp(pl.t / 0.7, 0, 1),
    e = 1 - Math.pow(1 - k, 3);
  const m = pl.it.mesh;
  m.position.lerpVectors(pl.from, pl.to, e);
  m.position.y += Math.sin(Math.PI * k) * 1.5;
  m.rotation.y = lerpAngle(pl.yaw0, 0, e);
  if (k >= 1) {
    m.position.copy(pl.to);
    m.rotation.set(0, 0, 0);
    player.placing = null;
    pl.onDone?.(pl.it);
  }
}
