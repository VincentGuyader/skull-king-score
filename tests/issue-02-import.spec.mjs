import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, store } from './helpers.mjs';

/* Issue #2 : un fichier dont le tableau archive contenait une partie sans
   players franchissait le controle d'entree. L'ecriture avait lieu avant le
   rendu, le rendu levait, et le catch affichait "Fichier illisible" alors que
   l'historique venait d'etre remplace. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const PARTIE = game({
  id: 'g1', date: Date.parse('2026-05-01'), cfg: { rounds: 1 },
  players: [ANNE, BOB],
  rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 })]
});

const HOSTILES = {
  'pas-une-sauvegarde.json': { name: 'package', version: '1.0.0', dependencies: {} },
  'archive-sans-players.json': { v: 1, roster: [], archive: [{ id: 'gz', date: 1, cfg: {}, rounds: [] }] },
  'archive-null.json': { v: 1, roster: [], archive: [null] },
  'archive-non-objets.json': { v: 1, roster: [], archive: [42, 'coucou'] },
  'archive-joueurs-sans-id.json': { v: 1, roster: [], archive: [{ id: 'gz', date: 1, cfg: {}, players: [{ name: 'X' }], rounds: [] }] },
  'archive-pas-un-tableau.json': { v: 1, roster: [], archive: { a: 1 } },
  'roster-pas-un-tableau.json': { v: 1, roster: { a: 1 }, archive: [] }
};
const TRONQUE = '{"v":1,"roster":[{"id":"jA","name":"An';

/* La boite de choix fusion ou remplacement est un confirm() : OK fusionne,
   Annuler remplace. Un seul ecouteur par page, pilote par cette reference. */
function repondreAuxBoites(page, modeRef) {
  page.on('dialog', d => (modeRef.mode === 'fusion' ? d.accept() : d.dismiss()));
}

/** Ouvre la feuille de sauvegarde et depose un fichier. */
async function importer(page, nom, contenu) {
  await page.evaluate(() => { go('hof'); backupSheet(); });
  await page.setInputFiles('#bfile', {
    name: nom, mimeType: 'application/json', buffer: Buffer.from(contenu, 'utf8')
  });
  await page.waitForTimeout(400);
}

for (const mode of ['fusion', 'remplacement']) {
  test(`un fichier hostile ne touche pas a l historique, mode ${mode}`, async ({ page }) => {
    repondreAuxBoites(page, { mode });
    for (const [nom, objet] of Object.entries(HOSTILES)) {
      await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
      const roster0 = await store(page, 'sk_roster');
      const archive0 = await store(page, 'sk_archive');

      await importer(page, nom, JSON.stringify(objet));

      expect(await store(page, 'sk_roster'), `${nom} : repertoire`).toEqual(roster0);
      expect(await store(page, 'sk_archive'), `${nom} : archive`).toEqual(archive0);
    }
  });
}

test('un fichier tronque ne touche pas a l historique', async ({ page }) => {
  repondreAuxBoites(page, { mode: 'remplacement' });
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
  const archive0 = await store(page, 'sk_archive');
  await importer(page, 'tronque.json', TRONQUE);
  expect(await store(page, 'sk_archive')).toEqual(archive0);
  expect(await store(page, 'sk_roster')).toEqual([ANNE, BOB]);
});

test('le refus laisse l application utilisable et previent l utilisateur', async ({ page }) => {
  const errs = watchErrors(page);
  repondreAuxBoites(page, { mode: 'remplacement' });
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
  await importer(page, 'archive-sans-players.json',
    JSON.stringify(HOSTILES['archive-sans-players.json']));

  await expect(page.locator('#toast'), 'un message est affiche').toHaveClass(/on/);
  await page.evaluate(() => goRoot('hof'));
  const texte = await page.locator('#app').textContent();
  expect(texte, 'le hall of fame reste affichable').toContain('Anne');
  expect(errs, 'aucune erreur non capturee').toEqual([]);
});

test('une sauvegarde valide se restaure encore, dans les deux modes', async ({ page }) => {
  const CLEO = player('jC', 'Cleo', { color: '#199e70', icon: '⚓' });
  const AUTRE = game({
    id: 'g2', date: Date.parse('2026-05-02'), cfg: { rounds: 1 },
    players: [ANNE, CLEO],
    rounds: [round({ jA: 0, jC: 1 }, { jA: 0, jC: 1 })]
  });
  const sauvegarde = JSON.stringify({ v: 1, roster: [ANNE, CLEO], archive: [AUTRE] });
  const modeRef = { mode: 'fusion' };
  repondreAuxBoites(page, modeRef);

  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
  await importer(page, 'sauvegarde.json', sauvegarde);
  expect((await store(page, 'sk_archive')).map(g => g.id), 'fusion').toEqual(['g1', 'g2']);
  expect((await store(page, 'sk_roster')).map(p => p.id), 'fusion, repertoire')
    .toEqual(['jA', 'jB', 'jC']);

  modeRef.mode = 'remplacement';
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
  await importer(page, 'sauvegarde.json', sauvegarde);
  expect((await store(page, 'sk_archive')).map(g => g.id), 'remplacement').toEqual(['g2']);
  expect((await store(page, 'sk_roster')).map(p => p.id), 'remplacement, repertoire')
    .toEqual(['jA', 'jC']);
});
