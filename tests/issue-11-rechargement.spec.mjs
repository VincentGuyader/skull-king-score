import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, blank, head, setCounter, tapBar } from './helpers.mjs';

/* Issue #11 : lockRound ne touchait pas a G.cur. Au demarrage, la vue valait
   round tant que toutes les manches n'etaient pas verrouillees, et
   renderRound repartait de la manche qui venait d'etre bouclee. Le joueur
   croyait avoir perdu sa validation, ressaisissait, et reecrivait une manche
   deja comptabilisee. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });

function partieNeuve() {
  return game({
    id: 'gR', cfg: { rounds: 3 }, players: [ANNE, BOB],
    rounds: [blank(), blank(), blank()], cur: 0, phase: 'bid'
  });
}
async function jouerUneManche(page) {
  await setCounter(page, 0, 1);
  await page.locator('#ok').click();
  await setCounter(page, 0, 1);
  await page.locator('#ok').click();
}

test('apres validation, un rechargement ramene sur les scores', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: partieNeuve() });
  await jouerUneManche(page);
  expect((await head(page)).view, 'juste apres validation').toBe('scores');

  await page.reload({ waitUntil: 'domcontentloaded' });
  expect((await head(page)).view, 'apres rechargement').toBe('scores');
  expect(await page.evaluate(() => G.rounds.map(r => r.locked))).toEqual([true, false, false]);
  expect(errs).toEqual([]);
});

test('la manche suivante survit au rechargement', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partieNeuve() });
  await jouerUneManche(page);
  await tapBar(page, '#next');
  await setCounter(page, 0, 2);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const etat = await page.evaluate(() => ({ view, cur: G.cur, phase: G.phase, bid: G.rounds[1].bids.jA }));
  expect(etat, 'on reprend la manche 2 en annonces, saisie conservee')
    .toEqual({ view: 'round', cur: 1, phase: 'bid', bid: 2 });
});

test('un rechargement en pleine phase de resultats reste sur la manche', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partieNeuve() });
  await setCounter(page, 0, 1);
  await page.locator('#ok').click();
  await setCounter(page, 0, 1);

  await page.reload({ waitUntil: 'domcontentloaded' });
  const etat = await page.evaluate(() => ({ view, phase: G.phase, tricks: G.rounds[0].tricks.jA }));
  expect(etat).toEqual({ view: 'round', phase: 'res', tricks: 1 });
});

test('une partie terminee rouvre sur les scores', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partieNeuve() });
  for (let m = 0; m < 3; m++) {
    if (m) await tapBar(page, '#next');
    await setCounter(page, 0, 1);
    await page.locator('#ok').click();
    await setCounter(page, 0, 1);
    await page.locator('#ok').click();
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  const h = await head(page);
  expect(h.view).toBe('scores');
  expect(h.title).toBe('Partie terminée');
});

test('revenir sur la derniere manche puis recharger rouvre bien cette manche', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partieNeuve() });
  await jouerUneManche(page);
  await tapBar(page, '#undoR');
  expect((await head(page)).view).toBe('round');

  await page.reload({ waitUntil: 'domcontentloaded' });
  const etat = await page.evaluate(() => ({ view, cur: G.cur, locked: G.rounds[0].locked }));
  expect(etat, 'la manche rouverte reste ouverte').toEqual({ view: 'round', cur: 0, locked: false });
});
