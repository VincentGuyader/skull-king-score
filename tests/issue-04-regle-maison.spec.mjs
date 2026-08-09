import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, blank, table, store } from './helpers.mjs';

/* Issue #4 : supprimer une regle maison effacait retroactivement les points
   des manches deja validees, alors que la feuille d'edition promet le
   contraire en toutes lettres. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const TRESOR = { id: 'cX', name: 'Tresor', pts: 30, max: 1, tricks: 0, cond: 'always' };
const PERROQUET = { id: 'cY', name: 'Perroquet', pts: 15, max: 1, tricks: 0, cond: 'bid' };

/* Manche 1 : Anne annonce 1 et la realise, +20, plus 30 de regle maison. */
function partie(custom) {
  return game({
    id: 'gH', cfg: { rounds: 3, custom },
    players: [ANNE, BOB],
    rounds: [
      round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 }, { bonus: { jA: { xcX: 1 } } }),
      blank(), blank()
    ],
    cur: 1, phase: 'bid'
  });
}

/** Supprime une regle depuis la feuille des regles maison en cours de partie. */
async function supprimerRegle(page, nom) {
  await page.evaluate(() => rulesSheet());
  await page.locator('#rl .rule').filter({ hasText: nom }).locator('.rm').click();
  await page.waitForTimeout(150);
  await page.locator('#rdone').click();
  await page.waitForTimeout(150);
}

test('supprimer une regle deja saisie laisse les manches validees intactes', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: partie([TRESOR]) });
  await page.evaluate(() => goRoot('scores'));

  expect(await table(page), 'etat de depart').toEqual([
    ['Joueur', 'M1', 'Total'],
    ['Anne', '+50', '50'], ['Bob', '+10', '10']
  ]);

  await supprimerRegle(page, 'Tresor');
  await page.evaluate(() => goRoot('scores'));

  expect(await table(page), 'la manche validee garde ses points').toEqual([
    ['Joueur', 'M1', 'Total'],
    ['Anne', '+50', '50'], ['Bob', '+10', '10']
  ]);
  expect(errs).toEqual([]);
});

test('une regle supprimee disparait de la feuille de bonus des manches suivantes', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie([TRESOR, PERROQUET]) });
  await supprimerRegle(page, 'Tresor');

  await page.evaluate(() => { G.cur = 1; G.phase = 'res'; save(); goRoot('round'); });
  await page.locator('#rows .pr').first().locator('.star').click();
  await page.waitForTimeout(200);
  const lignes = await page.evaluate(() =>
    [...document.querySelectorAll('#bc .brow .lbl')].map(x => x.firstChild.textContent.trim()));
  expect(lignes, 'seule la regle restante est proposee').toEqual(['Perroquet']);
});

test('une regle supprimee ne reste pas dans la liste editable ni dans l aide', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie([TRESOR, PERROQUET]) });
  await supprimerRegle(page, 'Tresor');

  await page.evaluate(() => rulesSheet());
  const listees = await page.evaluate(() =>
    [...document.querySelectorAll('#rl .rule .lbl > div')].map(x => x.textContent.trim()));
  expect(listees, 'la regle supprimee n est plus proposee a l edition').toEqual(['Perroquet']);
  await page.locator('#rdone').click();

  await page.evaluate(() => go('help'));
  const aide = await page.locator('#app').textContent();
  expect(aide, 'ni rappelee dans l aide').not.toContain('Tresor');
  expect(aide, 'la regle restante y figure toujours').toContain('Perroquet');
});

test('une regle jamais saisie est retiree pour de bon', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie([TRESOR, PERROQUET]) });
  await supprimerRegle(page, 'Perroquet');

  const g = await store(page, 'sk_game');
  expect(g.cfg.custom.map(c => c.id), 'la regle inutilisee sort de la configuration')
    .toEqual(['cX']);
});

test('supprimer une regle a la configuration la retire simplement', async ({ page }) => {
  await boot(page, {
    roster: [ANNE, BOB], lastsel: ['jA', 'jB'],
    cfg: { rounds: 5, custom: [TRESOR, PERROQUET] }
  });
  await page.locator('#customs .rule').filter({ hasText: 'Tresor' }).locator('.rm').click();
  await page.waitForTimeout(150);

  const restantes = await page.evaluate(() => draft.cfg.custom.map(c => c.id));
  expect(restantes, 'aucune manche jouee, aucune raison de conserver la regle').toEqual(['cY']);
});
