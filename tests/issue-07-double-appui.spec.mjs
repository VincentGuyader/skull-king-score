import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, blank, head, setCounter } from './helpers.mjs';

/* Issue #7 : apres validation, le bouton de la manche suivante occupe
   exactement la place que "Valider la manche" vient de liberer. Un second
   appui rapide tombait dessus et sautait l'ecran des scores. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });

function partieNeuve() {
  return game({
    id: 'gD', cfg: { rounds: 3 }, players: [ANNE, BOB],
    rounds: [blank(), blank(), blank()], cur: 0, phase: 'bid'
  });
}

async function jusquAuxPlis(page) {
  await setCounter(page, 0, 1);
  await page.locator('#ok').click();
  await setCounter(page, 0, 1);
}

test('un double appui sur Valider la manche laisse l ecran des scores', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: partieNeuve() });
  await jusquAuxPlis(page);

  await page.locator('#ok').dblclick();
  await page.waitForTimeout(200);

  expect((await head(page)).view, 'on reste sur les scores').toBe('scores');
  expect(await page.evaluate(() => G.rounds.map(r => r.locked)), 'une seule manche validee')
    .toEqual([true, false, false]);
  expect(errs).toEqual([]);
});

test('un double appui sur Annonces terminees ne valide pas la manche', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partieNeuve() });
  await setCounter(page, 0, 1);

  await page.locator('#ok').dblclick();
  await page.waitForTimeout(200);

  const etat = await page.evaluate(() => ({ view, phase: G.phase, locked: G.rounds[0].locked }));
  expect(etat.view, 'toujours sur la manche').toBe('round');
  expect(etat.phase, 'passe en resultats').toBe('res');
  expect(etat.locked, 'mais rien n est valide').toBe(false);
});

test('un double appui sur Manche suivante ne valide pas la manche suivante', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partieNeuve() });
  await jusquAuxPlis(page);
  await page.locator('#ok').click();
  await page.waitForTimeout(400);

  await page.locator('#next').dblclick();
  await page.waitForTimeout(200);

  const etat = await page.evaluate(() => ({ view, cur: G.cur, phase: G.phase, locked: G.rounds.map(r => r.locked) }));
  expect(etat, 'on entre dans la manche 2, en annonces').toMatchObject({
    view: 'round', cur: 1, phase: 'bid', locked: [true, false, false]
  });
});

test('deux appuis distincts enchainent normalement les ecrans', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partieNeuve() });
  await jusquAuxPlis(page);

  await page.locator('#ok').click();
  await page.waitForTimeout(400);
  expect((await head(page)).view).toBe('scores');

  await page.locator('#next').click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => ({ view, cur: G.cur }))).toEqual({ view: 'round', cur: 1 });

  await setCounter(page, 0, 2);
  await page.locator('#ok').click();
  await page.waitForTimeout(400);
  await setCounter(page, 0, 2);
  await page.locator('#ok').click();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => G.rounds.map(r => r.locked)), 'deux manches validees')
    .toEqual([true, true, false]);
});
