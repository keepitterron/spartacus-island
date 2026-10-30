import * as THREE from 'three';
import { clamp, distXZ, lerp, smoothstep, rand, distToSegmentXZ, vec3 } from '../../core/util.js';
import { scene, LOW_POWER } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst, textSprite, onFontsReady } from '../../core/fx.js';
import { toast, hintOnce, actionKeyName } from '../../core/ui.js';
import { addCylinder, addBox } from '../../core/colliders.js';
import { terrainHeight, buildGround } from '../../world/terrain.js';
import { CENTER_3 } from '../../world/layout.js';
import { scatter, dock } from '../../world/props.js';
import { ship, addBucket } from '../../world/ship.js';
import { makeKey, makeFlower, makeAcorn } from '../../models/items.js';
import { player } from '../../player/player.js';
import { addItem, carryItem, useUpCarried } from '../../systems/items.js';
import { addPickup, pickupText } from '../../systems/collect.js';
import { addFruit } from '../../systems/powers.js';
import { addDig } from '../../systems/digs.js';
import { addHook } from '../../systems/hooks.js';
import { climbVine, zipVine, vineAction } from '../../systems/vines.js';
import { mango, ensureMangoCrew, mangoFetch } from '../../npcs/mango.js';
import { wasabi } from '../../npcs/wasabi.js';
import { startBubble } from '../../cutscenes/bubble.js';
import { completeTask } from '../../game/tasks.js';
import { enterIsland } from '../../game/flow.js';
import { hintTooHigh } from '../../game/interact.js';

/* ============ Island 3: Mossy Paw Woods ============
   Grow-Grow fruit: magic seeds grow a climbing vine and ziplines between treetops.
   Mango fetches a flower, the bees trade it for a key, the key opens the water gate,
   the stream refills Wasabi's spring and she swims down to the ship.

   PLACEHOLDER LAYOUT until Zoë draws the map. Everything is positioned with W3(x,z) in
   island-local coordinates, so her layout can be dropped in by editing the numbers. */

const W3 = (x, z) => ({ x: CENTER_3.x + x, z: CENTER_3.z + z });
const POOL3 = { x: CENTER_3.x - 12, z: CENTER_3.z - 4 }; // Wasabi's spring
const STREAM = [
  [-14, -15],
  [-12, -4],
  [-10, 6],
  [-8, 16],
  [-7, 30],
].map(([x, z]) => vec3(CENTER_3.x + x, 0, CENTER_3.z + z));
function streamDist(x, z) {
  let d = 1e9;
  for (let i = 0; i < STREAM.length - 1; i++)
    d = Math.min(d, distToSegmentXZ({ x, z }, STREAM[i], STREAM[i + 1]));
  return d;
}
function edge(a) {
  return 26 + Math.sin(a * 5) * 1.2 + Math.sin(a * 3 + 2) * 1.4;
}
function height(x, z) {
  const lx = x - CENTER_3.x,
    lz = z - CENTER_3.z,
    r = Math.hypot(lx, lz),
    a = Math.atan2(lz, lx),
    e = edge(a);
  let h =
    1.25 + 0.3 * Math.sin(x * 0.35 + 1) * Math.cos(z * 0.3) + 0.18 * Math.sin(x * 0.8 + z * 0.7);
  const sd = streamDist(x, z);
  if (sd < 2.2) h = lerp(0.5, h, smoothstep(1.1, 2.2, sd));
  const pd = Math.hypot(x - POOL3.x, z - POOL3.z);
  if (pd < 4.6) h = lerp(0.45, h, smoothstep(3.2, 4.6, pd));
  h = lerp(h, 0.35, smoothstep(e - 5, e - 2, r));
  return lerp(h, -4, smoothstep(e, e + 2.5, r));
}

// a big tree with a flat leafy deck on top; smooth bark can't be climbed even with a vine
function bigTree(lx, lz, top, smoothBark) {
  const { x, z } = W3(lx, lz),
    gh = terrainHeight(x, z),
    H = top - gh;
  const t = { x, z, gh, top, grown: false };
  const trunk = mesh(
    new THREE.CylinderGeometry(1.0, 1.35, H, 9),
    material(smoothBark ? 0x9a7a5e : 0x6e4a30),
    { receiveShadow: true },
  );
  trunk.position.set(x, gh + H / 2, z);
  scene.add(trunk);
  const deck = mesh(new THREE.CylinderGeometry(3.2, 2.9, 0.5, 14), material(0x5ea84c), {
    receiveShadow: true,
  });
  deck.position.set(x, top - 0.25, z);
  scene.add(deck);
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * 6.283;
    const p = mesh(
      new THREE.IcosahedronGeometry(0.9 + rand() * 0.4, 0),
      material(k % 2 ? 0x3f8f3f : 0x4fa84a),
    );
    p.position.set(x + Math.cos(a) * 3.5, top - 0.3 + rand() * 0.5, z + Math.sin(a) * 3.5);
    scene.add(p);
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 6.283 + 0.3;
    const p = mesh(new THREE.IcosahedronGeometry(1.5, 0), material(0x3a8a3c));
    p.position.set(x + Math.cos(a) * 2.3, top - 1.5, z + Math.sin(a) * 2.3);
    scene.add(p);
  }
  t.col = addCylinder(x, z, { r: 1.2, bottom: gh - 1, top: top - 0.6 });
  t.col.tree = t;
  addCylinder(x, z, { r: 3.2, bottom: top - 0.6, top });
  return t;
}
function forestTree(x, z) {
  const gh = terrainHeight(x, z);
  if (rand() < 0.5) {
    const tr = mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 6), material(0x6e4a30));
    tr.position.set(x, gh + 0.7, z);
    scene.add(tr);
    for (let k = 0; k < 3; k++) {
      const c = mesh(
        new THREE.ConeGeometry(1.6 - k * 0.4, 1.8, 7),
        material(k % 2 ? 0x2f7f3f : 0x3a9446),
      );
      c.position.set(x, gh + 1.6 + k * 1.1, z);
      scene.add(c);
    }
  } else {
    const h = 2.5 + rand() * 1.5;
    const tr = mesh(new THREE.CylinderGeometry(0.25, 0.35, h, 6), material(0x6e4a30));
    tr.position.set(x, gh + h / 2, z);
    scene.add(tr);
    for (let k = 0; k < 3; k++) {
      const c = mesh(
        new THREE.IcosahedronGeometry(1.1 + rand() * 0.5, 0),
        material(k % 2 ? 0x4fa84a : 0x5fbf55),
      );
      c.position.set(
        x + (rand() - 0.5) * 1.2,
        gh + h + 0.3 + rand() * 0.6,
        z + (rand() - 0.5) * 1.2,
      );
      scene.add(c);
    }
  }
  addCylinder(x, z, { r: 0.4, bottom: gh - 1, top: gh + 3 });
}

let T1,
  T2,
  T3,
  T4,
  t1vine,
  flowerMesh,
  flowCurve,
  flowGeo,
  poolWater,
  thirsty = null;
let flowK = 0,
  flowerCalled = false;
const HIVE = {},
  GATE = W3(-14, -17.5),
  FLW = {},
  MUSH = W3(14, 6);
const BUSH3 = { grow: W3(5, 9), boing: W3(11, 1), stretch: W3(9, -2) };

function build() {
  buildGround(CENTER_3.x, CENTER_3.z, {
    size: 68,
    segments: LOW_POWER ? 90 : 140,
    palette: { g: 0x4fa84a, g2: 0x6fbf55 },
  });
  I.spawn = vec3(CENTER_3.x, 0, CENTER_3.z + 15);
  I.spawn.y = terrainHeight(I.spawn.x, I.spawn.z);
  dock(CENTER_3.x, { zFrom: CENTER_3.z + 18, zTo: CENTER_3.z + 33 });
  // T1 has a magic seed at its roots; T2/T3/T4 have bark too smooth to climb
  T1 = bigTree(-2, 2, 10);
  T2 = bigTree(6, -6, 8.5, true);
  T3 = bigTree(-3, -13, 7, true);
  T4 = bigTree(15, -12, 8, true);
  t1vine = climbVine(T1, I.spawn.x, I.spawn.z);
  zipVine(T1, T2);
  zipVine(T2, T3);
  // bonus: Stretchy hook from T2 to T4 (golden acorn on top)
  addHook({ x: T2.x, y: T2.top, z: T2.z }, { x: T4.x, y: T4.top, z: T4.z });

  /* the bees' hive on T3 */
  {
    const dx = T3.x - T2.x,
      dz = T3.z - T2.z,
      d = Math.hypot(dx, dz);
    HIVE.x = T3.x + (dx / d) * 1.7;
    HIVE.z = T3.z + (dz / d) * 1.7;
    HIVE.y = T3.top;
    const g = new THREE.Group();
    g.position.set(HIVE.x, HIVE.y, HIVE.z);
    g.rotation.y = Math.atan2(-dx, -dz);
    scene.add(g);
    for (let i = 0; i < 4; i++) {
      const ring = mesh(new THREE.TorusGeometry(0.75 - i * 0.15, 0.17, 6, 14), material(0xf2c14e));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.18 + i * 0.3;
      g.add(ring);
    }
    const core = mesh(new THREE.SphereGeometry(0.68, 10, 8), material(0xe8b23e));
    core.scale.y = 1.1;
    core.position.y = 0.55;
    g.add(core);
    const door = mesh(new THREE.CircleGeometry(0.16, 10), material(0x3a2a1a), {
      castShadow: false,
    });
    door.position.set(0, 0.3, 0.71);
    g.add(door);
    addCylinder(HIVE.x, HIVE.z, { r: 0.75, bottom: HIVE.y - 0.5, top: HIVE.y + 1.3 });
    HIVE.bees = [];
    const wm = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group();
      const bd = mesh(new THREE.SphereGeometry(0.09, 6, 5), material(0xffd84d), {
        castShadow: false,
      });
      bd.scale.z = 1.3;
      b.add(bd);
      const st = mesh(new THREE.TorusGeometry(0.085, 0.022, 4, 10), material(0x2b2b38), {
        castShadow: false,
      });
      b.add(st);
      for (const sd of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), wm);
        w.position.set(sd * 0.07, 0.07, 0);
        w.rotation.x = -Math.PI / 2;
        b.add(w);
      }
      scene.add(b);
      HIVE.bees.push({ b, ph: i * 0.9, r: 1.1 + rand() * 0.6, h: 0.6 + rand() * 0.8 });
    }
    HIVE.excite = 0;
  }

  /* the locked water gate upstream of Wasabi's spring */
  {
    const gh = terrainHeight(GATE.x, GATE.z);
    GATE.y = gh;
    GATE.fx = GATE.x;
    GATE.fz = GATE.z + 1.8;
    for (const sd of [-1, 1]) {
      const w = mesh(new THREE.BoxGeometry(3, 2.4, 1.3), material(0x9aa6b8), {
        receiveShadow: true,
      });
      w.position.set(GATE.x + sd * 2.6, gh + 1.2, GATE.z);
      scene.add(w);
      addBox(GATE.x + sd * 2.6, GATE.z, { hw: 1.5, hd: 0.65, bottom: gh - 1, top: gh + 2.4 });
      const moss = mesh(new THREE.BoxGeometry(3.05, 0.2, 1.35), material(0x7cc86a), {
        castShadow: false,
      });
      moss.position.set(GATE.x + sd * 2.6, gh + 2.45, GATE.z);
      scene.add(moss);
    }
    GATE.doors = [-1, 1].map((sd) => {
      const pv = new THREE.Group();
      pv.position.set(GATE.x + sd * 1.1, gh, GATE.z);
      const dr = mesh(new THREE.BoxGeometry(1.1, 1.9, 0.16), material(0x9c6436));
      dr.position.set(-sd * 0.55, 0.95, 0);
      pv.add(dr);
      for (const y of [0.4, 1.5]) {
        const b = mesh(new THREE.BoxGeometry(1.12, 0.12, 0.18), material(0x6e4a30), {
          castShadow: false,
        });
        b.position.set(-sd * 0.55, y, 0);
        pv.add(b);
      }
      scene.add(pv);
      pv.userData.s = sd;
      return pv;
    });
    GATE.lock = mesh(
      new THREE.BoxGeometry(0.3, 0.34, 0.12),
      material(0xffc83d, { metalness: 0.35, roughness: 0.4 }),
    );
    GATE.lock.position.set(GATE.x, gh + 1.05, GATE.z + 0.15);
    scene.add(GATE.lock);
    GATE.col = addBox(GATE.x, GATE.z, { hw: 1.1, hd: 0.25, bottom: gh - 1, top: gh + 1.9 });
    const res = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 18),
      new THREE.MeshStandardMaterial({
        color: 0x34b3d4,
        transparent: true,
        opacity: 0.85,
        roughness: 0.3,
      }),
    );
    res.rotation.x = -Math.PI / 2;
    res.position.set(GATE.x, gh + 0.35, GATE.z - 3.2);
    scene.add(res);
    const rim = mesh(new THREE.TorusGeometry(3.25, 0.3, 5, 20), material(0x9aa6b8));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(GATE.x, gh + 0.35, GATE.z - 3.2);
    scene.add(rim);
    GATE.open = 0;
  }
  // dry stream bed + spring; water flows in once the gate opens
  flowCurve = new THREE.CatmullRomCurve3([
    vec3(GATE.x, 0, GATE.z + 0.8),
    ...STREAM.map((p) => vec3(p.x, 0, p.z)),
  ]);
  flowGeo = new THREE.TubeGeometry(flowCurve, 140, 0.95, 6);
  flowGeo.setDrawRange(0, 0);
  const flowMesh = new THREE.Mesh(
    flowGeo,
    new THREE.MeshStandardMaterial({
      color: 0x4cc3e6,
      transparent: true,
      opacity: 0.8,
      roughness: 0.25,
    }),
  );
  flowMesh.position.y = 0.62;
  flowMesh.scale.y = 0.18;
  scene.add(flowMesh);
  poolWater = new THREE.Mesh(
    new THREE.CircleGeometry(4.1, 22),
    new THREE.MeshStandardMaterial({
      color: 0x4cc3e6,
      transparent: true,
      opacity: 0.82,
      roughness: 0.25,
    }),
  );
  poolWater.rotation.x = -Math.PI / 2;
  poolWater.position.set(POOL3.x, 0.52, POOL3.z);
  poolWater.scale.setScalar(0.28);
  scene.add(poolWater);

  /* tall tree with the flower on a branch high above the stream (Mango fetches it) */
  {
    const tx = CENTER_3.x - 5,
      tz = CENTER_3.z + 9,
      gh = terrainHeight(tx, tz);
    const tr = mesh(new THREE.CylinderGeometry(0.4, 0.55, 6.5, 7), material(0x6e4a30));
    tr.position.set(tx, gh + 3.25, tz);
    scene.add(tr);
    addCylinder(tx, tz, { r: 0.55, bottom: gh - 1, top: gh + 6 });
    for (let k = 0; k < 5; k++) {
      const c = mesh(
        new THREE.IcosahedronGeometry(1.5 + rand() * 0.4, 0),
        material(k % 2 ? 0x4fa84a : 0x3f8f3f),
      );
      c.position.set(tx + (rand() - 0.5) * 2, gh + 6.8 + rand(), tz + (rand() - 0.5) * 2);
      scene.add(c);
    }
    const bx = CENTER_3.x - 9.6,
      by = gh + 5.4;
    const br = mesh(new THREE.CylinderGeometry(0.08, 0.16, 4.8, 5), material(0x6e4a30));
    br.rotation.z = Math.PI / 2 + 0.12;
    br.position.set((tx + bx) / 2, by + 0.2, tz);
    scene.add(br);
    FLW.x = bx;
    FLW.z = tz;
    FLW.y = by + 0.1;
    FLW.tx = tx;
  }
  flowerMesh = makeFlower();
  flowerMesh.position.set(FLW.x, FLW.y, FLW.z);
  scene.add(flowerMesh);

  /* giant mushroom: only a Boing-Boing jump reaches the top */
  {
    const gh = terrainHeight(MUSH.x, MUSH.z),
      H = 3.1;
    const st = mesh(new THREE.CylinderGeometry(0.75, 1, H, 10), material(0xfff3df), {
      receiveShadow: true,
    });
    st.position.set(MUSH.x, gh + H / 2, MUSH.z);
    scene.add(st);
    const cap = mesh(
      new THREE.SphereGeometry(2.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      material(0xf2545b),
      { receiveShadow: true },
    );
    cap.scale.y = 0.55;
    cap.position.set(MUSH.x, gh + H - 0.1, MUSH.z);
    scene.add(cap);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.283,
        r = k ? 1.5 : 0;
      const sp = mesh(new THREE.SphereGeometry(0.26, 6, 5), material(0xffffff), {
        castShadow: false,
      });
      sp.scale.y = 0.4;
      sp.position.set(
        MUSH.x + Math.cos(a) * r,
        gh + H - 0.1 + (k ? 1.0 : 1.3),
        MUSH.z + Math.sin(a) * r,
      );
      scene.add(sp);
    }
    addCylinder(MUSH.x, MUSH.z, { r: 1, bottom: gh - 1, top: gh + H });
    addCylinder(MUSH.x, MUSH.z, { r: 2.3, bottom: gh + H - 0.3, top: gh + H + 1.2 });
    MUSH.top = gh + H + 1.2;
  }

  /* forest dressing, kept off the paths and puzzles */
  function okForest(x, z) {
    const lx = x - CENTER_3.x,
      lz = z - CENTER_3.z;
    if (Math.hypot(lx, lz) > 19 || streamDist(x, z) < 3.2) return false;
    for (const t of [T1, T2, T3, T4]) if (Math.hypot(x - t.x, z - t.z) < 5) return false;
    if (
      Math.hypot(x - POOL3.x, z - POOL3.z) < 6 ||
      Math.hypot(x - GATE.x, z - GATE.z) < 6 ||
      Math.hypot(x - MUSH.x, z - MUSH.z) < 4 ||
      Math.hypot(x - FLW.tx, z - FLW.z) < 3
    )
      return false;
    for (const b of Object.values(BUSH3)) if (Math.hypot(x - b.x, z - b.z) < 3.5) return false;
    return !(Math.abs(lx) < 4 && lz > 9);
  }
  for (let i = 0, n = 0; i < 300 && n < (LOW_POWER ? 16 : 28); i++) {
    const a = rand() * 6.28,
      r = 3 + rand() * 16,
      x = CENTER_3.x + Math.cos(a) * r,
      z = CENTER_3.z + Math.sin(a) * r;
    if (!okForest(x, z)) continue;
    n++;
    forestTree(x, z);
  }
  for (let i = 0, n = 0; i < 200 && n < 24; i++) {
    const a = rand() * 6.28,
      r = 2 + rand() * 18,
      x = CENTER_3.x + Math.cos(a) * r,
      z = CENTER_3.z + Math.sin(a) * r;
    if (!okForest(x, z)) continue;
    n++;
    const gh = terrainHeight(x, z);
    const st = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 5), material(0xfff3df), {
      castShadow: false,
    });
    st.position.set(x, gh + 0.15, z);
    scene.add(st);
    const cp = mesh(
      new THREE.SphereGeometry(0.2, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      material(n % 3 ? 0xf2545b : 0xffa53d),
      { castShadow: false },
    );
    cp.position.set(x, gh + 0.28, z);
    scene.add(cp);
  }
  scatter(CENTER_3.x, CENTER_3.z, { radius: 18, allowed: okForest, bushes: 10, flowers: 70 });

  // golden acorns
  addPickup(T1.x - 1.5, T1.z + 0.4, { y: T1.top, island: 3 });
  addPickup(T4.x, T4.z, { y: T4.top, island: 3 });
  addPickup(MUSH.x, MUSH.z, { y: MUSH.top, island: 3 });
  {
    const w = W3(-16, 9);
    addDig(w.x, w.z, {
      reward: (d) => {
        addPickup(d.x, d.z, { y: d.y, island: 3, pop: 0.6 });
        toast('A buried golden acorn!', 1800);
      },
    });
  }
  wasabi.g.position.set(POOL3.x, 0.5, POOL3.z);
  wasabi.g.rotation.y = 0.6;
  onFontsReady(() => {
    thirsty = textSprite('Thirsty…', '#7fd8ee');
    thirsty.scale.set(3.2, 0.8, 1);
    thirsty.material.depthTest = true;
    thirsty.visible = false;
    scene.add(thirsty);
  });
}
function buildLate() {
  for (const [t, w] of Object.entries(BUSH3))
    addFruit(w.x, w.z, { type: t, y: terrainHeight(w.x, w.z), bush: true });
}

function giveFlower() {
  useUpCarried();
  sfx.buzz();
  HIVE.excite = 1.5;
  burst(vec3(HIVE.x, HIVE.y + 1.2, HIVE.z), {
    count: 24,
    color: [0xffd84d, 0xffffff, 0xff9fb2],
    speed: 4,
    up: 3,
    life: 1,
    size: 1,
  });
  setTimeout(() => {
    const k = addItem('key3', {
      model: makeKey(),
      pos: vec3(HIVE.x, HIVE.y + 0.6, HIVE.z),
      name: 'key',
    });
    if (!player.carry && game.state === 'play') carryItem(k); // if busy, the key just waits on the hive
    toast('Bzz bzz! The bees give Spartacus their shiny key!', 3400);
    completeTask('trade');
  }, 700);
}
function openGate() {
  useUpCarried();
  GATE.open = 0.001;
  GATE.col.top = -99;
  scene.remove(GATE.lock);
  sfx.creak();
  burst(vec3(GATE.x, GATE.y + 1.2, GATE.z + 0.5), {
    count: 24,
    color: [0xffd84d, 0x7fd8ee, 0xffffff],
    speed: 4,
    up: 3,
    life: 1,
    size: 1,
  });
  toast('The gate is open! Here comes the water!', 3000);
  completeTask('gate');
}

// Wasabi's part of the story: stuck -> happy (spring refilled) -> swim down the stream -> crew
function updWasabi3(dt) {
  const w = wasabi,
    g = w.g,
    T = game.T;
  if (thirsty) thirsty.visible = w.state === 'stuck';
  if (w.state === 'stuck') {
    g.rotation.y = 0.6 + Math.sin(T * 0.8) * 0.4;
    g.position.y = 0.5;
    if (thirsty) thirsty.position.set(g.position.x, 1.9 + Math.sin(T * 2) * 0.1, g.position.z);
    if (flowK > 0.75) {
      w.state = 'happy';
      w.t = 0;
      sfx.splashy();
      toast('Splash! Wasabi’s spring is full again!', 3000);
    }
  } else if (w.state === 'happy') {
    g.position.y = poolWater.position.y - 0.05 + Math.abs(Math.sin(w.t * 5)) * 0.7;
    g.rotation.y += dt * 4;
    if (Math.random() < dt * 6)
      burst(vec3(g.position.x, poolWater.position.y, g.position.z), {
        count: 3,
        color: [0xffffff, 0x7fd8ee],
        speed: 2,
        up: 3,
        life: 0.5,
        size: 0.8,
      });
    if (w.t > 2.4) {
      w.state = 'swim';
      w.t = 0;
      ship.updateMatrixWorld(true);
      const end = ship.localToWorld(vec3(0.65, 1.6, 1.4));
      w.path = new THREE.CatmullRomCurve3([
        vec3(g.position.x, 0.8, g.position.z),
        vec3(STREAM[2].x, 0.8, STREAM[2].z),
        vec3(STREAM[3].x, 0.8, STREAM[3].z),
        vec3(STREAM[4].x, 0.15, STREAM[4].z),
        vec3(ship.position.x - 2.5, 0.1, ship.position.z),
        end,
      ]);
      toast('Wasabi is swimming down the stream to the ship!', 3200);
    }
  } else if (w.state === 'swim') {
    const u = Math.min(1, w.t / 9),
      pt = w.path.getPointAt(u),
      tg = w.path.getTangentAt(u);
    g.position.copy(pt);
    g.position.y += Math.sin(T * 6) * 0.05;
    g.rotation.y = Math.atan2(tg.x, tg.z);
    if (Math.random() < dt * 5)
      burst(vec3(pt.x, pt.y + 0.1, pt.z), {
        count: 1,
        color: 0xffffff,
        speed: 1,
        up: 1,
        life: 0.5,
        size: 0.6,
      });
    if (u >= 1) {
      scene.remove(g);
      ship.add(g);
      g.position.set(0.65, 1.55, 1.4);
      g.rotation.set(0, 0, 0);
      g.scale.setScalar(0.75);
      w.state = 'crew';
      sfx.splashy();
      burst(ship.localToWorld(vec3(0.65, 2, 1.4)), {
        count: 24,
        color: [0x6fb6ff, 0xb59cff, 0xffffff],
        speed: 4,
        up: 3,
        life: 1,
        size: 1,
      });
      toast('Wasabi hopped into the bucket on the ship!', 3000);
      completeTask('wasabi');
    }
  }
}

const I = {
  id: 3,
  center: CENTER_3,
  name: 'Mossy Paw Woods',
  zMax: -245,
  height,
  tasks: {
    title: 'Mossy Paw Woods',
    list: [
      { id: 'grow', ic: '🌱', t: () => 'Eat a Grow-Grow fruit', power: 'grow' },
      { id: 'acorns', ic: '🌰', t: () => pickupText(3, 'golden acorns') },
      { id: 'flower', ic: '🌼', t: () => 'Get a flower for the bees' },
      { id: 'trade', ic: '🐝', t: () => 'Trade it for the bees’ key' },
      { id: 'gate', ic: '🚪', t: () => 'Open the water gate' },
      { id: 'wasabi', ic: '💧', t: () => 'Bring Wasabi to the ship' },
    ],
  },
  collect: {
    total: 4,
    count: 0,
    taskId: 'acorns',
    name: 'Golden acorn',
    all: 'All the golden acorns! Good boy, Spartacus!',
    model: makeAcorn,
  },
  intro: [[3400, 'Wasabi the axolotl’s spring has dried up!', 3400]],
  win: {
    title: 'Wasabi is home!',
    text: 'The spring is full again and Wasabi the axolotl joined the crew. Wasabi has a bubbly idea for the next adventure…',
    tip: 'You can also dive later from the end of the dock.',
    go: 'Dive in! 🫧',
  },
  exit: {
    label: 'Dive',
    at: (p) => p.z > CENTER_3.z + 27 && Math.abs(p.x - CENTER_3.x) < 1.6 && p.y > 0.5,
    run: () => startBubble(() => enterIsland(4, true)),
  },
  build,
  buildLate,
  enter() {
    ensureMangoCrew();
    addBucket();
  },
  update(dt) {
    const T = game.T;
    HIVE.excite = Math.max(0, HIVE.excite - dt);
    HIVE.bees.forEach((b) => {
      const a = T * (2 + HIVE.excite) + b.ph,
        r = b.r * (1 + HIVE.excite * 0.4);
      b.b.position.set(
        HIVE.x + Math.cos(a) * r,
        HIVE.y + b.h + Math.sin(T * 5 + b.ph) * 0.12,
        HIVE.z + Math.sin(a) * r,
      );
      b.b.rotation.y = -a;
    });
    if (GATE.open > 0 && GATE.open < 1) {
      GATE.open = Math.min(1, GATE.open + dt / 1.1);
      GATE.doors.forEach((d) => (d.rotation.y = d.userData.s * -1.6 * GATE.open));
    }
    if (GATE.open > 0 && flowK < 1) {
      flowK = Math.min(1, flowK + dt / 4);
      flowGeo.setDrawRange(0, Math.floor((flowGeo.index.count * flowK) / 3) * 3);
      const pk = clamp((flowK - 0.25) / 0.5, 0, 1);
      poolWater.scale.setScalar(lerp(0.28, 1, pk));
      poolWater.position.y = lerp(0.52, 0.82, pk);
      if (Math.random() < dt * 10) {
        const pt = flowCurve.getPointAt(flowK);
        burst(vec3(pt.x, 0.85, pt.z), {
          count: 2,
          color: [0xffffff, 0xbff3ff],
          speed: 2,
          up: 2,
          life: 0.5,
          size: 0.8,
        });
      }
    }
    updWasabi3(dt);
  },
  interact(p) {
    if (wasabi.state === 'stuck' && distXZ(p, POOL3.x, POOL3.z) < 6)
      hintOnce('pool', 'Wasabi’s spring has dried up! The water gate upstream is locked.', 3800);
    if (
      !I.done.gate &&
      distXZ(p, GATE.fx, GATE.fz) < 3.5 &&
      !(player.carry && player.carry.id === 'key3')
    )
      hintOnce('gate', 'The water gate is locked. Who has the key?', 3200);
    if (player.power !== 'grow' && !t1vine.grown && distXZ(p, t1vine.x, t1vine.z) < 3)
      hintOnce('seed', 'A magic seed! A Grow-Grow fruit could wake it up.', 3400);
    if (t1vine.grown && player.grounded && distXZ(p, T1.x, T1.z) < 3.5 && p.y < T1.gh + 1)
      hintOnce('climb', 'Walk into the vine to climb it!', 3000);
    for (const t of [T2, T3, T4])
      if (player.grounded && p.y < t.gh + 1 && distXZ(p, t.x, t.z) < 2.6)
        hintOnce('smooth', 'This bark is too smooth to climb. Try going tree to tree!', 3400);
    if (
      !I.done.trade &&
      distXZ(p, HIVE.x, HIVE.z) < 4 &&
      Math.abs(p.y - HIVE.y) < 2 &&
      !(player.carry && player.carry.id === 'flower')
    )
      hintOnce('bees', 'Bees: “Bzz! Bring us a flower and the shiny key is yours!”', 4000);
    if (!flowerCalled && distXZ(p, FLW.x, FLW.z) < 5.5)
      hintOnce('flower', 'That flower is too high… Bark to call Mango!', 3600);
    hintTooHigh(distXZ(p, MUSH.x, MUSH.z) < 4, 'Too high! A Boing-Boing jump could reach it.');
  },
  actions(p) {
    const it = player.carry;
    if (
      it &&
      it.id === 'flower' &&
      !I.done.trade &&
      distXZ(p, HIVE.x, HIVE.z) < 2.8 &&
      Math.abs(p.y - HIVE.y) < 1.5
    )
      return { label: 'Give', fn: giveFlower };
    if (
      it &&
      it.id === 'key3' &&
      !I.done.gate &&
      distXZ(p, GATE.fx, GATE.fz) < 2.8 &&
      Math.abs(p.y - GATE.y) < 1.5
    )
      return { label: 'Open', fn: openGate };
    return vineAction(p);
  },
  bark(p) {
    if (mango.state === 'crew' && !flowerCalled && distXZ(p, FLW.x, FLW.z) < 5.5) {
      flowerCalled = true;
      toast('Mango heard you! Here he comes…', 2400);
      mangoFetch(FLW, flowerMesh, (pos) => {
        addItem('flower', {
          model: flowerMesh,
          pos: vec3(pos.x, pos.y + 0.05, pos.z),
          name: 'flower',
          lift: 0.05,
        });
        toast(`Mango dropped the flower! Grab it with ${actionKeyName()}.`, 3200);
        completeTask('flower');
      });
    }
  },
};
export default I;
