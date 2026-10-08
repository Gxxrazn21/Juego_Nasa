// Efectos de sonido sintetizados con Web Audio: no hay archivos que descargar.
let ctx = null;
let master = null;
let enabled = true;

function ensure() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setSound(on) {
  enabled = on;
  if (!on && ctx) ctx.suspend();
}

export const soundOn = () => enabled;

function noiseBuffer(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // ruido marrón: grave, de motor
    d[i] = last * 3.5;
  }
  return buf;
}

function envelope(node, t0, attack, hold, release, peak) {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  node.gain.setValueAtTime(peak, t0 + attack + hold);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
}

function tone(freq, start, dur, type = 'sine', peak = 0.15) {
  const c = ensure();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  envelope(g, c.currentTime + start, 0.005, dur * 0.3, dur * 0.7, peak);
  o.connect(g).connect(master);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.05);
}

function rumble(seconds, peak, cutoff = 300) {
  const c = ensure();
  if (!c) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(seconds);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  const g = c.createGain();
  envelope(g, c.currentTime, seconds * 0.25, seconds * 0.45, seconds * 0.3, peak);
  src.connect(lp).connect(g).connect(master);
  src.start();
}

export const sfx = {
  click: () => tone(1800, 0, 0.04, 'triangle', 0.04),
  select: () => { tone(660, 0, 0.06, 'sine', 0.06); tone(990, 0.05, 0.08, 'sine', 0.05); },
  beep: () => tone(880, 0, 0.12, 'sine', 0.12),
  countdown: () => tone(1046, 0, 0.18, 'square', 0.06),
  launch: () => { rumble(6, 0.9, 260); tone(55, 0, 4, 'sawtooth', 0.05); },
  burn: () => rumble(1.6, 0.35, 500),
  dock: () => { tone(140, 0, 0.25, 'square', 0.12); rumble(0.4, 0.4, 900); tone(2400, 0.3, 0.1, 'sine', 0.05); },
  success: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.35, 'sine', 0.1)),
  alarm: () => [0, 0.35, 0.7].forEach((t) => { tone(880, t, 0.15, 'square', 0.08); tone(660, t + 0.16, 0.15, 'square', 0.08); }),
};
