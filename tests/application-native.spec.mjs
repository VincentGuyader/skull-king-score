import { test, expect } from '@playwright/test';
import { boot, watchErrors, roster, game, round, blank } from './helpers.mjs';

/* Comportements propres a l'application Capacitor : retour Android, retour
   tactile, ecran allume, confirmation traduite, restauration. Les plugins
   sont simules avant le chargement, comme le fait le pont natif. */

const [ANNE, BOB] = roster('Anne', 'Bob');
const FINIE = game({
  id: 'gN', cfg: { rounds: 1 }, players: [ANNE, BOB],
  rounds: [round({ j0: 1, j1: 0 }, { j0: 1, j1: 0 })], cur: 0, phase: 'res'
});
const EN_COURS = game({
  id: 'gC', cfg: { rounds: 2 }, players: [ANNE, BOB],
  rounds: [round({ j0: 1, j1: 0 }, { j0: 1, j1: 0 }), blank()], cur: 1, phase: 'bid'
});

async function natif(page) {
  await page.addInitScript(() => {
    const n = window.__natif = { retour: null, reduit: 0, impacts: [], eveil: [] };
    window.Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        Share: { share: () => Promise.resolve({}) },
        App: {
          addListener: (nom, f) => { if (nom === 'backButton') n.retour = f; return Promise.resolve({ remove() {} }); },
          minimizeApp: () => { n.reduit++; return Promise.resolve(); }
        },
        Haptics: { impact: o => { n.impacts.push(o.style); return Promise.resolve(); } },
        KeepAwake: {
          keepAwake: () => { n.eveil.push('on'); return Promise.resolve(); },
          allowSleep: () => { n.eveil.push('off'); return Promise.resolve(); }
        }
      }
    };
  });
}
const vue = page => page.evaluate(() => view);
const retour = page => page.evaluate(() => window.__natif.retour());

test('le retour Android ferme la feuille, puis recule, puis reduit l application', async ({ page }) => {
  const errs = watchErrors(page);
  await natif(page);
  await boot(page, { roster: [ANNE, BOB], archive: [FINIE] });
  await page.evaluate(() => go('hof'));
  await page.evaluate(() => go('game', 'gN'));
  await page.evaluate(() => backupSheet());
  await expect(page.locator('#sheet')).toHaveClass(/open/);

  await retour(page);
  await expect(page.locator('#sheet'), 'la feuille se ferme d abord').not.toHaveClass(/open/);
  expect(await vue(page)).toBe('game');

  await retour(page);
  await expect.poll(() => vue(page), { message: 'puis on recule d un ecran' }).toBe('hof');
  await retour(page);
  await expect.poll(() => vue(page)).toBe('setup');
  expect(await page.evaluate(() => window.__natif.reduit), 'pas encore reduite').toBe(0);

  await retour(page);
  expect(await page.evaluate(() => window.__natif.reduit), 'a la racine, l application passe en arriere-plan').toBe(1);
  expect(errs).toEqual([]);
});

test('le retour tactile passe par le plugin Haptics', async ({ page }) => {
  await natif(page);
  await boot(page, { roster: [ANNE, BOB] });
  await page.evaluate(() => { buzz(); buzz(20); });
  expect(await page.evaluate(() => window.__natif.impacts)).toEqual(['LIGHT', 'MEDIUM']);
});

test('l ecran reste allume pendant une manche, puis peut s eteindre', async ({ page }) => {
  await natif(page);
  await boot(page, { roster: [ANNE, BOB], game: EN_COURS });
  await expect.poll(() => vue(page)).toBe('round');
  await expect.poll(() => page.evaluate(() => window.__natif.eveil)).toEqual(['on']);
  await page.evaluate(() => go('scores'));
  await expect.poll(() => page.evaluate(() => window.__natif.eveil)).toEqual(['on', 'off']);
});

test('dans l application, la restauration accepte tout type de fichier', async ({ page }) => {
  await natif(page);
  await boot(page, {});
  await page.evaluate(() => { go('hof'); backupSheet(); });
  expect(await page.locator('#bfile').getAttribute('accept')).toBeNull();
});

test('sur le web, la restauration filtre toujours les fichiers JSON', async ({ page }) => {
  await boot(page, {});
  await page.evaluate(() => { go('hof'); backupSheet(); });
  expect(await page.locator('#bfile').getAttribute('accept')).toBe('application/json,.json');
});

/* confirm() du WebView natif : boutons OK / Cancel en anglais, quelle que
   soit la langue. La confirmation passe par une feuille traduite. */
test('supprimer une partie demande confirmation dans une feuille traduite', async ({ page }) => {
  let boites = 0;
  page.on('dialog', d => { boites++; d.dismiss(); });
  await boot(page, { roster: [ANNE, BOB], archive: [FINIE] });
  await page.evaluate(() => { go('hof'); go('game', 'gN'); });
  await page.locator('#gd').click();
  await expect(page.locator('#askOk')).toHaveText('Confirmer');
  await expect(page.locator('#askNo')).toHaveText('Annuler');

  await page.locator('#askNo').click();
  expect(await page.evaluate(() => archive().length), 'Annuler ne supprime rien').toBe(1);

  await page.locator('#gd').click();
  await page.locator('#askOk').click();
  await expect.poll(() => page.evaluate(() => archive().length)).toBe(0);
  expect(boites, 'aucune boite de dialogue du navigateur').toBe(0);
});

test('le voile vaut Annuler', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: EN_COURS });
  await page.evaluate(() => ask('Vraiment ?', () => { window.__fait = true; }));
  await page.locator('#scrim').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('#sheet')).not.toHaveClass(/open/);
  expect(await page.evaluate(() => !!window.__fait)).toBe(false);
});
