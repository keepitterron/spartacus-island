// Background music and ambience, synthesised like the sound effects (no audio files).
// Each island has its own little tune as data:
//   music: { tempo, root, wave, melody: [16 steps], bass: [16 steps] }
//   tempo in beats per minute (each step is half a beat); root is a MIDI note; steps count up
//   the major pentatonic scale from the root (0, 1, 2 … 5 is an octave up, -5 an octave down),
//   null is a rest. Pentatonic means any notes sound nice together.
// Under the music there's a soft ambience: waves on land, a low hum underwater.
import { currentIsland } from './state.js';
import { audioContext, masterOut } from './audio.js';

const PENTATONIC = [0, 2, 4, 7, 9]; // semitones above the root
const MUSIC_VOLUME = 0.32;
const LOOKAHEAD = 0.3; // seconds of notes scheduled ahead; the timer runs every 0.1 s
const music = { on: true, started: false, gain: null, ambience: null, step: 0, nextTime: 0 };

function noteHz(root, step) {
  const octave = Math.floor(step / 5),
    semitones = PENTATONIC[step - octave * 5];
  return 440 * 2 ** ((root + octave * 12 + semitones - 69) / 12);
}

// call from a user gesture (starting the game), when audio is allowed
export function startMusic() {
  if (music.started) return;
  const ac = audioContext(),
    out = masterOut();
  if (!ac || !out) return;
  music.started = true;
  music.gain = ac.createGain();
  music.gain.gain.value = music.on ? MUSIC_VOLUME : 0;
  music.gain.connect(out);
  music.ambience = startAmbience(ac, out);
  music.nextTime = ac.currentTime + 0.2;
  setInterval(scheduleNotes, 100);
}

export const isMusicOn = () => music.on;
export function setMusicOn(on) {
  music.on = on;
  music.gain?.gain.setTargetAtTime(on ? MUSIC_VOLUME : 0, audioContext().currentTime, 0.2);
}

function scheduleNotes() {
  const ac = audioContext(),
    island = currentIsland(),
    tune = island.music;
  updateAmbience(ac, island);
  // after the tab was hidden the timer falls behind: skip ahead rather than play a pile of notes
  if (music.nextTime < ac.currentTime) music.nextTime = ac.currentTime + 0.05;
  if (!tune) return;
  const stepTime = 30 / tune.tempo;
  while (music.nextTime < ac.currentTime + LOOKAHEAD) {
    const i = music.step % 16;
    if (tune.melody[i] != null)
      pluck(ac, noteHz(tune.root, tune.melody[i]), {
        time: music.nextTime,
        duration: stepTime * 1.8,
        type: tune.wave,
        volume: 0.16,
      });
    if (tune.bass[i] != null)
      pluck(ac, noteHz(tune.root, tune.bass[i]), {
        time: music.nextTime,
        duration: stepTime * 3.5,
        type: 'sine',
        volume: 0.22,
      });
    music.nextTime += stepTime;
    music.step++;
  }
}

// a soft plucked note: quick attack, gentle fade
function pluck(ac, hz, { time, duration, type, volume }) {
  const osc = ac.createOscillator(),
    gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(gain).connect(music.gain);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

// looping noise through a filter, swelling slowly up and down like waves on a beach
function startAmbience(ac, out) {
  const length = ac.sampleRate * 2,
    buffer = ac.createBuffer(1, length, ac.sampleRate),
    data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  gain.gain.value = 0.05;
  // the swell: a very slow oscillator wobbling the volume
  const swell = ac.createOscillator(),
    swellDepth = ac.createGain();
  swell.frequency.value = 0.13;
  swellDepth.gain.value = 0.035;
  swell.connect(swellDepth).connect(gain.gain);
  source.connect(filter).connect(gain).connect(out);
  source.start();
  swell.start();
  return { filter, underwater: null };
}

// waves on land, a low hum under the sea
function updateAmbience(ac, island) {
  const ambience = music.ambience,
    underwater = !!island.underwater;
  if (ambience.underwater === underwater) return;
  ambience.underwater = underwater;
  ambience.filter.type = underwater ? 'lowpass' : 'bandpass';
  ambience.filter.frequency.setTargetAtTime(underwater ? 240 : 650, ac.currentTime, 0.5);
  ambience.filter.Q.value = underwater ? 1 : 0.6;
}
