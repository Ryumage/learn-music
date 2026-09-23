import { expect, type Page } from '@playwright/test';

interface Probe {
  kind: 'notes' | 'choice';
  phase: string;
  fields?: { letter: number; acc: number }[];
  correct?: number;
  options?: number;
}

export async function probe(page: Page): Promise<Probe> {
  const p = await page.evaluate(() => (window as unknown as { __saitenlesen: { probe: () => unknown } }).__saitenlesen.probe());
  expect(p, 'aktuelle Frage').not.toBeNull();
  return p as Probe;
}

/** Beantwortet die aktuelle Frage über die Tastatur/Auswahl, richtig oder falsch. */
export async function answer(page: Page, correct: boolean): Promise<void> {
  const p = await probe(page);
  if (p.kind === 'choice') {
    const i = correct ? p.correct! : (p.correct! + 1) % p.options!;
    await page.locator(`[data-choice="${i}"]`).click();
  } else {
    for (const f of p.fields!) {
      await page.locator(`[data-letter="${correct ? f.letter : (f.letter + 1) % 7}"]`).click();
      if (correct && f.acc !== 0) await page.locator(`[data-acc="${f.acc}"]`).click();
    }
  }
  await page.getByTestId('check').click();
}

export async function startModule(page: Page, id: string, count = '10'): Promise<void> {
  await page.goto('./');
  await page.getByTestId(`module-${id}`).click();
  await page.locator(`[data-setting="count"][data-value="${count}"]`).click();
  await page.getByTestId('start').click();
  await expect(page.getByTestId('prompt')).toBeVisible();
}

/** Beantwortet alle restlichen Fragen richtig bis zur Auswertung. */
export async function finishRound(page: Page): Promise<void> {
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId('summary').isVisible()) return;
    await answer(page, true);
    await page.getByTestId('next').click();
    await expect(page.getByTestId('summary').or(page.getByTestId('check'))).toBeVisible();
  }
  await expect(page.getByTestId('summary')).toBeVisible();
}
