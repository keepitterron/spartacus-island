import * as THREE from 'three';
import {
  lerpAngle,
  distXZ,
  lerp,
  smoothstep,
  rand,
  distToSegmentXZ,
  vec3,
} from '../../core/util.js';
import { scene, LOW_POWER } from '../../core/renderer.js';
import { material, mesh } from '../../core/materials.js';
import { game, followCam, isPlaying } from '../../core/state.js';
import { sfx } from '../../core/audio.js';
import { burst } from '../../core/fx.js';
import { toast, hintOnce } from '../../core/ui.js';
import { addCylinder } from '../../core/colliders.js';
import { terrainHeight, buildGround } from '../../world/terrain.js';
import { CENTER_4 } from '../../world/layout.js';
import { rock } from '../../world/props.js';
import { ship, shipBubble, shipState } from '../../world/ship.js';
import { makePillow } from '../../models/items.js';
import { player } from '../../player/player.js';
import { addItem } from '../../systems/items.js';
import { addFruit } from '../../systems/powers.js';
import { climbVine, vineAction, growers } from '../../systems/vines.js';
import { addChoppable, chopAction } from '../../systems/hat.js';
import { ensureMangoCrew } from '../../npcs/mango.js';
import { wasabiFollow } from '../../npcs/wasabi.js';
import { completeTask } from '../../game/tasks.js';
import { hintTooHigh } from '../../game/interact.js';
import { SB, W4, LA, LU, LN, LLEN, lanePt, OCTO, CA, CB, CU, CLEN, canPt } from './geo.js';
import { octo, buildOcto, updateOcto, wakeOcto, givePillow } from './octopus.js';
import {
  CRABS_TOTAL,
  crabCount,
  addCrab,
  updateCrabs,
  barkCrabs,
  touchCrabs,
  crabNear,
  crabsParty,
} from './crabs.js';
import { eduardo, buildEduardo, updateEduardo, eek, eduardoToShip } from './eduardo.js';
import { buildWhale, startWhale } from './whale.js';

/* ============ Island 4: Bubbly Ocean (underwater) ============
   Wasabi's bubble lets Spartacus breathe. Chop-Chop fruit: throw the hat to cut seaweed.
   Find 5 red hermit crabs, chase Eduardo through the seaweed lane past the tentacle gates,
   fetch the octopus's pillow through the bubble vent canyon so he goes back to sleep,
   bring Eduardo to the ship. A whale pushes the ship back to the surface. */

function height(x, z) {
  const r = Math.hypot(x - CENTER_4.x, z - CENTER_4.z);
  return (
    SB +
    0.4 * Math.sin(x * 0.3) * Math.cos(z * 0.25) +
    0.25 * Math.sin(x * 0.7 + z * 0.5) +
    smoothstep(28, 40, r) * 16
  );
}

let ceilGeo, breath, KP;
const rays = [],
  sway = [],
  gates = [],
  vents = [];
let LEDGE, SHELF;
const BUSH4 = { chop: W4(4, 9), grow: W4(-6, 7), boing: W4(9, 8) };
const SHIP4 = W4(-10, 17);

// seaweed: light clumps can be chopped, dark thick kelp can't.
// Thick walls look short but have a tall invisible collider (colH) so the camera can see over them.
function seaweed(x, z, o = {}) {
  const gh = terrainHeight(x, z),
    g = new THREE.Group();
  g.position.set(x, gh, z);
  const thick = !!o.thick,
    H = o.h || (thick ? 7 : 3.2),
    n = thick ? 4 : 6,
    R0 = o.r || 1;
  const m = material(thick ? 0x2f7f4f : 0xb8d84a),
    m2 = material(thick ? 0x3a9a5a : 0x9ccf3a);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 6.283 + rand(),
      r = rand() * R0 * 0.6,
      h = H * (0.75 + rand() * 0.35);
    const geo = new THREE.BoxGeometry(thick ? 0.5 : 0.24, h, 0.06);
    geo.translate(0, h / 2, 0);
    const st = mesh(geo, k % 2 ? m : m2);
    st.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    st.rotation.y = rand() * 3;
    g.add(st);
  }
  scene.add(g);
  const col = addCylinder(x, z, R0, gh - 1, gh + (o.colH || H));
  const c = { g, x, z, y: gh, col, forest: !!o.forest, crab: null, ph: rand() * 6, cutT: 0 };
  if (!thick) addChoppable(Object.assign(c, { onChop: onChopClump }));
  sway.push(c);
  return c;
}
function onChopClump(c) {
  c.cutT = 0.001;
  c.col.top = -999;
  if (c.forest) wakeOcto(I.done.sleep);
  if (c.crab) {
    c.crab.state = 'hidden';
    c.crab.g.visible = true;
  }
  if (c.edInside && eduardo.state === 'inClump') {
    c.edInside = false;
    eduardo.g.visible = true;
    eek();
  }
}

function vent(x, z, kind, off, dir) {
  const gh = terrainHeight(x, z),
    lift = kind === 'lift';
  const ring = mesh(
    new THREE.TorusGeometry(lift ? 0.9 : 1.3, 0.25, 6, 16),
    material(0x6f7f94),
    true,
    true,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, gh + 0.15, z);
  scene.add(ring);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(lift ? 0.85 : 1.25, 14), material(0x2b3a55));
  hole.rotation.x = -Math.PI / 2;
  hole.position.set(x, gh + 0.05, z);
  scene.add(hole);
  vents.push({
    x,
    z,
    y: gh,
    kind,
    off,
    dir,
    r: lift ? 1.2 : 2.4,
    on: false,
    period: lift ? 3.6 : 3.0,
    onDur: lift ? 1.6 : 1.5,
  });
}

// a rock pillar you climb with a Grow-Grow kelp ladder (works like a tree, see systems/vines)
function pillar(lx, lz, h) {
  const { x, z } = W4(lx, lz),
    gh = terrainHeight(x, z),
    top = gh + h;
  const m = mesh(new THREE.CylinderGeometry(1.1, 1.35, h, 8), material(0x8fa0b4), true, true);
  m.position.set(x, gh + h / 2, z);
  scene.add(m);
  const cap = mesh(new THREE.CylinderGeometry(2.2, 1.6, 0.5, 10), material(0x9fb3c6), true, true);
  cap.position.set(x, top - 0.25, z);
  scene.add(cap);
  const t = { x, z, gh, top, grown: false };
  t.col = addCylinder(x, z, 1.2, gh - 1, top - 0.6);
  t.col.tree = t;
  addCylinder(x, z, 2.2, top - 0.6, top);
  return t;
}

function bonk(g) {
  player.pos.set(g.cp.x, terrainHeight(g.cp.x, g.cp.z), g.cp.z);
  player.vel.set(0, 0, 0);
  player.sqv = -6;
  sfx.boing();
  octo.hmphT = 1.2;
  burst(player.pos.clone().add(vec3(0, 1, 0)), 10, [0xff7a59, 0xffffff], 3, 2, 0.5, 0.8, -0.05);
  hintOnce('bonk', 'Bonk! Wait for the tentacle to lift up, then run under.', 3200);
}

function build() {
  buildGround(CENTER_4.x, CENTER_4.z, 92, LOW_POWER ? 90 : 150, { seabed: SB });
  I.spawn = vec3(CENTER_4.x, 0, CENTER_4.z + 10);
  I.spawn.y = terrainHeight(I.spawn.x, I.spawn.z);
  // the water surface seen from below, and sun rays
  ceilGeo = new THREE.PlaneGeometry(200, 200, LOW_POWER ? 16 : 28, LOW_POWER ? 16 : 28);
  ceilGeo.rotateX(-Math.PI / 2);
  ceilGeo.translate(CENTER_4.x, 0, CENTER_4.z);
  scene.add(
    new THREE.Mesh(
      ceilGeo,
      new THREE.MeshStandardMaterial({
        color: 0x8fe3f5,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        flatShading: true,
        roughness: 0.3,
      }),
    ),
  );
  for (let i = 0; i < 7; i++) {
    const r = new THREE.Mesh(
      new THREE.ConeGeometry(2.5 + rand() * 2, 26, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const w = W4(-22 + rand() * 44, -22 + rand() * 40);
    r.position.set(w.x, -11, w.z);
    r.rotation.z = 0.15;
    scene.add(r);
    rays.push({ m: r, ph: rand() * 6 });
  }

  /* the seaweed lane, guarded by the octopus's tentacles */
  for (let s0 = -0.5; s0 <= LLEN + 0.8; s0 += 1.7)
    for (const o of [-2.7, 2.7]) {
      const q = lanePt(s0, o);
      seaweed(q.x, q.z, { thick: true, r: 1.1, h: 4, colH: 9 });
    }
  OCTO.y = terrainHeight(OCTO.x, OCTO.z);
  {
    const a0 = Math.atan2(-LU.z, -LU.x);
    for (let k = 0; k < 12; k++) {
      const a = a0 + ((45 + k * 24.5) * Math.PI) / 180;
      seaweed(OCTO.x + Math.cos(a) * 3.6, OCTO.z + Math.sin(a) * 3.6, {
        thick: true,
        r: 1.1,
        h: 4,
        colH: 9,
      });
    }
  }
  for (const o of [-1.3, 0, 1.3]) {
    const q = lanePt(0.6, o);
    seaweed(q.x, q.z, { forest: true, r: 1 });
  }
  // Eduardo runs away and dives into these clumps; the middle one of each row hides him
  const hides = [10, 16.5].map((s0) => {
    let mid = null;
    for (const o of [-1.1, 0, 1.1]) {
      const q = lanePt(s0, o);
      const c = seaweed(q.x, q.z, { forest: true, r: 0.95, h: 3.4 });
      if (o === 0) mid = c;
    }
    return mid;
  });
  // tentacle gates: an arch of segments that lifts and drops; cp = where a bonk puts you back
  [6.5, 13.5, 20].forEach((s0, i) => {
    const c = lanePt(s0, 0),
      gy = terrainHeight(c.x, c.z),
      segs = [];
    for (let k = 0; k < 12; k++) {
      const m = mesh(
        new THREE.SphereGeometry(0.5 - k * 0.03, 8, 6),
        material(k % 2 ? 0xff7a59 : 0xff8f6e),
      );
      scene.add(m);
      segs.push(m);
    }
    gates.push({ s: s0, c, gy, segs, off: i * 1.7, cp: lanePt(s0 - 2.4, 0), danger: false });
  });
  buildOcto();

  /* bubble vent canyon with the pillow at the far end */
  for (let s0 = 0; s0 <= CLEN + 1; s0 += 1.5)
    for (const o of [-2.9, 2.9]) {
      const q = canPt(s0, o);
      rock(q.x, q.z, 1.15, 6.2 + rand() * 1.5, 0x8fa0b4);
    }
  for (const o of [-1.5, 0, 1.5]) {
    const q = canPt(CLEN + 2, o);
    rock(q.x, q.z, 1.1, 6.5, 0x8fa0b4);
  }
  [0.3, 0.55, 0.8].forEach((f, i) => {
    const q = canPt(CLEN * f, 0);
    vent(q.x, q.z, 'push', i * 1.0, vec3(-CU.x, 0, -CU.z));
  });
  {
    const q = canPt(CLEN, 0);
    const top = rock(q.x, q.z, 0.85, 0.7, 0x9fb3c6);
    addItem('pillow', makePillow(), vec3(q.x, top + 0.2, q.z), false, {
      name: 'pillow',
      lift: 0.2,
      onCarry: () => {
        if (!I.done.pillowFound) {
          toast('A soft pink pillow! Whose could it be?', 3000);
          completeTask('pillowFound');
        }
      },
    });
  }
  // lift vent next to a high ledge
  {
    const v = W4(9, -1);
    vent(v.x, v.z, 'lift', 0.4);
  }
  LEDGE = W4(10.9, 0.4);
  LEDGE.top = rock(LEDGE.x, LEDGE.z, 1.3, 6.3, 0x9fb3c6);
  // Boing-Boing shelf
  SHELF = W4(16, 8);
  SHELF.top = rock(SHELF.x, SHELF.z, 1.6, 4.6, 0xc9b48a);
  // kelp pillar: grow a kelp ladder with Grow-Grow
  KP = pillar(-15, 4, 6.5);
  climbVine(KP, I.spawn.x, I.spawn.z);

  /* hermit crabs: on the sand, on top of the pillar, shelf and ledge, and inside a clump */
  {
    const w = W4(-3, 6);
    addCrab(w.x, w.z, terrainHeight(w.x, w.z));
  }
  addCrab(KP.x + 1.2, KP.z, KP.top);
  addCrab(SHELF.x, SHELF.z, SHELF.top);
  addCrab(LEDGE.x, LEDGE.z, LEDGE.top);
  {
    const w = W4(-8, 11);
    const cl = seaweed(w.x, w.z, { r: 1.1 });
    addCrab(w.x, w.z, terrainHeight(w.x, w.z), cl);
  }
  buildEduardo(hides);
  buildWhale();

  /* sea floor dressing, kept off the paths */
  function okSea(x, z) {
    if (Math.hypot(x - CENTER_4.x, z - CENTER_4.z) > 27) return false;
    if (
      distToSegmentXZ(x, z, lanePt(-1, 0), OCTO) < 4.6 ||
      distToSegmentXZ(x, z, CA, CB) < 4.4 ||
      Math.hypot(x - SHIP4.x, z - SHIP4.z) < 6 ||
      Math.hypot(x - I.spawn.x, z - I.spawn.z) < 3
    )
      return false;
    for (const q of [...Object.values(BUSH4), KP, LEDGE, SHELF, W4(9, -1), W4(-3, 6), W4(-8, 11)])
      if (Math.hypot(x - q.x, z - q.z) < 3) return false;
    return true;
  }
  const cCols = [0xff8fb1, 0xffa53d, 0xb59cff, 0x5fd3c8, 0xff6b8a];
  for (let i = 0, n = 0; i < 300 && n < (LOW_POWER ? 18 : 32); i++) {
    const a = rand() * 6.28,
      r = 3 + rand() * 24,
      x = CENTER_4.x + Math.cos(a) * r,
      z = CENTER_4.z + Math.sin(a) * r;
    if (!okSea(x, z)) continue;
    n++;
    const gh = terrainHeight(x, z),
      g = new THREE.Group(),
      col = cCols[n % cCols.length];
    g.position.set(x, gh, z);
    if (n % 4 === 0) {
      const b = mesh(
        new THREE.IcosahedronGeometry(0.6 + rand() * 0.4, 1),
        material(col),
        true,
        true,
      );
      b.scale.y = 0.7;
      b.position.y = 0.3;
      g.add(b);
    } else
      for (let k = 0; k < 4; k++) {
        const h = 0.6 + rand() * 1.3,
          bx = (rand() - 0.5) * 0.6,
          bz = (rand() - 0.5) * 0.6;
        const br = mesh(new THREE.CylinderGeometry(0.07, 0.13, h, 5), material(col));
        br.position.set(bx, h / 2, bz);
        br.rotation.set((rand() - 0.5) * 0.7, 0, (rand() - 0.5) * 0.7);
        g.add(br);
        const tip = mesh(new THREE.SphereGeometry(0.13, 6, 5), material(col));
        tip.position.set(bx * 1.6, h, bz * 1.6);
        g.add(tip);
      }
    scene.add(g);
  }
  for (let i = 0, n = 0; i < 200 && n < 12; i++) {
    const a = rand() * 6.28,
      r = 3 + rand() * 24,
      x = CENTER_4.x + Math.cos(a) * r,
      z = CENTER_4.z + Math.sin(a) * r;
    if (!okSea(x, z)) continue;
    n++;
    const g = new THREE.Group();
    g.position.set(x, terrainHeight(x, z) + 0.05, z);
    g.rotation.y = rand() * 6;
    for (let k = 0; k < 5; k++) {
      const arm = mesh(
        new THREE.ConeGeometry(0.12, 0.5, 4),
        material(n % 2 ? 0xffa53d : 0xff6b8a),
        false,
      );
      arm.rotation.z = -Math.PI / 2;
      arm.position.x = 0.25;
      const pv = new THREE.Group();
      pv.rotation.y = k * 1.2566;
      pv.add(arm);
      g.add(pv);
    }
    scene.add(g);
  }
  for (let i = 0, n = 0; i < 200 && n < 8; i++) {
    const a = rand() * 6.28,
      r = 6 + rand() * 20,
      x = CENTER_4.x + Math.cos(a) * r,
      z = CENTER_4.z + Math.sin(a) * r;
    if (!okSea(x, z)) continue;
    n++;
    seaweed(x, z, { thick: true, h: 4 + rand() * 3, r: 0.6 });
  }

  // Wasabi's breathing bubble around Spartacus
  breath = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 20, 14),
    new THREE.MeshStandardMaterial({
      color: 0xbff3ff,
      transparent: true,
      opacity: 0.16,
      roughness: 0.1,
      metalness: 0.2,
      depthWrite: false,
    }),
  );
  breath.visible = false;
  scene.add(breath);
}
function buildLate() {
  for (const [t, w] of Object.entries(BUSH4)) addFruit(t, w.x, w.z, terrainHeight(w.x, w.z), true);
}

// the ship rests on the sea floor inside its bubble
function placeShip() {
  ship.position.set(SHIP4.x, 0, SHIP4.z);
  ship.rotation.set(0, Math.PI * 0.9, 0);
  shipState.baseY = terrainHeight(SHIP4.x, SHIP4.z) + 0.75;
  shipState.depth = 0;
  shipBubble.visible = true;
  shipBubble.scale.setScalar(1);
  ship.updateMatrixWorld(true);
}

function update(dt) {
  const T = game.T;
  const cp = ceilGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i),
      z = cp.getZ(i);
    cp.setY(i, 0.15 * Math.sin(x * 0.25 + T * 1.2) + 0.12 * Math.cos(z * 0.3 + T));
  }
  cp.needsUpdate = true;
  ceilGeo.computeVertexNormals();
  for (const r of rays) {
    r.m.rotation.z = 0.15 + Math.sin(T * 0.3 + r.ph) * 0.08;
    r.m.material.opacity = 0.05 + 0.03 * Math.sin(T * 0.7 + r.ph);
  }
  for (const c of sway) {
    c.g.rotation.z = Math.sin(T * 1.1 + c.ph) * 0.08;
    c.g.rotation.x = Math.cos(T * 0.9 + c.ph) * 0.06;
    if (c.cutT > 0 && c.cutT < 1) {
      c.cutT = Math.min(1, c.cutT + dt * 2.5);
      c.g.scale.y = lerp(1, 0.12, c.cutT);
    }
  }
  // vents bubble on a timer; a few small bubbles warn just before they start
  for (const v of vents) {
    const t = (T + v.off) % v.period;
    v.on = t < v.onDur;
    const warn = !v.on && t > v.period - 0.7;
    if (v.on && Math.random() < dt * (v.kind === 'lift' ? 30 : 40))
      burst(
        vec3(v.x + (Math.random() - 0.5) * v.r, v.y + 0.3, v.z + (Math.random() - 0.5) * v.r),
        1,
        [0xffffff, 0xdff9ff],
        1,
        v.kind === 'lift' ? 9 : 7,
        1,
        1.3,
        -0.25,
      );
    if (warn && Math.random() < dt * 10)
      burst(vec3(v.x, v.y + 0.2, v.z), 1, 0xffffff, 0.6, 2, 0.6, 0.6, -0.1);
  }
  // tentacles: while the octopus is awake they arch over the lane and drop (~60% of the time safe)
  const active = OCTO.awake && !I.done.sleep;
  for (const g of gates) {
    const lift = 0.5 + 0.5 * Math.cos((2 * Math.PI * (T + g.off)) / 3.4),
      arch = lerp(0.5, 4.8, lift);
    for (let k = 0; k < 12; k++) {
      const u = k / 11;
      let q, y;
      if (active) {
        q = lanePt(g.s + Math.sin(u * Math.PI) * 0.3 * Math.sin(T * 3 + k), 3.1 - 6.2 * u);
        y = g.gy + 0.35 + arch * Math.sin(u * Math.PI) + (u > 0.85 ? Math.sin(T * 8) * 0.2 : 0);
      } else {
        const a = u * 4;
        q = lanePt(g.s + Math.sin(a) * 0.6 * u, 3.4 + Math.cos(a) * 0.6 * u);
        y = g.gy + 0.4 + u * 0.4;
      }
      g.segs[k].position.set(q.x, y, q.z);
    }
    g.danger = active && arch < 1.95;
  }
  updateOcto(dt);
  updateCrabs(dt);
  updateEduardo(dt);
  breath.visible = game.state === 'play' || game.state === 'rescue';
  breath.position.copy(player.pos).add(vec3(0, 1.1, 0));
  breath.scale.setScalar(1 + Math.sin(T * 2.5) * 0.03);
  if (isPlaying() && Math.random() < dt * 3)
    burst(
      player.pos.clone().add(vec3((Math.random() - 0.5) * 6, 0.2, (Math.random() - 0.5) * 6)),
      1,
      0xdff9ff,
      0.5,
      2,
      2.5,
      0.8,
      -0.15,
    );
}

function interact(p) {
  touchCrabs(p);
  if (crabNear(p, 7))
    hintOnce(
      'crabnear',
      'See the bubbles? A hermit crab is hiding there! Walk up close or bark.',
      3800,
    );
  if (eduardo.state === 'idle0' && distXZ(p, eduardo.g.position.x, eduardo.g.position.z) < 5) eek();
  if (!OCTO.awake && !I.done.sleep && distToSegmentXZ(p.x, p.z, lanePt(-4, 0), lanePt(0.5, 0)) < 3)
    hintOnce('sleepy', 'Shh… a big octopus is snoring deep in the seaweed.', 3200);
  for (const v of vents)
    if (v.on && distXZ(p, v.x, v.z) < v.r && p.y < v.y + (v.kind === 'lift' ? 7 : 3.5)) {
      if (v.kind === 'lift') {
        player.vel.y = Math.max(player.vel.y, 9);
      } else {
        player.vel.x = v.dir.x * 11;
        player.vel.z = v.dir.z * 11;
        player.vel.y = Math.max(player.vel.y, 3);
      }
      player.grounded = false;
    }
  for (const g of gates)
    if (g.danger) {
      const dx = p.x - g.c.x,
        dz = p.z - g.c.z,
        al = dx * LU.x + dz * LU.z,
        acr = dx * LN.x + dz * LN.z;
      if (Math.abs(al) < 1 && Math.abs(acr) < 2.8 && p.y < g.gy + 2.4) {
        bonk(g);
        break;
      }
    }
  if (eduardo.state === 'riding' && distXZ(p, ship.position.x, ship.position.z) < 5.5) {
    eduardoToShip();
    toast('Eduardo hops aboard! The crabs are throwing a party!', 3200);
    crabsParty();
  }
  if (player.power !== 'chop' && sway.some((c) => !c.cut && c.onChop && distXZ(p, c.x, c.z) < 3))
    hintOnce('chopneed', 'Seaweed in the way! A Chop-Chop fruit could cut through it.', 3400);
  if (distToSegmentXZ(p.x, p.z, CA, canPt(3, 0)) < 2.5)
    hintOnce('vents', 'Bubble vents! Wait until they stop, then dash through.', 3400);
  if (distXZ(p, vents[3].x, vents[3].z) < 3)
    hintOnce('lift', 'This vent pushes UP! Stand on it when it bubbles.', 3200);
  if (OCTO.awake && distToSegmentXZ(p.x, p.z, LA, lanePt(4, 0)) < 2.5)
    hintOnce('tent', 'Grumpy tentacles! Run under them when they lift up.', 3400);
  if (
    OCTO.awake &&
    distXZ(p, OCTO.x, OCTO.z) < 5 &&
    !(player.carry && player.carry.id === 'pillow')
  )
    hintOnce('octo', 'Octopus: “Grumble… I can’t sleep without my pillow!”', 4000);
  hintTooHigh(distXZ(p, SHELF.x, SHELF.z) < 3.5, 'Too high! A Boing-Boing jump could reach it.');
  const kg = growers.find((g) => g.t === KP);
  if (kg && !kg.grown && player.power !== 'grow' && distXZ(p, kg.x, kg.z) < 3)
    hintOnce('seed4', 'A magic seed! Grow-Grow could make a kelp ladder.', 3400);
}

const I = {
  id: 4,
  center: CENTER_4,
  name: 'Bubbly Ocean',
  zMax: -600,
  height,
  underwater: true,
  physics: {
    gravity: 16,
    maxFall: 9,
    speed: 0.85,
    jump: 0.72,
    water: false,
    bound: { x: CENTER_4.x, z: CENTER_4.z, r: 30 },
  },
  camera: {
    // stay below the surface and above the sand
    minY: (c) => Math.min(-1.5, terrainHeight(c.x, c.z) + 0.8),
    maxY: -1.2,
    // in the seaweed lane, gently turn to look down it (the walls would hide the dog)
    assist(dt) {
      if (distToSegmentXZ(player.pos.x, player.pos.z, LA, OCTO) < 2.6)
        followCam.yaw = lerpAngle(followCam.yaw, Math.atan2(-LU.x, -LU.z), Math.min(1, dt * 1.5));
    },
  },
  tasks: {
    title: 'Bubbly Ocean',
    list: [
      { id: 'chop', ic: '✂️', t: () => 'Eat a Chop-Chop fruit', power: 'chop' },
      {
        id: 'crabs',
        ic: '🦀',
        t: () => `Find ${CRABS_TOTAL} red hermit crabs (${crabCount()}/${CRABS_TOTAL})`,
      },
      { id: 'eduardo', ic: '💜', t: () => 'Find Eduardo in the seaweed' },
      { id: 'pillowFound', ic: '🛏️', t: () => 'Find the octopus’s pillow' },
      { id: 'sleep', ic: '😴', t: () => 'Help the grumpy octopus sleep' },
      { id: 'ship4', ic: '⛵', t: () => 'Bring Eduardo to the ship' },
    ],
  },
  intro: [
    [3400, 'The red hermit crabs lost their friend Eduardo!', 3400],
    [7200, 'Mango: “I’ll guard the ship!” Wasabi’s bubble lets Spartacus breathe.', 3800],
    [11400, 'Tip: hidden hermit crabs blow bubbles. Follow the bubbles!', 3800],
  ],
  win: {
    title: 'Eduardo is safe!',
    text: 'Eduardo joined the crew, the octopus is snoring and the red hermit crabs are having a party. Here comes a big friendly whale…',
    tip: 'You can also ride the whale later from the ship.',
    go: 'Ride the whale! 🐋',
  },
  exit: {
    label: 'Ride',
    at: (p) => distXZ(p, ship.position.x, ship.position.z) < 5,
    run: startWhale,
  },
  build,
  buildLate,
  enter() {
    placeShip();
    ensureMangoCrew();
    wasabiFollow();
  },
  update,
  interact,
  actions(p) {
    if (
      player.carry &&
      player.carry.id === 'pillow' &&
      !I.done.sleep &&
      distXZ(p, OCTO.x, OCTO.z) < 4.4
    )
      return { label: 'Give', fn: givePillow };
    return vineAction(p) || chopAction(p);
  },
  bark: barkCrabs,
};
export default I;
