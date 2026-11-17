// Conversations with characters, at the reader's own pace. Each line stays in a speech box with
// the speaker's name until the player taps it or presses the action button ("Next ▶", then "OK"),
// so nothing scrolls away before a slow reader is done. Walking away ends the conversation (it
// never carries on talking to someone who has left). Other messages wait while it's open.
//
//   startTalk(lines, { speaker, at, reach, onEnd })
//     lines: strings, or {text, run} where run() happens as that line appears (a gift, a hop)
//     at: {x, z} (or a function returning one) where the speaker is; reach: m before it ends
//     onEnd({ finished }): finished is false when the player walked away first
import { $, distXZ } from '../core/util.js';
import { sfx } from '../core/audio.js';
import { holdToasts } from '../core/ui.js';
import { player } from '../player/player.js';

const talk = { lines: null, index: 0, speaker: '', at: null, reach: 0, onEnd: null };

export const isTalking = () => talk.lines !== null;

export function startTalk(lines, { speaker, at, reach = 9, onEnd }) {
  if (isTalking()) endTalk({ finished: false });
  Object.assign(talk, { lines, index: 0, speaker, at, reach, onEnd });
  holdToasts(true);
  $('#talk').classList.add('show');
  showLine();
}

function showLine() {
  const line = talk.lines[talk.index];
  const text = typeof line === 'string' ? line : line.text;
  $('#talkWho').textContent = talk.speaker;
  $('#talkLine').textContent = text;
  $('#talkMore').textContent = isLastLine() ? 'OK ✓' : 'Next ▶';
  sfx.squeak();
  if (typeof line !== 'string') line.run?.();
}
const isLastLine = () => talk.index === talk.lines.length - 1;

export function nextLine() {
  if (!isTalking()) return;
  if (isLastLine()) {
    endTalk({ finished: true });
    return;
  }
  talk.index += 1;
  showLine();
}

function endTalk({ finished }) {
  const { onEnd } = talk;
  talk.lines = null;
  $('#talk').classList.remove('show');
  holdToasts(false);
  onEnd?.({ finished });
}

// the action button reads "Next" while someone's talking (it wins over everything else)
export const talkAction = () =>
  isTalking() ? { label: isLastLine() ? 'OK' : 'Next', run: nextLine } : null;

// per frame: walked away? the conversation is over
export function updateTalk() {
  if (!isTalking()) return;
  const at = typeof talk.at === 'function' ? talk.at() : talk.at;
  if (distXZ(player.pos, at.x, at.z) > talk.reach) endTalk({ finished: false });
}

// tapping the speech box is the same as Next
export function bindTalk() {
  $('#talk').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    nextLine();
  });
}
