import { test, expect } from '@playwright/test';
import { boot, watchErrors, head } from './helpers.mjs';

/* Issue #3 : trois formes de stockage corrompu laissaient un ecran blanc
   definitif, sans aucun moyen d'en sortir depuis l'application. */

const HOSTILES = {
  'sk_game invalide': { sk_game: '{ceci n est pas du json' },
  'sk_game sans joueurs': { sk_game: JSON.stringify({
    id: 'g', players: [], cfg: { scoring: 'classic', rounds: 1 },
    rounds: [{ bids: {}, tricks: {}, bonus: {}, locked: true }], cur: 0, phase: 'bid' }) },
  'sk_game joueurs sans identifiant': { sk_game: JSON.stringify({
    id: 'g', players: [{ name: 'X' }, { name: 'Y' }], cfg: { scoring: 'classic', rounds: 1 },
    rounds: [{ bids: {}, tricks: {}, bonus: {}, locked: false }], cur: 0, phase: 'bid' }) },
  'sk_game players pas un tableau': { sk_game: JSON.stringify({
    id: 'g', players: { a: 1 }, rounds: [], cfg: {}, cur: 0, phase: 'bid' }) },
  'sk_game rounds pas un tableau': { sk_game: JSON.stringify({
    id: 'g', players: [{ id: 'a', name: 'A' }], rounds: 'plein', cfg: {}, cur: 0, phase: 'bid' }) },
  'sk_roster pas un tableau': { sk_roster: '{"a":1}' },
  'sk_roster de valeurs nulles': { sk_roster: '[null,42,"coucou"]' },
  'sk_cfg pas un objet': { sk_cfg: '"classique"' },
  'sk_cfg.custom pas un tableau': { sk_cfg: JSON.stringify({ custom: 'oui' }) },
  'sk_lastsel pas un tableau': { sk_lastsel: '3' }
};

for (const [nom, raw] of Object.entries(HOSTILES)) {
  test(`l application demarre malgre ${nom}`, async ({ page }) => {
    const errs = watchErrors(page);
    await boot(page, { raw, installHidden: true });

    const h = await head(page);
    expect(h.title, 'un titre d ecran est affiche').not.toBe('');
    expect(h.title, 'et ce n est pas le titre de repli du document').not.toBe('Skull King');

    const app = (await page.locator('#app').textContent()).trim();
    expect(app.length, 'l ecran a du contenu').toBeGreaterThan(50);
    expect(errs, 'aucune erreur non capturee').toEqual([]);
  });
}

test('l ecran de configuration reste complet et permet de demarrer', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, {
    raw: { sk_cfg: JSON.stringify({ custom: 'oui', rounds: 7 }) },
    roster: [{ id: 'jA', name: 'Anne', color: '#3987e5', icon: '☠️' },
             { id: 'jB', name: 'Bob', color: '#d95926', icon: '💀' }],
    lastsel: ['jA', 'jB']
  });

  /* Le bloc des regles maison levait et emportait avec lui tout ce qui suit :
     le reglage du nombre de manches et le bouton de demarrage. */
  await expect(page.locator('#stRounds'), 'reglage du nombre de manches').toBeVisible();
  await expect(page.locator('#go'), 'bouton de demarrage').toBeEnabled();
  await page.locator('#go').click();
  expect((await head(page)).view, 'la partie demarre').toBe('round');
  expect(errs).toEqual([]);
});

test('le hall of fame reste accessible quand la partie en cours est illisible', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { raw: { sk_game: JSON.stringify({ id: 'g', players: [], rounds: [], cfg: {} }) } });
  await page.evaluate(() => go('hof'));
  expect((await page.locator('#app').textContent()).length).toBeGreaterThan(20);
  expect(errs).toEqual([]);
});

test('un rendu qui leve affiche un ecran de secours au lieu du vide', async ({ page }) => {
  await boot(page, { installHidden: true });

  /* Filet de derniere chance : meme si un ecran casse pour une raison
     imprevue, l'application doit proposer une sortie plutot que du blanc. */
  await page.evaluate(() => {
    G = { id: 'g', players: null, rounds: [], cfg: {}, cur: 0, phase: 'bid' };
    view = 'scores';
    render();
  });

  const app = (await page.locator('#app').textContent()).trim();
  expect(app.length, 'l ecran de secours a du contenu').toBeGreaterThan(20);
  await expect(page.locator('#app button'), 'il propose au moins une action').not.toHaveCount(0);
});
