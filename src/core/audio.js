// Every sound is synthesised with WebAudio, so there are no audio files to load.
let AC = null;
// browsers only allow audio after a user gesture: call ac() from input handlers to unlock it
export function ac() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}
function tone(f0, f1, dur, type = 'sine', vol = 0.2, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay,
    o = a.createOscillator(),
    g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise(dur, freq, vol, delay = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay,
    n = Math.floor(a.sampleRate * dur),
    b = a.createBuffer(1, n, a.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = a.createBufferSource();
  s.buffer = b;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination);
  s.start(t);
}
export const sfx = {
  // a big dog's WOOF-WOOF: low growly body + chesty sub + breathy burst, second one a bit lower
  bark() {
    for (const [d, k] of [
      [0, 1],
      [0.24, 0.9],
    ]) {
      tone(240 * k, 120 * k, 0.22, 'sawtooth', 0.26, d);
      tone(120 * k, 70 * k, 0.26, 'sine', 0.4, d);
      tone(480 * k, 260 * k, 0.12, 'square', 0.05, d);
      noise(0.14, 800 * k, 0.6, d);
      noise(0.06, 2200, 0.18, d);
    }
  },
  jump() {
    tone(300, 560, 0.12, 'triangle', 0.08);
  },
  boing() {
    tone(180, 900, 0.28, 'sine', 0.18);
    tone(360, 1400, 0.2, 'triangle', 0.05, 0.05);
  },
  bone() {
    [880, 1175, 1568].forEach((f, i) => tone(f, f * 1.01, 0.16, 'triangle', 0.12, i * 0.07));
  },
  splash() {
    noise(0.6, 500, 0.5);
    noise(0.3, 1800, 0.2, 0.05);
  },
  pop() {
    tone(900, 1900, 0.07, 'sine', 0.16);
  },
  ding() {
    [1, 2.4, 3.9].forEach((m, i) => tone(660 * m, 655 * m, 1.8 - i * 0.45, 'sine', 0.2 / (i + 1)));
    tone(523, 520, 1.6, 'sine', 0.12, 0.5);
  },
  gull() {
    tone(1400, 850, 0.16, 'triangle', 0.08);
    tone(1550, 950, 0.16, 'triangle', 0.08, 0.2);
  },
  parrot() {
    tone(1800, 1100, 0.1, 'square', 0.05);
    tone(2000, 1300, 0.12, 'square', 0.05, 0.13);
  },
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
      tone(f, f, 0.24, 'triangle', 0.13, i * 0.12),
    );
  },
  fruit() {
    [392, 523, 659, 784].forEach((f, i) => tone(f, f * 1.5, 0.18, 'sine', 0.12, i * 0.06));
  },
  scratch() {
    noise(0.09, 2600, 0.18);
  },
  grab() {
    tone(500, 750, 0.08, 'triangle', 0.1);
  },
  drop() {
    tone(300, 180, 0.1, 'triangle', 0.1);
    noise(0.06, 700, 0.15);
  },
  thunk() {
    tone(160, 90, 0.18, 'triangle', 0.18);
    noise(0.12, 400, 0.3);
    [523, 784].forEach((f, i) => tone(f, f, 0.15, 'triangle', 0.1, 0.2 + i * 0.1));
  },
  creak() {
    tone(220, 140, 0.5, 'sawtooth', 0.05);
    [659, 880, 1175, 1568].forEach((f, i) => tone(f, f, 0.25, 'sine', 0.12, 0.4 + i * 0.1));
  },
  stretch() {
    tone(200, 1200, 0.35, 'triangle', 0.12);
    tone(400, 1600, 0.3, 'sine', 0.06, 0.05);
  },
  horn() {
    tone(220, 215, 0.7, 'sawtooth', 0.07);
    tone(277, 272, 0.7, 'sawtooth', 0.05);
  },
  grow() {
    tone(260, 780, 0.8, 'triangle', 0.1);
    noise(0.5, 3000, 0.08);
    [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.2, 'sine', 0.08, 0.5 + i * 0.08));
  },
  zip() {
    noise(0.9, 1800, 0.18);
    tone(700, 300, 0.9, 'sine', 0.05);
  },
  buzz() {
    tone(180, 190, 0.5, 'sawtooth', 0.04);
    tone(240, 230, 0.4, 'sawtooth', 0.03, 0.1);
  },
  splashy() {
    noise(0.4, 900, 0.3);
    [392, 523, 659].forEach((f, i) => tone(f, f, 0.2, 'sine', 0.08, 0.2 + i * 0.1));
  },
  chop() {
    noise(0.12, 4000, 0.25);
    tone(900, 500, 0.12, 'triangle', 0.08);
  },
  grumble() {
    tone(110, 80, 0.6, 'sawtooth', 0.08);
    tone(130, 90, 0.5, 'sawtooth', 0.06, 0.25);
  },
  whale() {
    tone(180, 320, 1.4, 'sine', 0.14);
    tone(320, 200, 1.6, 'sine', 0.1, 1.2);
  },
};
