import { expect, test, type Page } from '@playwright/test';
import { answer, finishRound, probe, setShape } from './helpers';

async function startChords(page: Page, task: string, sets: string[] = []) {
  await page.goto('./#/m/chords');
  await page.locator(`[data-setting="task"][data-value="${task}"]`).click();
  for (const s of sets) await page.locator(`[data-setting="sets"][data-value="${s}"]`).click();
  await page.locator('[data-setting="count"][data-value="10"]').click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('prompt')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

for (const task of ['name', 'shape', 'tones']) {
  test(`M5 ${task}: richtig, falsch → Nochmal → Lösung, bis zur Auswertung`, async ({ page }) => {
    await startChords(page, task);
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

// Andere gültige Griffe (Umkehrungen, weniger Saiten) innerhalb der ersten 5 Bünde
const ALTERNATIVES: Record<string, (number | null)[]> = {
  A: [null, 0, 2, 2, 2, null],
  Am: [null, 0, 2, 2, 1, null],
  C: [null, 3, 5, 5, 5, 3],
  D: [null, 0, 0, 2, 3, 2],
  Dm: [null, 0, 0, 2, 3, 1],
  E: [0, 2, 2, 1, null, null],
  Em: [0, 2, 2, 0, null, null],
  G: [3, null, 0, 0, 0, 3],
};

test('M5 Griff setzen: andere gültige Griffe werden akzeptiert', async ({ page }) => {
  await startChords(page, 'shape');
  for (let i = 0; i < 4; i++) {
    const prompt = (await page.getByTestId('prompt').textContent())!;
    const name = prompt.replace('Setze den Griff für ', '').split(/[ .]/)[0]!;
    const alt = ALTERNATIVES[name];
    expect(alt, name).toBeDefined();
    await setShape(page, alt!);
    await page.getByTestId('check').click();
    await expect(page.getByTestId('feedback')).toContainText('Richtig!');
    await page.getByTestId('next').click();
  }
});

test('M5 Griff setzen: C7 ohne Quinte zählt als richtig', async ({ page }) => {
  await startChords(page, 'shape', ['seven', 'basic']); // Septakkorde an-, Grundakkorde abwählen
  // Zufallsauswahl: notfalls weitere Runden, bis C7 drankommt
  for (let i = 0; i < 50; i++) {
    if (await page.getByTestId('summary').isVisible()) await page.locator('[data-action=restart]').click();
    const prompt = (await page.getByTestId('prompt').textContent())!;
    const p = await probe(page);
    await setShape(page, p.shape!);
    await page.getByTestId('check').click();
    await expect(page.getByTestId('feedback')).toContainText('Richtig!');
    if (prompt.includes('C7')) return;
    await page.getByTestId('next').click();
    await expect(page.getByTestId('summary').or(page.getByTestId('check'))).toBeVisible();
  }
  throw new Error('C7 kam nicht dran');
});

test('M5 Diagramm → Name: Rückmeldung nennt den getippten Akkord', async ({ page }) => {
  await startChords(page, 'name');
  const p = await probe(page);
  await answer(page, false);
  await expect(page.getByTestId('feedback')).toContainText(p.suffix === 'm' ? 'Das wäre' : 'Moll');
});

test('Akkordwechsel: Minute läuft ab, Bestwert pro Paar bleibt gespeichert', async ({ page }) => {
  await page.clock.install();
  await page.goto('./#/changes');
  await page.locator('[data-action=changes-pick][data-slot="b"][data-id="E"]').click();
  await expect(page.getByTestId('changes-best')).toContainText('–');
  await page.getByTestId('changes-start').click();
  for (let i = 0; i < 7; i++) await page.getByTestId('changes-tap').click();
  await expect(page.getByTestId('changes-count')).toHaveText('7');
  await page.clock.runFor(61_000);
  await expect(page.getByTestId('changes-result')).toContainText('Erster Bestwert!');

  // Auswahl und Bestwert überstehen einen Neustart
  await page.reload();
  await page.goto('./#/changes');
  await expect(page.getByTestId('changes-best')).toContainText('Bestwert für dieses Paar: 7');

  // Schwächere Runde überschreibt den Bestwert nicht
  await page.getByTestId('changes-start').click();
  await page.getByTestId('changes-tap').click();
  await page.clock.runFor(61_000);
  await expect(page.getByTestId('changes-result')).toContainText('Bestwert: 7');
});
