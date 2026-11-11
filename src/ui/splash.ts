/**
 * Start animation, played once when the page is (re)loaded:
 * the chip of the logo is built up, the name types in, then the letters fold
 * back into the chip and the chip flies to its place in front of the title.
 *
 * Skipped if the user prefers reduced motion or the page is not visible;
 * a click or any key ends it early.
 */
import { h } from './dom';

const EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';
const EASE_IN = 'cubic-bezier(0.55, 0, 1, 0.45)';

export function playSplash(title: string): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (document.hidden || typeof Element.prototype.animate !== 'function') return;

  const pinTop = h('span', { class: 'splash-pin splash-pin-top' });
  const pinBottom = h('span', { class: 'splash-pin splash-pin-bottom' });
  const core = h('span', { class: 'splash-core' });
  const body = h('span', { class: 'splash-body' }, core);
  const chip = h('span', { class: 'splash-chip' }, pinTop, body, pinBottom);
  const letters = [...title.toUpperCase()].map((c) => h('span', { class: 'splash-letter' }, c));
  const name = h('span', { class: 'splash-name' }, ...letters);
  const overlay = h('div', { class: 'splash', 'aria-hidden': 'true' }, h('div', { class: 'splash-logo' }, chip, name));

  document.documentElement.classList.add('splash-running');
  document.body.append(overlay);

  let ended = false;
  const end = (): void => {
    if (ended) return;
    ended = true;
    document.removeEventListener('keydown', skip, true);
    overlay.remove();
    document.documentElement.classList.remove('splash-running');
  };
  // Skip: fade out quickly.
  const skip = (): void => {
    if (ended) return;
    for (const a of overlay.getAnimations({ subtree: true })) a.pause();
    overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' }).finished.then(end, end);
    setTimeout(end, 250); // in case animation frames are paused (e.g. hidden tab)
  };
  overlay.addEventListener('pointerdown', skip);
  document.addEventListener('keydown', skip, true);

  run().then(end, end);
  // Never block the app for long, even if animations stall (e.g. the tab is hidden meanwhile).
  setTimeout(end, 6000);

  async function run(): Promise<void> {
    // ----- build up the chip (alone in the middle, it moves aside when the name types in) -----
    const logoBox = overlay.firstElementChild!.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    const shift = logoBox.left + logoBox.width / 2 - (chipBox.left + chipBox.width / 2);
    chip.animate([
      { transform: `translateX(${shift}px)` },
      { transform: `translateX(${shift}px)`, offset: 0.55 },
      { transform: 'translateX(0)' },
    ], { duration: 1150, easing: 'ease-in-out' });
    body.animate([
      { transform: 'scale(0) rotate(-90deg)' },
      { transform: 'scale(1) rotate(0deg)' },
    ], { duration: 550, easing: EASE_BACK, fill: 'backwards' });
    core.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }],
      { duration: 350, delay: 350, easing: EASE_BACK, fill: 'backwards' });
    for (const [pin, dir] of [[pinTop, 1], [pinBottom, -1]] as const) {
      pin.animate([
        { transform: `translateY(${dir * 100}%) scaleX(0.3)`, opacity: 0 },
        { transform: 'translateY(0) scaleX(1)', opacity: 1 },
      ], { duration: 320, delay: 480, easing: EASE_OUT, fill: 'backwards' });
    }

    // ----- type in the name -----
    const typed = letters.map((l, i) => l.animate([
      { opacity: 0, transform: 'translateY(0.5em) scale(0.6)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], { duration: 260, delay: 650 + i * 55, easing: EASE_BACK, fill: 'backwards' }));
    await typed[typed.length - 1]?.finished;
    if (ended) return;
    await wait(550);
    if (ended) return;

    // ----- take the name apart: letters fold back into the chip, last one first -----
    const chipRight = chip.getBoundingClientRect().right;
    const folded = letters.map((l, i) => {
      const r = l.getBoundingClientRect();
      const dx = chipRight - (r.left + r.width / 2);
      return l.animate([
        { opacity: 1, transform: 'translateX(0) rotateY(0deg) scale(1)' },
        { opacity: 0, transform: `translateX(${dx}px) rotateY(90deg) scale(0.2)` },
      ], { duration: 380, delay: (letters.length - 1 - i) * 45, easing: EASE_IN, fill: 'forwards' });
    });
    // the chip "swallows" each letter with a small pulse
    chip.animate([
      { transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(0.96)' }, { transform: 'scale(1)' },
    ], { duration: 700, delay: 250, easing: 'ease-in-out' });
    await folded[0]?.finished;
    if (ended) return;

    // ----- fold the chip together and move it to the title -----
    const target = titleChipRect();
    const from = body.getBoundingClientRect();
    const bg = getComputedStyle(overlay).backgroundColor;
    const moves: Animation[] = [
      overlay.animate([{ backgroundColor: bg }, { backgroundColor: 'transparent' }],
        { duration: 650, easing: 'ease-in', fill: 'forwards' }),
    ];
    if (target) {
      const dx = target.x + target.size / 2 - (from.left + from.width / 2);
      const dy = target.y + target.size / 2 - (from.top + from.height / 2);
      const s = target.size / from.width;
      moves.push(chip.animate([
        { transform: 'translate(0, 0) scale(1)' },
        { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
      ], { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' }));
    } else {
      moves.push(chip.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.3)' }],
        { duration: 400, easing: EASE_IN, fill: 'forwards' }));
    }
    await Promise.all(moves.map((a) => a.finished));
  }
}

/** Position and size of the small chip in front of the page title (h1::before), if visible. */
function titleChipRect(): { x: number; y: number; size: number } | null {
  const title = document.querySelector('.app-header h1');
  if (!title) return null;
  const r = title.getBoundingClientRect();
  if (r.width === 0 || r.bottom < 0) return null;
  const size = parseFloat(getComputedStyle(title, '::before').width) || 0;
  if (!size) return null;
  return { x: r.left, y: r.top + r.height / 2 - size / 2, size };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
