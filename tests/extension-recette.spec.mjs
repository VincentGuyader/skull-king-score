import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boot, watchErrors, roster, game, round, blank, head, table, cardsRow } from './helpers.mjs';

/* Recette adverse de l'option Extension : l'application est eprouvee avec
   l'option active et sans elle, sur les parcours qu'un test unitaire ne
   traverse pas : partie complete a neuf, persistance au rechargement, archive
   et hall of fame, aide-memoire dans les quatre langues, accessibilite, et
   les sauvegardes d'avant l'option. */

const NEUF = roster('Anne', 'Bob', 'Cleo', 'Dan', 'Eve', 'Fred', 'Gus', 'Hal', 'Ida');
const IDS = NEUF.map(p => p.id);
const LANGUES = ['fr', 'en', 'de', 'es'];

/* Dix manches jouees a n joueurs, chaque manche remportee par un seul joueur
   qui annonce juste, les autres a zero. */
function dixManches(n, cfg) {
  const J = NEUF.slice(0, n);
  const rounds = [];
  for (let ri = 0; ri < 10; ri++) {
    const gagnant = J[ri % n].id;
    const bids = {}, tricks = {};
    J.forEach(p => { bids[p.id] = 0; tricks[p.id] = 0; });
    const cartes = Math.min(ri + 1, Math.floor((cfg.ext ? 93 : 74) / n));
    bids[gagnant] = cartes; tricks[gagnant] = cartes;
    rounds.push(round(bids, tricks));
  }
  return game({ id: 'gX', cfg: { rounds: 10, ...cfg }, players: J, rounds, cur: 9, phase: 'res' });
}

for (const [ext, n, cartesFin] of [[true, 9, 10], [false, 8, 9]]) {
  test(`partie complete a ${n} joueurs, extension ${ext ? 'active' : 'inactive'}`, async ({ page }) => {
    const errs = watchErrors(page);
    await boot(page, { roster: NEUF, lastsel: IDS.slice(0, n), cfg: { ext } });
    await page.locator('#go').click();
    expect(await page.evaluate(() => G.players.length), 'joueurs a la table').toBe(n);
    expect(await page.evaluate(() => G.cfg.ext), 'option portee par la partie').toBe(ext);

    await page.evaluate(() => { G.cur = 9; G.phase = 'bid'; save(); goRoot('round'); });
    expect((await head(page)).title, 'cartes de la derniere manche').toContain(cartesFin + ' cartes');
    const cap = await page.evaluate(() => roundCapacity(G, 9).cap);
    expect(cap, 'plis attribuables').toBe(cartesFin);

    /* Une partie entierement jouee, vue depuis l'ecran des scores. */
    await boot(page, { roster: NEUF, game: dixManches(n, { ext }) });
    await page.evaluate(() => goRoot('scores'));
    const ligneCartes = (await cardsRow(page)).filter(Boolean);
    expect(ligneCartes[ligneCartes.length - 1], 'derniere colonne de cartes').toBe(String(cartesFin));
    expect((await table(page)).length, 'en-tete plus une ligne par joueur').toBe(n + 1);
    expect(await page.locator('#lgd .lg').count(), 'legende').toBe(n);
    expect(await page.locator('#chart path').count(), 'une courbe par joueur').toBe(n);
    const couleurs = await page.evaluate(() => [...document.querySelectorAll('#chart path')].map(p => p.getAttribute('stroke')));
    expect(new Set(couleurs).size, 'courbes toutes distinctes').toBe(n);
    expect(errs).toEqual([]);
  });
}

test('l option survit au rechargement et se propose a la partie suivante', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: NEUF, lastsel: IDS, cfg: { ext: true } });
  await page.locator('#go').click();
  await page.reload();
  await page.waitForFunction(() => document.readyState === 'complete');
  expect(await page.evaluate(() => G.cfg.ext && G.players.length), 'partie reprise a neuf').toBe(9);

  await page.evaluate(() => { G.cur = 2; G.phase = 'res'; save(); goRoot('round'); });
  await page.locator('#rows .pr').first().locator('.star').click();
  expect(await page.locator('#bl .brow').count(), 'feuille de bonus etendue').toBe(10);
  await page.locator('#bok').click();

  await page.evaluate(() => { Store.del('sk_game'); G = null; draft = newDraft(); goRoot('setup'); });
  expect(await page.evaluate(() => draft.cfg.ext), 'option retenue pour la suite').toBe(true);
  expect(await page.evaluate(() => draft.sel.length), 'neuf joueurs proposes').toBe(9);
  expect(errs).toEqual([]);
});

test('sans l option, une selection de neuf memorisee retombe a huit', async ({ page }) => {
  await boot(page, { roster: NEUF, lastsel: IDS, cfg: { ext: false } });
  expect(await page.evaluate(() => draft.sel.length)).toBe(8);
  await expect(page.locator('#go')).toBeEnabled();
});

test('une sequence sur mesure trop haute pour le paquet de base est plafonnee sans erreur', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: NEUF, lastsel: IDS.slice(0, 8), cfg: { ext: true, deal: 'custom', seq: [11, 11, 11] } });
  expect(await page.evaluate(() => cardsForRound(draft.cfg, 8, 0)), 'onze cartes possibles a huit avec l extension').toBe(11);
  await page.locator('#opts .brow').filter({ hasText: 'Extension' }).locator('.sw').click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => cardsForRound(draft.cfg, 8, 0)), 'ramene au paquet de base').toBe(9);
  await page.locator('#go').click();
  expect((await head(page)).title).toContain('9 cartes');
  expect(errs).toEqual([]);
});

test('le hall of fame connait Mary Thorne et les parties a neuf', async ({ page }) => {
  const errs = watchErrors(page);
  const g = dixManches(9, { ext: true, pirates: true });
  g.rounds[0].bonus = { j0: { pir: ['mary', 'mary', 'harry'], e8: 1 } };
  g.rounds[1].bonus = { j0: { pir: ['mary'] } };
  for (const lang of LANGUES) {
    await boot(page, { roster: NEUF, archive: [g], lang });
    await page.evaluate(() => goRoot('player', 'j0'));
    const fiche = await page.locator('#app').textContent();
    expect(fiche, `${lang} : pirate favori`).toContain('Mary Thorne');
    expect(fiche, `${lang} : pas de cle brute`).not.toContain('mary');
  }
  await page.evaluate(() => { HOF_FILTER.size = '6+'; goRoot('hof'); });
  expect(await page.locator('#app').textContent(), 'la partie a neuf est dans le perimetre 6+').toContain('Anne');
  expect(errs).toEqual([]);
});

test('une archive d avant l option compte exactement comme avant', async ({ page }) => {
  /* Sauvegarde ancienne : pas de cle ext, compteurs de base seulement. */
  const g = dixManches(4, { loot: true });
  delete g.cfg.ext;
  g.rounds[3].bonus = { j3: { c14: 2, loot: 1, pBySK: 5 } };
  await boot(page, { roster: NEUF, archive: [g] });
  const total = await page.evaluate(() => gameResult(archive()[0]).tot.find(t => t.id === 'j3').total);
  /* Manche 4 : 4 plis annonces et faits = 80, +20 +20 +150 ; manche 8 : 8 plis
     = 160 ; les huit autres manches a zero reussi : 10 x (1+2+3+5+6+7+9+10). */
  expect(total).toBe(80 + 20 + 20 + 150 + 160 + 430);
});

test('un compteur Butin dans une partie sans Butin ne vaut rien non plus', async ({ page }) => {
  const g = dixManches(3, { loot: false });
  delete g.cfg.ext;
  g.rounds[0].bonus = { j0: { loot: 2, c14: 1 } };
  await boot(page, { roster: NEUF, archive: [g] });
  const total = await page.evaluate(() => gameResult(archive()[0]).tot.find(t => t.id === 'j0').total);
  expect(total, '440 + 330 + 10, sans les 40 du Butin').toBe(780);
});

test('des compteurs d extension egares dans une partie de base ne valent rien', async ({ page }) => {
  const g = dixManches(3, {});
  g.rounds[0].bonus = { j0: { e8: 4, dj: 3, mate: 1 } };
  await boot(page, { roster: NEUF, archive: [g] });
  const total = await page.evaluate(() => gameResult(archive()[0]).tot.find(t => t.id === 'j0').total);
  /* Manches 1, 4, 7, 10 gagnees : 20 + 80 + 140 + 200 ; six manches a zero
     reussi : 10 x (2+3+5+6+8+9). Rien pour les compteurs egares. */
  expect(total).toBe(440 + 330);
});

test('l aide-memoire suit le brouillon de configuration', async ({ page }) => {
  await boot(page, { roster: NEUF, lastsel: IDS.slice(0, 3) });
  await page.evaluate(() => go('help'));
  expect(await page.locator('#app').textContent()).not.toContain('Davy Jones');
  await page.evaluate(() => { draft.cfg.ext = true; goRoot('help'); });
  expect(await page.locator('#app').textContent()).toContain('Davy Jones');
});

for (const lang of LANGUES) {
  test(`l aide-memoire etendu tient dans 320 px en ${lang}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await boot(page, { roster: NEUF, game: dixManches(9, { ext: true, pirates: true }), lang });
    await page.evaluate(() => go('help'));
    const m = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      vue: document.documentElement.clientWidth,
      debordants: [...document.querySelectorAll('#app .kv, #app .hier div')]
        .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent.trim().slice(0, 40))
    }));
    expect(m.doc, 'aucun defilement horizontal').toBeLessThanOrEqual(m.vue);
    expect(m.debordants, 'aucune ligne coupee').toEqual([]);
  });
}

test('la configuration et la feuille de bonus etendues passent l audit axe', async ({ page }) => {
  await boot(page, { roster: NEUF, lastsel: IDS, cfg: { ext: true } });
  const graves = r => r.violations.filter(v => ['serious', 'critical'].includes(v.impact))
    .map(v => `${v.impact} ${v.id} : ${v.help}`);
  expect(graves(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()), 'configuration').toEqual([]);

  const g = dixManches(9, { ext: true, pirates: true });
  g.rounds[9].locked = false; g.cur = 9; g.phase = 'res';
  await boot(page, { roster: NEUF, game: g });
  await page.locator('#rows .pr').first().locator('.star').click();
  await page.waitForTimeout(200);
  expect(graves(await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()), 'feuille de bonus').toEqual([]);
});

test('le bareme Rascal applique les bonus de l extension comme les autres', async ({ page }) => {
  await boot(page, { roster: NEUF });
  const r = await page.evaluate(() => {
    const cfg = { scoring: 'rascal', rascal: 'grapeshot', ext: true, custom: [] };
    const sp = bonusSplit({ e8: 1, dj: 1 }, cfg);
    return [scoreRound(3, 3, 5, sp.cond, cfg, sp.free, 0).total, scoreRound(3, 4, 5, sp.cond, cfg, sp.free, 0).total];
  });
  expect(r, 'dans le mille : 50 + 25 ; a un pli pres : 25 + 13').toEqual([75, 38]);
});
