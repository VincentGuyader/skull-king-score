import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, store } from './helpers.mjs';

/* Issue #15 : quand navigator.canShare accepte les fichiers, ce qui est le
   cas sur Android et iOS, doExport appelait navigator.share puis sortait.
   Les trois lignes suivantes, qui portent tout l'etat de la sauvegarde,
   n'etaient jamais executees : la banniere de rappel revenait indefiniment
   et aucune confirmation ne s'affichait. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });

function parties(n) {
  return Array.from({ length: n }, (_, i) => game({
    id: 'g' + i, date: Date.parse('2026-01-01') + i * 864e5, cfg: { rounds: 1 },
    players: [ANNE, BOB], rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 })]
  }));
}

/** Installe un partage de fichiers factice et note ce qu'il recoit. */
async function simulerPartage(page, { accepte = true } = {}) {
  await page.evaluate(ok => {
    window.__partages = [];
    Object.defineProperty(navigator, 'canShare', {
      configurable: true, value: d => !!(d && d.files && d.files.length)
    });
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: d => {
        window.__partages.push((d.files || []).map(f => f.name));
        return ok ? Promise.resolve() : Promise.reject(new Error('abandon'));
      }
    });
  }, accepte);
}

test('un export par partage eteint la banniere de rappel', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], archive: parties(12), exportedCount: 0 });
  await simulerPartage(page);

  await page.evaluate(() => { go('hof'); backupSheet(); });
  await expect(page.locator('#bkNow'), 'la banniere est bien la au depart').toBeVisible();

  await page.locator('#bex').click();
  await page.waitForTimeout(300);

  expect(await page.evaluate(() => window.__partages.length), 'le partage a bien eu lieu').toBe(1);
  expect(await store(page, 'sk_exported_count'), 'le compteur suit l archive').toBe(12);
  expect(await store(page, 'sk_backup_snooze'), 'le report est remis a zero').toBe(0);

  await page.evaluate(() => goRoot('hof'));
  await expect(page.locator('#bkNow'), 'la banniere a disparu').toHaveCount(0);
  expect(errs).toEqual([]);
});

test('un export par partage confirme au joueur que c est fait', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: parties(3) });
  await simulerPartage(page);
  await page.evaluate(() => { go('hof'); backupSheet(); });
  await page.locator('#bex').click();
  await page.waitForTimeout(300);
  await expect(page.locator('#toast')).toHaveClass(/on/);
});

test('un partage abandonne ne marque pas la sauvegarde comme faite', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: parties(12), exportedCount: 0 });
  await simulerPartage(page, { accepte: false });
  await page.evaluate(() => { go('hof'); backupSheet(); });
  await page.locator('#bex').click();
  await page.waitForTimeout(300);

  expect(await store(page, 'sk_exported_count'), 'rien n a ete sauvegarde').toBe(0);
  await page.evaluate(() => goRoot('hof'));
  await expect(page.locator('#bkNow'), 'la banniere reste').toBeVisible();
});

test('le telechargement classique marque toujours la sauvegarde', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: parties(12), exportedCount: 0 });
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false });
  });
  await page.evaluate(() => { go('hof'); backupSheet(); });
  const dl = page.waitForEvent('download').catch(() => null);
  await page.locator('#bex').click();
  await dl;
  await page.waitForTimeout(300);
  expect(await store(page, 'sk_exported_count')).toBe(12);
});
