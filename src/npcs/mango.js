import * as THREE from 'three';
import { clamp, vec3 } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { material, mesh } from '../core/materials.js';
import { game } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { textSprite, onFontsReady } from '../core/fx.js';
import { supportHeight } from '../core/colliders.js';
import { ship } from '../world/ship.js';
import { player, forwardDir } from '../player/player.js';
import { dog } from '../player/dog.js';

// Mango the parrot. Rescued on island 2 (too hungry to fly), lives in the crow's nest,
// and on later islands fetches things for Spartacus.
// state: hungry | hop (onto the hat) | riding | fly (to the ship) | crew
//        | fetchGo | fetchDrop | fetchHome   (a fetch errand, see mangoFetch)
export const mango = {
  g: new THREE.Group(),
  state: 'hungry',
  t: 0,
  nest: null,
  island: 0,
  fetch: null,
};
const NEST = vec3(0, 6.6, 0.4); // crow's nest, ship-local
let hungry = null;
{
  const Gr = material(0x3fbf5a),
    R = material(0xf2545b),
    Y = material(0xffd84d),
    O = material(0xffa53d),
    I = material(0x2b2b38),
    Wt = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const b = mesh(new THREE.SphereGeometry(0.3, 10, 8), Gr);
  b.scale.set(1, 1.15, 1);
  b.position.y = 0.35;
  mango.g.add(b);
  const bl = mesh(new THREE.SphereGeometry(0.2, 8, 6), Y);
  bl.scale.set(1, 1.2, 0.6);
  bl.position.set(0, 0.3, 0.17);
  mango.g.add(bl);
  const h = mesh(new THREE.SphereGeometry(0.23, 10, 8), Gr);
  h.position.set(0, 0.72, 0.05);
  mango.g.add(h);
  const bk = mesh(new THREE.ConeGeometry(0.08, 0.22, 6), O);
  bk.rotation.x = Math.PI / 2 + 0.5;
  bk.position.set(0, 0.65, 0.27);
  mango.g.add(bk);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), Wt);
    e.position.set(s * 0.1, 0.77, 0.18);
    mango.g.add(e);
    const pu = mesh(new THREE.SphereGeometry(0.035, 6, 5), I, false);
    pu.position.set(s * 0.1, 0.77, 0.235);
    mango.g.add(pu);
  }
  const tuft = mesh(new THREE.ConeGeometry(0.07, 0.22, 5), Y);
  tuft.position.set(0, 0.98, 0);
  tuft.rotation.x = -0.4;
  mango.g.add(tuft);
  mango.wings = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.27, 0.5, 0);
    const w = mesh(new THREE.BoxGeometry(0.12, 0.44, 0.32), R);
    w.position.y = -0.14;
    p.add(w);
    mango.g.add(p);
    p.userData.s = s;
    return p;
  });
  const tl = mesh(new THREE.BoxGeometry(0.14, 0.05, 0.5), R);
  tl.position.set(0, 0.18, -0.36);
  tl.rotation.x = 0.55;
  mango.g.add(tl);
  scene.add(mango.g);
}
onFontsReady(() => {
  hungry = textSprite('Hungry!', '#ffd84d');
  hungry.scale.set(3.2, 0.8, 1);
  hungry.material.depthTest = true;
  hungry.visible = false;
  scene.add(hungry);
});

// sit hungry on a nest {x,y,z} on island `isl`, looking towards `look` {x,z}
export function placeMango(nest, look, isl) {
  mango.nest = nest;
  mango.island = isl;
  mango.g.position.set(nest.x, nest.y + 0.2, nest.z);
  mango.g.rotation.y = Math.atan2(look.x - nest.x, look.z - nest.z);
}
// after being fed: hop onto Spartacus's hat
export function mangoHop() {
  mango.state = 'hop';
  mango.t = 0;
  mango.from = mango.g.position.clone();
}
// riding the hat -> fly up to the crow's nest; onArrive when he lands
function detach() {
  const w = vec3();
  mango.g.getWorldPosition(w);
  mango.g.parent.remove(mango.g);
  scene.add(mango.g);
  mango.g.position.copy(w);
  mango.from = w;
  mango.t = 0;
}
export function mangoToShip(onArrive) {
  detach();
  mango.g.scale.setScalar(1);
  mango.state = 'fly';
  mango.onArrive = onArrive;
  sfx.parrot();
}
// arriving on a later island directly (Continue): put him in the crow's nest
export function ensureMangoCrew() {
  if (mango.state === 'crew') return;
  if (mango.g.parent) mango.g.parent.remove(mango.g);
  ship.add(mango.g);
  mango.g.position.copy(NEST);
  mango.g.rotation.set(0, 0, 0);
  mango.g.scale.setScalar(1);
  mango.state = 'crew';
  if (hungry) hungry.visible = false;
}
// errand: fly to `to`, pick up `mesh`, bring it to just in front of Spartacus, then onDrop(pos, groundY)
export function mangoFetch(to, m, onDrop) {
  detach();
  mango.fetch = { to, mesh: m, onDrop };
  mango.state = 'fetchGo';
  sfx.parrot();
}

function landOnShip() {
  const g = mango.g;
  scene.remove(g);
  ship.add(g);
  g.position.copy(NEST);
  g.rotation.set(0, 0, 0);
  mango.state = 'crew';
}
export function updateMango(dt) {
  const g = mango.g,
    T = game.T;
  mango.t += dt;
  const flap = (a) =>
    mango.wings.forEach(
      (w) => (w.rotation.z = w.userData.s * (0.2 + Math.abs(Math.sin(T * 18)) * a)),
    );
  const flyTo = (to, dur, arc) => {
    const k = clamp(mango.t / dur, 0, 1);
    g.position.lerpVectors(mango.from, to, k);
    g.position.y += Math.sin(Math.PI * k) * arc;
    flap(1.2);
    g.rotation.y = Math.atan2(to.x - mango.from.x, to.z - mango.from.z);
    return k;
  };
  if (mango.state === 'hungry') {
    const n = mango.nest;
    g.position.y = n.y + 0.2 + Math.abs(Math.sin(T * 2.2)) * 0.08;
    flap(0.1);
    if (hungry) {
      hungry.visible = game.island === mango.island;
      hungry.position.set(n.x, n.y + 2 + Math.sin(T * 2) * 0.1, n.z);
    }
  } else if (mango.state === 'hop') {
    if (hungry) hungry.visible = false;
    const k = clamp(mango.t / 0.8, 0, 1);
    const to = vec3();
    dog.head.localToWorld(to.set(0, 0.75, -0.05));
    g.position.lerpVectors(mango.from, to, k);
    g.position.y += Math.sin(Math.PI * k) * 1.2;
    flap(1.2);
    if (k >= 1) {
      scene.remove(g);
      dog.head.add(g);
      g.position.set(0, 0.66, -0.05);
      g.rotation.set(0, 0, 0);
      g.scale.setScalar(0.62);
      mango.state = 'riding';
    }
  } else if (mango.state === 'riding') {
    flap(player.grounded ? 0.05 : 0.9);
    g.position.y = 0.66 + (player.grounded ? Math.abs(Math.sin(player.phase)) * 0.03 : 0);
  } else if (mango.state === 'fly') {
    if (flyTo(ship.localToWorld(NEST.clone().setY(6.65)), 1.6, 3) >= 1) {
      landOnShip();
      sfx.parrot();
      mango.onArrive?.();
    }
  } else if (mango.state === 'crew') {
    flap(0.08);
    g.rotation.y = Math.sin(T * 0.6) * 0.8;
  } else if (mango.state === 'fetchGo') {
    const f = mango.fetch;
    if (flyTo(vec3(f.to.x, f.to.y + 0.25, f.to.z), 2.2, 3) >= 1) {
      scene.remove(f.mesh);
      g.add(f.mesh);
      f.mesh.position.set(0, -0.15, 0.3);
      mango.state = 'fetchDrop';
      mango.t = 0;
      mango.from = g.position.clone();
      sfx.parrot();
    }
  } else if (mango.state === 'fetchDrop') {
    const f = mango.fetch,
      k = clamp(mango.t / 1.6, 0, 1),
      fw = forwardDir(),
      to = vec3(player.pos.x + fw.x * 1.2, player.pos.y + 2.2, player.pos.z + fw.z * 1.2);
    g.position.lerpVectors(mango.from, to, k);
    g.position.y += Math.sin(Math.PI * k) * 1.5;
    flap(1.2);
    g.rotation.y = Math.atan2(to.x - g.position.x, to.z - g.position.z) || g.rotation.y;
    if (k >= 1) {
      g.remove(f.mesh);
      const sy = Math.max(supportHeight(to.x, to.z, player.pos.y + 0.6), player.pos.y);
      f.onDrop(vec3(to.x, sy, to.z));
      mango.state = 'fetchHome';
      mango.t = 0;
      mango.from = g.position.clone();
    }
  } else if (mango.state === 'fetchHome') {
    if (flyTo(ship.localToWorld(NEST.clone().setY(6.65)), 2.4, 3) >= 1) landOnShip();
  }
}
