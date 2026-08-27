/* Captures d'ecran pour les fiches Google Play et App Store.
   Usage : PORT=8125 node tests/server.mjs &  puis  node store/screenshots/capture.mjs
   Toutes les donnees sont semees dans localStorage avant le chargement,
   comme dans la recette (tests/helpers.mjs). */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://127.0.0.1:8125';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const COLORS = ['#3987e5', '#d03b3b', '#199e70', '#f2c94c', '#d55181', '#9085e9', '#2ab5c9', '#e8842a'];
const ICONS = ['☠️', '🦜', '⚓', '🚢', '⛵', '🗺️', '💎', '👑', '🧭'];
const NAMES = ['Barbe-Noire', 'Anne Bonny', 'Capitaine Flint', 'Marie la Rousse', 'Long John', 'Rackham', 'Surcouf', 'Calico Jack'];
const ROSTER = NAMES.map((name, i) => ({ id: 'j' + i, name, color: COLORS[i], icon: ICONS[i] }));

const CFG = { scoring: 'classic', rascal: 'grapeshot', bonusIfExact: true, loot: true, kraken: true, whale: true, pirates: true, ext: false, rounds: 10, custom: [] };

/* Generateur deterministe : les captures sont reproductibles. */
let seed = 7;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function ri(n) { return Math.floor(rnd() * n); }

/* Une manche credible : les plis se partagent les cartes distribuees, les
   annonces sont justes environ deux fois sur trois. */
function makeRound(players, cards, withBonus) {
  const tricks = {}, bids = {}, bonus = {};
  players.forEach(p => { tricks[p.id] = 0; });
  for (let c = 0; c < cards; c++) tricks[players[ri(players.length)].id]++;
  players.forEach(p => {
    const t = tricks[p.id];
    const r = rnd();
    bids[p.id] = r < 0.62 ? t : Math.max(0, t + (r < 0.81 ? 1 : -1));
    if (withBonus && bids[p.id] === t && rnd() < 0.5) {
      const b = {};
      if (rnd() < 0.5) b.c14 = 1 + ri(2);
      if (rnd() < 0.3) b.pBySK = 1 + ri(2);
      if (rnd() < 0.2) b.skByM = 1;
      if (rnd() < 0.25) b.loot = 1;
      if (rnd() < 0.4) b.pir = ['harry', 'rosie', 'juanita', 'bahij', 'rascal'].slice(0, 1 + ri(2));
      bonus[p.id] = b;
    }
  });
  return { bids, tricks, bonus, locked: true };
}

function makeGame({ id, date, players, played, cur, phase, cfg = {} }) {
  const c = { ...CFG, ...cfg };
  const rounds = [];
  for (let k = 0; k < 10; k++) {
    if (k < played) rounds.push(makeRound(players, k + 1, true));
    else rounds.push({ bids: {}, tricks: {}, bonus: {}, locked: false });
  }
  return { id, date, started: date, cfg: c, players: players.map(p => ({ id: p.id, name: p.name, color: p.color, icon: p.icon })), rounds, cur, phase, manual: false };
}

const day = 86400000;
const T0 = Date.parse('2026-08-20');
const pick = (...idx) => idx.map(i => ROSTER[i]);
const ARCHIVE = [
  makeGame({ id: 'a1', date: T0 - 60 * day, players: pick(0, 1, 2, 3), played: 10, cur: 9, phase: 'res' }),
  makeGame({ id: 'a2', date: T0 - 45 * day, players: pick(0, 1, 2, 3, 4), played: 10, cur: 9, phase: 'res' }),
  makeGame({ id: 'a3', date: T0 - 30 * day, players: pick(1, 2, 4, 5, 6, 7), played: 10, cur: 9, phase: 'res', cfg: { scoring: 'rascal' } }),
  makeGame({ id: 'a4', date: T0 - 21 * day, players: pick(0, 2, 3, 5, 6), played: 10, cur: 9, phase: 'res' }),
  makeGame({ id: 'a5', date: T0 - 12 * day, players: pick(0, 1, 3, 4, 6, 7), played: 10, cur: 9, phase: 'res', cfg: { ext: true } }),
  makeGame({ id: 'a6', date: T0 - 5 * day, players: pick(0, 1, 2, 4, 5, 6, 7), played: 10, cur: 9, phase: 'res', cfg: { ext: true } }),
  makeGame({ id: 'a7', date: T0 - 1 * day, players: pick(0, 1, 2, 3), played: 10, cur: 9, phase: 'res' })
];

const SIX = pick(0, 1, 2, 3, 4, 5);
const MID_BID = makeGame({ id: 'g1', date: T0, players: SIX, played: 5, cur: 5, phase: 'bid', cfg: { ext: true } });
const MID_RES = makeGame({ id: 'g2', date: T0, players: SIX, played: 6, cur: 6, phase: 'res', cfg: { ext: true } });
/* Manche 7 en cours : annonces posees, plis a saisir. */
MID_RES.rounds[6] = { bids: Object.fromEntries(SIX.map((p, i) => [p.id, [1, 2, 0, 1, 2, 1][i]])), tricks: Object.fromEntries(SIX.map((p, i) => [p.id, [1, 2, 0, 1, 2, 1][i]])), bonus: {}, locked: false };
const DONE = makeGame({ id: 'g3', date: T0, players: SIX, played: 10, cur: 9, phase: 'res', cfg: { ext: true } });

/* Tailles exigees par les boutiques : viewport CSS x facteur d'echelle. */
const SIZES = [
  { key: 'play-phone-1080x1920', w: 360, h: 640, dsf: 3, mobile: true },
  { key: 'appstore-6.7-1290x2796', w: 430, h: 932, dsf: 3, mobile: true },
  { key: 'appstore-6.5-1284x2778', w: 428, h: 926, dsf: 3, mobile: true },
  { key: 'appstore-ipad-12.9-2048x2732', w: 1024, h: 1366, dsf: 2, mobile: true }
];

/* Les huit ecrans demandes. `seed` = etat de localStorage, `act` = mise en
   place apres chargement. */
const SHOTS = [
  { n: '01-configuration', seed: { roster: ROSTER, archive: ARCHIVE, lastsel: SIX.map(p => p.id), cfg: { ...CFG, ext: true } },
    act: async page => {
      const row = page.locator('#opts .brow').filter({ hasText: /Extension|Expansion/ });
      await row.scrollIntoViewIfNeeded();
      await page.evaluate(() => {
        const r = [...document.querySelectorAll('#opts .brow')].find(e => /Extension|Expansion/.test(e.textContent));
        if (!r) return;
        const b = r.getBoundingClientRect().bottom;
        if (b > window.innerHeight - 150) window.scrollBy(0, b - window.innerHeight + 150);
      });
    } },
  { n: '02-annonces', seed: { roster: ROSTER, archive: ARCHIVE, game: MID_BID },
    act: async page => {
      await page.evaluate(() => { const r = G.rounds[G.cur]; [1, 2, 0, 1, 2, 0].forEach((v, i) => { r.bids[G.players[i].id] = v; }); save(); renderRound2(); });
      await page.waitForTimeout(200);
    } },
  { n: '03-bonus', seed: { roster: ROSTER, archive: ARCHIVE, game: MID_RES },
    act: async page => {
      await page.locator('#rows .pr').nth(1).locator('.star').click();
      await page.waitForTimeout(400);
      const pir = page.locator('#bp .pchip').nth(0);
      if (await pir.count()) await pir.click();
      await page.locator('#bl .brow').first().locator('.plus').click();
      await page.evaluate(() => { const sh = document.querySelector('#sheet'); if (sh) sh.scrollTop = 0; document.querySelector('#sheetBody').scrollTop = 0; });
      await page.waitForTimeout(300);
    } },
  { n: '04-scores', seed: { roster: ROSTER, archive: ARCHIVE, game: DONE },
    act: async page => { await page.evaluate(() => goRoot('scores')); await page.waitForTimeout(300); } },
  { n: '04b-courbe', seed: { roster: ROSTER, archive: ARCHIVE, game: DONE },
    act: async page => {
      await page.evaluate(() => goRoot('scores'));
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const c = document.querySelector('#chart'), t = document.querySelector('#tbl');
        if (!c || !t) return;
        if (t.getBoundingClientRect().bottom > window.innerHeight - 150) {
          /* La courbe en haut de l'ecran, le tableau suit. */
          window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY - 70);
        }
      });
      await page.waitForTimeout(200);
    } },
  { n: '05-hall-of-fame', seed: { roster: ROSTER, archive: ARCHIVE, lastsel: SIX.map(p => p.id) },
    act: async page => { await page.evaluate(() => goRoot('hof')); } },
  { n: '06-joueur', seed: { roster: ROSTER, archive: ARCHIVE, lastsel: SIX.map(p => p.id) },
    act: async page => { await page.evaluate(() => goRoot('player', 'j0')); } },
  { n: '07-aide', seed: { roster: ROSTER, archive: ARCHIVE, game: DONE },
    act: async page => { await page.evaluate(() => goRoot('help')); } },
  { n: '07b-aide-extension', seed: { roster: ROSTER, archive: ARCHIVE, game: DONE },
    act: async page => {
      await page.evaluate(() => goRoot('help'));
      await page.evaluate(() => { const h = [...document.querySelectorAll('#app h2')].find(e => /Extension|Expansion/.test(e.textContent)); if (h && h.getBoundingClientRect().bottom > window.innerHeight - 300) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 70); });
      await page.waitForTimeout(200);
    } },
  { n: '08-joueurs', seed: { roster: ROSTER, archive: ARCHIVE, lastsel: SIX.map(p => p.id) },
    act: async page => { await page.evaluate(() => goRoot('roster')); } }
];

async function boot(page, state, lang) {
  const raw = {};
  const put = (k, v) => { if (v !== undefined) raw[k] = JSON.stringify(v); };
  put('sk_roster', state.roster); put('sk_archive', state.archive); put('sk_game', state.game);
  put('sk_cfg', state.cfg); put('sk_lang', lang); put('sk_lastsel', state.lastsel);
  put('sk_install_hidden', true); put('sk_exported_count', (state.archive || []).length);
  await page.addInitScript(entries => { for (const [k, v] of entries) localStorage.setItem(k, v); }, Object.entries(raw));
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForTimeout(250);
}

const browser = await chromium.launch();
const manifest = [];
for (const size of SIZES) {
  for (const lang of ['fr', 'en']) {
    const dir = path.join(HERE, size.key, lang);
    fs.mkdirSync(dir, { recursive: true });
    for (const shot of SHOTS) {
      if (ONLY && !ONLY.some(o => shot.n.startsWith(o))) continue;
      const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.dsf, isMobile: size.mobile, hasTouch: true, locale: lang, colorScheme: 'dark', serviceWorkers: 'block' });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(e.message));
      await boot(page, shot.seed, lang);
      if (shot.act) await shot.act(page);
      await page.waitForTimeout(200);
      const file = path.join(dir, shot.n + '.png');
      await page.screenshot({ path: file, fullPage: false });
      const doc = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      manifest.push({ size: size.key, lang, shot: shot.n, file: path.relative(HERE, file), overflow: doc.sw > doc.cw, errs });
      await ctx.close();
      console.log(size.key, lang, shot.n, errs.length ? 'ERREURS ' + errs.join(' | ') : 'ok', doc.sw > doc.cw ? 'DEBORDEMENT' : '');
    }
  }
}
await browser.close();
fs.writeFileSync(path.join(HERE, 'manifest.json'), JSON.stringify(manifest, null, 2));
