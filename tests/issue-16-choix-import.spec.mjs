import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, store } from './helpers.mjs';

/* Issue #16 : le choix entre fusion et remplacement passait par un confirm()
   unique ou Annuler valait remplacer. La touche d'echappement, le bouton de
   fermeture et le geste de retour valent tous Annuler : le geste d'abandon
   declenchait l'action irreversible. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const CLEO = player('jC', 'Cleo', { color: '#199e70', icon: '⚓' });

const LOCALE = game({
  id: 'gLocal', date: Date.parse('2026-05-01'), cfg: { rounds: 1 },
  players: [ANNE, BOB], rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 })]
});
const DU_FICHIER = game({
  id: 'gFichier', date: Date.parse('2026-05-02'), cfg: { rounds: 1 },
  players: [ANNE, CLEO], rounds: [round({ jA: 0, jC: 1 }, { jA: 0, jC: 1 })]
});
const SAUVEGARDE = JSON.stringify({ v: 1, roster: [ANNE, CLEO], archive: [DU_FICHIER] });

async function deposer(page) {
  await page.evaluate(() => { go('hof'); backupSheet(); });
  await page.setInputFiles('#bfile', {
    name: 'sauvegarde.json', mimeType: 'application/json',
    buffer: Buffer.from(SAUVEGARDE, 'utf8')
  });
  await page.waitForTimeout(300);
}

test('le choix se fait par deux boutons nommes, pas par une boite du navigateur', async ({ page }) => {
  const errs = watchErrors(page);
  let boites = 0;
  page.on('dialog', d => { boites++; d.dismiss(); });

  await boot(page, { roster: [ANNE, BOB], archive: [LOCALE] });
  await deposer(page);

  expect(boites, 'aucune boite du navigateur').toBe(0);
  await expect(page.locator('#imMerge')).toBeVisible();
  await expect(page.locator('#imReplace')).toBeVisible();
  await expect(page.locator('#imCancel')).toBeVisible();
  expect(errs).toEqual([]);
});

test('annuler ne touche a rien', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [LOCALE] });
  const avantA = await store(page, 'sk_archive');
  const avantR = await store(page, 'sk_roster');

  await deposer(page);
  await page.locator('#imCancel').click();
  await page.waitForTimeout(200);

  expect(await store(page, 'sk_archive'), 'archive intacte').toEqual(avantA);
  expect(await store(page, 'sk_roster'), 'repertoire intact').toEqual(avantR);
});

test('fermer la feuille par le voile ne touche a rien non plus', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [LOCALE] });
  const avantA = await store(page, 'sk_archive');

  await deposer(page);
  await page.locator('#scrim').click({ position: { x: 5, y: 5 } });
  await page.waitForTimeout(200);

  expect(await store(page, 'sk_archive'), 'archive intacte').toEqual(avantA);
});

test('le bouton de fusion ajoute a l historique existant', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [LOCALE] });
  await deposer(page);
  await page.locator('#imMerge').click();
  await page.waitForTimeout(300);

  expect((await store(page, 'sk_archive')).map(g => g.id)).toEqual(['gLocal', 'gFichier']);
  expect((await store(page, 'sk_roster')).map(p => p.id)).toEqual(['jA', 'jB', 'jC']);
});

test('le bouton de remplacement est explicite et signale comme destructeur', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [LOCALE] });
  await deposer(page);
  await expect(page.locator('#imReplace'), 'presente comme destructeur').toHaveClass(/danger/);

  await page.locator('#imReplace').click();
  await page.waitForTimeout(300);
  expect((await store(page, 'sk_archive')).map(g => g.id)).toEqual(['gFichier']);
  expect((await store(page, 'sk_roster')).map(p => p.id)).toEqual(['jA', 'jC']);
});

test('un fichier refuse n ouvre meme pas le choix', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [LOCALE] });
  await page.evaluate(() => { go('hof'); backupSheet(); });
  await page.setInputFiles('#bfile', {
    name: 'nope.json', mimeType: 'application/json',
    buffer: Buffer.from('{"pas":"une sauvegarde"}', 'utf8')
  });
  await page.waitForTimeout(300);
  await expect(page.locator('#imMerge')).toHaveCount(0);
  await expect(page.locator('#toast')).toHaveClass(/on/);
});
