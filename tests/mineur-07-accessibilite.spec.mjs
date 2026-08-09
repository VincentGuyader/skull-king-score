import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, blank } from './helpers.mjs';

/* Anomalie mineure m10 et cosmetique c3 du rapport de recette.

   m10 : les boutons moins et plus des compteurs n'avaient ni aria-label ni
   title, le chevron de retour non plus, et plusieurs cibles tactiles
   mesuraient 40 a 42 px de cote.

   c3 : deux fiches pouvaient porter le meme prenom sans le moindre
   avertissement, alors que rien ne les distingue ensuite dans la selection. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });

function enResultats() {
  const g = game({
    id: 'gA', cfg: { rounds: 3 }, players: [ANNE, BOB],
    rounds: [blank(), blank(), blank()], cur: 0, phase: 'res'
  });
  g.rounds[0].bids = { jA: 1, jB: 0 };
  g.rounds[0].bid0 = { jA: 1, jB: 0 };
  return g;
}
/** Intitule accessible d'un element. */
const intitule = async el => (await el.getAttribute('aria-label')) || (await el.getAttribute('title'))
  || (await el.textContent() || '').trim();

test('les compteurs annoncent leur action et le joueur concerne', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: enResultats() });

  const ligne = page.locator('#rows .pr').first();
  expect(await intitule(ligne.locator('.step .minus')), 'moins').toContain('Anne');
  expect(await intitule(ligne.locator('.step .plus')), 'plus').toContain('Anne');
  expect(await intitule(ligne.locator('.star')), 'etoile de bonus').toBeTruthy();
  expect(errs).toEqual([]);
});

test('aucun bouton icone ne reste sans intitule', async ({ page }) => {
  const PARTIE = game({
    id: 'g1', date: Date.parse('2026-05-01'), cfg: { rounds: 1 },
    players: [ANNE, BOB], rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 })]
  });
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE], game: enResultats() });

  for (const ecran of ['round', 'scores', 'roster', 'hof', 'help']) {
    await page.evaluate(v => { view = v; render(); }, ecran);
    const muets = await page.evaluate(() => [...document.querySelectorAll('button')]
      .filter(b => b.offsetParent !== null)
      .filter(b => {
        const t = (b.textContent || '').trim();
        return t.length <= 2 && !b.getAttribute('aria-label') && !b.getAttribute('title');
      })
      .map(b => (b.textContent || '').trim() + ' [' + b.className + ']'));
    expect(muets, `ecran ${ecran}`).toEqual([]);
  }
});

test('les cibles tactiles font au moins 44 px sur un ecran courant', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await boot(page, { roster: [ANNE, BOB], game: enResultats() });

  const petites = await page.evaluate(() => [...document.querySelectorAll('button, .sw')]
    .filter(b => b.offsetParent !== null)
    .map(b => ({ r: b.getBoundingClientRect(), c: b.className, t: (b.textContent || '').trim().slice(0, 14) }))
    .filter(x => x.r.width < 44 || x.r.height < 44)
    .map(x => `${x.t} [${x.c}] ${Math.round(x.r.width)}x${Math.round(x.r.height)}`));
  expect(petites, 'aucune cible sous 44 px').toEqual([]);
});

test('le chevron de retour porte un intitule', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB] });
  await page.evaluate(() => go('hof'));
  const t = await intitule(page.locator('#hBack'));
  expect(t.length, 'un intitule lisible, pas seulement un chevron').toBeGreaterThan(3);
});

test('creer une fiche au nom deja pris declenche un avertissement', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB] });
  await page.evaluate(() => { goRoot('roster'); newPlayerSheet(); });

  await page.locator('#pn').fill('Anne');
  await page.waitForTimeout(120);
  await expect(page.locator('#pdup'), 'le doublon est signale').not.toBeEmpty();

  await page.locator('#pn').fill('Anne B');
  await page.waitForTimeout(120);
  await expect(page.locator('#pdup'), 'un nom distinct ne l est pas').toBeEmpty();
});

test('l avertissement n empeche pas de garder deux homonymes', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB] });
  await page.evaluate(() => { goRoot('roster'); newPlayerSheet(); });
  await page.locator('#pn').fill('Anne');
  await page.locator('#pok').click();
  await page.waitForTimeout(200);
  const noms = await page.evaluate(() => roster().map(p => p.name));
  expect(noms, 'la fiche est bien creee').toEqual(['Anne', 'Bob', 'Anne']);
});

test('renommer une fiche ne la signale pas comme son propre doublon', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB] });
  await page.evaluate(() => { goRoot('roster'); playerEditSheet('jA'); });
  await page.waitForTimeout(120);
  await expect(page.locator('#pdup'), 'Anne n est pas en double avec elle-meme').toBeEmpty();
});
