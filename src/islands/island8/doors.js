// The temple's doors and paw plates. A door fills a doorway the level left open in a wall
// (make_island8.py) and sinks into the floor when it opens; its collider goes as it sinks.
// Looks: `slab` (the Great Door, two stone halves with a paw each), `bars` (the Garden's gate and
// the locked door to the Echo Hall, with a keyhole) and `sun` (the Sun Door, a gold sun with three
// holes for the Sun Gems). Plates are flat stones that click down under a dog or a stone block.
//
//   const door = addDoor(spot, { across: 'x', width: 4, look: 'slab' })  // across: the wall's way
//   door.open()  door.isOpen  door.sockets (sun door: world spots for the gems)
//   const plate = addPlate(spot, { icon: 'paw' })   plate.press(true / false)
import * as THREE from 'three';
import { clamp, vec3 } from '../../core/util.js';
import { scene } from '../../core/renderer.js';
import { canvasTexture, drawPaw, material, mergeParts, mesh } from '../../core/materials.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { addBox } from '../../core/colliders.js';

const SINK_TIME = 2.2; // s for a door to sink away
const TALL = 4.4; // how tall a door looks
const COLLIDER_TOP = 16; // above the floor: no jumping over a door
export const GEM_COLORS = { garden: 0xff8fc8, echo: 0x7fd8ee, mirror: 0xffd84d };

const doors = [],
  plates = [];

// a stone face with a gold paw (the Great Door's halves)
const pawStone = () =>
  canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d9c298';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#b89a6a';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    drawPaw(ctx, { x: w / 2, y: h * 0.45, size: 30, color: '#f2b84b' });
  });

// spot: the middle of the doorway on the floor. across: 'x' if the wall runs along x (the door
// faces z), 'z' if it runs along z
export function addDoor(spot, { across, width, look }) {
  const g = new THREE.Group();
  g.position.set(spot.x, spot.y, spot.z);
  if (across === 'z') g.rotation.y = Math.PI / 2;
  scene.add(g);
  const sockets = LOOKS[look](g, width);
  if (look !== 'slab') mergeParts(g); // bars, rays and holes: a few draw calls (the slab's
  // halves have a material per face, which merging doesn't handle)
  const along = across === 'x';
  const collider = addBox(spot.x, spot.z, {
    hw: along ? width / 2 : 0.6,
    hd: along ? 0.6 : width / 2,
    bottom: spot.y - 1,
    top: spot.y + COLLIDER_TOP,
  });
  const door = {
    g,
    spot,
    collider,
    isOpen: false,
    t: -1, // seconds into sinking, -1 while shut
    sockets: null, // the sun door's gem holes, in the world
    open({ quiet = false } = {}) {
      if (door.isOpen) return;
      door.isOpen = true;
      collider.top = -999;
      if (quiet) {
        g.visible = false;
        return;
      }
      door.t = 0;
      sfx.rumble();
    },
  };
  g.updateMatrixWorld(true);
  door.sockets = sockets?.map((local) => g.localToWorld(local.clone()));
  doors.push(door);
  return door;
}

const LOOKS = {
  // two stone halves, a gold paw on each: it takes two dogs to open
  slab(g, width) {
    const face = new THREE.MeshStandardMaterial({ map: pawStone(), roughness: 0.9 });
    for (const side of [-1, 1]) {
      const half = mesh(new THREE.BoxGeometry(width / 2 - 0.05, TALL + 0.6, 0.9), [
        material(0xd9c298),
        material(0xd9c298),
        material(0xd9c298),
        material(0xd9c298),
        face,
        face,
      ]);
      half.position.set((side * width) / 4, TALL / 2, 0);
      g.add(half);
    }
  },
  // bronze bars with a cross bar; `width` wide
  bars(g, width) {
    const bronze = material(0xb0803c, { metalness: 0.3, roughness: 0.5 });
    const count = Math.round(width / 0.45);
    for (let i = 0; i <= count; i++) {
      const bar = mesh(new THREE.CylinderGeometry(0.07, 0.07, TALL - 1, 6), bronze);
      bar.position.set(-width / 2 + (i * width) / count, (TALL - 1) / 2, 0);
      g.add(bar);
    }
    for (const y of [0.4, TALL - 1.2]) {
      const rail = mesh(new THREE.BoxGeometry(width, 0.14, 0.16), bronze);
      rail.position.y = y;
      g.add(rail);
    }
  },
  // the locked door: bars and a big gold lock in the middle
  locked(g, width) {
    LOOKS.bars(g, width);
    const lock = mesh(new THREE.BoxGeometry(0.7, 0.8, 0.4), material(0xf2b84b, { metalness: 0.4 }));
    lock.position.y = 1.4;
    g.add(lock);
    const hole = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.42, 8), material(0x2b2b38));
    hole.rotation.x = Math.PI / 2;
    hole.position.set(0, 1.45, 0);
    g.add(hole);
  },
  // the Sun Door: a stone slab with a big gold sun and three holes; returns the holes (local)
  sun(g, width) {
    const slab = mesh(new THREE.BoxGeometry(width, TALL + 0.6, 0.9), material(0xd9c298));
    slab.position.y = TALL / 2;
    g.add(slab);
    const sun = mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.2, 24),
      material(0xf2b84b, { metalness: 0.3 }),
    );
    sun.rotation.x = Math.PI / 2;
    sun.position.set(0, 2.4, 0.5);
    g.add(sun);
    for (let i = 0; i < 12; i++) {
      const ray = mesh(new THREE.ConeGeometry(0.22, 0.6, 4), material(0xf2b84b));
      const angle = (i / 12) * Math.PI * 2;
      ray.position.set(Math.cos(angle) * 1.85, 2.4 + Math.sin(angle) * 1.85, 0.5);
      ray.rotation.z = angle - Math.PI / 2;
      g.add(ray);
    }
    const holes = [-0.75, 0, 0.75].map((x, i) => vec3(x, i === 1 ? 2.75 : 2.15, 0.66));
    for (const hole of holes) {
      const socket = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), material(0x5a4636));
      socket.rotation.x = Math.PI / 2;
      socket.position.copy(hole).setZ(0.6);
      g.add(socket);
    }
    return holes.map((hole) => hole.clone().setZ(0.95));
  },
};

/* paw plates */

const plateLooks = {};
const plateLook = (icon) =>
  (plateLooks[icon] ??= canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c9ae82';
    ctx.fillRect(0, 0, w, h);
    if (icon === 'paw') drawPaw(ctx, { x: w / 2, y: h / 2 + 4, size: 26, color: '#f2b84b' });
    else {
      ctx.fillStyle = '#8a7a66';
      ctx.fillRect(w * 0.28, h * 0.28, w * 0.44, h * 0.44);
    }
  }));

// icon: 'paw' (a dog sits here) or 'block' (a stone block goes here)
export function addPlate(spot, { icon = 'paw', radius = 1 } = {}) {
  const top = new THREE.MeshStandardMaterial({
    map: plateLook(icon),
    emissive: 0xffc83d,
    emissiveIntensity: 0,
    roughness: 0.9,
  });
  const side = material(0xa88b5f);
  const m = mesh(new THREE.CylinderGeometry(radius, radius * 1.05, 0.2, 20), [side, top, side], {
    receiveShadow: true,
  });
  m.position.set(spot.x, spot.y + 0.1, spot.z);
  scene.add(m);
  const plate = {
    x: spot.x,
    y: spot.y,
    z: spot.z,
    radius,
    pressed: false,
    m,
    top,
    press(down) {
      if (down === plate.pressed) return;
      plate.pressed = down;
      if (down) sfx.click();
      m.position.y = spot.y + (down ? 0.03 : 0.1);
      top.emissiveIntensity = down ? 0.5 : 0;
    },
  };
  plates.push(plate);
  return plate;
}

/* every frame: doors sinking */

export function updateDoors(dt) {
  for (const door of doors) {
    if (door.t < 0 || !door.g.visible) continue;
    door.t += dt;
    const t = clamp(door.t / SINK_TIME, 0, 1);
    door.g.position.y = door.spot.y - t * t * (TALL + 1);
    door.g.position.x = door.spot.x + Math.sin(door.t * 40) * 0.03 * (1 - t); // a shudder
    if (Math.random() < dt * 12)
      burst(vec3(door.spot.x, door.spot.y + 0.3, door.spot.z), {
        count: 3,
        color: [0xe0c9a0, 0xfff0c8],
        speed: 2.5,
        up: 1.5,
        life: 0.8,
        size: 1.2,
      });
    if (t === 1) door.g.visible = false;
  }
}
