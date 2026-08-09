/* Briques communes aux tests de recette.
   Tout l'etat de l'application vit dans localStorage : on l'ecrit avant le
   chargement de la page, ce qui permet de placer l'application dans n'importe
   quel etat sans avoir a rejouer toute une partie a la souris. */

export const CFG = {
  scoring: 'classic', rascal: 'grapeshot', bonusIfExact: true,
  loot: true, kraken: true, whale: true, pirates: true, rounds: 10, custom: []
};

export const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500',
                       '#d55181', '#008300', '#9085e9', '#e66767'];

/** Fiche de repertoire. */
export function player(id, name, extra = {}) {
  return { id, name, color: COLORS[0], icon: '☠️', ...extra };
}

/** Liste de fiches, couleurs et pictos distincts. */
export function roster(...names) {
  const icons = ['☠️', '💀', '⚓', '🚢',
                 '⛵', '🗺️', '💎', '👑'];
  return names.map((name, i) => player('j' + i, name, { color: COLORS[i % 8], icon: icons[i % 8] }));
}

/** Manche jouee. bids et tricks sont indexes par identifiant de joueur. */
export function round(bids, tricks, extra = {}) {
  return { bids, tricks, bonus: {}, locked: true, ...extra };
}

/** Manche non commencee. */
export function blank() {
  return { bids: {}, tricks: {}, bonus: {}, locked: false };
}

/** Partie, en cours ou terminee. */
export function game({ id = 'g1', date, cfg = {}, players, rounds, cur = 0, phase = 'bid', manual = false, finals }) {
  const g = {
    id,
    date: date ?? Date.parse('2026-06-01'),
    started: date ?? Date.parse('2026-06-01'),
    cfg: { ...CFG, ...cfg },
    players: players.map(p => ({ id: p.id, name: p.name, color: p.color, icon: p.icon })),
    rounds,
    cur, phase, manual
  };
  if (finals) g.finals = finals;
  return g;
}

/**
 * Ecrit l'etat puis charge l'application.
 * Les cles absentes ne sont pas ecrites, ce qui laisse l'application sur son
 * comportement de premier lancement. Les valeurs brutes (chaines) sont ecrites
 * telles quelles : c'est ainsi qu'on injecte du JSON invalide.
 */
export async function boot(page, state = {}) {
  const raw = {};
  const put = (key, value) => {
    if (value === undefined) return;
    raw[key] = typeof value === 'string' && state.rawKeys?.includes(key)
      ? value : JSON.stringify(value);
  };
  put('sk_roster', state.roster);
  put('sk_archive', state.archive);
  put('sk_game', state.game);
  put('sk_cfg', state.cfg);
  put('sk_lang', state.lang ?? 'fr');
  put('sk_lastsel', state.lastsel);
  put('sk_exported_count', state.exportedCount);
  put('sk_backup_snooze', state.backupSnooze);
  put('sk_install_hidden', state.installHidden ?? true);
  for (const [k, v] of Object.entries(state.raw || {})) raw[k] = v;

  /* addInitScript rejoue a chaque navigation et s'accumule d'un appel a
     l'autre. Le temoin __seme est pose APRES le chargement : au chargement
     qui suit un boot() il est absent, donc tous les scripts s'executent dans
     l'ordre d'ajout et le plus recent gagne ; a un rechargement il est la,
     donc aucun ne s'execute et le test garde ce qu'il vient de faire. */
  try {
    await page.evaluate(() => { try { localStorage.removeItem('__seme'); } catch (e) {} });
  } catch (e) { /* aucune page chargee pour l'instant */ }

  await page.addInitScript(entries => {
    try { if (localStorage.getItem('__seme')) return; } catch (e) { /* stockage indisponible */ }
    for (const [k, v] of entries) {
      try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ }
    }
  }, Object.entries(raw));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.evaluate(() => { try { localStorage.setItem('__seme', '1'); } catch (e) {} });
  return page;
}

/** Collecte les erreurs non capturees et les erreurs de console. */
export function watchErrors(page) {
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  return errs;
}

/** Etat visible de l'en tete et de la barre du bas. */
export function head(page) {
  return page.evaluate(() => ({
    title: document.querySelector('#hTitle').textContent,
    sub: document.querySelector('#hSub').textContent,
    hint: document.querySelector('#barHint').textContent,
    view: typeof view === 'undefined' ? null : view
  }));
}

/** Tableau manche par manche de l'ecran des scores, sous forme de lignes. */
export function table(page) {
  return page.evaluate(() => {
    const t = document.querySelector('#tbl table');
    if (!t) return null;
    return [...t.querySelectorAll('tr')].map(tr => [...tr.children].map(td => td.textContent));
  });
}

/** Classement en tete de l'ecran des scores. */
export function lead(page) {
  return page.evaluate(() => [...document.querySelectorAll('#lead .lead')].map(d => ({
    rank: d.querySelector('.rank').textContent,
    name: d.querySelector('.nm').textContent,
    total: d.querySelector('.tot').textContent
  })));
}

/** Amene le compteur de la ligne joueur indiquee a la valeur voulue. */
export async function setCounter(page, index, target) {
  const row = page.locator('#rows .pr').nth(index);
  for (let i = 0; i < 60; i++) {
    const cur = Number(await row.locator('.step .v').textContent());
    if (cur === target) return;
    const btn = row.locator(cur < target ? '.step .plus' : '.step .minus');
    if (await btn.isDisabled()) throw new Error(`compteur bloque a ${cur} en visant ${target}`);
    await btn.click();
  }
  throw new Error('trop d iterations sur le compteur');
}

/**
 * Clique un bouton de la barre du bas en laissant passer l'anti-rebond de
 * navigation : deux actions d'ecran separees de moins d'un tiers de seconde
 * sont traitees comme un double appui accidentel et la seconde est ignoree.
 */
export async function tapBar(page, selecteur) {
  await page.waitForTimeout(350);
  await page.locator(selecteur).click();
}

/** Contenu d'une cle de stockage, deserialise. */
export function store(page, key) {
  return page.evaluate(k => {
    const v = localStorage.getItem(k);
    if (v === null) return null;
    try { return JSON.parse(v); } catch (e) { return { __brut: v }; }
  }, key);
}
