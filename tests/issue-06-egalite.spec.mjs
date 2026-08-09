import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, lead, head } from './helpers.mjs';

/* Issue #6 : a egalite parfaite, le tri stable tranchait selon l'ordre du
   tableau players. Un vainqueur arbitraire etait proclame, l'autre perdait
   sa victoire dans le hall of fame et le face a face. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const CLEO = player('jC', 'Cleo', { color: '#199e70', icon: '⚓' });

/* Anne et Bob annoncent 1 et le realisent : 20 partout. */
const EGALITE = game({
  id: 'gT', date: Date.parse('2026-07-01'), cfg: { rounds: 1 },
  players: [ANNE, BOB],
  rounds: [round({ jA: 1, jB: 1 }, { jA: 1, jB: 1 })],
  cur: 0, phase: 'res'
});

/* Anne et Bob a 20, Cleo a -10 : deux premiers ex aequo, un troisieme. */
const EGALITE_TETE = game({
  id: 'gT3', date: Date.parse('2026-07-02'), cfg: { rounds: 1 },
  players: [ANNE, BOB, CLEO],
  rounds: [round({ jA: 1, jB: 1, jC: 1 }, { jA: 1, jB: 1, jC: 0 })],
  cur: 0, phase: 'res'
});

test('deux joueurs a egalite partagent le rang 1', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: EGALITE });
  const l = await lead(page);
  expect(l.map(x => x.total), 'memes totaux').toEqual(['20', '20']);
  expect(l.map(x => x.rank), 'meme rang').toEqual(['1', '1']);
  expect(errs).toEqual([]);
});

test('le rang suivant une egalite tient compte des ex aequo', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB, CLEO], game: EGALITE_TETE });
  const l = await lead(page);
  expect(l.map(x => x.total)).toEqual(['20', '20', '-10']);
  expect(l.map(x => x.rank), 'deux premiers, puis troisieme').toEqual(['1', '1', '3']);
});

test('la fin de partie annonce une egalite au lieu d un vainqueur', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: EGALITE });
  const h = await head(page);
  expect(h.title).toBe('Partie terminée');
  expect(h.hint, 'les deux noms sont cites').toContain('Anne');
  expect(h.hint, 'les deux noms sont cites').toContain('Bob');
  expect(h.hint, 'et le mot egalite apparait').toMatch(/galit/);
});

test('le texte de partage marque les rangs partages', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: EGALITE });
  const txt = await page.evaluate(() => shareText());
  const rangs = txt.split('\n').filter(l => /\d\./.test(l)).map(l => l.trim().slice(0, 2));
  expect(rangs, 'aucun des deux n est classe deuxieme').toEqual(['1.', '1.']);
});

test('une partie sans egalite garde son vainqueur et ses rangs', async ({ page }) => {
  const NET = game({
    id: 'gN', cfg: { rounds: 1 }, players: [ANNE, BOB],
    rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 1 })],
    cur: 0, phase: 'res'
  });
  await boot(page, { roster: [ANNE, BOB], game: NET });
  const l = await lead(page);
  expect(l.map(x => x.rank)).toEqual(['1', '2']);
  const h = await head(page);
  expect(h.hint).toContain('Anne');
  expect(h.hint).not.toContain('Bob');
});

test('le hall of fame attribue une victoire a chaque ex aequo', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB, CLEO], archive: [EGALITE, EGALITE_TETE] });
  const S = await page.evaluate(() => computeStats(archive()).S);
  expect(S.jA.wins, 'Anne, deux egalites en tete').toBe(2);
  expect(S.jB.wins, 'Bob, les memes deux').toBe(2);
  expect(S.jC.wins, 'Cleo, aucune').toBe(0);
  expect(S.jA.margin, 'aucun ecart infligé sur une egalite').toBe(0);
});

test('le face a face ne donne pas l avantage sur une egalite', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [EGALITE] });
  const H = await page.evaluate(() => computeStats(archive()).H);
  expect(H['jA|jB'], 'Anne face a Bob').toEqual({ w: 0, n: 1 });
  expect(H['jB|jA'], 'Bob face a Anne').toEqual({ w: 0, n: 1 });
});
