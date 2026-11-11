import { describe, expect, it } from 'vitest';
import { assemble, Cpu, formatError, INSTRUCTIONS, SP_START, toSigned16 } from '../src/core';
import { guideSections } from '../src/ui/guide/content';
import { guideHash, parseGuideHash } from '../src/ui/guide/route';

/** Turns the HTML of a code block back into plain text. */
function unescape(html: string): string {
  return html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}

interface CodeExample { lang: string; extended: boolean; check: [string, number]; source: string }

function codeExamples(): CodeExample[] {
  const result: CodeExample[] = [];
  for (const lang of ['de', 'en'] as const) {
    for (const section of guideSections(lang)) {
      for (const m of section.html.matchAll(/<pre class="g-code" data-asm(?:="(\w+)")? data-check="(\w+)=(-?\d+)">([\s\S]*?)<\/pre>/g)) {
        result.push({ lang, extended: m[1] === 'extended', check: [m[2]!, Number(m[3])], source: unescape(m[4]!) });
      }
    }
  }
  return result;
}

describe('guide', () => {
  it('has the same sections in German and English', () => {
    expect(guideSections('en').map((s) => s.id)).toEqual(guideSections('de').map((s) => s.id));
  });

  it('every code example is checked, in both languages', () => {
    const examples = codeExamples();
    const de = examples.filter((e) => e.lang === 'de');
    expect(de.length).toBeGreaterThanOrEqual(5);
    expect(examples.length).toBe(2 * de.length);
    // every block marked data-asm is matched by the pattern above
    const marked = (['de', 'en'] as const).flatMap((l) => guideSections(l)).map((s) => s.html.split('data-asm').length - 1)
      .reduce((a, b) => a + b, 0);
    expect(marked).toBe(examples.length);
  });

  it.each(codeExamples().map((e) => [`${e.lang}: ${e.source.split('\n')[0]}`, e] as const))('%s assembles, runs and computes the result', (_name, e) => {
    const r = assemble(e.source, { extended: e.extended });
    expect(r.errors.map((x) => formatError(x))).toEqual([]);
    const cpu = new Cpu();
    cpu.extended = e.extended;
    cpu.loadMemory(r.memory);
    expect(cpu.run(100_000).reason).toBe('halt');
    const [label, expected] = e.check;
    const address = r.labels.get(label);
    expect(address, `label ${label}`).toBeDefined();
    expect(toSigned16(cpu.getState().memory[address!]!)).toBe(expected);
    if (e.extended) expect(cpu.getState().sp).toBe(SP_START);
  });

  it('the instruction reference lists every instruction and alias', () => {
    for (const lang of ['de', 'en'] as const) {
      const html = guideSections(lang).find((s) => s.id === 'befehle')!.html;
      for (const def of INSTRUCTIONS) {
        for (const name of [def.mnemonic, ...def.aliases, def.immediateMnemonic].filter(Boolean)) {
          expect(html, `${lang}: ${name}`).toContain(`<code>${name}`);
        }
      }
    }
  });

  it('internal links point to existing sections', () => {
    for (const lang of ['de', 'en'] as const) {
      const sections = guideSections(lang);
      const ids = new Set(sections.map((s) => s.id));
      for (const s of sections) {
        for (const m of s.html.matchAll(/href="(#[^"]*)"/g)) {
          const parsed = parseGuideHash(m[1]!);
          expect(parsed, `${lang}/${s.id}: ${m[1]}`).not.toBeNull();
          expect(ids.has(parsed!.section ?? ''), `${lang}/${s.id}: ${m[1]}`).toBe(true);
        }
      }
    }
  });

  it('reads and builds the address of the guide', () => {
    expect(parseGuideHash('#anleitung')).toEqual({ section: null });
    expect(parseGuideHash('#guide/befehle')).toEqual({ section: 'befehle' });
    expect(parseGuideHash('#code=abc')).toBeNull();
    expect(parseGuideHash('')).toBeNull();
    expect(guideHash('de', 'flags')).toBe('#anleitung/flags');
    expect(guideHash('en')).toBe('#guide');
  });
});
