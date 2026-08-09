import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, blank, setCounter, head } from './helpers.mjs';

/* Que se passe-t-il quand le stockage sature en pleine partie ? Store.set
   avale l'exception : l'application continue comme si de rien n'etait, et le
   joueur ne decouvre la perte qu'au rechargement suivant. Ce cas n'avait
   jamais ete eprouve. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const partie = () => game({
  id: 'gQ', cfg: { rounds: 3 }, players: [ANNE, BOB],
  rounds: [blank(), blank(), blank()], cur: 0, phase: 'bid'
});

/** Fait echouer toute ecriture ulterieure, comme un stockage plein. */
async function saturer(page) {
  await page.evaluate(() => {
    const vrai = Storage.prototype.setItem;
    window.__ecrituresRefusees = 0;
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith('sk_')) {
        window.__ecrituresRefusees++;
        const e = new Error('quota depasse');
        e.name = 'QuotaExceededError';
        throw e;
      }
      return vrai.call(this, k, v);
    };
  });
}

test('une saisie apres saturation ne fait pas planter l application', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await saturer(page);

  await setCounter(page, 0, 1);
  await page.locator('#ok').click();
  await setCounter(page, 0, 1);

  expect((await head(page)).view, 'la partie continue').toBe('round');
  expect(await page.evaluate(() => window.__ecrituresRefusees), 'des ecritures ont bien echoue')
    .toBeGreaterThan(0);
  expect(errs, 'aucune erreur non capturee').toEqual([]);
});

test('le joueur est averti que ses saisies ne sont plus enregistrees', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await saturer(page);
  await setCounter(page, 0, 1);
  await page.waitForTimeout(300);

  /* Sans avertissement, le joueur poursuit une partie qui n'existe plus sur
     le disque et ne s'en apercoit qu'au rechargement, tout perdu. */
  const alerte = page.locator('#storageBanner');
  await expect(alerte, 'une alerte apparait').toBeVisible();
  const texte = await alerte.textContent();
  expect(texte.length, 'et elle explique la situation').toBeGreaterThan(30);
});

test('l alerte propose d exporter avant de perdre quoi que ce soit', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await saturer(page);
  await setCounter(page, 0, 1);
  await page.waitForTimeout(300);
  await expect(page.locator('#storageBanner button'), 'une action de sauvegarde')
    .not.toHaveCount(0);
});

test('un stockage sain n affiche aucune alerte', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie() });
  await setCounter(page, 0, 1);
  await page.waitForTimeout(300);
  await expect(page.locator('#storageBanner')).toHaveCount(0);
});

test('le quota reel du navigateur peut etre reduit sans casser l application', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'pilotage du quota reserve a Chromium');
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], game: partie() });

  const cdp = await page.context().newCDPSession(page);
  const origine = new URL(page.url()).origin;
  await cdp.send('Storage.overrideQuotaForOrigin', { origin: origine, quotaSize: 1024 });

  await page.evaluate(() => {
    /* Une partie volumineuse : huit joueurs, quinze manches, notes longues. */
    try {
      const gros = { ...G, rounds: Array.from({ length: 15 }, () => ({
        bids: {}, tricks: {}, bonus: { jA: { note: 'x'.repeat(4000) } }, locked: false })) };
      Store.set('sk_game', gros);
    } catch (e) { /* c'est justement ce qu'on eprouve */ }
  });

  expect((await head(page)).view, 'l application tient debout').toBe('round');
  expect(errs).toEqual([]);
  await cdp.detach();
});
