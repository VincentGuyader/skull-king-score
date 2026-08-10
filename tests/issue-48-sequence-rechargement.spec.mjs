import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, table, store } from './helpers.mjs';

/* Issue #48 : trois bornes se contredisaient. L'editeur de sequence bornait a
   maxCards, soit 37 a deux joueurs ; safeCfg rejetait la sequence entiere
   au-dela de 15 ; cardsForRound n'avait aucune borne haute. load() appelant
   safeCfg a chaque demarrage, une partie en cours perdait sa distribution au
   premier rechargement et ses manches deja verrouillees etaient recomptees. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });

/* Trois manches verrouillees, chacun annonce 0 et le tient : le total ne
   depend que du nombre de cartes distribuees. */
function partieJouee(seq) {
  return game({
    id: 'gS', cfg: { deal: 'custom', seq, rounds: seq.length, custom: [] },
    players: [ANNE, BOB],
    rounds: seq.map(() => ({ bids: { jA: 0, jB: 0 }, tricks: { jA: 0, jB: 0 }, bonus: {}, locked: true })),
    cur: seq.length - 1, phase: 'res'
  });
}

test('une sequence saisissable par l editeur survit au rechargement', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: partieJouee([16, 3, 3]) });

  await page.evaluate(() => goRoot('scores'));
  const avant = await table(page);
  const cartesAvant = await page.evaluate(() =>
    G.rounds.map((_, i) => cardsForRound(G.cfg, G.players.length, i)));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => goRoot('scores'));

  expect(await page.evaluate(() => G.rounds.map((_, i) => cardsForRound(G.cfg, G.players.length, i))),
    'les cartes distribuees ne bougent pas').toEqual(cartesAvant);
  expect(await table(page), 'les manches deja verrouillees gardent leurs points').toEqual(avant);
  expect(errs).toEqual([]);
});

test('le total d une partie deja jouee ne change pas au rechargement', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partieJouee([16, 3, 3]) });
  const avant = await page.evaluate(() => standings(G).tot.find(t => t.p.id === 'jA').total);
  expect(avant, 'annonces a zero tenues sur 16, 3 et 3 cartes').toBe(220);

  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => standings(G).tot.find(t => t.p.id === 'jA').total),
    'et apres rechargement').toBe(220);
});

test('la partie archivee et la partie reprise racontent la meme chose', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partieJouee([16, 3, 3]) });
  await page.evaluate(() => { G.rounds.forEach(r => { r.locked = true; }); save(); });

  await page.reload({ waitUntil: 'domcontentloaded' });
  const enCours = await page.evaluate(() => standings(G).tot.find(t => t.p.id === 'jA').total);
  const archivee = await page.evaluate(() =>
    gameResult(archive().find(g => g.id === 'gS')).tot.find(t => t.id === 'jA').total);
  expect(enCours, 'le meme total des deux cotes').toBe(archivee);
});

test('l editeur ne propose jamais une valeur que le stockage refuserait', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], lastsel: ['jA', 'jB'] });
  await page.locator('#deal button').filter({ hasText: 'Sur mesure' }).click();

  /* On pousse la premiere cellule a son maximum, quel qu'il soit. */
  const max = await page.evaluate(() => {
    const s = document.querySelector('.seqgrid .seqcell .step');
    let n = 0;
    while (!s.querySelector('.plus').disabled && n < 60) { s.querySelector('.plus').click(); n++; }
    return Number(s.querySelector('.v').textContent);
  });
  const seq = await page.evaluate(() => draft.cfg.seq);
  expect(seq[0], 'la cellule et la configuration sont d accord').toBe(max);

  /* Ce que l'editeur a produit doit traverser safeCfg sans etre altere. */
  const apres = await page.evaluate(s => safeCfg({ seq: s.slice(), custom: [] }).seq, seq);
  expect(apres, 'safeCfg ne retouche pas une sequence issue de l editeur').toEqual(seq);
});

test('une valeur illisible retombe sur la progression, sans emporter les autres', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], lastsel: ['jA', 'jB'] });
  const cartes = await page.evaluate(() => {
    const cfg = { loot: true, kraken: true, whale: true, seq: [null, 4, 'x', 6] };
    return [0, 1, 2, 3].map(i => cardsForRound(cfg, 2, i));
  });
  /* Les entrees valides sont respectees, les autres reprennent le rang. */
  expect(cartes, 'repli par element, pas en bloc').toEqual([1, 4, 3, 6]);
});

test('safeCfg et cardsForRound appliquent la meme regle', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], lastsel: ['jA', 'jB'] });
  const cas = [[16, 3, 3], [1, 2, 3], [10, 10], [null, 4], [37], ['x'], [0, 5]];
  for (const seq of cas) {
    const memes = await page.evaluate(s => {
      const brut = { loot: true, kraken: true, whale: true, seq: s.slice(), custom: [] };
      const propre = safeCfg(JSON.parse(JSON.stringify(brut)));
      return s.map((_, i) => [cardsForRound(brut, 2, i), cardsForRound(propre, 2, i)]);
    }, seq);
    for (const [avant, apres] of memes) {
      expect(apres, `sequence ${JSON.stringify(seq)} : ${avant} devient ${apres}`).toBe(avant);
    }
  }
});

test('une sequence structurellement inutilisable est bien ecartee', async ({ page }) => {
  const errs = watchErrors(page);
  for (const seq of ['oui', 7, {}, true, []]) {
    await boot(page, {
      roster: [ANNE, BOB], lastsel: ['jA', 'jB'],
      raw: { sk_cfg: JSON.stringify({ deal: 'custom', seq, rounds: 5, custom: [] }) }
    });
    expect(await page.evaluate(() => draft.cfg.seq), 'sequence ' + JSON.stringify(seq)).toBeUndefined();
    await expect(page.locator('#go'), 'l ecran reste utilisable').toBeEnabled();
  }
  expect(errs).toEqual([]);
});
