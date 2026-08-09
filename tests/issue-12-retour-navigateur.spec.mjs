import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, head } from './helpers.mjs';

/* Issue #12 : la navigation interne reposait sur une pile en memoire et
   n'appelait jamais l'API History. Le bouton precedent du navigateur, et le
   geste de retour d'Android, quittaient l'application au lieu de reculer
   d'un ecran. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const PARTIE = game({
  id: 'gN', date: Date.parse('2026-05-01'), cfg: { rounds: 1 },
  players: [ANNE, BOB],
  rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 })]
});

/** L'application est-elle toujours a l'ecran ? */
function vivante(page) {
  return page.evaluate(() => !!document.querySelector('#hTitle') && typeof view !== 'undefined');
}

test('le bouton precedent recule d un ecran au lieu de quitter', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
  expect((await head(page)).view).toBe('setup');

  await page.evaluate(() => go('hof'));
  expect((await head(page)).view).toBe('hof');

  await page.goBack();
  expect(await vivante(page), 'l application est toujours la').toBe(true);
  expect((await head(page)).view, 'retour a la configuration').toBe('setup');
  expect(errs).toEqual([]);
});

test('deux ecrans empiles se remontent un par un', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
  await page.evaluate(() => go('hof'));
  await page.evaluate(() => go('player', 'jA'));
  expect((await head(page)).view).toBe('player');

  await page.goBack();
  expect((await head(page)).view, 'un cran').toBe('hof');
  await page.goBack();
  expect((await head(page)).view, 'deux crans').toBe('setup');
  expect(await vivante(page)).toBe(true);
});

test('le bouton suivant du navigateur ne casse rien', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
  await page.evaluate(() => go('hof'));
  await page.goBack();
  await page.goForward();
  expect(await vivante(page), 'toujours vivante').toBe(true);
  expect(errs).toEqual([]);
});

test('le chevron de l en tete recule aussi d un ecran', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
  await page.evaluate(() => go('hof'));
  await expect(page.locator('#hBack')).toBeVisible();
  await page.locator('#hBack').click();
  await page.waitForTimeout(150);
  expect((await head(page)).view).toBe('setup');
  await expect(page.locator('#hBack'), 'le chevron disparait a la racine').toBeHidden();
});

test('supprimer une partie depuis son detail revient au hall of fame', async ({ page }) => {
  page.on('dialog', d => d.accept());
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
  await page.evaluate(() => go('hof'));
  await page.evaluate(() => go('game', 'gN'));
  await page.locator('#gd').click();
  await page.waitForTimeout(200);
  expect((await head(page)).view, 'retour a la liste').toBe('hof');
  expect(await page.evaluate(() => archive().length), 'la partie est bien supprimee').toBe(0);
});
