import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, store } from './helpers.mjs';

/* Anomalie mineure m6 : doExport ecrivait bien cfg dans le fichier, mais
   l'import ne lisait que archive et roster. Apres un cycle export, effacement
   complet, reimport, les options de partie, les regles maison par defaut et
   le nombre de manches etaient a ressaisir. La langue n'etait ni exportee ni
   restauree, et sk_exported_count restait fausse. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const PARTIE = game({
  id: 'g1', date: Date.parse('2026-05-01'), cfg: { rounds: 1 },
  players: [ANNE, BOB], rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 })]
});
const CFG_MAISON = {
  scoring: 'rascal', rascal: 'cannonball', bonusIfExact: false,
  loot: false, kraken: true, whale: true, pirates: true, rounds: 7,
  custom: [{ id: 'cX', name: 'Tresor', pts: 30, max: 2, tricks: 1, cond: 'always' }]
};

/** Recupere le contenu du fichier que l application exporte. */
async function contenuExporte(page) {
  await page.evaluate(() => {
    window.__fichier = null;
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async d => { window.__fichier = await d.files[0].text(); }
    });
  });
  await page.evaluate(() => { go('hof'); backupSheet(); });
  await page.locator('#bex').click();
  await page.waitForTimeout(300);
  return JSON.parse(await page.evaluate(() => window.__fichier));
}

async function importer(page, contenu, mode) {
  await page.evaluate(() => { go('hof'); backupSheet(); });
  await page.setInputFiles('#bfile', {
    name: 's.json', mimeType: 'application/json', buffer: Buffer.from(contenu, 'utf8')
  });
  await page.waitForTimeout(300);
  await page.locator(mode === 'remplacement' ? '#imReplace' : '#imMerge').click();
  await page.waitForTimeout(300);
}

test('le fichier exporte emporte la configuration et la langue', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE], cfg: CFG_MAISON, lang: 'de' });
  const d = await contenuExporte(page);
  expect(d.archive.length, 'les parties').toBe(1);
  expect(d.roster.length, 'les fiches').toBe(2);
  expect(d.cfg, 'la configuration de partie').toMatchObject({ scoring: 'rascal', rounds: 7 });
  expect(d.cfg.custom.map(c => c.id), 'les regles maison').toEqual(['cX']);
  expect(d.lang, 'la langue choisie').toBe('de');
});

test('un aller retour complet rend tout a l identique', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE], cfg: CFG_MAISON, lang: 'de' });
  const fichier = JSON.stringify(await contenuExporte(page));

  /* Vider les seules cles de l application : un localStorage.clear() emporte
     aussi le temoin de seed du harnais, et le rechargement resemerait l etat
     de depart, ce qui ferait passer le test sans que l import y soit pour
     quoi que ce soit. */
  await page.evaluate(() => Object.keys(localStorage)
    .filter(k => k.startsWith('sk_')).forEach(k => localStorage.removeItem(k)));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await importer(page, fichier, 'remplacement');

  expect(await store(page, 'sk_cfg'), 'configuration restauree').toMatchObject({
    scoring: 'rascal', rascal: 'cannonball', bonusIfExact: false, loot: false, rounds: 7
  });
  expect((await store(page, 'sk_cfg')).custom.map(c => c.id), 'regles maison restaurees').toEqual(['cX']);
  expect(await store(page, 'sk_lang'), 'langue restauree').toBe('de');
  expect((await store(page, 'sk_archive')).length, 'historique restaure').toBe(1);
  expect(errs).toEqual([]);
});

test('la configuration restauree se retrouve sur l ecran de partie', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE], cfg: CFG_MAISON, lang: 'fr' });
  const fichier = JSON.stringify(await contenuExporte(page));
  /* Vider les seules cles de l application : un localStorage.clear() emporte
     aussi le temoin de seed du harnais, et le rechargement resemerait l etat
     de depart, ce qui ferait passer le test sans que l import y soit pour
     quoi que ce soit. */
  await page.evaluate(() => Object.keys(localStorage)
    .filter(k => k.startsWith('sk_')).forEach(k => localStorage.removeItem(k)));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await importer(page, fichier, 'remplacement');

  await page.evaluate(() => { draft = null; goRoot('setup'); });
  expect(await page.evaluate(() => draft.cfg.rounds), 'nombre de manches').toBe(7);
  expect(await page.evaluate(() => draft.cfg.custom.length), 'regle maison proposee').toBe(1);
});

test('une fusion ne pietine pas les preferences deja en place', async ({ page }) => {
  await boot(page, {
    roster: [ANNE, BOB], archive: [PARTIE],
    cfg: { scoring: 'classic', rounds: 12, custom: [] }, lang: 'fr'
  });
  const autre = JSON.stringify({
    v: 1, roster: [], archive: [], cfg: CFG_MAISON, lang: 'es'
  });
  await importer(page, autre, 'fusion');

  expect((await store(page, 'sk_cfg')).rounds, 'la configuration locale reste').toBe(12);
  expect(await store(page, 'sk_lang'), 'la langue locale reste').toBe('fr');
});

test('apres restauration, l alerte de sauvegarde repart de zero', async ({ page }) => {
  const beaucoup = Array.from({ length: 14 }, (_, i) => game({
    id: 'g' + i, date: Date.parse('2026-01-01') + i * 864e5, cfg: { rounds: 1 },
    players: [ANNE, BOB], rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 })]
  }));
  await boot(page, { roster: [ANNE, BOB], archive: [PARTIE] });
  await importer(page, JSON.stringify({ v: 1, roster: [ANNE, BOB], archive: beaucoup }), 'remplacement');

  expect(await store(page, 'sk_exported_count'), 'le fichier importe fait office de sauvegarde').toBe(14);
  await page.evaluate(() => goRoot('hof'));
  await expect(page.locator('#bkNow'), 'aucune alerte juste apres une restauration').toHaveCount(0);
});
