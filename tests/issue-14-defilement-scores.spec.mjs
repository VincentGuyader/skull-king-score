import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round } from './helpers.mjs';

/* Issue #14 : l'ecouteur resize declenchait un rendu complet de l'ecran des
   scores, et render() se termine par un retour en haut de page. Sur mobile,
   le repli de la barre d'URL suffit a declencher un resize : l'ecran le plus
   long de l'application redebobinait a chaque defilement. */

const JOUEURS = ['Anne', 'Bob', 'Cleo', 'Dan', 'Eve', 'Finn'].map((n, i) =>
  player('j' + i, n, { color: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'][i], icon: '☠️' }));

/* Dix manches jouees : l'ecran des scores est bien plus haut que l'ecran. */
function partieFinie() {
  const rounds = Array.from({ length: 10 }, (_, r) => {
    const bids = {}, tricks = {};
    JOUEURS.forEach((p, i) => { bids[p.id] = (r + i) % 3; tricks[p.id] = (r * i + 1) % 3; });
    return round(bids, tricks);
  });
  return game({ id: 'gS', cfg: { rounds: 10 }, players: JOUEURS, rounds, cur: 9, phase: 'res' });
}

test('un redimensionnement ne renvoie pas en haut de l ecran des scores', async ({ page }) => {
  const errs = watchErrors(page);
  await page.setViewportSize({ width: 412, height: 915 });
  await boot(page, { roster: JOUEURS, game: partieFinie() });

  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(150);
  const avant = await page.evaluate(() => Math.round(window.scrollY));
  expect(avant, 'la page defile bien').toBeGreaterThan(300);

  await page.setViewportSize({ width: 412, height: 820 });
  await page.waitForTimeout(400);

  const apres = await page.evaluate(() => Math.round(window.scrollY));
  expect(Math.abs(apres - avant), `position ${avant} devenue ${apres}`).toBeLessThanOrEqual(40);
  expect(errs).toEqual([]);
});

test('le graphique se redessine a la nouvelle largeur', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await boot(page, { roster: JOUEURS, game: partieFinie() });
  const large = () => page.evaluate(() => {
    const svg = document.querySelector('#chart svg');
    return svg ? Number(svg.getAttribute('viewBox').split(' ')[2]) : 0;
  });
  const avant = await large();
  expect(avant, 'un graphique est dessine').toBeGreaterThan(200);

  await page.setViewportSize({ width: 760, height: 915 });
  await page.waitForTimeout(400);
  expect(await large(), 'la largeur du trace suit la fenetre').toBeGreaterThan(avant);
});

test('les donnees affichees restent justes apres redimensionnement', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await boot(page, { roster: JOUEURS, game: partieFinie() });
  const totaux = () => page.evaluate(() =>
    [...document.querySelectorAll('#lead .lead .tot')].map(t => t.textContent));
  const avant = await totaux();
  await page.setViewportSize({ width: 360, height: 700 });
  await page.waitForTimeout(400);
  expect(await totaux()).toEqual(avant);
});

test('changer d ecran remet bien en haut de page', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await boot(page, { roster: JOUEURS, game: partieFinie() });
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.evaluate(() => go('hof'));
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(0);
});
