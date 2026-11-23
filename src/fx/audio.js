// Suoni sintetizzati: rumore filtrato per gli strumenti, piccoli "tic" per gli eventi
import { TOOLS } from '../config.js';

let AC = null, gain, filt, motor, motorGain;

export function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const len = AC.sampleRate, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
    filt = AC.createBiquadFilter(); filt.type = 'bandpass';
    gain = AC.createGain(); gain.gain.value = 0;
    src.connect(filt).connect(gain).connect(AC.destination); src.start();
    // ronzio del motore del trapano
    motor = AC.createOscillator(); motor.type = 'sawtooth'; motor.frequency.value = 95;
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
    motorGain = AC.createGain(); motorGain.gain.value = 0;
    motor.connect(lp).connect(motorGain).connect(AC.destination); motor.start();
  } catch (e) { AC = null; }
}

export function toolSound(toolIndex, active, damaging) {
  if (!AC) return;
  const T = TOOLS[toolIndex], t = AC.currentTime;
  filt.frequency.setTargetAtTime(T.snd[0] * (damaging ? 1.8 : 1), t, 0.02);
  filt.Q.setTargetAtTime(T.snd[2], t, 0.02);
  gain.gain.setTargetAtTime(active ? T.snd[1] * (damaging ? 1.5 : 1) : 0, t, 0.03);
  motorGain.gain.setTargetAtTime(active && T.id === 'drill' ? 0.05 : 0, t, 0.05);
  motor.frequency.setTargetAtTime(active ? 110 : 80, t, 0.1);
}

export function blip(kind) {
  if (!AC) return;
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
  const seq = { win: [523, 659, 784, 1047], lose: [330, 247, 196], tool: [880], scan: [440, 880], place: [660, 990] }[kind] || [600];
  o.type = kind === 'lose' ? 'triangle' : 'sine';
  seq.forEach((f, i) => o.frequency.setValueAtTime(f, t + i * 0.09));
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seq.length * 0.09 + 0.25);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + seq.length * 0.09 + 0.3);
}
