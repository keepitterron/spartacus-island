// Keyboard + touch stick + drag-to-look. Game code reads `keys`/`moveAxis()`; one-shot
// buttons (jump, bark, action) are passed in as callbacks by main.js.
import { $, clamp } from './util.js';
import { canvas } from './renderer.js';
import { followCam } from './state.js';
import { audioContext } from './audio.js';
import { overlayOpen } from './ui.js';

export const keys = {}; // lowercased e.key -> currently held
export const stick = { x: 0, y: 0 }; // touch stick, each -1..1
export const drag = { id: null }; // pointer dragging the camera: {id, x, y} (id null when none)
const STICK_RADIUS = 46; // px the knob can travel from the stick's centre

// movement input: f = forward/back, r = right/left, each roughly -1..1 (not normalised)
export function moveAxis() {
  let f = 0;
  let r = 0;
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
  bindKeyboard(onKey);
  bindCameraDrag();
  bindTouchControls({ onJump, onBark, onAct });
}

// onKey fires once per press, not on key repeat
function bindKeyboard(onKey) {
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    // stop Space/arrows scrolling the page, but let Space still press a focused button
    if (
      [' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) &&
      !(e.target instanceof HTMLButtonElement)
    )
      e.preventDefault();
    const isFirstPress = !keys[k];
    keys[k] = true;
    if (isFirstPress) onKey(k, e);
  });
  addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
  });
}

// dragging on the 3D view turns the camera (sideways) and raises/lowers it (up/down)
function bindCameraDrag() {
  canvas.addEventListener('pointerdown', (e) => {
    drag.id = e.pointerId;
    drag.x = e.clientX;
    drag.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    audioContext();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== drag.id) return;
    followCam.yaw -= (e.clientX - drag.x) * 0.007;
    followCam.height = clamp(followCam.height + (e.clientY - drag.y) * 0.02, 2.5, 11);
    drag.x = e.clientX;
    drag.y = e.clientY;
  });
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
}
function endDrag(e) {
  if (e.pointerId === drag.id) drag.id = null;
}

function bindTouchControls({ onJump, onBark, onAct }) {
  // touch UI appears on coarse pointers, or as soon as the screen is touched
  if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
  addEventListener('touchstart', () => document.body.classList.add('touch'), {
    once: true,
    passive: true,
  });
  const zone = $('#stickZone');
  const base = $('#stickBase');
  const knob = $('#knob');
  let stickPointerId = null;
  let stickCenter = { x: 0, y: 0 };
  function moveStick(e) {
    let dx = e.clientX - stickCenter.x;
    let dy = e.clientY - stickCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > STICK_RADIUS) {
      dx *= STICK_RADIUS / dist;
      dy *= STICK_RADIUS / dist;
    }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    stick.x = dx / STICK_RADIUS;
    stick.y = dy / STICK_RADIUS;
  }
  zone.addEventListener('pointerdown', (e) => {
    if (stickPointerId !== null) return;
    stickPointerId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    const rect = base.getBoundingClientRect();
    stickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    moveStick(e);
    e.preventDefault();
    audioContext();
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickPointerId) moveStick(e);
  });
  const endStick = (e) => {
    if (e.pointerId !== stickPointerId) return;
    stickPointerId = null;
    stick.x = 0;
    stick.y = 0;
    knob.style.transform = '';
  };
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);
  $('#btnJump').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audioContext();
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
