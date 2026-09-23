import { describe, expect, it } from 'vitest';
import { isIOS, isStandalone, shouldShowInstallHint } from '../../src/util/platform';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';

describe('Plattform-Erkennung', () => {
  it('erkennt das iPhone', () => {
    expect(isIOS({ userAgent: IPHONE_UA })).toBe(true);
  });

  it('erkennt iPadOS, das sich als Mac meldet', () => {
    expect(isIOS({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
  });

  it('hält einen Mac ohne Touch nicht für iOS', () => {
    expect(isIOS({ userAgent: MAC_UA, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
  });

  it('hält Android nicht für iOS', () => {
    expect(isIOS({ userAgent: ANDROID_UA, platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false);
  });

  it('erkennt den Standalone-Modus', () => {
    expect(isStandalone({ userAgent: IPHONE_UA, standalone: true })).toBe(true);
    expect(isStandalone({ userAgent: IPHONE_UA, displayModeStandalone: true })).toBe(true);
    expect(isStandalone({ userAgent: IPHONE_UA })).toBe(false);
  });
});

describe('Installationshinweis', () => {
  it('erscheint in Safari auf dem iPhone', () => {
    expect(shouldShowInstallHint({ userAgent: IPHONE_UA, standalone: false })).toBe(true);
  });

  it('erscheint nicht in der installierten App', () => {
    expect(shouldShowInstallHint({ userAgent: IPHONE_UA, standalone: true })).toBe(false);
  });

  it('erscheint nicht auf Android', () => {
    expect(shouldShowInstallHint({ userAgent: ANDROID_UA })).toBe(false);
  });
});
