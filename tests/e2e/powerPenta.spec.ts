import { expect, test } from '@playwright/test';
import { answer, finishRound, probe } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

test.describe('Querformat', () => {
  // Antipp-Aufgaben (Grundton finden, Pattern greifen) laufen auf dem Telefon quer
  test.use({ viewport: { width: 844, height: 390 } });

  test('M8 Powerchords: Einführung, Runde mit allen Aufgaben, falsch → Nochmal → Lösung', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('./');
    await page.getByTestId('module-power').click();
    await expect(page.getByTestId('module-intro')).toContainText('Grundton und Quinte');
    await expect(page.locator('.pw-shape')).toHaveCount(3);
    await page.locator('[data-setting="count"][data-value="30"]').click();
    await page.getByTestId('start').click();
    const kinds = new Set<string>();
    for (let i = 0; i < 3; i++) {
      kinds.add((await probe(page)).kind);
      await answer(page, true);
      await expect(page.getByTestId('feedback')).toContainText('Richtig!');
      await page.getByTestId('next').click();
    }
    await answer(page, false);
    await expect(page.getByTestId('feedback')).toContainText('Leider nicht ganz.');
    await page.getByRole('button', { name: 'Nochmal' }).click();
    await answer(page, false);
    await expect(page.getByTestId('feedback')).toContainText('Lösung');
    await page.getByTestId('next').click();
    for (let i = 0; i < 40; i++) {
      if (await page.getByTestId('summary').isVisible()) break;
      kinds.add((await probe(page)).kind);
      await answer(page, true);
      await page.getByTestId('next').click();
      await expect(page.getByTestId('summary').or(page.getByTestId('check'))).toBeVisible();
    }
    await finishRound(page);
    expect([...kinds].sort()).toEqual(['choice', 'notes', 'shape', 'tap']);
  });

  test('M9 Pentatonik: Pattern greifen, erkennen, Stufen – Runde bis zur Auswertung', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('./#/m/penta');
    await page.locator('[data-setting="count"][data-value="10"]').click();
    await page.getByTestId('start').click();
    const kinds = new Set<string>();
    for (let i = 0; i < 30; i++) {
      if (await page.getByTestId('summary').isVisible()) break;
      const p = await probe(page);
      kinds.add(p.items[0]!.slice(0, 4));
      await answer(page, true);
      await expect(page.getByTestId('feedback')).toContainText('Richtig!');
      await page.getByTestId('next').click();
      await expect(page.getByTestId('summary').or(page.getByTestId('check'))).toBeVisible();
    }
    await expect(page.getByTestId('summary')).toContainText('von 10');
    expect(kinds.has('pnt:')).toBe(true);
  });
});

test('Pentatonik-Patterns: Tonart wählen, blättern, abspielen mit Hervorhebung, Pattern üben', async ({ page }) => {
  await page.clock.install();
  await page.goto('./');
  await page.getByTestId('tool-penta').click();
  await expect(page.getByTestId('penta-title')).toHaveText('a-Moll-Pentatonik');
  await expect(page.locator('.penta-thumb')).toHaveCount(5);
  // E-Moll, Pattern 1 liegt am Sattel
  await page.locator('[data-action=penta-root][data-value="4"]').click();
  await expect(page.getByTestId('penta-title')).toHaveText('e-Moll-Pentatonik');
  await expect(page.getByTestId('penta-page')).toHaveText('Pattern 1 von 5');
  await page.locator('[data-action=penta-page][data-value="1"]').click();
  await expect(page.getByTestId('penta-page')).toHaveText('Pattern 2 von 5');
  // Abspielen: der gespielte Bund leuchtet, Schritt für Schritt
  await page.getByTestId('penta-play').click();
  await expect(page.getByTestId('penta-play')).toContainText('Stopp');
  await expect(page.locator('.penta-board .fb-marker.is-playing')).toHaveCount(1);
  const first = await page.locator('.penta-board .fb-marker.is-playing').getAttribute('data-marker');
  await page.clock.runFor(700);
  const second = await page.locator('.penta-board .fb-marker.is-playing').getAttribute('data-marker');
  expect(second).not.toBe(first);
  // auf und ab: 23 Töne bei 90 pro Minute
  await page.clock.runFor(23 * 667);
  await expect(page.getByTestId('penta-play')).toContainText('Abspielen');
  await expect(page.locator('.penta-board .fb-marker.is-playing')).toHaveCount(0);
  // ein bestimmtes Pattern wählen und üben
  await page.locator('.penta-thumb[data-value="3"]').click();
  await expect(page.getByTestId('penta-page')).toHaveText('Pattern 3');
  await page.getByTestId('penta-practice').click();
  await expect(page.getByTestId('prompt')).toContainText('e-Moll-Pentatonik');
  const p = await probe(page);
  expect(p.items[0]).toMatch(/^pn[twd]:minor:4:3$/);
  // Auswahl bleibt gemerkt
  await page.goto('./#/penta');
  await expect(page.getByTestId('penta-title')).toHaveText('e-Moll-Pentatonik');
});
