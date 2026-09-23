import { describe, expect, it } from 'vitest';
import { esc } from '../../src/util/html';

describe('esc', () => {
  it('maskiert HTML-Sonderzeichen', () => {
    expect(esc(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;',
    );
  });

  it('lässt Umlaute und Notenzeichen stehen', () => {
    expect(esc('Eselsbrücke ♯ ♭ 𝄠')).toBe('Eselsbrücke ♯ ♭ 𝄠');
  });

  it('wandelt Zahlen in Text', () => {
    expect(esc(7)).toBe('7');
  });
});
