// HUD helpers: toast messages, one-time hints, island title card, overlays.
import { $ } from './util.js';
import { game } from './state.js';

export const isTouch = () => document.body.classList.contains('touch');
// how to name the action button in messages
export const actionKeyName = () => (isTouch() ? 'the green button' : 'F');

// kids read slowly: a toast stays at least this long, plus a bit per letter, whatever `ms` says
const TOAST_MIN_MS = 3500;
const TOAST_MS_PER_CHAR = 60;
// how long a toast stays up
export const toastTime = (msg, ms = 0) =>
  Math.max(ms, TOAST_MIN_MS, 1500 + msg.length * TOAST_MS_PER_CHAR);
let toastTimer;
export function toast(msg, ms = 0) {
  if (game.restoring) return; // putting a save back replays rewards: no messages for those
  const el = $('#toast');
  el.firstChild.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), toastTime(msg, ms));
}
// every new thing gets a hint the first time the player meets it
const seenHints = {};
export function hintOnce(id, msg, ms) {
  if (seenHints[id]) return;
  seenHints[id] = 1;
  toast(msg, ms);
}
export function showTitleCard(small, big) {
  $('#cardSmall').textContent = small;
  $('#cardBig').textContent = big;
  $('#card').classList.add('show');
  setTimeout(() => $('#card').classList.remove('show'), 3200);
}

// any full-screen panel (win, end, error) open? game keys are ignored while one is
export const overlayOpen = () => !!document.querySelector('.overlay:not(.hidden):not(#start)');

// a button that needs a second tap within 3 s before it does something destructive
export function armButton(btn, armedText, fn) {
  const text = btn.textContent;
  let disarmTimer = null;
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) {
      fn();
      return;
    }
    btn.dataset.armed = '1';
    btn.textContent = armedText;
    clearTimeout(disarmTimer);
    disarmTimer = setTimeout(() => {
      delete btn.dataset.armed;
      btn.textContent = text;
    }, 3000);
  });
}
