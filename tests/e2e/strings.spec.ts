import { expect, test } from '@playwright/test';
import { answer, finishRound, probe, startModule } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

test('M1: Runde mit richtigen, falschen Antworten, Nochmal und Lösung bis zur Auswertung', async ({ page }) => {
  await startModule(page, 'strings');
  await expect(page.getByTestId('count')).toHaveText('1 / 10');

  for (let i = 0; i < 3; i++) {
    await answer(page, true);
    await expect(page.getByTestId('feedback')).toContainText('Richtig!');
    await page.getByTestId('next').click();
  }

  // falsch → Nochmal → wieder falsch → Lösung
  await answer(page, false);
  await expect(page.getByTestId('feedback')).toContainText('Leider nicht ganz.');
  await page.getByRole('button', { name: 'Nochmal' }).click();
  expect((await probe(page)).phase).toBe('answering');
  await answer(page, false);
  await expect(page.getByTestId('feedback')).toContainText('Lösung');
  await page.getByTestId('next').click();

  // falsch → Lösung zeigen
  await answer(page, false);
  await page.getByRole('button', { name: 'Lösung zeigen' }).click();
  await expect(page.getByTestId('feedback')).toContainText('Lösung');
  await page.getByTestId('next').click();

  await finishRound(page);
  const summary = page.getByTestId('summary');
  await expect(summary).toContainText('8 von 10');
  await expect(page.locator('.mistakes li')).toHaveCount(2);

  // Statistik erscheint auf der Übersicht
  await page.getByRole('link', { name: 'Zur Übersicht' }).last().click();
  await expect(page.getByTestId('module-strings')).toContainText('Antworten');
});

test('M1: Fehler kommen etwa 4 Fragen später als Wiederholung', async ({ page }) => {
  await startModule(page, 'strings');
  await answer(page, false);
  await page.getByRole('button', { name: 'Lösung zeigen' }).click();
  await page.getByTestId('next').click();
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('.retry-badge')).toHaveCount(0);
    await answer(page, true);
    await page.getByTestId('next').click();
  }
  await expect(page.locator('.retry-badge')).toHaveText('Wiederholung');
  await expect(page.getByTestId('count')).toHaveText('4 / 10');
});

test('M1: Einstellungen bleiben nach Neuladen erhalten', async ({ page }) => {
  await page.goto('./#/m/strings');
  await page.locator('[data-setting="count"][data-value="10"]').click();
  await page.locator('[data-setting="kinds"][data-value="tab"]').click();
  await page.reload();
  await expect(page.locator('[data-setting="count"][data-value="10"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-setting="kinds"][data-value="tab"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-setting="kinds"][data-value="dia"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('start')).toHaveText('Los geht’s · 10 Fragen');
});

test('Notennamen DE/EN wirken sofort', async ({ page }) => {
  await page.goto('./#/m/strings');
  // nur „Alle Saiten“, damit die Notentastatur sicher erscheint
  for (const k of ['name', 'num', 'tab', 'dia', 'staff']) await page.locator(`[data-setting="kinds"][data-value="${k}"]`).click();
  await page.getByTestId('start').click();
  await expect(page.locator('[data-letter="6"]')).toHaveText('H');
  await page.getByRole('button', { name: 'Runde abbrechen' }).click();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();

  await page.goto('./#/settings');
  await page.getByRole('button', { name: /Englisch/ }).click();
  await expect(page.getByRole('button', { name: /Englisch/ })).toHaveAttribute('aria-pressed', 'true');
  await page.goto('./#/m/strings');
  await page.getByTestId('start').click();
  await expect(page.locator('[data-letter="6"]')).toHaveText('B');
  await expect(page.getByTestId('prompt')).toContainText('Nenne alle Saiten');
});

test('Abbrechen fragt in der Seite nach und behält die Antworten', async ({ page }) => {
  await startModule(page, 'strings');
  await answer(page, true);
  await page.getByTestId('next').click();
  await page.getByRole('button', { name: 'Runde abbrechen' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('Runde abbrechen?');
  await page.getByRole('button', { name: 'Weiter üben' }).click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Runde abbrechen' }).click();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(page.getByTestId('module-stats')).toContainText('1 Antwort');
});

test('Quiz hat keine horizontale Scrollbreite bei 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startModule(page, 'strings');
  for (let i = 0; i < 6; i++) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await answer(page, i % 2 === 0);
    if (await page.getByRole('button', { name: 'Lösung zeigen' }).isVisible()) {
      await page.getByRole('button', { name: 'Lösung zeigen' }).click();
    }
    const after = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(after).toBeLessThanOrEqual(0);
    await page.getByTestId('next').click();
  }
});
