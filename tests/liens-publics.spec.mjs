import { test, expect } from '@playwright/test';
import { boot, roster, game, round } from './helpers.mjs';

/* Google Play demande un lien vers la politique de confidentialite dans
   l'application elle-meme, pas seulement sur la fiche. Le texte partage
   depuis l'application Android renvoie vers sa fiche Play. */

const [ANNE, BOB] = roster('Anne', 'Bob');
const FINIE = game({
  id: 'gL', cfg: { rounds: 1 }, players: [ANNE, BOB],
  rounds: [round({ j0: 1, j1: 0 }, { j0: 1, j1: 0 })], cur: 0, phase: 'res'
});
const PRIVACY = 'https://vincentguyader.github.io/skull-king-score/privacy.html';
const PLAY = 'https://play.google.com/store/apps/details?id=fr.thinkr.skullkingscore';
const SITE = 'https://vincentguyader.github.io/skull-king-score/';

for (const [lang, libelle] of [['fr', 'Politique de confidentialité'], ['en', 'Privacy policy'],
                               ['de', 'Datenschutzerklärung'], ['es', 'Política de privacidad']]) {
  test(`A propos renvoie a la politique de confidentialite en ${lang}`, async ({ page }) => {
    await boot(page, { roster: [ANNE], lang });
    await page.evaluate(() => go('help'));
    await page.locator('details.about summary').click();
    const lien = page.locator(`details.about a[href="${PRIVACY}"]`);
    await expect(lien).toHaveText(libelle);
    expect(await lien.getAttribute('target')).toBe('_blank');
    expect(await lien.getAttribute('rel')).toContain('noopener');
  });
}

async function plateforme(page, nom) {
  await page.addInitScript(n => {
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => n,
      Plugins: { Share: { share: () => Promise.resolve({}) } } };
  }, nom);
}
const dernier = page => page.evaluate(() => shareText().trim().split('\n').pop());

test('depuis l application Android, le partage renvoie vers la fiche Play', async ({ page }) => {
  await plateforme(page, 'android');
  await boot(page, { roster: [ANNE, BOB], game: FINIE });
  expect(await dernier(page)).toBe(PLAY);
});

test('depuis l application iOS, le partage renvoie vers le site', async ({ page }) => {
  await plateforme(page, 'ios');
  await boot(page, { roster: [ANNE, BOB], game: FINIE });
  expect(await dernier(page)).toBe(SITE);
});

test('sur le web, le partage renvoie vers le site', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: FINIE });
  expect(await dernier(page)).toBe(SITE);
});
