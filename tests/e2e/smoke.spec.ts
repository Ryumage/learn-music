import { expect, test } from '@playwright/test';

test('Startseite lädt auf Deutsch', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle('Saitenlesen');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await expect(page.getByRole('heading', { level: 1, name: 'Saitenlesen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Noten lesen' })).toBeVisible();
});

test('Manifest und Icons sind für die Installation vorhanden', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const manifest = await (await request.get(new URL(href!, page.url()).href)).json();
  expect(manifest.name).toBe('Saitenlesen');
  expect(manifest.display).toBe('standalone');
  expect(manifest.start_url).toBe('/learn-music/');
  for (const icon of manifest.icons as { src: string }[]) {
    const res = await request.get(new URL(icon.src, page.url()).href);
    expect(res.ok(), icon.src).toBe(true);
  }
  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(new URL(touchIcon!, page.url()).href)).ok()).toBe(true);
});

test('keine horizontale Scrollbreite bei 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('./');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('keine Requests nach außen', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.hostname !== 'localhost') external.push(req.url());
  });
  await page.goto('./');
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
});

test('startet offline nach dem ersten Besuch @offline', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    // Warten, bis der Service Worker die Seite kontrolliert (clientsClaim).
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }),
      );
    }
    return reg.active?.state;
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Saitenlesen' })).toBeVisible();
  await context.setOffline(false);
});
