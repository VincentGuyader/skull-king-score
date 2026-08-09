import { test, expect } from '@playwright/test';
import { boot, player, game, round, blank } from './helpers.mjs';

/* Issue #9 : sur la ligne joueur, le compteur occupait 146 px fixes. Sous
   412 px de large, il ne restait plus assez pour le nom, reduit a une lettre
   a 320 px. On ne savait plus a qui on attribuait les plis. */

const NOMS = ['Bartholomew', 'Clementine', 'Maximiliane', 'Wolfgang',
              'Konstanze', 'Friedrich', 'Alexandra', 'Christoph'];
const COULEURS = ['#3987e5', '#d95926', '#199e70', '#c98500',
                  '#d55181', '#008300', '#9085e9', '#e66767'];
const HUIT = NOMS.map((n, i) => player('j' + i, n, { color: COULEURS[i], icon: '☠️' }));

function partie(phase) {
  const bids = {}, tricks = {};
  HUIT.forEach((p, i) => { bids[p.id] = i % 3; tricks[p.id] = (i + 1) % 3; });
  return game({
    id: 'gL', cfg: { rounds: 10 }, players: HUIT,
    rounds: [round(bids, tricks, { locked: false }), ...Array.from({ length: 9 }, blank)],
    cur: 0, phase
  });
}

/* Les metriques de police varient d'un systeme a l'autre : un test qui
   compare des pixels a une valeur en dur passe sur une machine et casse sur
   une autre. On verifie ce qui compte vraiment, que le nom soit entierement
   lisible, sans supposer la largeur qu'il occupe. */
function mesures(page) {
  return page.evaluate(() => [...document.querySelectorAll('#rows .pr')].map(row => {
    const nm = row.querySelector('.nm');
    const ligne = parseFloat(getComputedStyle(nm).lineHeight) || 18;
    return {
      nom: nm.textContent,
      dispo: Math.round(nm.getBoundingClientRect().width),
      requis: nm.scrollWidth,
      lignes: Math.max(1, Math.round(nm.scrollHeight / ligne)),
      hauteurLigne: Math.round(row.getBoundingClientRect().height)
    };
  }));
}

for (const largeur of [320, 360, 390, 412]) {
  for (const phase of ['bid', 'res']) {
    test(`a ${largeur} px, phase ${phase}, aucun nom n est tronque`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await boot(page, { roster: HUIT, game: partie(phase) });

      for (const m of await mesures(page)) {
        expect(m.requis, `${m.nom} deborde : ${m.dispo} px pour ${m.requis} px`)
          .toBeLessThanOrEqual(m.dispo + 1);
        expect(m.lignes, `${m.nom} tient au plus sur deux lignes`).toBeLessThanOrEqual(2);
        expect(m.hauteurLigne, `hauteur de la ligne de ${m.nom}`).toBeLessThanOrEqual(96);
      }
    });
  }
}

test('la page ne defile pas horizontalement a 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await boot(page, { roster: HUIT, game: partie('res') });
  const d = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    vue: document.documentElement.clientWidth
  }));
  expect(d.doc, 'aucun debordement horizontal').toBeLessThanOrEqual(d.vue);
});

test('les compteurs restent utilisables sur petit ecran', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await boot(page, { roster: HUIT, game: partie('res') });

  const tailles = await page.evaluate(() =>
    [...document.querySelectorAll('#rows .pr')].slice(0, 1).flatMap(row =>
      [...row.querySelectorAll('.step button, .star')].map(b => {
        const c = b.getBoundingClientRect();
        return { w: Math.round(c.width), h: Math.round(c.height) };
      })));
  for (const t of tailles) {
    expect(t.w, 'largeur de la cible tactile').toBeGreaterThanOrEqual(36);
    expect(t.h, 'hauteur de la cible tactile').toBeGreaterThanOrEqual(36);
  }
});

test('un nom court tient sur une seule ligne, meme a 320 px', async ({ page }) => {
  const courts = ['Ana', 'Bo', 'Cid', 'Dan', 'Eve', 'Finn', 'Gil', 'Hugo']
    .map((n, i) => player('j' + i, n, { color: COULEURS[i], icon: '☠️' }));
  await page.setViewportSize({ width: 320, height: 900 });
  await boot(page, { roster: courts, game: { ...partie('res'), players: courts } });
  for (const m of await mesures(page)) {
    expect(m.lignes, `${m.nom} sur une seule ligne`).toBe(1);
  }
});

test('a 412 px et au dela, la ligne garde sa disposition confortable', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await boot(page, { roster: HUIT, game: partie('res') });
  const h = await page.evaluate(() =>
    Math.round(document.querySelector('#rows .pr').getBoundingClientRect().height));
  expect(h, 'la ligne tient sur une hauteur raisonnable').toBeLessThanOrEqual(96);
});
