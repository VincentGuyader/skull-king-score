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

/* Meme logique pour la sauvegarde : dans l'application, l'historique vit
   sur le telephone, pas dans un navigateur. */
async function natif(page) {
  await page.addInitScript(() => {
    window.Capacitor = { isNativePlatform: () => true, Plugins: { Share: { share: () => Promise.resolve({}) } } };
  });
}

test('dans l application, la fiche de sauvegarde parle du telephone', async ({ page }) => {
  await natif(page);
  await boot(page, {});
  await page.evaluate(() => { go('hof'); backupSheet(); });
  const txt = await page.locator('.sheet').innerText();
  expect(txt).toContain('sur ce téléphone');
  expect(txt).not.toContain('navigateur');
});

test('sur le web, la fiche de sauvegarde parle toujours du navigateur', async ({ page }) => {
  await boot(page, {});
  await page.evaluate(() => { go('hof'); backupSheet(); });
  await expect(page.locator('.sheet')).toContainText('ce navigateur');
});
