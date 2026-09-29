import { expect, type Page } from '@playwright/test';

export interface Probe {
  kind: 'notes' | 'choice' | 'tap' | 'chord' | 'shape';
  root?: { letter: number; acc: number };
  suffix?: string;
  shape?: (number | null)[];
  phase: string;
  items: string[];
  fields?: { letter: number; acc: number }[];
  correct?: number;
  options?: number;
  targets?: { string: number; fret: number }[];
  multi?: boolean;
}

export const cell = (page: Page, s: number, f: number) => page.locator(`[data-action=tap][data-string="${s}"][data-fret="${f}"]`);

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
  } else if (p.kind === 'chord') {
    await page.locator(`[data-action=chord-root][data-letter="${p.root!.letter}"]`).click();
    if (p.root!.acc) await page.locator(`[data-action=chord-acc][data-acc="${p.root!.acc}"]`).click();
    const suffix = correct ? p.suffix! : p.suffix === 'm' ? '' : 'm';
    await page.locator(`[data-action=chord-suffix][data-suffix="${suffix}"]`).click();
  } else if (p.kind === 'shape') {
    if (correct) await setShape(page, p.shape!);
    else await page.locator('[data-action=cd-cell][data-index="0"][data-fret="1"]').click();
  } else if (p.kind === 'tap') {
    if (correct) {
      for (const t of p.multi ? p.targets! : p.targets!.slice(0, 1)) await cell(page, t.string, t.fret).click();
    } else {
      const cells = await page.locator('[data-action=tap]').evaluateAll((els) =>
        els.map((e) => ({ string: Number((e as HTMLElement).dataset.string), fret: Number((e as HTMLElement).dataset.fret) })),
      );
      const wrong = cells.find((c) => !p.targets!.some((t) => t.string === c.string && t.fret === c.fret))!;
      await cell(page, wrong.string, wrong.fret).click();
    }
  } else {
    for (const field of p.fields!) {
      // Doppel-Vorzeichen (z. B. Heses in Cdim7) gibt es auf der Tastatur nicht: gleiche Tonklasse eingeben
      const f = typeable(field);
      await page.locator(`[data-letter="${correct ? f.letter : (f.letter + 1) % 7}"]`).click();
      if (correct && f.acc !== 0) await page.locator(`[data-acc="${f.acc}"]`).click();
    }
  }
  await page.getByTestId('check').click();
}

const STEPS = [0, 2, 4, 5, 7, 9, 11];

/** Schreibweise mit höchstens einem Vorzeichen und derselben Tonklasse. */
function typeable(n: { letter: number; acc: number }): { letter: number; acc: number } {
  if (Math.abs(n.acc) <= 1) return n;
  const pc = (STEPS[n.letter]! + n.acc + 24) % 12;
  const natural = STEPS.indexOf(pc);
  return natural >= 0 ? { letter: natural, acc: 0 } : { letter: STEPS.indexOf(pc - 1), acc: 1 };
}

/** Setzt einen Griff im editierbaren Diagramm (Start: alle Saiten leer, erste Lage). */
export async function setShape(page: Page, shape: (number | null)[]): Promise<void> {
  // hohe Lagen: Fenster erst verschieben (leere Saiten wandern nicht mit)
  const fretted = shape.filter((f): f is number => f !== null && f > 0);
  const base = fretted.length && Math.max(...fretted) > 5 ? Math.min(...fretted) : 1;
  for (let b = 1; b < base; b++) await page.locator('[data-action=cd-base][data-step="1"]').click();
  for (const [i, f] of shape.entries()) {
    if (f === null) await page.locator(`[data-action=cd-open][data-index="${i}"]`).click();
    else if (f > 0) await page.locator(`[data-action=cd-cell][data-index="${i}"][data-fret="${f}"]`).click();
  }
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
