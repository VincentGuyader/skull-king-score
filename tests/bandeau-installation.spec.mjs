import { test, expect } from '@playwright/test';
import { boot, watchErrors } from './helpers.mjs';

/* Le bandeau « Installer l'application » explique comment installer le site
   depuis le navigateur. Dans l'application Android ou iOS, elle est deja
   installee : le bandeau n'a rien a y faire. */

test('sur le web, le bandeau d installation reste propose', async ({ page }) => {
  await boot(page, { installHidden: false });
  await expect(page.locator('#inHide')).toBeVisible();
});

test('dans l application native, le bandeau d installation n apparait pas', async ({ page }) => {
  const errs = watchErrors(page);
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, Plugins: { Share: { share: () => Promise.resolve({}) } } };
  });
  await boot(page, { installHidden: false });
  await expect(page.locator('#hTitle')).toHaveText('Nouvelle partie');
  await expect(page.locator('#inHide')).toHaveCount(0);
  expect(errs).toEqual([]);
});
