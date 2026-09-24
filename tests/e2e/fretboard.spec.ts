import { expect, test, type Page } from '@playwright/test';
import { answer, cell, finishRound, probe, startModule } from './helpers';

const OPEN: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };

async function startFret(page: Page, task: string, extra: [string, string][] = []) {
  await page.goto('./#/m/fret');
  await page.locator(`[data-setting="task"][data-value="${task}"]`).click();
  for (const [k, v] of extra) await page.locator(`[data-setting="${k}"][data-value="${v}"]`).click();
  await page.locator('[data-setting="count"][data-value="10"]').click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('prompt')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

for (const task of ['name', 'find', 'all']) {
  test(`M4 ${task}: richtig, falsch → Nochmal → Lösung, bis zur Auswertung`, async ({ page }) => {
    await startFret(page, task, task === 'all' ? [['frets', '0-12']] : task === 'name' ? [['points', '2-4']] : []);
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

test('M4 finden: andere Saiten sind abgedunkelt und nicht antippbar', async ({ page }) => {
  await startFret(page, 'find');
  const strings = await page.locator('[data-action=tap]').evaluateAll((els) => [...new Set(els.map((e) => (e as HTMLElement).dataset.string))]);
  expect(strings).toHaveLength(1);
  await expect(page.locator('.fb-veil')).toHaveCount(5);
});

test('M4 alle finden: Mehrfachauswahl, nochmal tippen hebt auf, Rückmeldung zählt', async ({ page }) => {
  await startFret(page, 'all', [['frets', '0-12']]);
  const p = await probe(page);
  const t = p.targets![0]!;
  await cell(page, t.string, t.fret).click();
  await expect(page.locator(`[data-marker="${t.string}:${t.fret}"]`)).toHaveCount(1);
  await cell(page, t.string, t.fret).click();
  await expect(page.locator(`[data-marker="${t.string}:${t.fret}"]`)).toHaveCount(0);
  await cell(page, t.string, t.fret).click();
  await page.getByTestId('check').click();
  if (p.targets!.length > 1) await expect(page.getByTestId('feedback')).toContainText(`1 von ${p.targets!.length} gefunden`);
  else await expect(page.getByTestId('feedback')).toContainText('Richtig!');
});

for (const view of ['low-bottom', 'low-top'] as const) {
  test(`Tippen trifft zuverlässig die richtige Zelle (${view})`, async ({ page }) => {
    if (view === 'low-top') {
      await page.goto('./#/settings');
      await page.getByRole('button', { name: 'Tiefe E-Saite oben' }).click();
    }
    await startModule(page, 'read');
    for (const s of [6, 5, 4, 3, 2, 1]) {
      for (const f of [0, 1, 3, 5]) {
        await cell(page, s, f).evaluate((e) => e.scrollIntoView({ block: 'center' }));
        const box = (await cell(page, s, f).boundingBox())!;
        // Tipp in die Zellmitte und knapp an den Rand
        for (const [dx, dy] of [
          [0.5, 0.5],
          [0.15, 0.2],
          [0.85, 0.8],
        ]) {
          await page.mouse.click(box.x + box.width * dx!, box.y + box.height * dy!);
          await expect(page.locator(`[data-marker="${s}:${f}"]`)).toHaveCount(1);
        }
        expect(box.width).toBeGreaterThanOrEqual(30);
        expect(box.height).toBeGreaterThanOrEqual(30);
      }
    }
  });
}

test('Ansicht umschaltbar: tiefe E-Saite oben, Sattel rechts', async ({ page }) => {
  await startModule(page, 'read');
  let low = (await cell(page, 6, 1).boundingBox())!;
  let high = (await cell(page, 1, 1).boundingBox())!;
  let open = (await cell(page, 6, 0).boundingBox())!;
  expect(low.y).toBeGreaterThan(high.y);
  expect(open.x).toBeLessThan(low.x);

  await page.goto('./#/settings');
  await page.getByRole('button', { name: 'Tiefe E-Saite oben' }).click();
  await expect(page.getByTestId('fret-preview')).toBeVisible();
  await startModule(page, 'read');
  low = (await cell(page, 6, 1).boundingBox())!;
  high = (await cell(page, 1, 1).boundingBox())!;
  open = (await cell(page, 6, 0).boundingBox())!;
  expect(low.y).toBeLessThan(high.y);
  expect(open.x).toBeGreaterThan(low.x);
});

test('M3: gleicher Ton in anderer Oktave bekommt eine eigene Meldung', async ({ page }) => {
  await page.goto('./#/m/read');
  await page.locator('[data-setting="level"][data-value="4"]').click();
  await page.getByTestId('start').click();
  for (let i = 0; i < 20; i++) {
    const p = await probe(page);
    const t = p.targets![0]!;
    const m = OPEN[t.string]! + t.fret;
    let octave: { s: number; f: number } | null = null;
    for (const s of [6, 5, 4, 3, 2, 1]) {
      for (let f = 0; f <= 5; f++) if (Math.abs(OPEN[s]! + f - m) === 12) octave = { s, f };
    }
    if (!octave) {
      await answer(page, true);
      await page.getByTestId('next').click();
      continue;
    }
    await cell(page, octave.s, octave.f).click();
    await page.getByTestId('check').click();
    await expect(page.getByTestId('feedback')).toContainText('Richtiger Ton, falsche Oktave');
    await page.getByRole('button', { name: 'Lösung zeigen' }).click();
    await expect(page.locator('.fb-marker.fb-solution').first()).toBeVisible();
    return;
  }
  throw new Error('keine Frage mit Oktav-Alternative gefunden');
});

test('M3: Runde bis zur Auswertung', async ({ page }) => {
  await startModule(page, 'read');
  await answer(page, false);
  await page.getByRole('button', { name: 'Lösung zeigen' }).click();
  await page.getByTestId('next').click();
  await finishRound(page);
  await expect(page.getByTestId('summary')).toContainText('9 von 10');
});

test('Hochformat: Hinweis „quer halten“, lässt sich dauerhaft ausblenden', async ({ page }) => {
  await startModule(page, 'fret');
  await expect(page.getByTestId('landscape-hint')).toBeVisible();
  await page.getByRole('button', { name: 'Hinweis ausblenden' }).click();
  await expect(page.getByTestId('landscape-hint')).toHaveCount(0);
  await startModule(page, 'read');
  await expect(page.getByTestId('landscape-hint')).toHaveCount(0);
});

for (const mod of ['fret', 'read']) {
  test(`Querformat (${mod}): breitere Zellen, ganzes Griffbrett sichtbar, Tippen trifft`, async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(`./#/m/${mod}`);
    if (mod === 'fret') await page.locator('[data-setting="task"][data-value="find"]').click();
    await page.getByTestId('start').click();
    await expect(page.getByTestId('landscape-hint')).toHaveCount(0);
    const cells = page.locator('[data-action=tap]');
    const first = (await cells.first().boundingBox())!;
    expect(first.width).toBeGreaterThanOrEqual(60);
    expect(first.height).toBeGreaterThanOrEqual(26);
    // alle Zellen oberhalb des Docks
    const dockTop = (await page.locator('.dock').boundingBox())!.y;
    const bottoms = await cells.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().bottom));
    expect(Math.max(...bottoms)).toBeLessThanOrEqual(dockTop + 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await answer(page, true);
    await expect(page.getByTestId('feedback')).toContainText('Richtig!');
  });
}
