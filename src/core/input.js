import { $, clamp } from './util.js';
import { canvas } from './renderer.js';
import { cam } from './state.js';
import { ac } from './audio.js';
import { overlayOpen } from './ui.js';

// Keyboard + touch stick + drag-to-look. Game code reads `keys`/`axis()`; one-shot
// buttons (jump, bark, action) are passed in as callbacks by main.js.
export const keys = {};
export const stick = { x: 0, y: 0 };
export const drag = { id: null };

// movement input: f = forward/back, r = right/left, each roughly -1..1 (not normalised)
export function axis() {
  let f = 0,
    r = 0;
  if (overlayOpen()) return { f, r };
  if (keys.w || keys.arrowup) f += 1;
  if (keys.s || keys.arrowdown) f -= 1;
  if (keys.d || keys.arrowright) r += 1;
  if (keys.a || keys.arrowleft) r -= 1;
  f -= stick.y;
  r += stick.x;
  return { f, r };
}

export function bindInput({ onKey, onJump, onBark, onAct }) {
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (
      [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) &&
      !(e.target instanceof HTMLButtonElement)
    )
      e.preventDefault();
    const first = !keys[k];
    keys[k] = true;
    if (first) onKey(k, e);
  });
  addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
  });

  canvas.addEventListener('pointerdown', (e) => {
    drag.id = e.pointerId;
    drag.x = e.clientX;
    drag.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    ac();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== drag.id) return;
    cam.yaw -= (e.clientX - drag.x) * 0.007;
    cam.h = clamp(cam.h + (e.clientY - drag.y) * 0.02, 2.5, 11);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  const endDrag = (e) => {
    if (e.pointerId === drag.id) drag.id = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // touch UI appears on coarse pointers, or as soon as the screen is touched
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  addEventListener('touchstart', () => document.body.classList.add('touch'), {
    once: true,
    passive: true,
  });
  const zone = $('#stickZone'),
    base = $('#stickBase'),
    knob = $('#knob');
  let stickId = null,
    so = { x: 0, y: 0 };
  function moveStick(e) {
    let dx = e.clientX - so.x,
      dy = e.clientY - so.y;
    const d = Math.hypot(dx, dy),
      m = 46;
    if (d > m) {
      dx *= m / d;
      dy *= m / d;
    }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    stick.x = dx / m;
    stick.y = dy / m;
  }
  zone.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    const r = base.getBoundingClientRect();
    so = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    moveStick(e);
    e.preventDefault();
    ac();
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickId) moveStick(e);
  });
  const endStick = (e) => {
    if (e.pointerId === stickId) {
      stickId = null;
      stick.x = stick.y = 0;
      knob.style.transform = '';
    }
  };
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);
  $('#btnJump').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    ac();
    onJump();
  });
  $('#btnBark').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onBark();
  });
  $('#btnAct').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onAct();
  });
}
