import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, blank, table } from './helpers.mjs';

/* Issue #5 : rouvrir une manche du milieu decalait les colonnes du tableau.
   standings n'empile que les manches verrouillees et buildTable numerotait
   les colonnes par leur rang d'affichage, si bien que l'en tete d'une
   colonne ouvrait une autre manche que celle qu'elle montrait. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });

/* Quatre manches jouees sur cinq. */
function partie() {
  return game({
    id: 'gX', cfg: { rounds: 5 }, players: [ANNE, BOB],
    rounds: [
      round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 }),   // Anne +20, Bob +10
      round({ jA: 2, jB: 0 }, { jA: 2, jB: 0 }),   // Anne +40, Bob +20
      round({ jA: 1, jB: 2 }, { jA: 1, jB: 2 }),   // Anne +20, Bob +40
      round({ jA: 0, jB: 4 }, { jA: 0, jB: 4 }),   // Anne +40, Bob +80
      blank()
    ],
    cur: 4, phase: 'bid'
  });
}

/** Numeros affiches en en tete et manche reellement visee par chaque colonne. */
function colonnes(page) {
  return page.evaluate(() => [...document.querySelectorAll('#tbl th[data-r]')]
    .map(th => ({ libelle: th.textContent, vise: Number(th.dataset.r) })));
}

/** Rouvre une manche depuis son en tete, puis revient aux scores. */
async function rouvrir(page, libelle) {
  await page.locator('#tbl th', { hasText: new RegExp('^' + libelle + '$') }).click();
  await page.locator('#ed').click();
  await page.locator('#backSc').click();
}

test('sans manche rouverte, chaque colonne vise la manche qu elle affiche', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await page.evaluate(() => goRoot('scores'));
  expect(await colonnes(page)).toEqual([
    { libelle: 'M1', vise: 0 }, { libelle: 'M2', vise: 1 },
    { libelle: 'M3', vise: 2 }, { libelle: 'M4', vise: 3 }
  ]);
});

test('une manche rouverte ne decale plus les colonnes suivantes', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await page.evaluate(() => goRoot('scores'));

  await rouvrir(page, 'M2');

  expect(await colonnes(page), 'la manche 2 disparait, les autres gardent leur numero')
    .toEqual([{ libelle: 'M1', vise: 0 }, { libelle: 'M3', vise: 2 }, { libelle: 'M4', vise: 3 }]);

  const lignes = await table(page);
  expect(lignes[1], 'Anne : 20 puis 20 puis 40').toEqual(['Anne', '+20', '+20', '+40', '80']);
  expect(lignes[2], 'Bob : 10 puis 40 puis 80').toEqual(['Bob', '+10', '+40', '+80', '130']);
  expect(errs).toEqual([]);
});

test('l en tete d une colonne rouvre bien la manche qu elle affiche', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await page.evaluate(() => goRoot('scores'));
  await rouvrir(page, 'M2');

  await page.locator('#tbl th', { hasText: /^M3$/ }).click();
  expect(await page.locator('#sheetBody h3').textContent(), 'la feuille annonce la manche 3')
    .toContain('3');
  await page.locator('#ed').click();
  expect(await page.evaluate(() => G.cur), 'et ouvre bien la manche d indice 2').toBe(2);
});

test('l ecran des scores signale les manches en attente', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await page.evaluate(() => goRoot('scores'));

  const avant = await page.locator('#app').textContent();
  await rouvrir(page, 'M2');
  const apres = await page.locator('#app').textContent();

  expect(apres.length, 'un avertissement apparait').toBeGreaterThan(avant.length);
  expect(apres, 'et il nomme la manche concernee').toMatch(/2/);
});

test('la courbe garde les bons numeros de manche en abscisse', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await page.evaluate(() => goRoot('scores'));
  await rouvrir(page, 'M2');

  const abscisses = await page.evaluate(() =>
    [...document.querySelectorAll('#chart svg text[text-anchor="middle"]')]
      .map(t => t.textContent).filter(Boolean));
  expect(abscisses, 'les manches 1, 3 et 4 sont jouees').toEqual(['1', '3', '4']);
});
