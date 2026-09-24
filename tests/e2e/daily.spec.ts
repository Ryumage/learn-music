import { expect, test } from '@playwright/test';
import { answer, finishRound, probe, startModule } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

const storedItems = (page: import('@playwright/test').Page) =>
  page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('saitenlesen') ?? '{"items":{}}').items as object));

test('„Heute fällig“ stimmt nach dem Tageswechsel; Tagesübung fragt die fälligen Elemente', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-03-10T15:00:00') });
  await startModule(page, 'strings');
  await finishRound(page);
  await page.goto('./');
  await expect(page.getByTestId('due')).toHaveText('Heute fällig: 0');
  await expect(page.getByTestId('start-daily')).toBeDisabled();

  const items = await storedItems(page);
  expect(items.length).toBeGreaterThan(0);

  // Am nächsten Morgen ab 3 Uhr ist alles fällig
  await page.clock.setSystemTime(new Date('2026-03-11T02:30:00'));
  await page.reload();
  await expect(page.getByTestId('due')).toHaveText('Heute fällig: 0');
  await page.clock.setSystemTime(new Date('2026-03-11T04:00:00'));
  await page.reload();
  await expect(page.getByTestId('due')).toHaveText(`Heute fällig: ${items.length}`);

  await page.getByTestId('start-daily').click();
  await expect(page.locator('.quiz-title')).toHaveText('Tagesübung');
  await expect(page.getByTestId('count')).toHaveText(`1 / ${Math.min(items.length, 20)}`);
  await finishRound(page);
  await page.getByRole('link', { name: 'Zur Übersicht' }).last().click();
  await expect(page.getByTestId('due')).toHaveText('Heute fällig: 0');
});

test('Falsche Antworten sind sofort fällig und kommen in der Tagesübung', async ({ page }) => {
  await startModule(page, 'strings');
  await answer(page, false);
  await page.getByRole('button', { name: 'Lösung zeigen' }).click();
  await page.getByRole('button', { name: 'Runde abbrechen' }).click();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await page.goto('./');
  await expect(page.getByTestId('due')).toHaveText('Heute fällig: 1');
  await page.getByTestId('start-daily').click();
  await expect(page.getByTestId('count')).toHaveText('1 / 1');
  await answer(page, true);
  await page.getByTestId('next').click();
  await expect(page.getByTestId('summary')).toContainText('1 von 1');
});

test('Export/Import-Rundlauf und zweistufiges Löschen', async ({ page }) => {
  await startModule(page, 'strings');
  await finishRound(page);
  await page.goto('./#/settings');
  await page.getByText('Lernstand anzeigen').click();
  const exported = await page.getByTestId('export-text').inputValue();
  expect(JSON.parse(exported).v).toBe(1);

  // Löschen: erst Rückfrage, dann weg
  await page.getByRole('button', { name: 'Lernstand löschen' }).click();
  await expect(page.getByText('Wirklich alles löschen?')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await page.goto('./');
  await expect(page.getByTestId('module-strings')).toContainText('10 Antworten');
  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Lernstand löschen' }).click();
  await page.getByRole('button', { name: 'Ja, alles löschen' }).click();
  await expect(page.getByTestId('data-msg')).toHaveText('Lernstand gelöscht.');
  await page.goto('./');
  await expect(page.getByTestId('module-strings')).toContainText('Noch nicht geübt');

  // Ungültiger Import ändert nichts
  await page.goto('./#/settings');
  await page.getByTestId('import-text').fill('kein Lernstand');
  await page.getByRole('button', { name: 'Importieren' }).click();
  await page.getByRole('button', { name: 'Ersetzen' }).click();
  await expect(page.getByTestId('data-msg')).toContainText('kein gültiger');

  // Import stellt alles wieder her
  await page.getByTestId('import-text').fill(exported);
  await page.getByRole('button', { name: 'Importieren' }).click();
  await page.getByRole('button', { name: 'Ersetzen' }).click();
  await expect(page.getByTestId('data-msg')).toHaveText('Lernstand wiederhergestellt.');
  await page.goto('./');
  await expect(page.getByTestId('module-strings')).toContainText('10 Antworten');
});

test('Statistik-Seite mit Kennzahlen, Modultabelle, Heatmap und Schwachstellen; keine Seiten-Scrollbreite', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('./#/m/fret');
  await page.locator('[data-setting="task"][data-value="name"]').click();
  await page.locator('[data-setting="count"][data-value="10"]').click();
  await page.getByTestId('start').click();
  await answer(page, false);
  await page.getByRole('button', { name: 'Lösung zeigen' }).click();
  await page.getByTestId('next').click();
  await finishRound(page);
  // Auswertung M4: Heatmap
  await expect(page.getByTestId('heatmap')).toBeVisible();

  await page.goto('./#/stats');
  await expect(page.getByTestId('stats-kpis')).toContainText('Antworten gesamt');
  await expect(page.locator('.stats-table')).toContainText('Griffbrett');
  await expect(page.locator('.hm-cell').first()).toBeVisible();
  await expect(page.locator('.weak-list li').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Auswertung M2 zeigt die schwächsten Noten', async ({ page }) => {
  await page.goto('./#/m/staff');
  await page.locator('[data-setting="count"][data-value="3"]').click();
  await page.getByTestId('start').click();
  const p = await probe(page);
  for (const f of p.fields!) await page.locator(`[data-letter="${(f.letter + 1) % 7}"]`).click();
  await page.getByTestId('check').click();
  await page.getByRole('button', { name: 'Lösung zeigen' }).click();
  await page.getByTestId('next').click();
  await finishRound(page);
  await expect(page.getByTestId('weakest')).toContainText('falsch');
});
