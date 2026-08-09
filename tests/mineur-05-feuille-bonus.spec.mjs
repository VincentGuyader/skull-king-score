import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, blank } from './helpers.mjs';

/* Anomalies mineures m8 et cosmetique c4 du rapport de recette.

   m8 : freeEditor initialisait le champ de saisie exacte a vide sans regarder
   b.free. En rouvrant une feuille qui porte un ajustement de -37, la grande
   valeur affichait bien -37 mais le champ etait vide, ce qui invite a
   ressaisir et donc a ecraser.

   c4 : le pied de la feuille affichait le total des bonus sans le pari du
   Rascal, qui vaut pourtant 20 points dans un sens ou dans l'autre. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });

function enResultats() {
  const g = game({
    id: 'gF', cfg: { rounds: 10 }, players: [ANNE, BOB],
    rounds: Array.from({ length: 10 }, blank), cur: 5, phase: 'res'
  });
  g.rounds[5].bids = { jA: 3, jB: 3 };
  g.rounds[5].bid0 = { jA: 3, jB: 3 };
  g.rounds[5].tricks = { jA: 3, jB: 3 };
  return g;
}
const ouvrirBonus = page => page.locator('#rows .pr').first().locator('.star').click();

test('le champ de saisie exacte montre l ajustement en cours', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: enResultats() });

  await ouvrirBonus(page);
  await page.locator('#fin').fill('-37');
  await page.locator('#bok').click();
  await page.waitForTimeout(200);

  await ouvrirBonus(page);
  expect(await page.locator('#fv').textContent(), 'la grande valeur').toBe('-37');
  expect(await page.locator('#fin').inputValue(), 'et le champ de saisie exacte').toBe('-37');
  expect(errs).toEqual([]);
});

test('sans ajustement, le champ reste vide', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: enResultats() });
  await ouvrirBonus(page);
  expect(await page.locator('#fin').inputValue()).toBe('');
  expect(await page.locator('#fv').textContent()).toBe('0');
});

test('les raccourcis partent bien de la valeur affichee', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: enResultats() });
  await ouvrirBonus(page);
  await page.locator('#fin').fill('-37');
  await page.locator('#bok').click();
  await page.waitForTimeout(200);

  await ouvrirBonus(page);
  await page.locator('.qgrid .qbtn').nth(1).click();   // +10
  expect(await page.locator('#fv').textContent(), '-37 plus 10').toBe('-27');
  expect(await page.locator('#fin').inputValue(), 'le champ suit').toBe('-27');
});

test('le pari du Rascal est annonce sous le total des bonus', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: enResultats() });
  await ouvrirBonus(page);

  await expect(page.locator('#bwn'), 'rien a signaler sans pari').toBeEmpty();

  await page.evaluate(() => {
    [...document.querySelectorAll('#bp .pchip')].find(c => /Rascal/i.test(c.textContent)).click();
  });
  await page.waitForTimeout(150);
  await page.locator('[data-w="20"]').click();
  await page.waitForTimeout(150);

  const note = await page.locator('#bwn').textContent();
  expect(note, 'le montant du pari').toContain('20');
  expect(note, 'et le fait qu il compte a part').not.toBe('');
});

test('le total des bonus ne melange pas le pari', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: enResultats() });
  await ouvrirBonus(page);
  await page.locator('#bl .brow').first().locator('.plus').click();   // 14 de couleur, +10

  await page.evaluate(() => {
    [...document.querySelectorAll('#bp .pchip')].find(c => /Rascal/i.test(c.textContent)).click();
  });
  await page.waitForTimeout(150);
  await page.locator('[data-w="20"]').click();
  await page.waitForTimeout(150);

  expect(await page.locator('#btot').textContent(), 'le total reste celui des bonus').toBe('+10');
  await page.locator('#bok').click();
  await page.waitForTimeout(200);
  const d = await page.evaluate(() => scoreRoundAll(G, 5).jA);
  expect(d.bonus, 'les bonus').toBe(10);
  expect(d.bet, 'le pari, compte a part').toBe(20);
});

test('decocher le Rascal fait disparaitre la mention du pari', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: enResultats() });
  await ouvrirBonus(page);
  const rascal = () => page.evaluate(() => {
    [...document.querySelectorAll('#bp .pchip')].find(c => /Rascal/i.test(c.textContent)).click();
  });
  await rascal();
  await page.waitForTimeout(150);
  await page.locator('[data-w="20"]').click();
  await page.waitForTimeout(150);
  await rascal();
  await page.waitForTimeout(200);
  await expect(page.locator('#bwn')).toBeEmpty();
});
