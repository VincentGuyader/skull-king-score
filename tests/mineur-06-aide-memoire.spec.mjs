import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, blank } from './helpers.mjs';

/* Anomalie mineure m9 : les lignes cle-valeur de l'aide-memoire ne se
   repliaient pas. Le contenu reclamait 380 px en francais et 442 px en
   allemand dans une fenetre de 320 : toute la page prenait un defilement
   horizontal et les textes sortaient de leur carte. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const LANGUES = ['fr', 'en', 'de', 'es'];
const LARGEURS = [320, 360, 390, 412];

/* Une partie en cours fait afficher les sections liees a la configuration :
   pirates nommes, Kraken, Baleine et regles maison. */
function partieAvecTout() {
  return game({
    id: 'gA', players: [ANNE, BOB],
    cfg: {
      rounds: 10, scoring: 'rascal', rascal: 'cannonball', pirates: true,
      kraken: true, whale: true, loot: true,
      custom: [{ id: 'cX', name: 'Sondermünze des Kapitäns', pts: 25, max: 2, tricks: 1, cond: 'bid' }]
    },
    rounds: Array.from({ length: 10 }, blank), cur: 0, phase: 'bid'
  });
}

for (const lang of LANGUES) {
  for (const largeur of LARGEURS) {
    test(`l aide-memoire tient dans ${largeur} px en ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await boot(page, { roster: [ANNE, BOB], game: partieAvecTout(), lang });
      await page.evaluate(() => go('help'));

      const m = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        vue: document.documentElement.clientWidth,
        debordants: [...document.querySelectorAll('#app .kv, #app .hier div')]
          .filter(e => e.scrollWidth > e.clientWidth + 1)
          .slice(0, 3).map(e => e.textContent.trim().slice(0, 40))
      }));
      expect(m.doc, `aucun defilement horizontal (${m.doc} pour ${m.vue})`).toBeLessThanOrEqual(m.vue);
      expect(m.debordants, 'aucune ligne coupee').toEqual([]);
    });
  }
}

test('les valeurs de bareme restent alignees a droite sur large ecran', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await boot(page, { roster: [ANNE, BOB], game: partieAvecTout(), lang: 'fr' });
  await page.evaluate(() => go('help'));
  const surUneLigne = await page.evaluate(() => {
    const kv = document.querySelector('#app .kv');
    return getComputedStyle(kv).flexDirection === 'row';
  });
  expect(surUneLigne, 'la lecture en deux colonnes est conservee').toBe(true);
});

test('l aide-memoire ne leve aucune erreur', async ({ page }) => {
  const errs = watchErrors(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await boot(page, { roster: [ANNE, BOB], game: partieAvecTout(), lang: 'de' });
  await page.evaluate(() => go('help'));
  expect((await page.locator('#app').textContent()).length).toBeGreaterThan(200);
  expect(errs).toEqual([]);
});
