import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, blank, head } from './helpers.mjs';

/* Anomalies mineures m1, m2, m3 et c1 du rapport de recette : des chaines
   ecrites en dur hors du dictionnaire, et un gabarit jamais interpole. Le
   dictionnaire lui meme est complet, 317 cles dans les quatre langues. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const LANGUES = ['fr', 'en', 'de', 'es'];

test('la zone de progression affiche un texte, pas un gabarit', async ({ page }) => {
  const errs = watchErrors(page);
  for (const lang of LANGUES) {
    await boot(page, {
      roster: [ANNE, BOB], lang,
      game: game({ id: 'g', cfg: { rounds: 3 }, players: [ANNE, BOB],
                   rounds: [blank(), blank(), blank()], cur: 0, phase: 'bid' })
    });
    await page.evaluate(() => goRoot('scores'));
    const texte = (await page.locator('#chart').textContent()).trim();
    expect(texte, `${lang} : aucun gabarit non interpole`).not.toContain('${');
    expect(texte, `${lang} : le texte traduit`).toBe(await page.evaluate(l => I18N[l].chartLater, lang));
  }
  expect(errs).toEqual([]);
});

test('basculer une option garde le sous-titre dans la langue courante', async ({ page }) => {
  for (const lang of LANGUES) {
    await boot(page, { roster: [ANNE, BOB], lang, lastsel: ['jA', 'jB'] });
    const attendu = await page.evaluate(l => I18N[l].headSub(2, 10), lang);
    expect((await head(page)).sub, `${lang} : au depart`).toBe(attendu);

    await page.locator('#opts .sw').first().click();
    await page.waitForTimeout(120);
    expect((await head(page)).sub, `${lang} : apres bascule du Butin`).toBe(attendu);
  }
});

test('le titre de la liste des parties est traduit', async ({ page }) => {
  const PARTIE = game({
    id: 'g1', date: Date.parse('2026-05-01'), cfg: { rounds: 1 },
    players: [ANNE, BOB], rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 })]
  });
  for (const lang of LANGUES) {
    await boot(page, { roster: [ANNE, BOB], archive: [PARTIE], lang });
    await page.evaluate(() => go('hof'));
    const titres = await page.evaluate(() => [...document.querySelectorAll('#app h2')].map(x => x.textContent));
    expect(titres, `${lang} : titre de section`).toContain(await page.evaluate(l => I18N[l].gamesSection, lang));
  }
});

test('le pirate fetiche porte son nom dans la langue courante', async ({ page }) => {
  const AVEC_PIRATE = game({
    id: 'gP', date: Date.parse('2026-05-01'), cfg: { rounds: 1 },
    players: [ANNE, BOB],
    rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 }, { bonus: { jA: { pir: ['rascal'] } } })]
  });
  for (const lang of LANGUES) {
    await boot(page, { roster: [ANNE, BOB], archive: [AVEC_PIRATE], lang });
    await page.evaluate(() => go('player', 'jA'));
    const texte = await page.locator('#app').textContent();
    expect(texte, `${lang} : nom traduit du Rascal`)
      .toContain(await page.evaluate(l => I18N[l].pirNames.rascal, lang));
  }
});

test('le bouton de bonus porte un intitule dans la langue courante', async ({ page }) => {
  for (const lang of LANGUES) {
    await boot(page, {
      roster: [ANNE, BOB], lang,
      game: game({ id: 'g', cfg: { rounds: 3 }, players: [ANNE, BOB],
                   rounds: [blank(), blank(), blank()], cur: 0, phase: 'res' })
    });
    const etoile = page.locator('#rows .pr').first().locator('.star');
    const intitule = (await etoile.getAttribute('aria-label')) || (await etoile.getAttribute('title'));
    expect(intitule, `${lang} : intitule present`).toBeTruthy();
    expect(intitule, `${lang} : intitule traduit`)
      .toBe(await page.evaluate(l => I18N[l].bonusTitle, lang));
  }
});

test('le manifeste porte un identifiant stable', async ({ page }) => {
  const rep = await page.request.get('/manifest.webmanifest');
  expect(rep.status()).toBe(200);
  const m = await rep.json();
  expect(m.id, 'un identifiant fige l application meme si l URL bouge').toBeTruthy();
  expect(m.start_url, 'point de depart').toBeTruthy();
  expect(m.icons.length, 'icones declarees').toBeGreaterThanOrEqual(3);
});
