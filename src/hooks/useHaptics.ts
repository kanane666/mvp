/**
 * useHaptics — sons courts via Web Audio API + vibrations.
 * Aucun fichier externe, tout généré en code.
 * Désactivable via soundEnabled sur le match.
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

function beep(freq: number, duration: number, type: OscillatorType = 'sine', gain = 0.3) {
  const ctx = getCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = type;
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function vibrate(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch {}
}

export const haptics = {
  /** Bip court pour action normale (2pts, rebond, etc.) */
  action() {
    beep(880, 0.08, 'sine', 0.25);
    vibrate(30);
  },

  /** Double bip pour 3 points */
  threePoints() {
    beep(880, 0.07, 'sine', 0.3);
    setTimeout(() => beep(1100, 0.1, 'sine', 0.3), 90);
    vibrate([20, 30, 20]);
  },

  /** Bip grave pour faute */
  foul() {
    beep(220, 0.2, 'sawtooth', 0.2);
    vibrate([40, 20, 40]);
  },

  /** Bip annuler */
  undo() {
    beep(440, 0.12, 'sine', 0.2);
    vibrate(20);
  },

  /** Buzzer fin de quart */
  buzzer() {
    beep(180, 0.5, 'sawtooth', 0.4);
    vibrate([100, 50, 100]);
  },

  /** Alerte shot clock (≤5s) */
  shotClockWarning() {
    beep(660, 0.05, 'square', 0.15);
    vibrate(15);
  },
};

/** Unlocks AudioContext on first user interaction (required by browsers) */
export function unlockAudio() {
  getCtx();
}
