import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, store } from './helpers.mjs';

/* Issue #1 : fusionner deux fiches joueur mettait a zero les scores de la
   fiche absorbee. La fusion renommait l'identifiant dans g.players mais
   laissait bids, tricks et bonus indexes sur l'ancien. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const ANNE2 = player('jC', 'Anne2', { color: '#199e70', icon: '⚓' });

/* Anne 60, Bob -10. */
const g1 = game({
  id: 'g1', date: Date.parse('2026-01-10'), cfg: { rounds: 2 },
  players: [ANNE, BOB],
  rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 }),
           round({ jA: 2, jB: 0 }, { jA: 2, jB: 1 })]
});
/* Anne2 40 et gagne, Bob 30. */
const g2 = game({
  id: 'g2', date: Date.parse('2026-02-10'), cfg: { rounds: 2 },
  players: [ANNE2, BOB],
  rounds: [round({ jC: 1, jB: 1 }, { jC: 1, jB: 0 }),
           round({ jC: 0, jB: 2 }, { jC: 0, jB: 2 })]
});

/** Ligne de fiche dont le nom vaut exactement celui passe. */
function ficheExacte(page, racine, nom) {
  return page.locator(racine + ' .pr')
    .filter({ has: page.locator('.nm', { hasText: new RegExp('^' + nom + '$') }) });
}

/** Ouvre le repertoire, lance la fusion de la fiche nommee vers l'autre. */
async function fusionner(page, absorbee, absorbante) {
  page.on('dialog', d => d.accept());
  await page.evaluate(() => goRoot('roster'));
  await ficheExacte(page, '#rl', absorbee).locator('.mg').click();
  await ficheExacte(page, '#ml', absorbante).click();
  await page.waitForTimeout(200);
}

test('la fusion conserve les scores de la fiche absorbee', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB, ANNE2], archive: [g1, g2] });

  const avant = await page.evaluate(() => archive().map(g => gameResult(g).tot));
  expect(avant[1], 'etat de depart').toEqual([
    { id: 'jC', name: 'Anne2', total: 40 },
    { id: 'jB', name: 'Bob', total: 30 }
  ]);

  await fusionner(page, 'Anne2', 'Anne');

  const apres = await page.evaluate(() => archive().map(g => gameResult(g).tot));
  expect(apres[0], 'la partie ou Anne jouait deja est intacte').toEqual([
    { id: 'jA', name: 'Anne', total: 60 },
    { id: 'jB', name: 'Bob', total: -10 }
  ]);
  expect(apres[1], 'la partie absorbee garde son score et sa victoire').toEqual([
    { id: 'jA', name: 'Anne', total: 40 },
    { id: 'jB', name: 'Bob', total: 30 }
  ]);
  expect(errs).toEqual([]);
});

test('la fusion reporte les statistiques sans en inventer', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB, ANNE2], archive: [g1, g2] });
  await fusionner(page, 'Anne2', 'Anne');

  const s = await page.evaluate(() => computeStats(archive()).S.jA);
  expect(s.games, 'parties').toBe(2);
  expect(s.wins, 'victoires').toBe(2);
  expect(s.sum, 'points cumules').toBe(100);
  expect(s.avg, 'moyenne').toBe(50);
  expect(s.rounds, 'manches detaillees').toBe(4);
  expect(s.exact, 'annonces justes').toBe(4);
  /* Une seule annonce a zero, reussie. Les manches orphelines de l'ancien
     defaut en ajoutaient une deuxieme, parfaite, qui n'avait jamais eu lieu. */
  expect(s.zeroTry, 'annonces a zero tentees').toBe(1);
  expect(s.zeroOk, 'annonces a zero reussies').toBe(1);
});

test('la fusion suit la fiche dans la partie en cours et la derniere selection', async ({ page }) => {
  const enCours = game({
    id: 'gEnCours', cfg: { rounds: 2 }, players: [ANNE2, BOB],
    rounds: [round({ jC: 1, jB: 0 }, { jC: 1, jB: 0 }),
             { bids: {}, tricks: {}, bonus: {}, locked: false }],
    cur: 1, phase: 'bid'
  });
  await boot(page, {
    roster: [ANNE, BOB, ANNE2], archive: [], game: enCours, lastsel: ['jC', 'jB']
  });
  await fusionner(page, 'Anne2', 'Anne');

  const g = await store(page, 'sk_game');
  expect(g.players.map(p => p.id), 'joueurs de la partie en cours').toEqual(['jA', 'jB']);
  expect(g.rounds[0].bids, 'annonces reindexees').toEqual({ jA: 1, jB: 0 });
  expect(g.rounds[0].tricks, 'plis reindexes').toEqual({ jA: 1, jB: 0 });
  expect(await store(page, 'sk_lastsel'), 'derniere selection').toEqual(['jA', 'jB']);
});

test('la fusion est refusee quand les deux fiches ont joue la meme partie', async ({ page }) => {
  const ensemble = game({
    id: 'gEnsemble', date: Date.parse('2026-03-10'), cfg: { rounds: 1 },
    players: [ANNE, ANNE2, BOB],
    rounds: [round({ jA: 1, jC: 0, jB: 0 }, { jA: 1, jC: 0, jB: 0 })]
  });
  await boot(page, { roster: [ANNE, BOB, ANNE2], archive: [g1, ensemble] });

  const avant = await store(page, 'sk_archive');
  await fusionner(page, 'Anne2', 'Anne');

  expect(await store(page, 'sk_archive'), 'archive inchangee').toEqual(avant);
  expect(await store(page, 'sk_roster'), 'les deux fiches sont conservees')
    .toEqual([ANNE, BOB, ANNE2]);
  await expect(page.locator('#toast')).toHaveClass(/on/);
});
