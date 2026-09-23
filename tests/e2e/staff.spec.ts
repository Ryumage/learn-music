import { expect, test, type Page } from '@playwright/test';
import { finishRound, probe } from './helpers';

async function startStaff(page: Page, opts: { level: string; perRow?: string; rows?: string }) {
  await page.goto('./#/m/staff');
  await page.locator(`[data-setting="level"][data-value="${opts.level}"]`).click();
  if (opts.perRow) await page.locator(`[data-setting="perRow"][data-value="${opts.perRow}"]`).click();
  await page.locator(`[data-setting="count"][data-value="${opts.rows ?? '3'}"]`).click();
  await page.getByTestId('start').click();
  await expect(page.locator('.staff-system').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

test('M2: 8 Noten passen bei 375 px in eine Zeile, ohne horizontale Scrollbreite', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await startStaff(page, { level: '4', perRow: '8' });
  await expect(page.locator('.staff-system')).toHaveCount(1);
  await expect(page.locator('.staff-cell')).toHaveCount(8);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // Linienabstand ≥ 9,5 px
  const sp = await page.evaluate(() => {
    const lines = [...document.querySelectorAll('.staff-system .st-line')].slice(0, 2).map((l) => l.getBoundingClientRect().top);
    return lines[1]! - lines[0]!;
  });
  expect(sp).toBeGreaterThanOrEqual(9.5);
});

test('M2: 16 Noten brechen um', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await startStaff(page, { level: '1', perRow: '16' });
  await expect(page.locator('.staff-system')).toHaveCount(2);
  await expect(page.locator('.staff-cell')).toHaveCount(16);
});

test('M2: Mehrklänge von oben nach unten', async ({ page }) => {
  // bis eine Zeile mit Mehrklang erscheint
  for (let i = 0; i < 15; i++) {
    await startStaff(page, { level: '4', perRow: '16' });
    if ((await page.locator('.staff-cell .note-field').count()) > 16) break;
  }
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.st-col')].map((col) =>
      [...col.querySelectorAll<SVGGElement>('.st-note[data-field]')]
        .map((g) => ({ field: Number(g.dataset.field), y: g.querySelector('.st-head')!.getBoundingClientRect().top }))
        .sort((a, b) => a.field - b.field)
        .map((n) => n.y),
    ),
  );
  const stacks = order.filter((ys) => ys.length > 1);
  expect(stacks.length).toBeGreaterThan(0);
  for (const ys of stacks) for (let i = 1; i < ys.length; i++) expect(ys[i]!).toBeGreaterThan(ys[i - 1]!);
  // Tastatur füllt die Felder in derselben Reihenfolge
  const p = await probe(page);
  for (const f of p.fields!) await page.locator(`[data-letter="${f.letter}"]`).click();
  const texts = await page.locator('.staff-cell .note-field').allTextContents();
  const de = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];
  expect(texts.map((t) => t.trim())).toEqual(p.fields!.map((f) => de[f.letter]));
});

test('M2: nur falsche Noten werden bei „Nochmal“ geleert; Runde bis zur Auswertung', async ({ page }) => {
  await startStaff(page, { level: '3', rows: '3' });
  // Zeile 1 richtig
  let p = await probe(page);
  for (const f of p.fields!) await page.locator(`[data-letter="${f.letter}"]`).click();
  await page.getByTestId('check').click();
  await expect(page.getByTestId('feedback')).toContainText('Richtig!');
  await page.getByTestId('next').click();

  // Zeile 2: jede zweite Note falsch
  p = await probe(page);
  for (const [i, f] of p.fields!.entries()) await page.locator(`[data-letter="${i % 2 ? (f.letter + 1) % 7 : f.letter}"]`).click();
  await page.getByTestId('check').click();
  await expect(page.getByTestId('feedback')).toContainText('stimmen nicht');
  await expect(page.locator('.staff-cell .note-field.is-bad')).toHaveCount(Math.floor(p.fields!.length / 2));
  await page.getByRole('button', { name: 'Nochmal' }).click();
  const fields = page.locator('.staff-cell .note-field');
  const de = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];
  for (const [i, f] of p.fields!.entries()) {
    await expect(fields.nth(i)).toHaveText(i % 2 ? '' : de[f.letter]!, { useInnerText: true });
  }
  // Tippen auf eine Note wählt ihr Feld
  await page.locator('.st-note[data-field="1"]').click();
  await expect(fields.nth(1)).toHaveClass(/is-active/);
  for (const [i, f] of p.fields!.entries()) if (i % 2) await page.locator(`[data-letter="${f.letter}"]`).click();
  await page.getByTestId('check').click();
  await expect(page.getByTestId('feedback')).toContainText('Richtig!');
  await page.getByTestId('next').click();

  await finishRound(page);
  await expect(page.getByTestId('summary')).toContainText('von 3');
  await expect(page.locator('.kpis')).toContainText('Einzelne Antworten');
  await expect(page.locator('.mistakes li').first()).toContainText('Note im System');
});

test('M2: Lösung zeigt Name, Lage und Stelle auf der Gitarre', async ({ page }) => {
  await startStaff(page, { level: '1' });
  const p = await probe(page);
  for (const f of p.fields!) await page.locator(`[data-letter="${(f.letter + 1) % 7}"]`).click();
  await page.getByTestId('check').click();
  await page.getByRole('button', { name: 'Lösung zeigen' }).click();
  await expect(page.locator('.part-solutions li').first()).toContainText(/Linie|Zwischenraum/);
  await expect(page.locator('.part-solutions li').first()).toContainText(/Saite leer/);
});
