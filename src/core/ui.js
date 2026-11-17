// HUD helpers: toast messages (queued), one-time hints, island title card, overlays.
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
// Messages wait their turn: a new one never cuts the one being read short. They queue (at most
// TOAST_QUEUE waiting, the oldest dropped), the same message is never queued twice, and a message
// with an `id` replaces a waiting one with the same id (a counter like "Bone! 3 of 6" shows only
// its latest number). While a conversation is on screen (game/talk.js) they wait behind it.
const TOAST_QUEUE = 4;
const TOAST_GAP = 250; // ms between two messages, so a new one reads as new
const toasts = { waiting: [], showing: null, timer: null, held: false };

// id: messages with the same id replace each other while waiting
export function toast(msg, ms = 0, { id } = {}) {
  if (game.restoring) return; // putting a save back replays rewards: no messages for those
  const { waiting, showing } = toasts;
  if (showing?.msg === msg || waiting.some((each) => each.msg === msg)) return;
  const same = id && waiting.findIndex((each) => each.id === id);
  if (id && same >= 0) waiting[same] = { msg, ms, id };
  else waiting.push({ msg, ms, id });
  if (waiting.length > TOAST_QUEUE) waiting.shift();
  showNextToast();
}

function showNextToast() {
  if (toasts.showing || toasts.held || !toasts.waiting.length) return;
  const next = toasts.waiting.shift();
  toasts.showing = next;
  const el = $('#toast');
  el.firstChild.textContent = next.msg;
  el.classList.add('show');
  toasts.timer = setTimeout(hideToast, toastTime(next.msg, next.ms));
}
function hideToast() {
  $('#toast').classList.remove('show');
  toasts.showing = null;
  setTimeout(showNextToast, TOAST_GAP);
}

// a conversation is on screen: messages wait (the one showing goes back to the front of the queue
// and is shown again in full afterwards)
export function holdToasts(held) {
  toasts.held = held;
  if (held && toasts.showing) {
    clearTimeout(toasts.timer);
    toasts.waiting.unshift(toasts.showing);
    toasts.showing = null;
    $('#toast').classList.remove('show');
  }
  if (!held) showNextToast();
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
