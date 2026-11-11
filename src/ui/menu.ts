/**
 * Small drop-down menus: a toggle button and a panel that opens below it.
 * Clicking outside, pressing Esc or choosing a button in the menu closes it.
 *
 * "Phone menus" are drop-downs only on small screens. On wider screens their
 * items are shown in the row as usual (the toggle button is hidden by CSS),
 * so the layout on a laptop stays the same.
 */
import { h, type Props } from './dom';

type Child = Node | string | null | undefined | false;

export interface MenuOptions extends Props {
  align?: 'left' | 'right';
  /** Only a drop-down on phones; on wider screens the items stay visible. */
  phoneOnly?: boolean;
}

export interface Menu {
  element: HTMLElement;
  /** Changes the text on the toggle button (e.g. to show the current choice). */
  setLabel(label: string): void;
}

export function menu(label: string, options: MenuOptions, ...items: Child[]): Menu {
  const { align = 'left', phoneOnly = false, class: cls, title, ...rest } = options;
  const labelEl = h('span', { class: 'menu-label' }, label);
  const toggle = h('button', {
    type: 'button',
    class: `menu-toggle ${String(cls ?? '')}`,
    title,
    'aria-haspopup': 'true',
    'aria-expanded': 'false',
    ...rest,
  }, labelEl, h('span', { class: 'menu-caret', 'aria-hidden': 'true' }, '▾'));
  const pop = h('div', { class: `menu-pop menu-${align}` }, ...items);
  const element = h('div', { class: `menu${phoneOnly ? ' phone-menu' : ''}` }, toggle, pop);

  toggle.addEventListener('click', () => setOpen(element, !element.classList.contains('open')));
  // A chosen action closes the menu; checkboxes keep it open for more changes.
  pop.addEventListener('click', (ev) => {
    if ((ev.target as Element).closest('button:not(.info-btn)')) setOpen(element, false);
  });
  // Choosing one option of a radio group is a single choice, too.
  pop.addEventListener('change', (ev) => {
    if ((ev.target as HTMLInputElement).type === 'radio') setOpen(element, false);
  });
  return { element, setLabel: (text) => { labelEl.textContent = text; } };
}

/** Heading inside a menu (not clickable). */
export function menuHeading(text: string): HTMLElement {
  return h('div', { class: 'menu-heading' }, text);
}

/**
 * A menu entry (e.g. a checkbox) with a small info button; the button shows
 * or hides an explanation below the entry without closing the menu.
 */
export function menuItemWithInfo(item: HTMLElement, info: string, infoLabel: string): HTMLElement {
  const note = h('p', { class: 'menu-info-text', hidden: true }, info);
  const btn = h('button', {
    type: 'button', class: 'info-btn', title: infoLabel, 'aria-label': infoLabel, 'aria-expanded': 'false',
  }, 'i');
  btn.addEventListener('click', () => {
    note.hidden = !note.hidden;
    btn.setAttribute('aria-expanded', String(!note.hidden));
  });
  return h('div', { class: 'menu-info-item' }, h('div', { class: 'menu-info-row' }, item, btn), note);
}

function setOpen(menuEl: Element, open: boolean): void {
  menuEl.classList.toggle('open', open);
  menuEl.querySelector(':scope > .menu-toggle')?.setAttribute('aria-expanded', String(open));
}

// One listener for all menus: close open menus on a click outside or on Esc.
document.addEventListener('click', (ev) => {
  for (const open of document.querySelectorAll('.menu.open')) {
    if (!open.contains(ev.target as Node)) setOpen(open, false);
  }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape') return;
  for (const open of document.querySelectorAll('.menu.open')) {
    setOpen(open, false);
    open.querySelector<HTMLElement>(':scope > .menu-toggle')?.focus();
  }
});
