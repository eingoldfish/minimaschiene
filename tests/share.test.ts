import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare } from '../src/storage/share';
import { EXAMPLES } from '../src/ui/examples';

describe('share link', () => {
  it('round-trips every example (incl. umlauts and the extended flag)', async () => {
    for (const e of EXAMPLES) {
      const fragment = await encodeShare({ source: e.source, extended: e.extended });
      expect(await decodeShare('#' + fragment)).toEqual({ source: e.source, extended: e.extended });
    }
  });

  it('compresses and only uses URL-safe characters', async () => {
    const source = EXAMPLES[0]!.source;
    const fragment = await encodeShare({ source, extended: false });
    expect(fragment).toMatch(/^code=z[A-Za-z0-9_-]+$/);
    expect(fragment.length).toBeLessThan(source.length);
  });

  it('reads uncompressed links (fallback format)', async () => {
    const plain = 'code=p' + btoa('HALT').replace(/=+$/, '');
    expect(await decodeShare(plain)).toEqual({ source: 'HALT', extended: false });
  });

  it('returns null without a program and throws for damaged links', async () => {
    expect(await decodeShare('#something=else')).toBeNull();
    expect(await decodeShare('')).toBeNull();
    await expect(decodeShare('#code=zAAAA')).rejects.toThrow();
    await expect(decodeShare('#code=x123')).rejects.toThrow();
  });
});
