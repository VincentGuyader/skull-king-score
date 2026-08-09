import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, blank, head, setCounter } from './helpers.mjs';

/* Anomalies mineures m4 et m5 du rapport de recette.

   m4 : chaque compteur de plis etait borne par la capacite de la manche,
   jamais par ce qui restait a distribuer. En manche 1 avec une carte, on
   pouvait mettre un pli a chacun des trois joueurs. Le detrompeur n'arrivait
   qu'a la validation.

   m5 : le reglage manuel de la capacite descendait a -5 sans tenir compte du
   nombre de cartes, ce qui donnait une capacite negative et un libelle casse
   du genre "1 carte + -5 pli de cartes speciales". */

const TROIS = ['Anne', 'Bob', 'Cleo'].map((n, i) =>
  player('j' + i, n, { color: ['#3987e5', '#d95926', '#199e70'][i], icon: '☠️' }));

function manche(phase, cur = 0, nb = 5) {
  return game({
    id: 'gB', cfg: { rounds: nb }, players: TROIS,
    rounds: Array.from({ length: nb }, blank), cur, phase
  });
}

function plusActif(page, i) {
  return page.locator('#rows .pr').nth(i).locator('.step .plus').isEnabled();
}
function somme(page) {
  return page.evaluate(() =>
    Object.values(G.rounds[G.cur].tricks).reduce((s, v) => s + (v || 0), 0));
}

test('en resultats, un compteur s arrete a ce qui reste a distribuer', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: TROIS, game: manche('res') });

  /* Manche 1 : une seule carte, donc un seul pli a repartir. */
  expect(await plusActif(page, 1), 'au depart, chacun peut le prendre').toBe(true);
  await setCounter(page, 0, 1);

  expect(await plusActif(page, 1), 'le pli est pris, les autres sont bloques').toBe(false);
  expect(await plusActif(page, 2), 'pour tout le monde').toBe(false);
  expect(await somme(page), 'la somme ne depasse pas la capacite').toBe(1);
  expect(errs).toEqual([]);
});

test('rendre un pli rouvre la saisie aux autres joueurs', async ({ page }) => {
  await boot(page, { roster: TROIS, game: manche('res', 2) });

  /* Manche 3 : trois plis. */
  await setCounter(page, 0, 3);
  expect(await plusActif(page, 1), 'tout est distribue').toBe(false);
  await setCounter(page, 0, 1);
  expect(await plusActif(page, 1), 'deux plis reviennent au pot').toBe(true);
  await setCounter(page, 1, 2);
  expect(await plusActif(page, 2), 'le pot est vide a nouveau').toBe(false);
  expect(await somme(page)).toBe(3);
});

test('la validation reste possible quand le Kraken a mange des plis', async ({ page }) => {
  await boot(page, { roster: TROIS, game: manche('res', 2) });
  await setCounter(page, 0, 1);
  expect((await head(page)).hint, 'le message du Kraken').toMatch(/Kraken/);
  await expect(page.locator('#ok'), 'valider reste possible').toBeEnabled();
});

test('en annonces, la sur-annonce reste permise', async ({ page }) => {
  await boot(page, { roster: TROIS, game: manche('bid', 2) });
  await setCounter(page, 0, 3);
  await setCounter(page, 1, 3);
  await setCounter(page, 2, 3);
  const somme = await page.evaluate(() =>
    Object.values(G.rounds[2].bids).reduce((s, v) => s + v, 0));
  expect(somme, 'neuf plis annonces pour trois cartes').toBe(9);
  expect((await head(page)).hint, 'et le bandeau le signale').toMatch(/9/);
});

test('la capacite manuelle ne descend jamais sous zero', async ({ page }) => {
  await boot(page, { roster: TROIS, game: manche('res') });
  await page.locator('#barHint').click();

  await page.evaluate(() => {
    const s = document.querySelector('#ce');
    let n = 0;
    while (!s.querySelector('.minus').disabled && n < 30) { s.querySelector('.minus').click(); n++; }
  });
  const total = Number(await page.locator('#ctot').textContent());
  expect(total, 'capacite plancher').toBe(0);
  expect(await page.evaluate(() => roundCapacity(G, G.cur).cap)).toBe(0);
});

test('le bandeau de capacite reste lisible avec un ajustement negatif', async ({ page }) => {
  await boot(page, { roster: TROIS, game: manche('res', 4) });
  await page.locator('#barHint').click();
  await page.locator('#ce .minus').click();
  await page.locator('#cok').click();
  await page.waitForTimeout(200);

  const texte = (await head(page)).hint;
  expect(texte, 'pas de double signe').not.toMatch(/\+\s*-/);
  expect(texte, 'accord au singulier pour un pli').not.toMatch(/-1 plis/);
});
