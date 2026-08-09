import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, blank, store } from './helpers.mjs';

/* Issue #10 : bid0, l'annonce de reference, etait recopiee depuis bids a
   chaque passage des annonces aux resultats. Un aller retour transformait
   l'annonce modifiee par Harry en nouvelle reference : la trace disparaissait
   et la borne du pouvoir derivait d'un pli a chaque tour. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });

/* Manche 6, six cartes, annonces deja saisies. */
function partie() {
  const g = game({
    id: 'gH', cfg: { rounds: 10 }, players: [ANNE, BOB],
    rounds: Array.from({ length: 10 }, blank), cur: 5, phase: 'bid'
  });
  g.rounds[5].bids = { jA: 3, jB: 3 };
  g.rounds[5].tricks = { jA: 0, jB: 0 };
  return g;
}

/** Valeurs atteignables dans le reglage de Harry, bornes comprises. */
async function bornesHarry(page) {
  await page.locator('#rows .pr').first().locator('.mise').click();
  await page.waitForTimeout(150);
  const v = await page.evaluate(() => {
    const s = document.querySelector('#hs'), out = [];
    while (!s.querySelector('.minus').disabled) s.querySelector('.minus').click();
    out.push(Number(s.querySelector('.v').textContent));
    while (!s.querySelector('.plus').disabled) s.querySelector('.plus').click();
    out.push(Number(s.querySelector('.v').textContent));
    return out;
  });
  return { min: v[0], max: v[1] };
}

/** Retour aux annonces puis revalidation, au rythme de l'anti-rebond. */
async function allerRetour(page) {
  await page.waitForTimeout(350);
  await page.locator('#back').click();
  await page.waitForTimeout(350);
  await page.locator('#ok').click();
  await page.waitForTimeout(150);
}

test('l annonce initiale est fixee a la premiere validation des annonces', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await page.locator('#ok').click();
  expect((await store(page, 'sk_game')).rounds[5].bid0).toEqual({ jA: 3, jB: 3 });
});

test('un aller retour par les annonces ne remplace pas l annonce initiale', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await page.locator('#ok').click();

  /* Harry ramene Anne de 3 a 2. */
  await page.locator('#rows .pr').first().locator('.mise').click();
  await page.waitForTimeout(150);
  await page.locator('#hs .minus').click();
  await page.locator('#hok').click();
  await page.waitForTimeout(150);
  expect((await store(page, 'sk_game')).rounds[5].bids.jA, 'annonce modifiee').toBe(2);

  await allerRetour(page);

  const g = await store(page, 'sk_game');
  expect(g.rounds[5].bid0.jA, 'la reference reste l annonce d origine').toBe(3);
  expect(g.rounds[5].bids.jA, 'la modification de Harry est conservee').toBe(2);
  expect(errs).toEqual([]);
});

test('la trace de l annonce initiale reste visible sur la ligne joueur', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await page.locator('#ok').click();
  await page.locator('#rows .pr').first().locator('.mise').click();
  await page.waitForTimeout(150);
  await page.locator('#hs .minus').click();
  await page.locator('#hok').click();
  await allerRetour(page);

  const sous = await page.locator('#rows .pr').first().locator('.sub2').textContent();
  expect(sous, 'la mise courante').toContain('2');
  expect(sous, 'et la fleche vers l annonce d origine').toContain('3');
  await expect(page.locator('#rows .pr').first().locator('.mise')).toHaveClass(/moved/);
});

test('la borne de Harry ne derive pas d un aller retour a l autre', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await page.locator('#ok').click();

  expect(await bornesHarry(page), 'depuis une annonce de 3').toEqual({ min: 2, max: 4 });
  await page.locator('#hrz').click();
  await allerRetour(page);
  expect(await bornesHarry(page), 'apres un aller retour').toEqual({ min: 2, max: 4 });
  await page.locator('#hrz').click();
  await allerRetour(page);
  expect(await bornesHarry(page), 'apres deux allers retours').toEqual({ min: 2, max: 4 });
});

test('corriger reellement une annonce reste possible', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await page.locator('#ok').click();
  await page.waitForTimeout(350);
  await page.locator('#back').click();

  /* En phase d annonces, le compteur reste libre : ce n est pas Harry. */
  await page.locator('#rows .pr').first().locator('.step .plus').click();
  await page.waitForTimeout(350);
  await page.locator('#ok').click();

  expect((await store(page, 'sk_game')).rounds[5].bids.jA, 'annonce corrigee').toBe(4);
});
