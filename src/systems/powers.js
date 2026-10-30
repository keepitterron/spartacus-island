import * as THREE from 'three';
import { $, flat } from '../core/util.js';
import { scene } from '../core/renderer.js';
import { mat, mesh, canvasTex } from '../core/materials.js';
import { G, cur, inCutscene } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { burst, textSprite, onFontsReady } from '../core/fx.js';
import { toast, actWord } from '../core/ui.js';
import { complete } from '../game/tasks.js';
import { P } from '../player/player.js';

// Fruits give powers. One power at a time: eating another fruit swaps it.
// Bushes regrow after a few seconds so swapping can be part of a puzzle.
//   col: [main, light, accent] colours used for sparkles; sign: bush label colour
const tex = {
  boing: canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#8a5cf6';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#c4adff';
    x.lineWidth = 7;
    x.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const cx = 20 + i * 44,
        cy = i % 2 ? 40 : 88;
      x.beginPath();
      for (let t = 0; t < 12; t += 0.2) {
        const r = t * 2.1;
        x.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
      }
      x.stroke();
    }
  }),
  stretch: canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#ff9a3d';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#ff6b8a';
    x.lineWidth = 9;
    x.lineJoin = 'round';
    for (let r = 0; r < 4; r++) {
      x.beginPath();
      for (let i = 0; i <= 16; i++) x.lineTo(i * 16, 18 + r * 30 + (i % 2 ? 12 : -4));
      x.stroke();
    }
  }),
  grow: canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#4cc05a';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#b6f08a';
    for (let i = 0; i < 14; i++) {
      const cx = (i * 37) % w,
        cy = (i * 53) % h;
      x.beginPath();
      x.ellipse(cx, cy, 14, 6, i, 0, 7);
      x.fill();
    }
  }),
  chop: canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#ffd84d';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#ff9a3d';
    for (let r = 0; r < 3; r++) {
      x.beginPath();
      x.moveTo(0, 20 + r * 40);
      for (let i = 0; i <= 16; i++) x.lineTo(i * 16, (i % 2 ? 8 : 26) + r * 40);
      x.lineTo(w, 34 + r * 40);
      x.lineTo(0, 34 + r * 40);
      x.fill();
    }
  }),
};
export const POWERS = {
  boing: {
    name: 'Boing-Boing',
    ic: '🌀',
    col: [0x8a5cf6, 0xc4adff, 0xffd84d],
    sign: '#c4adff',
    bush: 0x3f9f4a,
    intro: () => 'Boing-Boing fruit! Now Spartacus can jump super high.',
    ms: 3400,
  },
  stretch: {
    name: 'Stretchy',
    ic: '➰',
    col: [0xff9a3d, 0xff6b8a, 0xffd84d],
    sign: '#ffb36b',
    bush: 0x58a83a,
    intro: () => `Stretchy fruit! Swing from golden hooks with ${actWord()}.`,
    ms: 3600,
  },
  grow: {
    name: 'Grow-Grow',
    ic: '🌱',
    col: [0x4cc05a, 0xb6f08a, 0xffd84d],
    sign: '#a6f08a',
    bush: 0x58a83a,
    intro: () => `Grow-Grow fruit! Touch magic seeds with ${actWord()} to grow vines.`,
    ms: 3800,
  },
  chop: {
    name: 'Chop-Chop',
    ic: '✂️',
    col: [0xffd84d, 0xff9a3d, 0xffffff],
    sign: '#ffe16b',
    bush: 0x58a83a,
    intro: () => `Chop-Chop fruit! Spartacus’s hat can chop seaweed. Use ${actWord()} near it.`,
    ms: 3800,
  },
};

const fruits = [];
// a fruit at (x,y,z): on a bush with a name sign, or on its own (e.g. on a rock)
export function addFruit(type, x, z, y, bush) {
  const g = new THREE.Group();
  g.add(
    mesh(
      new THREE.SphereGeometry(0.4, 14, 10),
      new THREE.MeshStandardMaterial({ map: tex[type], roughness: 0.5 }),
    ),
  );
  const st = mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 5), mat(0x3f8f3f));
  st.position.y = 0.45;
  st.rotation.z = 0.3;
  g.add(st);
  const lf = mesh(new THREE.SphereGeometry(0.16, 6, 4), mat(0x4cc05a));
  lf.scale.set(1.6, 0.3, 0.8);
  lf.position.set(0.16, 0.52, 0);
  g.add(lf);
  let fy = y + 0.7;
  if (bush) {
    const b = mesh(new THREE.IcosahedronGeometry(0.85, 0), mat(POWERS[type].bush));
    b.scale.y = 0.6;
    b.position.set(x, y + 0.35, z);
    scene.add(b);
    fy = y + 1.25;
    onFontsReady(() => {
      const sign = textSprite(POWERS[type].name, POWERS[type].sign);
      sign.scale.set(2.4, 1.2, 1);
      sign.position.set(x, y + 2.6, z);
      sign.material.depthTest = true;
      scene.add(sign);
    });
  }
  g.position.set(x, fy, z);
  scene.add(g);
  fruits.push({ type, m: g, x, z, y: fy, regrow: 0 });
}
export function updFruits(dt) {
  const T = G.T;
  for (const f of fruits) {
    if (f.m.visible) {
      f.m.rotation.y += dt * 1.5;
      f.m.position.y = f.y + Math.sin(T * 2.5 + f.x) * 0.15;
    } else {
      f.regrow -= dt;
      if (f.regrow <= 0) {
        f.m.visible = true;
        burst(f.m.position.clone(), 10, POWERS[f.type].col, 2, 2, 0.5, 0.8);
      }
    }
  }
}
// walking into a fruit eats it
export function eatFruits(p) {
  for (const f of fruits)
    if (
      f.m.visible &&
      P.power !== f.type &&
      flat(p, f.x, f.z) < 1.3 &&
      Math.abs(p.y + 0.6 - f.m.position.y) < 1.5
    ) {
      f.m.visible = false;
      f.regrow = 4;
      sfx.fruit();
      burst(f.m.position.clone(), 30, POWERS[f.type].col, 5, 3, 1, 1);
      setPower(f.type);
    }
}

export function setPower(t) {
  const prev = P.power;
  P.power = t;
  P.super = t === 'boing';
  P.stretch = t === 'stretch';
  updPower();
  if (prev && prev !== t) toast(`Swapped to ${POWERS[t].name}! One power at a time.`, 3000);
  else toast(POWERS[t].intro(), POWERS[t].ms);
  // "Eat a … fruit" tasks on this island are marked with power:'…'
  for (const k of cur().tasks.list) if (k.power === t) complete(k.id);
}
export function updPower() {
  const el = $('#power');
  if (!P.power || inCutscene()) {
    el.classList.add('hidden');
    return;
  }
  el.classList.remove('hidden');
  $('#powerName').textContent = `${POWERS[P.power].ic} ${POWERS[P.power].name}`;
}
