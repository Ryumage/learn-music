import { expect, test, type Page } from '@playwright/test';
import { answer, finishRound, probe } from './helpers';

async function start(page: Page, mod: string, off: string[] = [], count = '10') {
  await page.goto(`./#/m/${mod}`);
  for (const t of off) await page.locator(`[data-setting="topics"][data-value="${t}"]`).click();
  await page.locator(`[data-setting="count"][data-value="${count}"]`).click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('prompt')).toBeVisible();
}

/** Beantwortet Fragen richtig (mit weiteren Runden) und sammelt die Fragetypen „tab:capo“ usw. */
async function collectTypes(page: Page, want: number, max: number): Promise<Set<string>> {
  const seen = new Set<string>();
  for (let i = 0; i < max && seen.size < want; i++) {
    if (await page.getByTestId('summary').isVisible()) await page.locator('[data-action=restart]').click();
    const p = await probe(page);
    seen.add(p.items[0]!.split(':').slice(0, 2).join(':'));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, p.items[0]).toBeLessThanOrEqual(0);
    await answer(page, true);
    await expect(page.getByTestId('feedback')).toContainText('Richtig!');
    await page.getByTestId('next').click();
    await expect(page.getByTestId('summary').or(page.getByTestId('check'))).toBeVisible();
  }
  return seen;
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

for (const mod of ['tabs', 'rhythm']) {
  test(`${mod}: richtig, falsch → Nochmal → Lösung, bis zur Auswertung`, async ({ page }) => {
    await start(page, mod);
    for (let i = 0; i < 3; i++) {
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
    await finishRound(page);
    await expect(page.getByTestId('summary')).toContainText('von 10');
  });
}

test('M6: alle Fragetypen erscheinen, H/B-Fragen im Deutsch-Modus', async ({ page }) => {
  test.setTimeout(240_000);
  await start(page, 'tabs', [], '30');
  const all = ['line', 'note', 'know', 'tech', 'arc', 'stack', 'capo', 'cfret', 'head', 'hb'].map((t) => `tab:${t}`);
  const seen = await collectTypes(page, all.length, 150);
  expect([...seen].sort()).toEqual(all.sort());
});

test('M6: im Englisch-Modus keine H/B-Fragen', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./#/settings');
  await page.getByRole('button', { name: /Englisch/ }).click();
  // nur „Akkorde & Capo“: dort stünden die H/B-Fragen
  await start(page, 'tabs', ['basics', 'tech'], '30');
  const seen = await collectTypes(page, 99, 40);
  expect(seen.has('tab:hb')).toBe(false);
  for (const t of seen) expect(['tab:capo', 'tab:cfret', 'tab:head', 'tab:stack']).toContain(t);
});

test('M7: alle Fragetypen erscheinen', async ({ page }) => {
  test.setTimeout(240_000);
  await start(page, 'rhythm', [], '30');
  const all = ['val', 'beats', 'fill', 'count', 'strum', 'time', 'tempo'].map((t) => `rh:${t}`);
  const seen = await collectTypes(page, all.length, 150);
  expect([...seen].sort()).toEqual(all.sort());
});

test('M7: Schlagmuster zählt nach dem Prüfen mit', async ({ page }) => {
  await start(page, 'rhythm', ['values', 'time'], '30');
  for (let i = 0; i < 30; i++) {
    const p = await probe(page);
    await answer(page, true);
    if (p.items[0]!.startsWith('rh:strum:')) {
      await expect(page.getByTestId('feedback').locator('.strum-count')).toHaveText(['1', '1 +', '2', '2 +', '3', '3 +', '4', '4 +']);
      return;
    }
    await page.getByTestId('next').click();
  }
  throw new Error('kein Schlagmuster');
});
