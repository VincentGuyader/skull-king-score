import { test, expect } from '@playwright/test';

/* Le site publie deux pages : l'application et la politique de
   confidentialite. Le service worker garde chaque page sous sa propre
   adresse : visiter privacy.html ne doit pas remplacer l'application dans
   le cache hors-ligne, et l'application reste le repli d'une page inconnue. */

test.skip(({ browserName }) => browserName !== 'chromium', 'service worker pilotable sur Chromium seulement');

test('visiter la politique de confidentialite ne chasse pas l application du cache', async ({ page, context }) => {
  await page.goto('/', { waitUntil: 'load' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.goto('/privacy.html', { waitUntil: 'load' });
  expect(await page.title(), 'la politique en ligne').toMatch(/confidentialit|privacy/i);

  await context.setOffline(true);
  await page.goto('/', { waitUntil: 'load' });
  expect(await page.title(), 'l application hors-ligne').toContain('Skull King');
  await expect(page.locator('#hTitle'), 'l application est bien rendue').toBeVisible();

  await page.goto('/privacy.html', { waitUntil: 'load' });
  expect(await page.title(), 'la politique hors-ligne aussi').toMatch(/confidentialit|privacy/i);
  await context.setOffline(false);
});
