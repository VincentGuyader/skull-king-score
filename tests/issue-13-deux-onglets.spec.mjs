import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, blank, store, setCounter } from './helpers.mjs';

/* Issue #13 : une seule cle sk_game et aucun ecouteur storage. Chaque onglet
   gardait son G en memoire et l'ecrivait integralement a chaque save(). Le
   dernier qui ecrivait detruisait la partie de l'autre, sans avertissement,
   et l'onglet perdant continuait d'afficher une partie qui n'existait plus. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const CLEO = player('jC', 'Cleo', { color: '#199e70', icon: '⚓' });

function partie(id, joueurs) {
  return game({
    id, cfg: { rounds: 3 }, players: joueurs,
    rounds: [blank(), blank(), blank()], cur: 0, phase: 'bid'
  });
}

/** Deuxieme onglet sur la meme application, meme stockage. */
async function secondOnglet(page) {
  const autre = await page.context().newPage();
  await autre.goto('/', { waitUntil: 'domcontentloaded' });
  await autre.waitForFunction(() => document.readyState === 'complete');
  return autre;
}

test('un onglet devenu obsolete cesse d ecrire par dessus l autre', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB, CLEO], game: partie('gA', [ANNE, BOB]) });

  const autre = await secondOnglet(page);
  await autre.evaluate(() => {
    draft = { sel: ['jA', 'jC'], cfg: Object.assign({}, DEFAULT_CFG, { rounds: 3 }) };
    startGame();
  });
  await page.waitForTimeout(250);

  /* Le premier onglet tente de continuer sa partie. */
  await page.evaluate(() => { G.rounds[0].bids = { jA: 2, jB: 2 }; save(); });
  await page.waitForTimeout(150);

  const enregistre = await store(page, 'sk_game');
  expect(enregistre.players.map(p => p.id), 'la partie du second onglet survit')
    .toEqual(['jA', 'jC']);
  expect(errs).toEqual([]);
  await autre.close();
});

test('l onglet obsolete le dit au joueur et propose de se remettre a jour', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB, CLEO], game: partie('gA', [ANNE, BOB]) });
  const autre = await secondOnglet(page);
  await autre.evaluate(() => {
    draft = { sel: ['jA', 'jC'], cfg: Object.assign({}, DEFAULT_CFG, { rounds: 3 }) };
    startGame();
  });
  await page.waitForTimeout(300);

  const banniere = page.locator('#staleBanner');
  await expect(banniere, 'un avertissement apparait').toBeVisible();
  await expect(banniere.locator('button'), 'avec une action pour se remettre a jour')
    .not.toHaveCount(0);
  await autre.close();
});

test('la remise a jour reprend la partie reellement enregistree', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB, CLEO], game: partie('gA', [ANNE, BOB]) });
  const autre = await secondOnglet(page);
  await autre.evaluate(() => {
    draft = { sel: ['jA', 'jC'], cfg: Object.assign({}, DEFAULT_CFG, { rounds: 3 }) };
    startGame();
  });
  await page.waitForTimeout(300);
  await autre.close();

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.locator('#staleBanner button').first().click()
  ]);
  await page.waitForFunction(() => typeof G !== 'undefined' && G);
  expect(await page.evaluate(() => G.players.map(p => p.id)), 'le joueur retrouve la vraie partie')
    .toEqual(['jA', 'jC']);
  await expect(page.locator('#staleBanner')).toHaveCount(0);
});

test('un seul onglet ne declenche aucun avertissement', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie('gA', [ANNE, BOB]) });
  /* Manche 1, une carte : l annonce est bornee a 1. */
  await setCounter(page, 0, 1);
  await page.waitForTimeout(200);
  await expect(page.locator('#staleBanner')).toHaveCount(0);
  expect((await store(page, 'sk_game')).rounds[0].bids.jA, 'la saisie est bien enregistree').toBe(1);
});
