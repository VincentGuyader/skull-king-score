import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { boot, player, game, round, blank } from './helpers.mjs';

/* Audit automatique par axe-core. Complete les verifications ecrites a la
   main : celles-ci ne couvrent que ce a quoi on a pense, axe balaie les
   regles connues, contraste, roles, noms accessibles, structure. */

const J = ['Anne', 'Bob', 'Cleo', 'Dan'].map((n, i) =>
  player('j' + i, n, { color: ['#3987e5', '#d95926', '#199e70', '#c98500'][i], icon: '☠️' }));

const PARTIE_FINIE = game({
  id: 'gA', date: Date.parse('2026-05-01'), cfg: { rounds: 2 },
  players: J.slice(0, 3),
  rounds: [round({ j0: 1, j1: 0, j2: 0 }, { j0: 1, j1: 0, j2: 0 }),
           round({ j0: 0, j1: 2, j2: 0 }, { j0: 0, j1: 2, j2: 0 })]
});
function enCours(phase) {
  return game({
    id: 'gB', cfg: { rounds: 5, custom: [{ id: 'cX', name: 'Tresor', pts: 30, max: 1, tricks: 0, cond: 'always' }] },
    players: J, rounds: Array.from({ length: 5 }, blank), cur: 2, phase
  });
}

const ECRANS = [
  ['configuration', p => p.evaluate(() => goRoot('setup'))],
  ['manche, annonces', p => p.evaluate(() => { G.cur = 2; G.phase = 'bid'; goRoot('round'); })],
  ['manche, resultats', p => p.evaluate(() => { G.cur = 2; G.phase = 'res'; goRoot('round'); })],
  ['scores', p => p.evaluate(() => goRoot('scores'))],
  ['hall of fame', p => p.evaluate(() => goRoot('hof'))],
  ['fiche joueur', p => p.evaluate(() => goRoot('player', 'j0'))],
  ['repertoire', p => p.evaluate(() => goRoot('roster'))],
  ['aide-memoire', p => p.evaluate(() => goRoot('help'))]
];

for (const [nom, aller] of ECRANS) {
  test(`axe ne releve rien de serieux sur l ecran ${nom}`, async ({ page }) => {
    await boot(page, { roster: J, archive: [PARTIE_FINIE], game: enCours('res') });
    await aller(page);
    await page.waitForTimeout(150);

    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const graves = r.violations.filter(v => ['serious', 'critical'].includes(v.impact));
    const resume = graves.map(v =>
      `${v.impact} ${v.id} (${v.nodes.length}) : ${v.help} -> ${v.nodes[0].target.join(' ')}`);
    expect(resume, `ecran ${nom}`).toEqual([]);
  });
}

test('les feuilles du bas passent aussi l audit', async ({ page }) => {
  await boot(page, { roster: J, archive: [PARTIE_FINIE], game: enCours('res') });
  await page.locator('#rows .pr').first().locator('.star').click();
  await page.waitForTimeout(200);

  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const graves = r.violations.filter(v => ['serious', 'critical'].includes(v.impact));
  expect(graves.map(v => `${v.impact} ${v.id} : ${v.help}`), 'feuille de bonus').toEqual([]);
});

test('l allemand, aux chaines les plus longues, ne degrade pas le contraste', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await boot(page, { roster: J, archive: [PARTIE_FINIE], game: enCours('res'), lang: 'de' });
  const r = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
  const contraste = r.violations.filter(v => v.id === 'color-contrast');
  expect(contraste.flatMap(v => v.nodes.map(n => n.target.join(' ') + ' ' + n.failureSummary?.slice(0, 90))),
    'contraste a 320 px en allemand').toEqual([]);
});
