import { test, expect } from '@playwright/test';
import { boot, watchErrors, roster, game, round, store } from './helpers.mjs';

/* Le texte partage en fin de partie, et le chemin natif de l'application
   Capacitor : son WebView n'a ni navigator.share ni telechargement par lien,
   le partage et l'export passaient donc par une copie ou un lien sans effet. */

const [ANNE, BOB, CLEO] = roster('Anne', 'Bob', 'Cleo');
const JOUE = Date.parse('2026-03-14T20:00:00');

/* Trois manches de 1, 2 et 3 cartes, bareme classique :
   Anne 20 + 40 + 60 = 120, Cleo -10 + 20 + 30 = 40, Bob 20 - 10 + 20 = 30. */
const FINIE = game({
  id: 'gP', date: JOUE, cfg: { rounds: 3 }, players: [ANNE, BOB, CLEO],
  rounds: [
    round({ j0: 1, j1: 1, j2: 1 }, { j0: 1, j1: 1, j2: 0 }),
    round({ j0: 2, j1: 1, j2: 0 }, { j0: 2, j1: 0, j2: 0 }),
    round({ j0: 3, j1: 1, j2: 0 }, { j0: 3, j1: 1, j2: 0 })
  ],
  cur: 2, phase: 'res'
});

test('le texte partage resume la partie', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB, CLEO], game: FINIE });
  const txt = await page.evaluate(() => shareText());
  const lignes = txt.split('\n');
  expect(lignes[0], 'date de la partie, pas du partage').toContain(new Date(JOUE).toLocaleDateString('fr-FR'));
  expect(lignes[1]).toContain('3 manches');
  expect(lignes[1]).toContain('Classique');
  expect(txt).toMatch(/^🥇 Anne : 120 pts$/m);
  expect(txt).toMatch(/^🥈 /m);
  expect(txt).toMatch(/^🥉 /m);
  expect(txt).toContain('Anne l’emporte avec 120 points');
  expect(txt, 'meilleure manche : Anne, +60 en M3').toContain('Meilleure manche : Anne, +60 en M3');
  expect(txt).toContain('Annonces justes : Anne 3/3 · Bob 2/3 · Cleo 2/3');
  expect(lignes[lignes.length - 1]).toBe('https://vincentguyader.github.io/skull-king-score/');
});

test('le texte partage suit la langue choisie', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB, CLEO], game: FINIE, lang: 'de' });
  const txt = await page.evaluate(() => shareText());
  expect(txt).toContain('3 Durchgänge');
  expect(txt).toMatch(/^🥇 Anne : 120 Pkt\.$/m);
  expect(txt).not.toContain(' pts');
});

/* Installe des plugins Capacitor factices avant le chargement, comme le fait
   le pont natif de l'application. */
async function simulerNatif(page, { accepte = true } = {}) {
  await page.addInitScript(ok => {
    window.__natif = { partages: [], fichiers: [] };
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        Share: { share: o => { window.__natif.partages.push(o); return ok ? Promise.resolve({}) : Promise.reject(new Error('abandon')); } },
        Filesystem: { writeFile: o => { window.__natif.fichiers.push(o); return Promise.resolve({ uri: 'file:///cache/' + o.path }); } }
      }
    };
  }, accepte);
}

test('dans l application, Partager ouvre la feuille de partage native', async ({ page }) => {
  const errs = watchErrors(page);
  await simulerNatif(page);
  await boot(page, { roster: [ANNE, BOB, CLEO], game: FINIE });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: () => { window.__web = true; return Promise.resolve(); } });
  });
  await page.locator('#share').click();
  await page.waitForTimeout(150);
  const n = await page.evaluate(() => ({ natif: window.__natif.partages, web: !!window.__web }));
  expect(n.natif).toHaveLength(1);
  expect(n.natif[0].text).toContain('🥇 Anne : 120 pts');
  expect(n.web, 'le partage web n est pas appele').toBe(false);
  expect(errs).toEqual([]);
});

test('dans l application, l export passe par un fichier puis la feuille de partage', async ({ page }) => {
  await simulerNatif(page);
  await boot(page, { roster: [ANNE, BOB, CLEO], archive: [FINIE], exportedCount: 0 });
  await page.evaluate(() => doExport());
  await page.waitForTimeout(200);
  const n = await page.evaluate(() => window.__natif);
  expect(n.fichiers).toHaveLength(1);
  expect(n.fichiers[0].directory).toBe('CACHE');
  expect(n.fichiers[0].path).toMatch(/^skull-king-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
  expect(JSON.parse(n.fichiers[0].data).archive).toHaveLength(1);
  expect(n.partages[0].files).toEqual(['file:///cache/' + n.fichiers[0].path]);
  expect(await store(page, 'sk_exported_count'), 'la sauvegarde est notee').toBe(1);
});

test('dans l application, un export abandonne n est pas note', async ({ page }) => {
  await simulerNatif(page, { accepte: false });
  await boot(page, { roster: [ANNE, BOB, CLEO], archive: [FINIE], exportedCount: 0 });
  await page.evaluate(() => doExport());
  await page.waitForTimeout(200);
  expect(await store(page, 'sk_exported_count')).toBe(0);
});
