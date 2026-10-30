import { $ } from './util.js';

// HUD helpers: toast messages, one-time hints, island title card, overlays.

export const isTouch = () => document.body.classList.contains('touch');
// how to name the action button in messages
export const actionKeyName = () => (isTouch() ? 'the green button' : 'F');

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = $('#toast');
  el.firstChild.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
// every new thing gets a hint the first time the player meets it
const seen = {};
export function hintOnce(id, msg, ms) {
  if (seen[id]) return;
  seen[id] = 1;
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
  let armT = null;
  btn.addEventListener('click', () => {
    if (btn.dataset.armed) {
      fn();
      return;
    }
    btn.dataset.armed = '1';
    btn.textContent = armedText;
    clearTimeout(armT);
    armT = setTimeout(() => {
      delete btn.dataset.armed;
      btn.textContent = text;
    }, 3000);
  });
}
