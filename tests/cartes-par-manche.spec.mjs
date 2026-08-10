import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, blank, table, cardsRow, head, setCounter } from './helpers.mjs';

/* Le livret 2022, section « Nombre de cartes », propose six facons de
   distribuer autrement que 1, 2, 3... L'application ne savait faire que la
   progression officielle, ce qui rendait ces variantes impossibles a compter
   juste : le score d'une annonce a zero et le potentiel Rascal dependent du
   nombre de cartes de la manche, pas de son numero. */

const J = ['Anne', 'Bob', 'Cleo'].map((n, i) =>
  player('j' + i, n, { color: ['#3987e5', '#d95926', '#199e70'][i], icon: '☠️' }));

/* Les six suggestions du livret, relevees page 27. */
const LIVRET = {
  noodd: [2, 2, 4, 4, 6, 6, 8, 8, 10, 10],
  ready: [6, 7, 8, 9, 10],
  flash: [5, 5, 5, 5, 5],
  barrage: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
  whirl: [9, 9, 7, 7, 5, 5, 3, 3, 1, 1],
  bedtime: [1]
};

function partie(cfg, nb) {
  return game({
    id: 'gD', cfg, players: J,
    rounds: Array.from({ length: nb }, blank), cur: 0, phase: 'bid'
  });
}

test('les six variantes du livret sont proposees, plus le sur-mesure', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: J, lastsel: ['j0', 'j1', 'j2'] });
  const noms = await page.evaluate(() =>
    [...document.querySelectorAll('#deal button .dn')].map(x => x.textContent));
  expect(noms.length, 'huit choix').toBe(8);
  for (const n of ['Croissant', 'Pas d’impair', 'Prêt au combat', 'Attaque éclair',
                   'Tir de barrage', 'Tourbillon', 'L’heure du dodo', 'Sur mesure']) {
    expect(noms, n).toContain(n);
  }
  expect(errs).toEqual([]);
});

test('chaque variante pose la sequence exacte du livret', async ({ page }) => {
  await boot(page, { roster: J, lastsel: ['j0', 'j1', 'j2'] });
  for (const [cle, attendue] of Object.entries(LIVRET)) {
    await page.evaluate(k => {
      draft.cfg.deal = k;
      draft.cfg.seq = DEALS.find(d => d.k === k).seq.slice();
      renderSetup2();
    }, cle);
    expect(await page.evaluate(() => draft.cfg.seq), cle).toEqual(attendue);
  }
});

test('choisir une variante fige le nombre de manches', async ({ page }) => {
  await boot(page, { roster: J, lastsel: ['j0', 'j1', 'j2'] });
  await page.locator('#deal button').filter({ hasText: 'Attaque éclair' }).click();

  expect((await page.locator('#stRounds').textContent()).trim(), 'cinq manches').toBe('5');
  await expect(page.locator('#stRounds button'), 'plus de reglage').toHaveCount(0);
  expect(await page.locator('#roundsHint').textContent(), 'la raison est dite')
    .toContain('Attaque éclair');

  await page.locator('#deal button').filter({ hasText: 'Croissant' }).click();
  await expect(page.locator('#stRounds button'), 'le reglage revient').toHaveCount(2);
});

test('Attaque eclair distribue cinq cartes a chaque manche', async ({ page }) => {
  await boot(page, { roster: J, lastsel: ['j0', 'j1', 'j2'] });
  await page.locator('#deal button').filter({ hasText: 'Attaque éclair' }).click();
  await page.locator('#go').click();

  const cartes = await page.evaluate(() =>
    G.rounds.map((_, i) => cardsForRound(G.cfg, G.players.length, i)));
  expect(cartes, 'cinq manches de cinq').toEqual([5, 5, 5, 5, 5]);
  expect((await head(page)).title, 'l en-tete l annonce').toContain('5 cartes');
});

test('le score suit le nombre de cartes reel, pas le numero de manche', async ({ page }) => {
  const cfg = { deal: 'flash', seq: [5, 5, 5, 5, 5], rounds: 5, custom: [] };
  await boot(page, { roster: J, game: partie(cfg, 5) });

  /* Manche 1 : Anne annonce 0 et tient. Avec cinq cartes cela vaut 50, la
     ou la progression officielle n'en donnerait que 10. */
  await setCounter(page, 1, 3);
  await setCounter(page, 2, 2);
  await page.locator('#ok').click();
  await setCounter(page, 1, 3);
  await setCounter(page, 2, 2);
  await page.locator('#ok').click();

  const lignes = await table(page);
  expect(lignes[1], 'annonce a zero tenue sur cinq cartes').toEqual(['Anne', '+50', '50']);
});

test('le tableau affiche les cartes distribuees, en variante comme en standard', async ({ page }) => {
  const jouer = () => page.evaluate(() => {
    G.rounds[0].bids = { j0: 0, j1: 0, j2: 0 };
    G.rounds[0].tricks = { j0: 0, j1: 0, j2: 0 };
    G.rounds[0].locked = true;
    save(); goRoot('scores');
  });

  await boot(page, { roster: J, game: partie({ deal: 'ready', seq: [6, 7, 8, 9, 10], rounds: 5, custom: [] }, 5) });
  await jouer();
  expect(await cardsRow(page), 'variante').toEqual(['cartes', '6', '']);

  await boot(page, { roster: J, game: partie({ rounds: 5, custom: [] }, 5) });
  await jouer();
  expect(await cardsRow(page), 'progression officielle').toEqual(['cartes', '1', '']);
});

test('la sequence sur mesure se compose manche par manche', async ({ page }) => {
  await boot(page, { roster: J, lastsel: ['j0', 'j1', 'j2'] });
  await page.locator('#deal button').filter({ hasText: 'Sur mesure' }).click();

  await expect(page.locator('.seqgrid .seqcell'), 'une cellule par manche').toHaveCount(10);
  await page.locator('#seqLess').click();
  await expect(page.locator('.seqgrid .seqcell'), 'une manche de moins').toHaveCount(9);
  await page.locator('#seqMore').click();
  await expect(page.locator('.seqgrid .seqcell'), 'et une de plus').toHaveCount(10);

  await page.locator('.seqgrid .seqcell').first().locator('.plus').click();
  expect((await page.evaluate(() => draft.cfg.seq))[0], 'premiere manche a deux cartes').toBe(2);
  expect((await page.locator('#stRounds').textContent()).trim(),
    'la longueur fait le nombre de manches').toBe('10');
});

test('le paquet garde le dernier mot a huit joueurs', async ({ page }) => {
  const huit = Array.from({ length: 8 }, (_, i) =>
    player('j' + i, 'J' + i, { color: '#3987e5', icon: '☠️' }));
  const cfg = { deal: 'barrage', seq: Array(10).fill(10), rounds: 10, custom: [] };
  await boot(page, {
    roster: huit,
    game: game({ id: 'g8', cfg, players: huit, rounds: Array.from({ length: 10 }, blank), cur: 0, phase: 'bid' })
  });
  const cartes = await page.evaluate(() => G.rounds.map((_, i) => cardsForRound(G.cfg, 8, i)));
  expect(cartes.every(c => c === 9), 'plafonne a 9, comme le livret le prevoit a 7 et 8 joueurs').toBe(true);
});

test('une sequence structurellement inutilisable est ecartee', async ({ page }) => {
  const errs = watchErrors(page);
  for (const seq of ['oui', [], {}, 7, true]) {
    await boot(page, {
      roster: J,
      raw: { sk_cfg: JSON.stringify({ deal: 'custom', seq, rounds: 5, custom: [] }) },
      lastsel: ['j0', 'j1', 'j2']
    });
    expect(await page.evaluate(() => draft.cfg.seq), 'sequence ' + JSON.stringify(seq)).toBeUndefined();
    await expect(page.locator('#go'), 'l ecran reste utilisable').toBeEnabled();
  }
  expect(errs).toEqual([]);
});

test('une valeur illisible ne fait pas tomber les valeurs voisines', async ({ page }) => {
  /* Reparation par element : une manche illisible reprend son rang, les
     autres gardent la valeur saisie. C'est la meme regle des deux cotes,
     celle qui evite de recompter une manche deja verrouillee. */
  await boot(page, { roster: J, lastsel: ['j0', 'j1', 'j2'] });
  const cartes = await page.evaluate(() => {
    const cfg = { loot: true, kraken: true, whale: true, seq: [0, 2, null, 6] };
    return [0, 1, 2, 3].map(i => cardsForRound(cfg, 3, i));
  });
  expect(cartes).toEqual([1, 2, 3, 6]);
});

test('une partie sans sequence garde le comportement d avant', async ({ page }) => {
  await boot(page, { roster: J, lastsel: ['j0', 'j1', 'j2'] });
  const cartes = await page.evaluate(() =>
    [0, 1, 2, 3, 4].map(i =>
      cardsForRound({ scoring: 'classic', loot: true, kraken: true, whale: true }, 3, i)));
  expect(cartes, 'progression officielle inchangee').toEqual([1, 2, 3, 4, 5]);
});
