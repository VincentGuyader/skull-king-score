import { test, expect } from '@playwright/test';
import { chargerMoteur, CLASSIQUE } from './moteur.mjs';
import { boot, watchErrors, roster, game, blank, setCounter } from './helpers.mjs';

/* Extension officielle (livret Grandpa Beck's, 11 pages) : 12 cartes de
   couleur (7, 8 et 0/14 par couleur), Joker 15, Mary Thorne, Second, Supplice
   de la planche, Raie tachetee, Derniere salve, Casier de Davy Jones. Jusqu'a
   neuf joueurs sur dix manches. Au score : +5 par 8 capture, -5 par 7 capture,
   +20 par monstre coule par Davy Jones, +30 pour le Second pris par le Skull
   King ou une sirene, Mary comptee comme un pirate de plus. Le tout seulement
   quand l'option est active : sans elle, rien ne doit bouger. */

const M = chargerMoteur();
const SANS = { ...CLASSIQUE };
const AVEC = { ...CLASSIQUE, ext: true };

/* ===== Moteur ======================================================== */

test('le paquet compte les dix-neuf cartes de l extension, et seulement avec l option', () => {
  expect(M.deckSize(SANS), 'paquet de base complet').toBe(74);
  expect(M.deckSize(AVEC), 'plus dix-neuf cartes').toBe(93);
});

test('neuf joueurs jouent dix manches completes avec l extension', () => {
  expect(M.maxCards(AVEC, 9), 'neuf joueurs').toBe(10);
  expect(M.maxCards(AVEC, 8), 'huit joueurs').toBe(11);
  expect(M.maxCards(SANS, 8), 'sans extension, huit joueurs plafonnent a neuf').toBe(9);
  expect(M.cardsForRound(AVEC, 9, 9), 'dixieme manche a neuf').toBe(10);
});

test('le nombre de joueurs admis passe de huit a neuf', () => {
  expect(M.maxPlayers(SANS)).toBe(8);
  expect(M.maxPlayers(AVEC)).toBe(9);
  expect(M.maxPlayers(undefined), 'sans configuration').toBe(8);
});

test('les quatre bonus de l extension valent ce que dit le livret', () => {
  const b = { e8: 2, e7: 1, dj: 3, mate: 1 };
  const s = M.bonusSplit(b, AVEC);
  expect(s.cond, '+10 -5 +60 +30, tous soumis a l annonce').toBe(95);
  expect(s.free).toBe(0);
  expect(M.bonusPoints(b, AVEC)).toBe(95);
});

test('les bonus de l extension ne sont proposes qu avec l option', () => {
  const cles = cfg => M.BONUS_DEFS.filter(d => !d.need || cfg[d.need]).map(d => d.k);
  expect(cles(SANS)).toEqual(['c14', 'b14', 'mByP', 'pBySK', 'skByM', 'loot', 'free']);
  expect(cles(AVEC)).toEqual(['c14', 'b14', 'mByP', 'pBySK', 'skByM', 'loot', 'e8', 'e7', 'dj', 'mate', 'free']);
});

test('les bonus de l extension restent conditionnes a l annonce dans le bareme', () => {
  const sp = M.bonusSplit({ e8: 1, dj: 1 }, AVEC);
  expect(M.scoreRound(2, 2, 5, sp.cond, AVEC, sp.free, 0).total, 'annonce juste').toBe(65);
  expect(M.scoreRound(2, 3, 5, sp.cond, AVEC, sp.free, 0).total, 'annonce ratee').toBe(-10);
});

test('Mary Thorne est un sixieme pirate, seulement avec l extension', () => {
  expect(M.pirates(SANS).map(p => p.k)).toEqual(['rosie', 'bendt', 'rascal', 'juanita', 'harry']);
  expect(M.pirates(AVEC).map(p => p.k)).toEqual(['rosie', 'bendt', 'rascal', 'juanita', 'harry', 'mary']);
});

test('le Skull King peut capturer six pirates avec l extension', () => {
  const sk = M.BONUS_DEFS.find(d => d.k === 'pBySK');
  expect(M.bonusMax(sk, SANS)).toBe(5);
  expect(M.bonusMax(sk, AVEC)).toBe(6);
  const m = M.BONUS_DEFS.find(d => d.k === 'mByP');
  expect(M.bonusMax(m, AVEC), 'les autres plafonds ne bougent pas').toBe(2);
});

test('une feuille de bonus de l extension ne vaut rien sans l option', () => {
  /* Une partie de base ne peut pas saisir ces compteurs ; s'ils se trouvent
     tout de meme dans une manche, le score reste celui du jeu de base. */
  expect(M.bonusPoints({ e8: 2, dj: 1, c14: 1 }, SANS)).toBe(10);
});

/* ===== Interface ===================================================== */

const NEUF = roster('Anne', 'Bob', 'Cleo', 'Dan', 'Eve', 'Fred', 'Gus', 'Hal', 'Ida');
const HUIT = NEUF.slice(0, 8).map(p => p.id);
const optionExt = page => page.locator('#opts .brow').filter({ hasText: 'Extension' }).locator('.sw');

test('sans l option, la neuvieme fiche est refusee ; avec, elle entre en partie', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: NEUF, lastsel: HUIT });
  await expect(optionExt(page), 'l option est proposee').toHaveCount(1);

  await page.locator('#pl .pr').nth(8).click();
  expect(await page.locator('#toast').textContent(), 'le refus est dit').toContain('8');
  expect(await page.evaluate(() => draft.sel.length), 'toujours huit').toBe(8);

  await optionExt(page).click();
  await page.locator('#pl .pr').nth(8).click();
  expect(await page.evaluate(() => draft.sel.length), 'neuf en partie').toBe(9);
  expect(await page.evaluate(() => draft.cfg.ext), 'l option est memorisee').toBe(true);
  expect(errs).toEqual([]);
});

test('le plafond de cartes annonce suit l extension', async ({ page }) => {
  await boot(page, { roster: NEUF, lastsel: HUIT });
  expect(await page.locator('#roundsHint').textContent(), 'huit joueurs, paquet de base').toContain('9');
  await optionExt(page).click();
  await page.waitForTimeout(100);
  expect(await page.locator('#roundsHint').textContent(), 'huit joueurs, paquet etendu').toContain('11');
});

test('retirer l extension a neuf joueurs ramene la selection a huit', async ({ page }) => {
  await boot(page, { roster: NEUF, lastsel: NEUF.map(p => p.id), cfg: { ext: true } });
  expect(await page.evaluate(() => draft.sel.length), 'neuf au depart').toBe(9);
  await optionExt(page).click();
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => draft.sel.length), 'le neuvieme sort').toBe(8);
  expect(await page.evaluate(() => draft.cfg.ext)).toBe(false);
});

test('une neuvieme couleur de serie est proposee quand les huit sont prises', async ({ page }) => {
  const HUIT_FICHES = NEUF.slice(0, 8);
  await boot(page, { roster: HUIT_FICHES, lastsel: HUIT_FICHES.map(p => p.id), cfg: { ext: true } });
  const r = await page.evaluate(() => ({ libre: freeColor(), serie: SERIES_HEX.length, css: SERIES.length }));
  expect(r.serie, 'neuf teintes').toBe(9);
  expect(r.css, 'neuf variables CSS').toBe(9);
  expect(HUIT_FICHES.map(p => p.color), 'une couleur pas encore prise').not.toContain(r.libre);
  const lisible = await page.evaluate(c => contrast(c, SURFACE), r.libre);
  expect(lisible, 'lisible sur fond sombre').toBeGreaterThanOrEqual(3);
});

function enResultats(cfg, bonus = {}) {
  const J = NEUF.slice(0, 3);
  const g = game({
    id: 'gE', cfg: { rounds: 10, ...cfg }, players: J,
    rounds: Array.from({ length: 10 }, blank), cur: 5, phase: 'res'
  });
  g.rounds[5].bids = { j0: 2, j1: 2, j2: 2 };
  g.rounds[5].bid0 = { j0: 2, j1: 2, j2: 2 };
  g.rounds[5].tricks = { j0: 2, j1: 2, j2: 2 };
  g.rounds[5].bonus = bonus;
  return g;
}
const ouvrirBonus = page => page.locator('#rows .pr').first().locator('.star').click();
const lignesBonus = page => page.evaluate(() =>
  [...document.querySelectorAll('#bl .brow .lbl')].map(l => l.firstChild.textContent.trim()));

test('la feuille de bonus gagne quatre lignes et un pirate avec l extension', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: NEUF, game: enResultats({ ext: true }) });
  await ouvrirBonus(page);
  const lignes = await lignesBonus(page);
  expect(lignes.length, 'six lignes de base plus quatre').toBe(10);
  for (const mot of ['8', '7', 'Davy Jones', 'Second']) {
    expect(lignes.some(l => l.includes(mot)), mot).toBe(true);
  }
  expect(await page.locator('#bp .pchip').count(), 'six pirates').toBe(6);
  expect(await page.locator('#bp').textContent()).toContain('Mary Thorne');
  expect(errs).toEqual([]);
});

test('sans l extension, la feuille de bonus est celle du jeu de base', async ({ page }) => {
  await boot(page, { roster: NEUF, game: enResultats({}) });
  await ouvrirBonus(page);
  expect((await lignesBonus(page)).length).toBe(6);
  expect(await page.locator('#bp .pchip').count()).toBe(5);
  expect(await page.locator('#bp').textContent()).not.toContain('Mary');
});

test('le compteur de pirates pris par le Skull King monte a six', async ({ page }) => {
  for (const [ext, attendu] of [[false, 5], [true, 6]]) {
    await boot(page, { roster: NEUF, game: enResultats(ext ? { ext: true } : {}) });
    await ouvrirBonus(page);
    const ligne = page.locator('#bl .brow').filter({ hasText: 'Skull King' }).first();
    for (let i = 0; i < 8; i++) {
      const plus = ligne.locator('.plus');
      if (await plus.isDisabled()) break;
      await plus.click();
    }
    expect(Number(await ligne.locator('.v').textContent()), `extension ${ext}`).toBe(attendu);
  }
});

test('les points de l extension entrent dans le score de la manche', async ({ page }) => {
  await boot(page, { roster: NEUF, game: enResultats({ ext: true }, { j0: { e8: 1, e7: 1, dj: 1, mate: 1 } }) });
  const sc = await page.evaluate(() => scoreRoundAll(G, 5));
  expect(sc.j0.total, '40 +5 -5 +20 +30').toBe(90);
  expect(sc.j1.total, 'sans bonus').toBe(40);
  await page.locator('#ok').click();
  await page.waitForTimeout(300);
  const lead = await page.evaluate(() => [...document.querySelectorAll('#lead .lead .tot')].map(d => d.textContent));
  expect(lead[0], 'en tete avec 90').toContain('90');
});

test('l aide-memoire decrit l extension seulement quand elle est active', async ({ page }) => {
  for (const lang of ['fr', 'en', 'de', 'es']) {
    await boot(page, { roster: NEUF, game: enResultats({ ext: true }), lang });
    await page.evaluate(() => go('help'));
    const texte = await page.locator('#app').textContent();
    for (const mot of ['Mary Thorne', 'Davy Jones', '+5', '−5', '+20', '+30', '15']) {
      expect(texte, `${lang} : ${mot}`).toContain(mot);
    }
    expect(texte, `${lang} : pas de gabarit`).not.toContain('${');
    expect(texte, `${lang} : pas de cle nue`).not.toMatch(/\bh[A-Z][a-zA-Z]+D?\b/);

    await boot(page, { roster: NEUF, game: enResultats({}), lang });
    await page.evaluate(() => go('help'));
    const base = await page.locator('#app').textContent();
    expect(base, `${lang} : rien sur l extension`).not.toContain('Mary Thorne');
    expect(base, `${lang} : rien sur Davy Jones`).not.toContain('Davy Jones');
  }
});

test('le dictionnaire couvre l extension dans les quatre langues', async ({ page }) => {
  await boot(page, { roster: NEUF });
  const manquantes = await page.evaluate(() => {
    const cles = Object.keys(I18N.fr);
    const out = [];
    for (const l of ['en', 'de', 'es']) {
      for (const k of cles) if (!(k in I18N[l])) out.push(l + ':' + k);
      for (const k of Object.keys(I18N.fr.pirNames)) if (!I18N[l].pirNames[k] || !I18N[l].pirPow[k]) out.push(l + ':pir:' + k);
    }
    return out;
  });
  expect(manquantes).toEqual([]);
  const be8 = await page.evaluate(() => ['be8', 'be7', 'bdj', 'bmate', 'optExt', 'hExtTitle'].filter(k => !I18N.fr[k]));
  expect(be8, 'cles de l extension presentes').toEqual([]);
});

test('une partie de base continue de compter exactement comme avant', async ({ page }) => {
  /* Temoin : le cas de reference du jeu de base, sans l option, doit donner le
     meme total qu'avant l'extension. */
  await boot(page, { roster: NEUF, game: enResultats({}, { j0: { c14: 1, pBySK: 2 } }) });
  const sc = await page.evaluate(() => scoreRoundAll(G, 5));
  expect(sc.j0.total, '40 +10 +60').toBe(110);
  expect(await page.evaluate(() => deckSize(G.cfg)), 'paquet inchange').toBe(74);
});
