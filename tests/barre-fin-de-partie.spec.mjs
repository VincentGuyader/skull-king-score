import { test, expect } from '@playwright/test';
import { boot, watchErrors, roster, game, round } from './helpers.mjs';

/* En fin de partie, la barre du bas porte le message du
   vainqueur, Partager, Hall of fame / Nouvelle partie et Revenir a la
   manche. Elle depasse alors largement la marge reservee sous le contenu :
   meme defile tout en bas, le tableau par manche restait cache dessous. */

const JOUEURS = roster('Baka', 'Kkk');

function partieFinie() {
  const rounds = Array.from({ length: 10 }, (_, r) => {
    const bids = {}, tricks = {};
    JOUEURS.forEach(p => { bids[p.id] = r % 3; tricks[p.id] = r % 3; });
    return round(bids, tricks);
  });
  return game({ id: 'gF', cfg: { rounds: 10 }, players: JOUEURS, rounds, cur: 9, phase: 'res' });
}

function partieEnCours() {
  const rounds = Array.from({ length: 10 }, (_, r) => {
    const bids = {}, tricks = {};
    JOUEURS.forEach(p => { bids[p.id] = 1; tricks[p.id] = 1; });
    return { ...round(bids, tricks), locked: r < 4 };
  });
  return game({ id: 'gE', cfg: { rounds: 10 }, players: JOUEURS, rounds, cur: 4, phase: 'bid' });
}

/* Defile tout en bas, puis mesure l'ecart entre le bas du dernier element de
   l'ecran et le haut de la barre (son message compris). */
async function ecartSousLaBarre(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const app = document.querySelector('#app');
    const last = app.lastElementChild.lastElementChild;
    const bar = document.querySelector('#bar .inner');
    return Math.round(bar.getBoundingClientRect().top - last.getBoundingClientRect().bottom);
  });
}

for (const [nom, vue] of [['petit telephone', { width: 360, height: 640 }],
                          ['grand telephone', { width: 412, height: 915 }]]) {
  test(`fin de partie, ${nom} : le bas de l ecran se degage de la barre`, async ({ page }) => {
    const errs = watchErrors(page);
    await page.setViewportSize(vue);
    await boot(page, { roster: JOUEURS, game: partieFinie() });
    await expect(page.locator('#share')).toBeVisible();
    expect(await ecartSousLaBarre(page)).toBeGreaterThanOrEqual(0);
    expect(errs).toEqual([]);
  });
}

test('partie en cours : le bas de l ecran se degage aussi de la barre', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await boot(page, { roster: JOUEURS, game: partieEnCours() });
  await page.evaluate(() => go('scores'));
  await expect(page.locator('#next')).toBeVisible();
  expect(await ecartSousLaBarre(page)).toBeGreaterThanOrEqual(0);
});

/* La courbe affichait son infobulle en annulant le toucher : un glissement
   vertical commence dessus ne faisait plus defiler la page. */
test('la courbe laisse le glissement vertical a la page', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'TouchEvent constructible seulement sous Chromium');
  await page.setViewportSize({ width: 412, height: 915 });
  await boot(page, { roster: JOUEURS, game: partieFinie() });
  const r = await page.evaluate(() => {
    const svg = document.querySelector('#chart svg');
    const b = svg.getBoundingClientRect();
    const t = new Touch({ identifier: 1, target: svg, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 });
    const ev = new TouchEvent('touchstart', { cancelable: true, bubbles: true, touches: [t], targetTouches: [t], changedTouches: [t] });
    svg.dispatchEvent(ev);
    return { annule: ev.defaultPrevented, geste: getComputedStyle(svg).touchAction,
             bulle: document.querySelector('#chart .tip').style.opacity };
  });
  expect(r.annule, 'le toucher n est pas annule').toBe(false);
  expect(r.geste).toBe('pan-y');
  expect(r.bulle, 'l infobulle s affiche toujours').toBe('1');
});

/* Ex aequo en tete : les deux points finissent en haut du trace, et le
   plancher des etiquettes les ramenait sur la meme ligne ("BKkk"). */
test('les noms des ex aequo ne se superposent pas au bout de la courbe', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await boot(page, { roster: JOUEURS, game: partieFinie() });
  const etiquettes = await page.evaluate(() =>
    [...document.querySelectorAll('#chart svg text[font-weight="600"]')]
      .map(t => ({ nom: t.textContent, y: Number(t.getAttribute('y')) })));
  expect(etiquettes.map(e => e.nom).sort()).toEqual(['Baka', 'Kkk']);
  expect(Math.abs(etiquettes[0].y - etiquettes[1].y)).toBeGreaterThanOrEqual(14);
});
