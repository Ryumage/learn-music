import { expect, test } from '@playwright/test';
import { answer, finishRound, probe } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

test('Akkord-Bibliothek: Menüpunkt, Filter, Griff wählen und im Trainer üben', async ({ page }) => {
  await page.goto('./');
  await page.getByTestId('tool-library').click();
  await expect(page.getByRole('heading', { name: 'Akkord-Bibliothek' })).toBeVisible();
  // Standard: C, alle Typen
  await expect(page.getByTestId('lib-count')).toContainText('17 Akkorde');
  await page.locator('[data-action=lib-root][data-root="1"]').click();
  await page.locator('[data-action=lib-type][data-type="m"]').click();
  await expect(page.getByTestId('lib-count')).toHaveText('1 Akkord, 2 Griffe');
  await expect(page.locator('.lib-chord h2')).toContainText('C#m (cis-Moll)');
  await page.locator('[data-action=lib-pick][data-id="C#m@x46654"]').click();
  await expect(page.getByTestId('lib-dock')).toContainText('C#m');
  await page.locator('[data-action=lib-use][data-slot="b"]').click();
  // im Trainer als Akkord 2
  await expect(page.getByTestId('changes-start')).toBeVisible();
  await expect(page.locator('[data-action=changes-pick][data-slot="b"][data-id="C#m@x46654"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.changes-diagram figcaption').nth(1)).toHaveText('C#m');
  // bleibt nach Neustart gemerkt – Trainer-Auswahl und Bibliotheksfilter
  await page.reload();
  await expect(page.locator('.changes-diagram figcaption').nth(1)).toHaveText('C#m');
  await page.getByTestId('changes-library-link').click();
  await expect(page.getByTestId('lib-count')).toHaveText('1 Akkord, 2 Griffe');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('M5 mit der ganzen Bibliothek: Runde mit Diagramm, Griff (auch hohe Lagen) und Tönen', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./#/m/chords');
  await page.locator('[data-setting="sets"][data-value="all"]').click();
  await page.locator('[data-setting="sets"][data-value="basic"]').click();
  await page.locator('[data-setting="count"][data-value="20"]').click();
  await page.getByTestId('start').click();
  const kinds = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const p = await probe(page);
    kinds.add(p.kind);
    await answer(page, true);
    await expect(page.getByTestId('feedback')).toContainText('Richtig!');
    await page.getByTestId('next').click();
    if (await page.getByTestId('summary').isVisible()) break;
  }
  await finishRound(page);
  expect([...kinds].sort()).toEqual(['chord', 'notes', 'shape']);
});

test('Griff-Editor: Lage verschieben nimmt gesetzte Punkte mit', async ({ page }) => {
  await page.goto('./#/m/chords');
  await page.locator('[data-setting="task"][data-value="shape"]').click();
  await page.getByTestId('start').click();
  // A-Saite, 3. Bund = C
  await page.locator('[data-action=cd-cell][data-index="1"][data-fret="3"]').click();
  await expect(page.locator('.cd-name').nth(1)).toHaveText('C');
  await page.locator('[data-action=cd-base][data-step="1"]').click();
  await expect(page.getByTestId('shape-base')).toHaveText('ab 2. Bund');
  // der Punkt wandert mit: 4. Bund = Cis
  await expect(page.locator('.cd-name').nth(1)).toHaveText('Cis');
  await page.locator('[data-action=cd-base][data-step="-1"]').click();
  await expect(page.getByTestId('shape-base')).toHaveText('erste Lage');
  await expect(page.locator('.cd-name').nth(1)).toHaveText('C');
});
