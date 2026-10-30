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
import { OCTOPUS_SPOT, LANE_DIR, LANE_NORMAL } from './geo.js';

// The grumpy octopus. Not a villain: he's just tired. Chopping the forest seaweed wakes
// him (tentacle gates start swinging); his pillow sends him back to sleep and he shuffles aside.
// moveT: 0..1 progress of the shuffle to bed; hmphTimer: seconds left showing "Hmph!" after a bonk
export const octo = { g: new THREE.Group(), awake: false, moveT: 0, moved: false, hmphTimer: 0 };
let zzzLabel = null,
  hmphLabel = null;

export function buildOcto() {
  const skinMat = material(0xff7a59),
    tentacleMat = material(0xffa07a),
    inkMat = material(0x1c2333),
    eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff }),
    g = octo.g;
  const head = mesh(new THREE.SphereGeometry(1.5, 14, 12), skinMat);
  head.scale.set(1.2, 1.05, 1.1);
  head.position.y = 1.9;
  g.add(head);
  octo.head = head;
  for (let k = 0; k < 8; k++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (-k / 8) * 6.283;
    const tentacle = mesh(new THREE.CapsuleGeometry(0.28, 1.4, 4, 8), tentacleMat);
    tentacle.rotation.z = Math.PI / 2;
    tentacle.position.set(1.5, 0.3, 0);
    pivot.add(tentacle);
    g.add(pivot);
  }
  // awake: open eyes + angry brows + frown; asleep: closed eyes + smile
  octo.brows = [];
  octo.openEyes = [];
  octo.closedEyes = [];
  for (const side of [-1, 1]) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), eyeWhiteMat);
    eyeWhite.position.set(side * 0.55, 2.25, 1.45);
    g.add(eyeWhite);
    const pupil = mesh(new THREE.SphereGeometry(0.15, 8, 6), inkMat, { castShadow: false });
    pupil.position.set(side * 0.55, 2.2, 1.74);
    g.add(pupil);
    octo.openEyes.push(eyeWhite, pupil);
    const closedEye = mesh(new THREE.TorusGeometry(0.24, 0.06, 5, 10, Math.PI), inkMat, {
      castShadow: false,
    });
    closedEye.rotation.z = Math.PI;
    closedEye.position.set(side * 0.55, 2.3, 1.7);
    g.add(closedEye);
    octo.closedEyes.push(closedEye);
    const brow = mesh(new THREE.BoxGeometry(0.55, 0.1, 0.1), inkMat, { castShadow: false });
    brow.position.set(side * 0.55, 2.75, 1.6);
    brow.rotation.z = side * -0.45;
    g.add(brow);
    octo.brows.push(brow);
  }
  octo.frown = mesh(new THREE.TorusGeometry(0.25, 0.05, 5, 10, Math.PI), inkMat, {
    castShadow: false,
  });
  octo.frown.position.set(0, 1.62, 1.68);
  g.add(octo.frown);
  octo.smile = mesh(new THREE.TorusGeometry(0.25, 0.05, 5, 10, Math.PI), inkMat, {
    castShadow: false,
  });
  octo.smile.rotation.z = Math.PI;
  octo.smile.position.set(0, 1.78, 1.68);
  octo.smile.visible = false;
  g.add(octo.smile);
  // the snot bubble that grows and pops while he snores
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
  g.position.set(OCTOPUS_SPOT.x, OCTOPUS_SPOT.y, OCTOPUS_SPOT.z);
  g.rotation.y = Math.atan2(-LANE_DIR.x, -LANE_DIR.z);
  scene.add(g);
  octo.col = addCylinder(OCTOPUS_SPOT.x, OCTOPUS_SPOT.z, {
    r: 1.8,
    bottom: OCTOPUS_SPOT.y - 1,
    top: OCTOPUS_SPOT.y + 3.5,
  });
  onFontsReady(() => {
    zzzLabel = textSprite('Zzz', '#ffffff');
    zzzLabel.scale.set(3, 0.75, 1);
    zzzLabel.visible = false;
    scene.add(zzzLabel);
    hmphLabel = textSprite('Hmph!', '#ff7a59');
    hmphLabel.scale.set(3.2, 0.8, 1);
    hmphLabel.visible = false;
    scene.add(hmphLabel);
  });
}

export function wakeOcto(asleepForGood) {
  if (octo.awake || asleepForGood) return;
  octo.awake = true;
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
  octo.awake = false;
  octo.moveT = 0.001;
  sfx.creak();
  burst(vec3(OCTOPUS_SPOT.x, OCTOPUS_SPOT.y + 3, OCTOPUS_SPOT.z), {
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

// shuffle aside to bed over 2.5s (and take his collider with him), clearing the lane
function shuffleToBed(dt) {
  octo.moveT = Math.min(1, octo.moveT + dt / 2.5);
  const k = octo.moveT * octo.moveT * (3 - 2 * octo.moveT),
    bedX = OCTOPUS_SPOT.x + LANE_NORMAL.x * 1.7 + LANE_DIR.x * 0.5,
    bedZ = OCTOPUS_SPOT.z + LANE_NORMAL.z * 1.7 + LANE_DIR.z * 0.5;
  octo.g.position.x = lerp(OCTOPUS_SPOT.x, bedX, k);
  octo.g.position.z = lerp(OCTOPUS_SPOT.z, bedZ, k);
  octo.col.x = octo.g.position.x;
  octo.col.z = octo.g.position.z;
  if (octo.moveT >= 1) octo.moved = true;
}

export function updateOcto(dt) {
  const T = game.time;
  if (octo.moveT > 0 && octo.moveT < 1) shuffleToBed(dt);
  const asleep = !octo.awake;
  for (const m of octo.openEyes) m.visible = !asleep;
  for (const m of octo.closedEyes) m.visible = asleep;
  for (const b of octo.brows) b.visible = !asleep;
  octo.frown.visible = !asleep;
  octo.smile.visible = asleep;
  // asleep: slow breathing bob; awake: grumpy bouncing and wobble
  octo.g.position.y =
    OCTOPUS_SPOT.y + (asleep ? Math.sin(T * 1.2) * 0.06 : Math.abs(Math.sin(T * 6)) * 0.15);
  octo.head.scale.y = 1.05 + Math.sin(T * (asleep ? 1.2 : 3)) * (asleep ? 0.05 : 0.03);
  octo.g.rotation.z = asleep ? 0 : Math.sin(T * 5) * 0.05;
  octo.snore.visible = asleep;
  octo.snore.scale.setScalar(asleep ? 0.3 + 0.9 * ((T * 0.45) % 1) : 0.01);
  // awake: angry steam bubbles from the top of his head
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
  if (zzzLabel) {
    zzzLabel.visible = asleep;
    const cycle = (T * 0.4) % 1; // each Zzz drifts up and fades over 2.5s
    zzzLabel.position.set(
      octo.g.position.x + cycle * 0.6,
      OCTOPUS_SPOT.y + 4.6 + cycle * 1.2,
      octo.g.position.z,
    );
    zzzLabel.material.opacity = Math.sin(cycle * Math.PI);
  }
  if (hmphLabel) {
    octo.hmphTimer -= dt;
    hmphLabel.visible = octo.hmphTimer > 0;
    hmphLabel.position.set(octo.g.position.x, OCTOPUS_SPOT.y + 5, octo.g.position.z);
  }
}
