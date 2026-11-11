/**
 * Content of the built-in guide ("Anleitung"), in German and English.
 *
 * The texts are static HTML strings (no DOM needed, so they can be checked in
 * tests). Everything that the app already defines – the instruction table,
 * opcodes, flags, addressing modes – is generated from src/core/isa.ts, so
 * the guide can never contradict the machine.
 *
 * Code examples marked with data-asm are assembled and executed in
 * tests/guide.test.ts; data-check="label=value" is the expected result.
 */
import { INSTRUCTIONS, type AddressingMode, type InstructionDef, type InstructionGroup, type Language } from '../../core';
import { sectionsDe } from './de';
import { sectionsEn } from './en';

export interface GuideSection {
  /** Used in the link: #anleitung/<id>. The same in both languages. */
  id: string;
  title: string;
  /** Trusted, static HTML. */
  html: string;
}

/** Parts of the guide that are generated from the app's own definitions. */
export interface GuideGenerated {
  /** All instruction tables, grouped. */
  instructionTables: string;
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** How the address part is written for each addressing mode. */
const MODE_SYNTAX: Record<Exclude<AddressingMode, 'none'>, Record<Language, string>> = {
  direct: { de: 'adr', en: 'adr' },
  immediate: { de: '$zahl', en: '$num' },
  indirect: { de: '(adr)', en: '(adr)' },
  offset: { de: 'n(SP)', en: 'n(SP)' },
  offsetIndirect: { de: '@n(SP)', en: '@n(SP)' },
  immediateOffset: { de: '$n(SP)', en: '$n(SP)' },
};

const SP_MODES: readonly AddressingMode[] = ['offset', 'offsetIndirect', 'immediateOffset'];

/** The possible address parts of an instruction, e.g. "adr · $zahl · (adr) · n(SP)ᴱ …". */
function addressForms(def: InstructionDef, lang: Language): string {
  // RSV/REL: the number is written without "$" (RSV 3).
  if (def.immediateMnemonic === def.mnemonic) return `<code>${lang === 'de' ? 'zahl' : 'num'}</code>`;
  const parts = def.modes.filter((m): m is Exclude<AddressingMode, 'none'> => m !== 'none').map((mode) =>
    `<code>${escapeHtml(MODE_SYNTAX[mode][lang])}</code>${SP_MODES.includes(mode) && !def.extendedOnly ? '<sup>E</sup>' : ''}`);
  return parts.length ? parts.join(' · ') : (lang === 'de' ? '<span class="g-muted">keiner</span>' : '<span class="g-muted">none</span>');
}

const GROUPS: { key: InstructionGroup | 'extended'; title: Record<Language, string> }[] = [
  { key: 'memory', title: { de: 'Laden und Speichern', en: 'Load and store' } },
  { key: 'arithmetic', title: { de: 'Rechnen und Vergleichen', en: 'Arithmetic and compare' } },
  { key: 'logic', title: { de: 'Bitoperationen und Schieben', en: 'Bit operations and shifts' } },
  { key: 'jump', title: { de: 'Sprünge', en: 'Jumps' } },
  { key: 'control', title: { de: 'Steuerung', en: 'Control' } },
  { key: 'extended', title: { de: 'Stack und Unterprogramme (nur erweiterter Modus)', en: 'Stack and subroutines (extended mode only)' } },
];

function groupOf(def: InstructionDef): InstructionGroup | 'extended' {
  return def.extendedOnly ? 'extended' : def.group;
}

function hex2(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** The instruction tables, generated from the ISA (the same data as the editor help). */
export function instructionTables(lang: Language): string {
  const head = lang === 'de'
    ? ['Befehl', 'Adressteil', 'Wirkung', 'Flags', 'Opcode']
    : ['Instruction', 'Address part', 'Effect', 'Flags', 'Opcode'];
  const also = lang === 'de' ? 'auch' : 'also';
  const short = lang === 'de' ? 'kurz' : 'short';
  return GROUPS.map((group) => {
    const defs = INSTRUCTIONS.filter((d) => groupOf(d) === group.key);
    const rows = defs.map((d) => {
      const aliases = d.aliases.length ? `<br><span class="g-muted">${also} ${d.aliases.map((a) => `<code>${a}</code>`).join(', ')}</span>` : '';
      const immediate = d.immediateMnemonic && d.immediateMnemonic !== d.mnemonic
        ? `<br><span class="g-muted">${short} <code>${d.immediateMnemonic}</code></span>` : '';
      return `<tr><th scope="row"><code>${d.mnemonic}</code>${aliases}${immediate}</th>`
        + `<td>${addressForms(d, lang)}</td>`
        + `<td>${escapeHtml(d.description[lang])}</td>`
        + `<td>${escapeHtml(d.flags[lang])}</td>`
        + `<td class="g-mono">${d.opcode}<br><span class="g-muted">${hex2(d.opcode)}</span></td></tr>`;
    });
    if (group.key === 'memory') {
      rows.push(lang === 'de'
        ? '<tr><th scope="row"><code>WORD</code></th><td><code>zahl</code> · <code>marke</code></td>'
          + '<td>Kein Befehl, sondern eine Anweisung an den Assembler: belegt <em>eine</em> Speicherzelle mit dem Startwert (auch negativ, hexadezimal oder die Adresse einer Marke).</td><td>–</td><td class="g-mono">–</td></tr>'
        : '<tr><th scope="row"><code>WORD</code></th><td><code>num</code> · <code>label</code></td>'
          + '<td>Not an instruction but a directive for the assembler: fills <em>one</em> memory cell with the start value (also negative, hexadecimal or the address of a label).</td><td>–</td><td class="g-mono">–</td></tr>');
    }
    return `<h4>${group.title[lang]}</h4>`
      + `<div class="g-scroll"><table class="g-table g-instr"><thead><tr>${head.map((x) => `<th scope="col">${x}</th>`).join('')}</tr></thead>`
      + `<tbody>${rows.join('')}</tbody></table></div>`;
  }).join('');
}

/** All sections of the guide in the given language. */
export function guideSections(lang: Language): GuideSection[] {
  const generated: GuideGenerated = { instructionTables: instructionTables(lang) };
  return lang === 'de' ? sectionsDe(generated) : sectionsEn(generated);
}
