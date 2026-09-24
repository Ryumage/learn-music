import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
});

test('Installationshinweis in Safari lässt sich ausblenden und bleibt weg', async ({ page }) => {
  // Das Profil „iPhone 13“ meldet sich als Safari auf iOS
  await page.goto('./');
  await expect(page.getByTestId('install-hint')).toContainText('Zum Home-Bildschirm');
  await page.getByRole('button', { name: 'Ausblenden' }).click();
  await expect(page.getByTestId('install-hint')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('install-hint')).toHaveCount(0);
});

test('Einstellungen erklären die Installation', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.getByTestId('install-section')).toContainText('Zum Home-Bildschirm');
  await expect(page.getByTestId('install-section')).toContainText('offline');
});

test('Dunkelmodus folgt dem System', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(13, 18, 32)');
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(light).toBe('rgb(244, 246, 250)');
});
