import { test, expect } from '@playwright/test';
import { boot, watchErrors, roster, game, round, blank, table, head, setCounter, tapBar } from './helpers.mjs';

/* Le bareme est le coeur du produit : ces cas viennent des regles officielles
   et servent de reference a toute modification du moteur. */

const CASES = [
  { nom: 'manche 5, annonce 2, 2 plis', cards: 5, bid: 2, tricks: 2, attendu: 40 },
  { nom: 'manche 5, annonce 2, 3 plis', cards: 5, bid: 2, tricks: 3, attendu: -10 },
  { nom: 'manche 5, annonce 4, 2 plis', cards: 5, bid: 4, tricks: 2, attendu: -20 },
  { nom: 'manche 7, annonce 0, 0 pli', cards: 7, bid: 0, tricks: 0, attendu: 70 },
  { nom: 'manche 7, annonce 0, 1 pli', cards: 7, bid: 0, tricks: 1, attendu: -70 },
  { nom: 'manche 7, annonce 0, 3 plis', cards: 7, bid: 0, tricks: 3, attendu: -70 }
];

test('bareme classique, cas de reference', async ({ page }) => {
  await boot(page, { roster: roster('Anne', 'Bob') });
  for (const c of CASES) {
    const got = await page.evaluate(
      ([bid, tricks, cards]) => scoreRound(bid, tricks, cards, 0,
        { scoring: 'classic', bonusIfExact: true }, 0, 0).total,
      [c.bid, c.tricks, c.cards]);
    expect(got, c.nom).toBe(c.attendu);
  }
});

test('bareme Rascal, potentiel entier, moitie et zero', async ({ page }) => {
  await boot(page, { roster: roster('Anne', 'Bob') });
  const mit = { scoring: 'rascal', rascal: 'grapeshot', bonusIfExact: true };
  const bou = { scoring: 'rascal', rascal: 'cannonball', bonusIfExact: true };
  const call = (cfg, bid, tricks, bp = 0, free = 0, wager = 0) => page.evaluate(
    ([cfg, bid, tricks, bp, free, wager]) => scoreRound(bid, tricks, 6, bp, cfg, free, wager),
    [cfg, bid, tricks, bp, free, wager]);

  expect((await call(mit, 3, 3, 20)).total, 'mitraille, dans le mille').toBe(80);
  expect((await call(mit, 3, 4, 20)).total, 'mitraille, un pli d ecart').toBe(40);
  expect((await call(mit, 3, 5)).total, 'mitraille, deux plis d ecart').toBe(0);
  expect((await call(bou, 2, 2, 20)).total, 'boulet, dans le mille').toBe(110);
  expect((await call(bou, 2, 3)).total, 'boulet, rate').toBe(0);

  /* L'ajustement libre n'est jamais divise par deux. */
  expect((await call(mit, 3, 4, 0, -10)).adj, 'ajustement non divise').toBe(-10);
  /* Le pari du Rascal n'est ni divise ni annule. */
  expect((await call(mit, 3, 4, 0, 0, 20)).bet, 'pari perdu en entier').toBe(-20);
  expect((await call(mit, 3, 3, 0, 0, 20)).bet, 'pari gagne en entier').toBe(20);
});

test('bonus soumis a l annonce, selon l option', async ({ page }) => {
  await boot(page, { roster: roster('Anne', 'Bob') });
  const call = (bonusIfExact, bid, tricks, bp, free = 0) => page.evaluate(
    ([bonusIfExact, bid, tricks, bp, free]) => scoreRound(bid, tricks, 5, bp,
      { scoring: 'classic', bonusIfExact }, free, 0).total,
    [bonusIfExact, bid, tricks, bp, free]);

  expect(await call(true, 1, 0, 30), 'annonce ratee, option active').toBe(-10);
  expect(await call(false, 1, 0, 30), 'annonce ratee, option desactivee').toBe(20);
  expect(await call(true, 1, 1, 35, -10), 'annonce juste, ajustement negatif').toBe(45);
  expect(await call(true, 1, 0, 35, -10), 'annonce ratee, ajustement acquis').toBe(-20);
});

test('plafond de cartes par manche selon le nombre de joueurs', async ({ page }) => {
  await boot(page, { roster: roster('Anne', 'Bob') });
  const full = { loot: true, kraken: true, whale: true };
  const cards = (n, roundIdx) => page.evaluate(
    ([cfg, n, r]) => cardsForRound(cfg, n, r), [full, n, roundIdx]);

  expect(await page.evaluate(c => deckSize(c), full), 'paquet complet').toBe(74);
  expect(await cards(8, 9), 'manche 10 a huit joueurs').toBe(9);
  expect(await cards(8, 14), 'manche 15 a huit joueurs').toBe(9);
  expect(await cards(7, 9), 'manche 10 a sept joueurs').toBe(10);
  expect(await cards(4, 9), 'manche 10 a quatre joueurs').toBe(10);
});

test('une partie jouee a l interface donne les totaux calcules a la main', async ({ page }) => {
  const errs = watchErrors(page);
  const r = roster('Anne', 'Bob', 'Cleo');
  await boot(page, {
    roster: r,
    game: game({
      players: r, cfg: { rounds: 3 },
      rounds: [blank(), blank(), blank()], cur: 0, phase: 'bid'
    })
  });

  /* Manche 1, une carte : Anne annonce 1 et la realise, les autres passent. */
  await setCounter(page, 0, 1);
  await page.locator('#ok').click();
  await setCounter(page, 0, 1);
  await page.locator('#ok').click();
  expect(await table(page)).toEqual([
    ['Joueur', 'M1', 'Total'],
    ['Anne', '+20', '20'], ['Bob', '+10', '10'], ['Cleo', '+10', '10']
  ]);

  /* Manche 2, deux cartes : Anne annonce 2 et les prend, les autres passent. */
  await tapBar(page, '#next');
  await setCounter(page, 0, 2);
  await page.locator('#ok').click();
  await setCounter(page, 0, 2);
  await page.locator('#ok').click();
  expect(await table(page)).toEqual([
    ['Joueur', 'M1', 'M2', 'Total'],
    ['Anne', '+20', '+40', '60'], ['Bob', '+10', '+20', '30'], ['Cleo', '+10', '+20', '30']
  ]);

  /* Manche 3, trois cartes : Anne annonce 0 mais prend un pli. */
  await tapBar(page, '#next');
  await setCounter(page, 1, 2);
  await setCounter(page, 2, 1);
  await page.locator('#ok').click();
  await setCounter(page, 0, 1);
  await setCounter(page, 1, 2);
  await page.locator('#ok').click();
  expect(await table(page)).toEqual([
    ['Joueur', 'M1', 'M2', 'M3', 'Total'],
    ['Anne', '+20', '+40', '-30', '30'],
    ['Bob', '+10', '+20', '+40', '70'],
    ['Cleo', '+10', '+20', '-10', '20']
  ]);

  expect((await head(page)).title).toBe('Partie terminée');
  expect(errs).toEqual([]);
});
