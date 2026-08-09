import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round } from './helpers.mjs';

/* Issue #8 : une seule entree d'archive mal formee faisait echouer
   computeStats et gameResult. Tout l'historique devenait inconsultable et
   non reexportable, definitivement. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });

/* Anne 20, Bob 10. */
const BONNE = game({
  id: 'gOk', date: Date.parse('2026-05-01'), cfg: { rounds: 1 },
  players: [ANNE, BOB],
  rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 })]
});

const ABIMEES = [
  null,
  42,
  'coucou',
  { id: 'gA', date: 1, cfg: {}, rounds: [] },                       // pas de players
  { id: 'gB', date: 1, cfg: {}, players: {}, rounds: [] },          // players pas un tableau
  { id: 'gC', date: 1, cfg: {}, players: [], rounds: [] },          // players vide
  { id: 'gD', date: 1, cfg: {}, players: [{ name: 'X' }], rounds: [] }, // joueur sans identifiant
  { id: 'gE', date: 1, cfg: {}, players: [{ id: 'jA', name: 'Anne' }], rounds: 'plein' }
];

test('le hall of fame ignore les parties inexploitables et affiche les autres', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], archive: [...ABIMEES, BONNE] });
  await page.evaluate(() => go('hof'));

  const texte = await page.locator('#app').textContent();
  expect(texte, 'la partie exploitable est bien la').toContain('Anne');
  expect(await page.locator('#gl .pr').count(), 'une seule partie listee').toBe(1);
  expect(await page.locator('#rk .lead').count(), 'deux joueurs classes').toBe(2);
  expect(errs, 'aucune erreur non capturee').toEqual([]);
});

test('les statistiques restent justes malgre les entrees abimees', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [...ABIMEES, BONNE] });
  const S = await page.evaluate(() => computeStats(archive()).S);
  expect(S.jA, 'Anne : une partie, une victoire, 20 points').toMatchObject({
    games: 1, wins: 1, sum: 20
  });
  expect(S.jB).toMatchObject({ games: 1, wins: 0, sum: 10 });
  expect(Object.keys(S).sort(), 'aucun joueur fantome').toEqual(['jA', 'jB']);
});

test('la fiche joueur et le detail de partie restent accessibles', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], archive: [...ABIMEES, BONNE] });

  await page.evaluate(() => go('player', 'jA'));
  expect(await page.locator('#app').textContent()).toContain('%');

  await page.evaluate(() => go('game', 'gOk'));
  expect(await page.locator('#lead').textContent()).toContain('Anne');
  expect(errs).toEqual([]);
});

test('le repertoire compte les parties sans se laisser piger', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], archive: [...ABIMEES, BONNE] });
  await page.evaluate(() => go('roster'));
  const texte = await page.locator('#rl').textContent();
  expect(texte, 'une partie au compteur').toContain('1');
  expect(errs).toEqual([]);
});

test('une archive entierement abimee affiche l ecran vide, pas une erreur', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], archive: ABIMEES });
  await page.evaluate(() => go('hof'));
  expect(await page.locator('#gl .pr').count()).toBe(0);
  expect(await page.locator('#app').textContent(), 'message d etat vide').not.toBe('');
  expect(errs).toEqual([]);
});
