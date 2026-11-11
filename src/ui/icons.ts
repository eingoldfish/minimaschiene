/**
 * Small inline SVG icons (own drawings; flags follow the official designs,
 * simplified). Built from fixed markup – no user data goes in here.
 */
import type { Language } from '../core';

function fromMarkup(markup: string): SVGSVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  const svg = template.content.firstElementChild as SVGSVGElement;
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  return svg;
}

/** Two overlapping sheets – the usual "copy" symbol. */
export function copyIcon(): SVGSVGElement {
  return fromMarkup(`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`);
}

/** A check mark, shown briefly after copying. */
export function checkIcon(): SVGSVGElement {
  return fromMarkup(`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
    stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>`);
}

const FLAGS: Record<Language, string> = {
  de: `<svg class="flag-icon" viewBox="0 0 5 3"><rect width="5" height="1" y="0" fill="#000"/>
    <rect width="5" height="1" y="1" fill="#DD0000"/><rect width="5" height="1" y="2" fill="#FFCE00"/></svg>`,
  en: `<svg class="flag-icon" viewBox="0 0 60 30"><clipPath id="flag-en-clip">
    <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
    <rect width="60" height="30" fill="#012169"/>
    <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>
    <path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#flag-en-clip)" stroke="#C8102E" stroke-width="4"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/>
    <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></svg>`,
};

/** Flag for a language (UK flag for English). */
export function flagIcon(lang: Language): SVGSVGElement {
  return fromMarkup(FLAGS[lang]);
}

/** Four corners pointing outwards – "make bigger". */
export function maximizeIcon(): SVGSVGElement {
  return fromMarkup(`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>`);
}

/** Four corners pointing inwards – "make smaller again". */
export function restoreIcon(): SVGSVGElement {
  return fromMarkup(`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>`);
}

/** Arrows pointing out to the corners – "fill the whole screen". */
export function fullscreenIcon(): SVGSVGElement {
  return fromMarkup(`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>`);
}

/** Arrows pointing in from the corners – "leave full screen". */
export function exitFullscreenIcon(): SVGSVGElement {
  return fromMarkup(`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/></svg>`);
}
