import { describe, expect, it } from 'vitest';
// ?raw imports the file content as text (Vite feature)
import css from '../src/styles.css?raw';

/**
 * The dark colours exist twice in styles.css: once for "automatic" (system is
 * dark) and once for the dark mode chosen with the switch. Both must define
 * the same colours, otherwise one of the two dark modes looks different.
 */

function declarations(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(start, css.indexOf('}', start));
  const result: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    expect(result[name!], `${name} twice in ${selector}`).toBeUndefined();
    result[name!] = value!.trim();
  }
  return result;
}

describe('colour tokens', () => {
  const light = declarations(':root {');
  const darkAuto = declarations(":root:not([data-theme='light']) {");
  const darkChosen = declarations(":root[data-theme='dark'] {");

  it('both dark modes define exactly the same colours', () => {
    expect(darkChosen).toEqual(darkAuto);
  });

  it('every colour of the light mode also exists in dark mode', () => {
    const colours = Object.keys(light).filter((k) => light[k]!.startsWith('#'));
    expect(colours.filter((k) => !(k in darkAuto))).toEqual([]);
  });
});
