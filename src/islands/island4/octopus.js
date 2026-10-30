import * as THREE from 'three';
import { lerp, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst, textSprite, onFontsReady } from '../../core/fx.js';
import { toast } from '../../core/ui.js';
import { addCylinder } from '../../core/colliders.js';
import { releaseCarried } from '../../systems/items.js';
import { completeTask } from '../../game/tasks.js';
import { OCTO, LU, LN } from './geo.js';

// The grumpy octopus. Not a villain: he's just tired. Chopping the forest seaweed wakes
// him (tentacle gates start swinging); his pillow sends him back to sleep and he shuffles aside.
export const octo = { g: new THREE.Group(), moveT: 0, moved: false, hmphT: 0 };
let octoZzz = null,
  hmph = null;
export function buildOcto() {
  const O = material(0xff7a59),
    O2 = material(0xffa07a),
    I = material(0x1c2333),
    Wt = new THREE.MeshBasicMaterial({ color: 0xffffff }),
    g = octo.g;
  const head = mesh(new THREE.SphereGeometry(1.5, 14, 12), O);
  head.scale.set(1.2, 1.05, 1.1);
  head.position.y = 1.9;
  g.add(head);
  octo.head = head;
  for (let k = 0; k < 8; k++) {
    const tg = new THREE.Group();
    tg.rotation.y = (-k / 8) * 6.283;
    const t = mesh(new THREE.CapsuleGeometry(0.28, 1.4, 4, 8), O2);
    t.rotation.z = Math.PI / 2;
    t.position.set(1.5, 0.3, 0);
    tg.add(t);
    g.add(tg);
  }
  octo.lids = [];
  octo.brows = [];
  octo.open = [];
  octo.closed = [];
  for (const sd of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), Wt);
    e.position.set(sd * 0.55, 2.25, 1.45);
    g.add(e);
    const pu = mesh(new THREE.SphereGeometry(0.15, 8, 6), I, { castShadow: false });
    pu.position.set(sd * 0.55, 2.2, 1.74);
    g.add(pu);
    octo.open.push(e, pu);
    const cl = mesh(new THREE.TorusGeometry(0.24, 0.06, 5, 10, Math.PI), I, { castShadow: false });
    cl.rotation.z = Math.PI;
    cl.position.set(sd * 0.55, 2.3, 1.7);
    g.add(cl);
    octo.closed.push(cl);
    const br = mesh(new THREE.BoxGeometry(0.55, 0.1, 0.1), I, { castShadow: false });
    br.position.set(sd * 0.55, 2.75, 1.6);
    br.rotation.z = sd * -0.45;
    g.add(br);
    octo.brows.push(br);
  }
  octo.frown = mesh(new THREE.TorusGeometry(0.25, 0.05, 5, 10, Math.PI), I, { castShadow: false });
  octo.frown.position.set(0, 1.62, 1.68);
  g.add(octo.frown);
  octo.smile = mesh(new THREE.TorusGeometry(0.25, 0.05, 5, 10, Math.PI), I, { castShadow: false });
  octo.smile.rotation.z = Math.PI;
  octo.smile.position.set(0, 1.78, 1.68);
  octo.smile.visible = false;
  g.add(octo.smile);
  octo.snore = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshStandardMaterial({
      color: 0xdff9ff,
      transparent: true,
      opacity: 0.55,
      roughness: 0.1,
    }),
  );
  octo.snore.position.set(0.35, 1.7, 1.85);
  g.add(octo.snore);
  g.position.set(OCTO.x, OCTO.y, OCTO.z);
  g.rotation.y = Math.atan2(-LU.x, -LU.z);
  scene.add(g);
  octo.col = addCylinder(OCTO.x, OCTO.z, { r: 1.8, bottom: OCTO.y - 1, top: OCTO.y + 3.5 });
  onFontsReady(() => {
    octoZzz = textSprite('Zzz', '#ffffff');
    octoZzz.scale.set(3, 0.75, 1);
    octoZzz.visible = false;
    scene.add(octoZzz);
    hmph = textSprite('Hmph!', '#ff7a59');
    hmph.scale.set(3.2, 0.8, 1);
    hmph.visible = false;
    scene.add(hmph);
  });
}
export function wakeOcto(asleepForGood) {
  if (OCTO.awake || asleepForGood) return;
  OCTO.awake = true;
  setTimeout(() => {
    sfx.grumble();
    toast('Uh oh… the grumpy octopus woke up!', 3000);
  }, 400);
}
export function givePillow() {
  const it = releaseCarried();
  it.state = 'used';
  octo.g.attach(it.mesh);
  it.mesh.position.set(0, 0.6, 1.7);
  it.mesh.rotation.set(0.4, 0, 0);
  OCTO.awake = false;
  octo.moveT = 0.001;
  sfx.creak();
  burst(vec3(OCTO.x, OCTO.y + 3, OCTO.z), {
    count: 24,
    color: [0xffb3d1, 0xffffff, 0xffd84d],
    speed: 4,
    up: 3,
    life: 1,
    size: 1,
  });
  toast('Ahh… the octopus hugs his pillow and shuffles off to bed!', 3600);
  completeTask('sleep');
}

export function updateOcto(dt) {
  const T = game.time;
  // shuffle aside to bed (and take his collider with him)
  if (octo.moveT > 0 && octo.moveT < 1) {
    octo.moveT = Math.min(1, octo.moveT + dt / 2.5);
    const k = octo.moveT * octo.moveT * (3 - 2 * octo.moveT),
      tx = OCTO.x + LN.x * 1.7 + LU.x * 0.5,
      tz = OCTO.z + LN.z * 1.7 + LU.z * 0.5;
    octo.g.position.x = lerp(OCTO.x, tx, k);
    octo.g.position.z = lerp(OCTO.z, tz, k);
    octo.col.x = octo.g.position.x;
    octo.col.z = octo.g.position.z;
    if (octo.moveT >= 1) octo.moved = true;
  }
  const asleep = !OCTO.awake;
  octo.open.forEach((m) => (m.visible = !asleep));
  octo.closed.forEach((m) => (m.visible = asleep));
  octo.brows.forEach((b) => (b.visible = !asleep));
  octo.frown.visible = !asleep;
  octo.smile.visible = asleep;
  octo.g.position.y =
    OCTO.y + (asleep ? Math.sin(T * 1.2) * 0.06 : Math.abs(Math.sin(T * 6)) * 0.15);
  octo.head.scale.y = 1.05 + Math.sin(T * (asleep ? 1.2 : 3)) * (asleep ? 0.05 : 0.03);
  octo.g.rotation.z = asleep ? 0 : Math.sin(T * 5) * 0.05;
  octo.snore.visible = asleep;
  octo.snore.scale.setScalar(asleep ? 0.3 + 0.9 * ((T * 0.45) % 1) : 0.01);
  if (!asleep && Math.random() < dt * 5)
    burst(octo.g.position.clone().add(vec3((Math.random() - 0.5) * 1.6, 3.7, 0)), {
      count: 1,
      color: 0xffffff,
      speed: 0.6,
      up: 3,
      life: 0.8,
      size: 1,
      gravity: -0.2,
    });
  if (octoZzz) {
    octoZzz.visible = asleep;
    const c = (T * 0.4) % 1;
    octoZzz.position.set(octo.g.position.x + c * 0.6, OCTO.y + 4.6 + c * 1.2, octo.g.position.z);
    octoZzz.material.opacity = Math.sin(c * Math.PI);
  }
  if (hmph) {
    octo.hmphT -= dt;
    hmph.visible = octo.hmphT > 0;
    hmph.position.set(octo.g.position.x, OCTO.y + 5, octo.g.position.z);
  }
}
