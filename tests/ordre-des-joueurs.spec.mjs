import { test, expect } from '@playwright/test';
import { boot, watchErrors, roster } from './helpers.mjs';

/* L'ordre des joueurs est celui de la selection et fixe le donneur de chaque
   manche. Le changer obligeait a tout deselectionner puis a reselectionner
   dans le bon ordre : la section Ordre de jeu le fait avec deux fleches. */

const JOUEURS = roster('Anne', 'Bob', 'Cleo');
const ordre = page => page.locator('#order .pr .nm').allInnerTexts();

test('les fleches changent l ordre de jeu et donc le donneur', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: JOUEURS, lastsel: ['j0', 'j1', 'j2'] });
  expect(await ordre(page)).toEqual(['Anne', 'Bob', 'Cleo']);

  await page.locator('#order .pr', { hasText: 'Cleo' }).locator('.up').click();
  expect(await ordre(page)).toEqual(['Anne', 'Cleo', 'Bob']);
  await page.locator('#order .pr', { hasText: 'Anne' }).locator('.dn').click();
  expect(await ordre(page)).toEqual(['Cleo', 'Anne', 'Bob']);

  /* Les badges de la liste de selection suivent le nouvel ordre. */
  await expect(page.locator('#pl .pr', { hasText: 'Cleo' }).locator('.badge')).toHaveText('joueur 1');

  /* La partie demarre dans cet ordre : Cleo donne la premiere manche. */
  await page.evaluate(() => startGame());
  expect(await page.evaluate(() => G.players.map(p => p.name))).toEqual(['Cleo', 'Anne', 'Bob']);
  await expect(page.locator('#hSub')).toContainText('Donneur : Cleo');
  expect(errs).toEqual([]);
});

test('le premier ne monte pas, le dernier ne descend pas', async ({ page }) => {
  await boot(page, { roster: JOUEURS, lastsel: ['j0', 'j1', 'j2'] });
  await expect(page.locator('#order .pr').first().locator('.up')).toBeDisabled();
  await expect(page.locator('#order .pr').last().locator('.dn')).toBeDisabled();
  await expect(page.locator('#order .pr').nth(1).locator('.up')).toBeEnabled();
});

test('pas de section Ordre de jeu avec moins de deux joueurs', async ({ page }) => {
  await boot(page, { roster: JOUEURS, lastsel: ['j0'] });
  await expect(page.locator('#order .pr')).toHaveCount(0);
});

test('les fleches portent un nom accessible traduit', async ({ page }) => {
  await boot(page, { roster: JOUEURS, lastsel: ['j0', 'j1'], lang: 'en' });
  await expect(page.locator('#order .pr').first().locator('.dn')).toHaveAttribute('aria-label', 'Move Anne down');
});
