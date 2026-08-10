import { test, expect } from '@playwright/test';
import { boot, watchErrors, player, game, round, store } from './helpers.mjs';

/* Issue #47 : validGame verifiait la forme d'une partie mais jamais celle de
   ses manches. Une partie bien formee dont une seule manche est abimee
   franchissait les filtres de #2 et #8, etait ecrite, puis tuait le hall of
   fame definitivement. C'est le mecanisme de l'issue #2 un cran plus bas. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const BONNE = game({
  id: 'gOk', date: Date.parse('2026-05-01'), cfg: { rounds: 1 },
  players: [ANNE, BOB], rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 })]
});

/* Toutes ces parties ont des joueurs identifies et un rounds de type tableau :
   elles passaient donc validGame. */
const MANCHES_ABIMEES = {
  'une manche nulle': [null],
  'une manche non objet': [42],
  'une manche sans annonces': [{ locked: true }],
  'des annonces qui ne sont pas un objet': [{ bids: 'x', tricks: {}, bonus: {}, locked: true }],
  'des plis qui sont un tableau': [{ bids: {}, tricks: [], bonus: {}, locked: true }],
  'des bonus nuls': [{ bids: {}, tricks: {}, bonus: null, locked: true }],
  'une bonne manche puis une nulle': [{ bids: {}, tricks: {}, bonus: {}, locked: true }, null]
};

const pourrie = rounds => ({
  id: 'gz', date: 1, cfg: { scoring: 'classic', custom: [] },
  players: [{ id: 'jA', name: 'Anne' }], rounds
});

for (const [nom, rounds] of Object.entries(MANCHES_ABIMEES)) {
  test(`le hall of fame survit a ${nom}`, async ({ page }) => {
    const errs = watchErrors(page);
    await boot(page, { roster: [ANNE, BOB], archive: [pourrie(rounds), BONNE] });

    await page.evaluate(() => goRoot('hof'));
    const texte = await page.locator('#app').textContent();
    expect(texte, 'la partie exploitable reste visible').toContain('Anne');
    await expect(page.locator('#gl .pr'), 'une seule partie listee').toHaveCount(1);
    expect(errs, 'aucune erreur non capturee').toEqual([]);
  });
}

test('les statistiques ignorent la partie dont une manche est abimee', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [pourrie([null]), BONNE] });
  const S = await page.evaluate(() => computeStats(archive()).S);
  expect(Object.keys(S).sort(), 'seuls les joueurs de la partie saine').toEqual(['jA', 'jB']);
  expect(S.jA, 'une partie, une victoire').toMatchObject({ games: 1, wins: 1, sum: 20 });
});

test('la fiche joueur et le detail de partie restent accessibles', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB], archive: [pourrie([{ locked: true }]), BONNE] });

  await page.evaluate(() => go('player', 'jA'));
  expect(await page.locator('#app').textContent()).toContain('%');
  await page.evaluate(() => go('game', 'gOk'));
  expect(await page.locator('#lead').textContent()).toContain('Anne');
  expect(errs).toEqual([]);
});

test('un import dont une manche est abimee est refuse avant toute ecriture', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], archive: [BONNE] });
  const avantA = await store(page, 'sk_archive');
  const avantR = await store(page, 'sk_roster');

  await page.evaluate(() => { go('hof'); backupSheet(); });
  await page.setInputFiles('#bfile', {
    name: 'manches.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ v: 1, roster: [], archive: [pourrie([null])] }), 'utf8')
  });
  await page.waitForTimeout(400);

  await expect(page.locator('#imReplace'), 'le choix ne doit meme pas s ouvrir').toHaveCount(0);
  expect(await store(page, 'sk_archive'), 'archive intacte').toEqual(avantA);
  expect(await store(page, 'sk_roster'), 'repertoire intact').toEqual(avantR);
  await expect(page.locator('#toast'), 'le refus est annonce').toHaveClass(/on/);
});

test('une partie en cours dont une manche est abimee ne bloque pas le demarrage', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, {
    roster: [ANNE, BOB], lastsel: ['jA', 'jB'],
    raw: {
      sk_game: JSON.stringify({
        id: 'g', cfg: { scoring: 'classic', rounds: 2, custom: [] },
        players: [ANNE, BOB], rounds: [{ bids: {}, tricks: {}, bonus: {}, locked: false }, null],
        cur: 0, phase: 'bid'
      })
    }
  });
  expect(await page.evaluate(() => view), 'on repart sur la configuration').toBe('setup');
  await expect(page.locator('#go'), 'et on peut demarrer').toBeEnabled();
  expect(errs).toEqual([]);
});

test('une partie saine avec des manches vides reste parfaitement valide', async ({ page }) => {
  const errs = watchErrors(page);
  const enCours = game({
    id: 'gEnCours', cfg: { rounds: 3 }, players: [ANNE, BOB],
    rounds: [round({ jA: 1, jB: 0 }, { jA: 1, jB: 0 }),
             { bids: {}, tricks: {}, bonus: {}, locked: false },
             { bids: {}, tricks: {}, bonus: {}, locked: false }],
    cur: 1, phase: 'bid'
  });
  await boot(page, { roster: [ANNE, BOB], game: enCours });
  expect(await page.evaluate(() => view), 'la partie est reprise').toBe('round');
  expect(await page.evaluate(() => G.rounds.length)).toBe(3);
  expect(errs).toEqual([]);
});

test('une partie saisie a la main, sans aucune manche, reste valide', async ({ page }) => {
  const manuelle = {
    id: 'gM', date: Date.parse('2026-04-01'), cfg: { scoring: 'classic', custom: [] },
    players: [ANNE, BOB], rounds: [], manual: true, finals: { jA: 300, jB: 100 }
  };
  await boot(page, { roster: [ANNE, BOB], archive: [manuelle, BONNE] });
  await page.evaluate(() => goRoot('hof'));
  await expect(page.locator('#gl .pr'), 'les deux parties sont listees').toHaveCount(2);
});
