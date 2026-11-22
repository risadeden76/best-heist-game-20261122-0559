// Synthesised WebAudio sounds: no audio files, everything is an oscillator or a
// burst of filtered noise built at run time. The context is created on the first
// user gesture, so the game stays silent until the player starts it.

export function createAudio() {
  let context = null;
  let alarmNodes = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, seconds, type, gainValue, when = 0) {
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(gainValue, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  function noise(seconds, gainValue, filterFreq) {
    const ctx = ensure();
    if (!ctx) return;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  return {
    /** Call from any user gesture so the browser lets sound play. */
    unlock() {
      const ctx = ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    footstep(sneaking) {
      noise(0.05, sneaking ? 0.03 : 0.07, 500);
    },
    cameraBeep() {
      tone(1180, 0.09, 'sine', 0.05);
    },
    vaultClick(progress) {
      tone(420 + progress * 500, 0.06, 'square', 0.06);
    },
    vaultOpen() {
      tone(523, 0.12, 'triangle', 0.12);
      tone(659, 0.12, 'triangle', 0.12, 0.1);
      tone(784, 0.2, 'triangle', 0.12, 0.2);
    },
    loot() {
      tone(880, 0.1, 'sine', 0.1);
      tone(1318, 0.16, 'sine', 0.1, 0.08);
    },
    smoke() {
      noise(0.35, 0.12, 900);
    },
    dash() {
      noise(0.14, 0.08, 1800);
    },
    /** A two-tone siren while the alarm is high; call again to stop it. */
    alarm(on) {
      const ctx = ensure();
      if (!ctx) return;
      if (on && !alarmNodes) {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 620;
        lfo.type = 'sine';
        lfo.frequency.value = 1.6;
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(oscillator.frequency);
        gain.gain.value = 0.045;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        lfo.start();
        alarmNodes = { oscillator, lfo, gain };
      } else if (!on && alarmNodes) {
        const nodes = alarmNodes;
        alarmNodes = null;
        nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, ctx.currentTime);
        nodes.gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
        nodes.oscillator.stop(ctx.currentTime + 0.25);
        nodes.lfo.stop(ctx.currentTime + 0.25);
      }
    },
    win() {
      const notes = [523, 659, 784, 1046, 1318];
      for (let i = 0; i < notes.length; i += 1) tone(notes[i], 0.22, 'triangle', 0.12, i * 0.11);
    },
    caught() {
      tone(220, 0.3, 'sawtooth', 0.1);
      tone(165, 0.5, 'sawtooth', 0.1, 0.25);
    },
  };
}
