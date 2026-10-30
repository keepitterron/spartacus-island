// Every sound is synthesised with WebAudio, so there are no audio files to load.
let context = null;
// browsers only allow audio after a user gesture: call audioContext() from input handlers to unlock it
export function audioContext() {
  if (!context) {
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {}
  }
  if (context?.state === 'suspended') context.resume().catch(() => {});
  return context;
}
// an oscillator sliding from frequency `from` to `to` (Hz) with a quick attack and fade out
function tone(from, { to, duration, type = 'sine', volume = 0.2, delay = 0 }) {
  const ac = audioContext();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, start);
  osc.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}
// a fading burst of white noise through a band-pass filter centred on `freq`
function noise(duration, { freq, volume, delay = 0 }) {
  const ac = audioContext();
  if (!ac) return;
  const start = ac.currentTime + delay;
  const length = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.value = volume;
  source.connect(filter).connect(gain).connect(ac.destination);
  source.start(start);
}
export const sfx = {
  // a big dog's WOOF-WOOF: low growly body + chesty sub + breathy burst, second one a bit lower
  bark() {
    for (const [delay, pitch] of [
      [0, 1],
      [0.24, 0.9],
    ]) {
      tone(240 * pitch, { to: 120 * pitch, duration: 0.22, type: 'sawtooth', volume: 0.26, delay });
      tone(120 * pitch, { to: 70 * pitch, duration: 0.26, type: 'sine', volume: 0.4, delay });
      tone(480 * pitch, { to: 260 * pitch, duration: 0.12, type: 'square', volume: 0.05, delay });
      noise(0.14, { freq: 800 * pitch, volume: 0.6, delay });
      noise(0.06, { freq: 2200, volume: 0.18, delay });
    }
  },
  jump() {
    tone(300, { to: 560, duration: 0.12, type: 'triangle', volume: 0.08 });
  },
  boing() {
    tone(180, { to: 900, duration: 0.28, type: 'sine', volume: 0.18 });
    tone(360, { to: 1400, duration: 0.2, type: 'triangle', volume: 0.05, delay: 0.05 });
  },
  bone() {
    [880, 1175, 1568].forEach((f, i) =>
      tone(f, { to: f * 1.01, duration: 0.16, type: 'triangle', volume: 0.12, delay: i * 0.07 }),
    );
  },
  splash() {
    noise(0.6, { freq: 500, volume: 0.5 });
    noise(0.3, { freq: 1800, volume: 0.2, delay: 0.05 });
  },
  pop() {
    tone(900, { to: 1900, duration: 0.07, type: 'sine', volume: 0.16 });
  },
  ding() {
    // a bell: three partials, the higher ones quieter and shorter
    [1, 2.4, 3.9].forEach((m, i) =>
      tone(660 * m, { to: 655 * m, duration: 1.8 - i * 0.45, type: 'sine', volume: 0.2 / (i + 1) }),
    );
    tone(523, { to: 520, duration: 1.6, type: 'sine', volume: 0.12, delay: 0.5 });
  },
  gull() {
    tone(1400, { to: 850, duration: 0.16, type: 'triangle', volume: 0.08 });
    tone(1550, { to: 950, duration: 0.16, type: 'triangle', volume: 0.08, delay: 0.2 });
  },
  parrot() {
    tone(1800, { to: 1100, duration: 0.1, type: 'square', volume: 0.05 });
    tone(2000, { to: 1300, duration: 0.12, type: 'square', volume: 0.05, delay: 0.13 });
  },
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) =>
      tone(f, { to: f, duration: 0.24, type: 'triangle', volume: 0.13, delay: i * 0.12 }),
    );
  },
  fruit() {
    [392, 523, 659, 784].forEach((f, i) =>
      tone(f, { to: f * 1.5, duration: 0.18, type: 'sine', volume: 0.12, delay: i * 0.06 }),
    );
  },
  scratch() {
    noise(0.09, { freq: 2600, volume: 0.18 });
  },
  grab() {
    tone(500, { to: 750, duration: 0.08, type: 'triangle', volume: 0.1 });
  },
  drop() {
    tone(300, { to: 180, duration: 0.1, type: 'triangle', volume: 0.1 });
    noise(0.06, { freq: 700, volume: 0.15 });
  },
  thunk() {
    tone(160, { to: 90, duration: 0.18, type: 'triangle', volume: 0.18 });
    noise(0.12, { freq: 400, volume: 0.3 });
    [523, 784].forEach((f, i) =>
      tone(f, { to: f, duration: 0.15, type: 'triangle', volume: 0.1, delay: 0.2 + i * 0.1 }),
    );
  },
  creak() {
    tone(220, { to: 140, duration: 0.5, type: 'sawtooth', volume: 0.05 });
    [659, 880, 1175, 1568].forEach((f, i) =>
      tone(f, { to: f, duration: 0.25, type: 'sine', volume: 0.12, delay: 0.4 + i * 0.1 }),
    );
  },
  stretch() {
    tone(200, { to: 1200, duration: 0.35, type: 'triangle', volume: 0.12 });
    tone(400, { to: 1600, duration: 0.3, type: 'sine', volume: 0.06, delay: 0.05 });
  },
  horn() {
    tone(220, { to: 215, duration: 0.7, type: 'sawtooth', volume: 0.07 });
    tone(277, { to: 272, duration: 0.7, type: 'sawtooth', volume: 0.05 });
  },
  grow() {
    tone(260, { to: 780, duration: 0.8, type: 'triangle', volume: 0.1 });
    noise(0.5, { freq: 3000, volume: 0.08 });
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(f, { to: f, duration: 0.2, type: 'sine', volume: 0.08, delay: 0.5 + i * 0.08 }),
    );
  },
  zip() {
    noise(0.9, { freq: 1800, volume: 0.18 });
    tone(700, { to: 300, duration: 0.9, type: 'sine', volume: 0.05 });
  },
  buzz() {
    tone(180, { to: 190, duration: 0.5, type: 'sawtooth', volume: 0.04 });
    tone(240, { to: 230, duration: 0.4, type: 'sawtooth', volume: 0.03, delay: 0.1 });
  },
  splashy() {
    noise(0.4, { freq: 900, volume: 0.3 });
    [392, 523, 659].forEach((f, i) =>
      tone(f, { to: f, duration: 0.2, type: 'sine', volume: 0.08, delay: 0.2 + i * 0.1 }),
    );
  },
  chop() {
    noise(0.12, { freq: 4000, volume: 0.25 });
    tone(900, { to: 500, duration: 0.12, type: 'triangle', volume: 0.08 });
  },
  grumble() {
    tone(110, { to: 80, duration: 0.6, type: 'sawtooth', volume: 0.08 });
    tone(130, { to: 90, duration: 0.5, type: 'sawtooth', volume: 0.06, delay: 0.25 });
  },
  whale() {
    tone(180, { to: 320, duration: 1.4, type: 'sine', volume: 0.14 });
    tone(320, { to: 200, duration: 1.6, type: 'sine', volume: 0.1, delay: 1.2 });
  },
};
