import { test, expect } from '@playwright/test';
import { boot, player, game, round } from './helpers.mjs';

/* Anomalies mineures m7 et cosmetique c2 du rapport de recette.

   m7 : filterGames ne rejetait que les parties trop vieilles. Une date dans
   le futur donne une anciennete negative, qui passait tous les filtres de
   periode.

   c2 : le podium etait accorde aux trois premiers sans regarder combien ils
   etaient. A deux et trois joueurs, tout le monde montait sur le podium et la
   tuile affichait le meme chiffre que le nombre de parties. */

const NOMS = ['Anne', 'Bob', 'Cleo', 'Dan', 'Eve'];
const COUL = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const J = NOMS.map((n, i) => player('j' + i, n, { color: COUL[i], icon: '☠️' }));

/* Une manche a un pli : le premier joueur cite gagne, les autres suivent. */
function partie(id, date, ordre) {
  const bids = {}, tricks = {};
  ordre.forEach((p, i) => { bids[p.id] = i === 0 ? 1 : 0; tricks[p.id] = i === 0 ? 1 : 0; });
  return game({ id, date, cfg: { rounds: 1 }, players: ordre, rounds: [round(bids, tricks)] });
}
const JOUR = 864e5;

test('une partie datee dans le futur sort des filtres de periode', async ({ page }) => {
  const parties = [
    partie('recente', Date.now() - 5 * JOUR, [J[0], J[1]]),
    partie('vieille', Date.now() - 200 * JOUR, [J[0], J[1]]),
    partie('future', Date.parse('2099-12-31'), [J[0], J[1]])
  ];
  await boot(page, { roster: J.slice(0, 2), archive: parties });

  const dansPerimetre = mois => page.evaluate(
    m => filterGames(archive(), { months: m, now: Date.now() }).map(g => g.id), mois);

  expect(await dansPerimetre(3), 'trois derniers mois').toEqual(['recente']);
  /* 200 jours, soit environ 6,6 mois : dedans a douze mois, dehors a trois. */
  expect(await dansPerimetre(12), 'douze derniers mois').toEqual(['recente', 'vieille']);
  expect(await dansPerimetre('all'), 'sans filtre, tout est la')
    .toEqual(['recente', 'vieille', 'future']);
});

test('une partie du jour reste dans le perimetre', async ({ page }) => {
  await boot(page, {
    roster: J.slice(0, 2),
    archive: [partie('aujourdhui', Date.now(), [J[0], J[1]])]
  });
  const dedans = await page.evaluate(() =>
    filterGames(archive(), { months: 3, now: Date.now() }).map(g => g.id));
  expect(dedans, 'une saisie du soir ne doit pas passer a la trappe').toEqual(['aujourdhui']);
});

test('la saisie d une partie ancienne n accepte pas une date future', async ({ page }) => {
  await boot(page, { roster: J.slice(0, 2) });
  await page.evaluate(() => { go('hof'); manualGameSheet(); });
  const max = await page.locator('#md').getAttribute('max');
  expect(max, 'la date est bornee a aujourd hui').toBe(new Date().toISOString().slice(0, 10));
});

test('le podium ne compte pas quand tout le monde y est', async ({ page }) => {
  await boot(page, {
    roster: J,
    archive: [
      partie('a2', Date.now() - JOUR, [J[0], J[1]]),
      partie('a3', Date.now() - 2 * JOUR, [J[0], J[1], J[2]])
    ]
  });
  const S = await page.evaluate(() => computeStats(archive()).S);
  expect(S.j0.games, 'deux parties jouees').toBe(2);
  expect(S.j0.wins, 'deux victoires').toBe(2);
  expect(S.j0.podiums, 'aucun podium a deux ni a trois joueurs').toBe(0);
  expect(S.j2.podiums, 'le dernier d une partie a trois non plus').toBe(0);
});

test('a partir de quatre joueurs, le podium reprend son sens', async ({ page }) => {
  await boot(page, {
    roster: J,
    archive: [partie('a4', Date.now() - JOUR, [J[0], J[1], J[2], J[3]])]
  });
  const S = await page.evaluate(() => computeStats(archive()).S);
  expect(S.j0.podiums, 'premier').toBe(1);
  /* Les trois derniers sont a egalite a 10 points : ils partagent le rang 2,
     donc ils sont tous sur le podium. */
  expect(S.j1.podiums, 'deuxieme ex aequo').toBe(1);
  expect(S.j3.podiums, 'et le dernier ex aequo aussi').toBe(1);
});

test('un quatrieme strictement derriere reste hors du podium', async ({ page }) => {
  const g = game({
    id: 'a4b', date: Date.now() - JOUR, cfg: { rounds: 1 },
    players: [J[0], J[1], J[2], J[3]],
    /* 20, 10, 10 puis -10 : le dernier est seul derriere. */
    rounds: [round({ j0: 1, j1: 0, j2: 0, j3: 1 }, { j0: 1, j1: 0, j2: 0, j3: 0 })]
  });
  await boot(page, { roster: J, archive: [g] });
  const S = await page.evaluate(() => computeStats(archive()).S);
  expect([S.j0.podiums, S.j1.podiums, S.j2.podiums], 'les trois premiers').toEqual([1, 1, 1]);
  expect(S.j3.podiums, 'le quatrieme, seul derriere').toBe(0);
});
