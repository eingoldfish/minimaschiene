/**
 * The guide page: replaces the machine view while it is open (the app stays
 * in the background with its whole state). It has its own address
 * (#anleitung or #guide, with an optional section: #anleitung/befehle), so it
 * can be linked from worksheets.
 */
import type { Language } from '../../core';
import { h } from '../dom';
import { flagIcon } from '../icons';
import { t } from '../i18n';
import { guideSections } from './content';
import { guideHash } from './route';

export interface GuideView {
  element: HTMLElement;
  /** Scrolls to a section (or to the top for null). */
  showSection(id: string | null): void;
  /** Moves the keyboard focus into the guide (for screen readers and keyboard users). */
  focus(): void;
}

export function createGuideView(lang: Language, actions: { close(): void; switchLanguage(): void }): GuideView {
  const d = t();
  const sections = guideSections(lang);

  // Phones: the short title, so the header stays one line.
  const heading = h('h1', { tabindex: '-1' },
    h('span', { class: 'wide-only' }, d.guideHeading), h('span', { class: 'phone-only' }, d.guide));
  const header = h('header', { class: 'guide-header' },
    h('button', { type: 'button', class: 'guide-back', onclick: () => actions.close(), title: d.guideBackTitle, 'aria-label': d.guideBack },
      '← ', h('span', { class: 'wide-only' }, d.guideBack), h('span', { class: 'phone-only' }, d.guideBackShort)),
    heading,
    h('button', { type: 'button', class: 'subtle lang-btn', title: d.langSwitchTitle, 'aria-label': d.langSwitchTitle,
      onclick: () => actions.switchLanguage() }, flagIcon(lang === 'de' ? 'en' : 'de')));

  const tocLinks = new Map<string, HTMLAnchorElement>();
  const toc = h('nav', { class: 'guide-toc', 'aria-label': d.guideContents },
    h('h2', {}, d.guideContents),
    h('ol', {}, ...sections.map((s) => {
      const a = h('a', { href: guideHash(lang, s.id) }, s.title);
      tocLinks.set(s.id, a);
      return h('li', {}, a);
    })));

  const article = h('article', { class: 'guide-content' });
  for (const [i, s] of sections.entries()) {
    const section = h('section', { class: 'guide-section', id: `g-${s.id}`, 'aria-labelledby': `gh-${s.id}` },
      h('h2', { id: `gh-${s.id}` }, h('span', { class: 'guide-num' }, String(i + 1).padStart(2, '0')), s.title));
    const body = h('div', { class: 'guide-body' });
    body.innerHTML = s.html; // static text from guide/de.ts and guide/en.ts
    section.append(body);
    article.append(section);
  }
  const element = h('div', { class: 'guide', lang }, header, h('div', { class: 'guide-layout' }, toc, article));

  const showSection = (id: string | null) => {
    const target = id ? element.querySelector<HTMLElement>(`#g-${CSS.escape(id)}`) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
    for (const [key, a] of tocLinks) a.toggleAttribute('aria-current', key === id);
  };

  // Section links (table of contents and links in the text): scroll without adding a history entry
  // for every click, but keep the address up to date so it can be copied.
  element.addEventListener('click', (ev) => {
    const link = (ev.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
    if (!link || ev.button !== 0 || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    const match = /^#(?:anleitung|guide)\/([\w-]+)$/.exec(link.getAttribute('href') ?? '');
    if (!match) return;
    ev.preventDefault();
    history.replaceState(null, '', guideHash(lang, match[1]));
    showSection(match[1]!);
  });

  return { element, showSection, focus: () => heading.focus({ preventScroll: true }) };
}
