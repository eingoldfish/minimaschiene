/**
 * Short sounds for buttons and events, generated with the Web Audio API
 * (no sound files, so they also work offline).
 *
 * Browsers only allow audio after a user action (click, key), so the audio
 * context is created on the first sound, which is always caused by one.
 */

export type SoundName =
  /** any button, tab, checkbox */
  | 'click'
  /** e.g. assembled, file saved, program finished with HALT */
  | 'success'
  /** e.g. assembler errors, division by 0 */
  | 'error'
  /** e.g. "assemble first", time limit */
  | 'warning'
  /** stopped at a breakpoint */
  | 'ping';

let enabled = true;
let ctx: AudioContext | null = null;
/** Time of the last click, so that one action does not click twice. */
let lastClick = 0;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function audio(): AudioContext | null {
  if (!enabled || document.hidden) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // no Web Audio (very old browser): just no sound
  }
}

interface Tone {
  freq: number;
  /** glide to this frequency */
  to?: number;
  type?: OscillatorType;
  /** seconds after now */
  at?: number;
  dur: number;
  gain: number;
}

function tone(c: AudioContext, { freq, to, type = 'sine', at = 0, dur, gain }: Tone): void {
  const start = c.currentTime + at;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.006);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(amp).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

export function playSound(name: SoundName): void {
  const c = audio();
  if (!c) return;
  switch (name) {
    case 'click': {
      const now = performance.now();
      if (now - lastClick < 40) return;
      lastClick = now;
      // short, soft "key" tick
      tone(c, { freq: 1500, to: 900, type: 'triangle', dur: 0.035, gain: 0.07 });
      break;
    }
    case 'success':
      // two rising notes (E6, A6)
      tone(c, { freq: 1318.5, type: 'triangle', at: 0.04, dur: 0.12, gain: 0.06 });
      tone(c, { freq: 1760, type: 'triangle', at: 0.13, dur: 0.22, gain: 0.06 });
      break;
    case 'error':
      // two low, slightly rough notes
      tone(c, { freq: 220, type: 'square', at: 0.04, dur: 0.11, gain: 0.035 });
      tone(c, { freq: 175, type: 'square', at: 0.17, dur: 0.18, gain: 0.035 });
      break;
    case 'warning':
      tone(c, { freq: 440, to: 380, type: 'triangle', at: 0.04, dur: 0.18, gain: 0.06 });
      break;
    case 'ping':
      tone(c, { freq: 1046.5, type: 'sine', at: 0.03, dur: 0.35, gain: 0.08 });
      break;
  }
}

/**
 * Clicks for all buttons, tabs and checkboxes of the page (also when used
 * with the keyboard). Call once.
 */
export function installClickSounds(): void {
  document.addEventListener('click', (ev) => {
    const target = ev.target as Element | null;
    const control = target?.closest('button, [role="tab"], input[type="checkbox"], input[type="radio"]');
    if (!control || (control as HTMLButtonElement).disabled) return;
    // a click on a label also "clicks" its checkbox: only one sound
    playSound('click');
  }, true);
}
