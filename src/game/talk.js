// Everything a character says, at the reader's own pace. Each line stays in a speech box with the
// speaker's name until the player taps it or presses the action button ("Next ▶", then "OK"), so
// nothing scrolls away before a slow reader is done. Walking away ends the conversation (it never
// carries on talking to someone who has left). Other messages (toasts) wait while it's open.
//
//   say(speaker, lines, { at, reach, once, auto, onEnd })
//     lines: a string or a list of them; a line can be {text, run}: run() happens as it appears
//     at: {x, z} (or a function returning one) where the speaker is; walk further than `reach`
//       and the conversation ends. Leave it out for story moments that don't depend on where he is
//     once: an id; a line said with it is never said again (like hintOnce)
//     auto: closes by itself after its reading time, for cutscenes where nobody is free to tap
//     onEnd({ finished }): finished is false when the player walked away first
//
// Someone says something while the box is open: the same speaker's new lines are added to the
// end (lines already in it are skipped: a second woof doesn't repeat "Hello!"); anyone else waits
// their turn.
import { $, distXZ } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { game } from '../core/state.js';
import { holdToasts, toastTime } from '../core/ui.js';
import { player } from '../player/player.js';

const QUEUE_MAX = 3; // conversations waiting behind the open one
const talk = { lines: null, index: 0, speaker: '', at: null, reach: 0, onEnd: null, timer: null };
const waiting = [];
const saidOnce = new Set();

export const isTalking = () => talk.lines !== null;

const textOf = (line) => (typeof line === 'string' ? line : line.text);

export function say(speaker, lines, { at = null, reach = 9, once, auto = false, onEnd } = {}) {
  if (game.restoring) return; // putting a save back replays rewards: nobody talks for those
  if (once) {
    if (saidOnce.has(once)) return;
    saidOnce.add(once);
  }
  const conversation = { speaker, lines: [lines].flat(), at, reach, auto, onEnd };
  if (!isTalking()) {
    open(conversation);
    return;
  }
  if (talk.speaker === speaker && !onEnd) {
    const said = new Set(talk.lines.map(textOf));
    talk.lines.push(...conversation.lines.filter((line) => !said.has(textOf(line))));
    showLine(); // the button may now read "Next" instead of "OK"
    return;
  }
  const same = waiting.find((each) => each.speaker === speaker && !each.onEnd && !onEnd);
  if (same) same.lines.push(...conversation.lines);
  else waiting.push(conversation);
  if (waiting.length > QUEUE_MAX) waiting.shift();
}

function open({ speaker, lines, at, reach, auto, onEnd }) {
  Object.assign(talk, { lines, index: 0, speaker, at, reach, auto, onEnd });
  holdToasts(true);
  $('#talk').classList.add('show');
  showLine({ fresh: true });
}

// fresh: a new line (squeak, run its action), not just the button relabelled
function showLine({ fresh = false } = {}) {
  const line = talk.lines[talk.index];
  $('#talkWho').textContent = talk.speaker;
  $('#talkLine').textContent = textOf(line);
  $('#talkMore').textContent = isLastLine() ? 'OK ✓' : 'Next ▶';
  if (!fresh) return;
  sfx.squeak();
  if (typeof line !== 'string') line.run?.();
  clearTimeout(talk.timer);
  if (talk.auto) talk.timer = setTimeout(nextLine, toastTime(textOf(line)));
}
const isLastLine = () => talk.index === talk.lines.length - 1;

export function nextLine() {
  if (!isTalking()) return;
  if (isLastLine()) {
    endTalk({ finished: true });
    return;
  }
  talk.index += 1;
  showLine({ fresh: true });
}

function endTalk({ finished }) {
  const { onEnd } = talk;
  clearTimeout(talk.timer);
  talk.lines = null;
  $('#talk').classList.remove('show');
  onEnd?.({ finished });
  if (isTalking()) return; // onEnd started a new conversation
  openNextWaiting();
  if (!isTalking()) holdToasts(false);
}

// the next one in line, unless its speaker is out of reach by now (then it never happened)
function openNextWaiting() {
  while (waiting.length) {
    const next = waiting.shift();
    if (inReach(next)) {
      open(next);
      return;
    }
    next.onEnd?.({ finished: false });
  }
}

function inReach({ at, reach }) {
  if (!at) return true;
  const spot = typeof at === 'function' ? at() : at;
  return distXZ(player.pos, spot.x, spot.z) <= reach;
}

// the action button reads "Next" while someone's talking (it wins over everything else)
export const talkAction = () =>
  isTalking() ? { label: isLastLine() ? 'OK' : 'Next', run: nextLine } : null;

// per frame: walked away? the conversation is over
export function updateTalk() {
  if (isTalking() && !inReach(talk)) endTalk({ finished: false });
}

// tapping the speech box is the same as Next
export function bindTalk() {
  $('#talk').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    nextLine();
  });
}

// sailing off to another island: whoever was talking stays behind
export function stopTalk() {
  waiting.length = 0;
  if (isTalking()) endTalk({ finished: false });
}
