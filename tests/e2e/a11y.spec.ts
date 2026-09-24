import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { answer, startModule } from './helpers';

async function check(page: Page, what: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const issues = r.violations.map((v) => `${what}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')} – ${v.nodes[0]?.failureSummary?.split('\n')[1] ?? ''}`);
  expect(issues).toEqual([]);
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Barrierefreiheit (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    test.beforeEach(async ({ page }) => {
      await page.goto('./');
      await page.evaluate(() => localStorage.clear());
    });

    test('Übersicht, Einstellungen, Statistik, Akkordwechsel', async ({ page }) => {
      await page.goto('./');
      await check(page, 'home');
      await page.goto('./#/settings');
      await check(page, 'settings');
      await page.goto('./#/stats');
      await check(page, 'stats');
      await page.goto('./#/changes');
      await check(page, 'changes');
      await page.goto('./#/m/staff');
      await check(page, 'setup');
    });

    for (const mod of ['strings', 'staff', 'chords', 'tabs', 'rhythm']) {
      test(`Quiz ${mod}: Frage, Rückmeldung, Auswertung`, async ({ page }) => {
        await startModule(page, mod);
        await check(page, `${mod} Frage`);
        await answer(page, false);
        await check(page, `${mod} falsch`);
        await page.getByRole('button', { name: 'Lösung zeigen' }).click();
        await check(page, `${mod} Lösung`);
        await page.getByTestId('next').click();
        await answer(page, true);
        await check(page, `${mod} richtig`);
      });
    }

    test('Griffbrett quer', async ({ page }) => {
      await page.setViewportSize({ width: 844, height: 390 });
      await startModule(page, 'fret');
      await check(page, 'fret Frage');
      await answer(page, true);
      await check(page, 'fret richtig');
    });
  });
}
