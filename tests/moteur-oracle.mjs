/* Seconde implantation du calcul, ecrite depuis les regles du jeu et non
   depuis le code de l'application. Elle sert de temoin : sur des parties
   tirees au hasard, les deux doivent tomber d'accord sur chaque champ.
   Elle est elle-meme epinglee par les cas de reference officiels, sans quoi
   deux implantations pourraient se tromper de concert. */

const PAQUET = { base: 70, loot: 2, kraken: 1, whale: 1 };
const VALEURS = { c14: 10, b14: 20, mByP: 20, pBySK: 30, skByM: 40, loot: 20 };

export function paquetOracle(cfg) {
  return PAQUET.base + (cfg.loot ? PAQUET.loot : 0)
    + (cfg.kraken ? PAQUET.kraken : 0) + (cfg.whale ? PAQUET.whale : 0);
}
/* Sans sequence, la progression officielle. Avec une sequence, la valeur
   qu'elle indique pour cette manche, la derniere servant au-dela. Le paquet
   plafonne dans les deux cas. */
export function cartesOracle(cfg, joueurs, manche) {
  const plafond = Math.floor(paquetOracle(cfg) / Math.max(2, joueurs));
  const seq = cfg && Array.isArray(cfg.seq) && cfg.seq.length ? cfg.seq : null;
  let voulu = manche + 1;
  if (seq) {
    const v = seq[manche] != null ? seq[manche] : seq[seq.length - 1];
    if (Number.isInteger(v) && v >= 1) voulu = v;
  }
  return Math.max(1, Math.min(voulu, plafond));
}

/* Deux poches : ce qui depend de la reussite de l'annonce, et ce qui est
   acquis quoi qu'il arrive. */
export function bonusOracle(b, cfg) {
  let cond = 0, free = 0;
  if (!b) return { cond, free };
  for (const [cle, points] of Object.entries(VALEURS)) {
    if (cle === 'loot' && !cfg.loot) { /* la ligne existe quand meme dans la manche */ }
    cond += (b[cle] || 0) * points;
  }
  free += b.free || 0;
  for (const c of (cfg && cfg.custom) || []) {
    const n = b['x' + c.id] || 0;
    if (!n) continue;
    if (c.cond === 'bid') cond += n * c.pts; else free += n * c.pts;
  }
  return { cond, free };
}

export function capaciteOracle(partie, ri) {
  const cartes = cartesOracle(partie.cfg, partie.players.length, ri);
  const manche = partie.rounds[ri];
  let extra = manche.extra || 0;
  for (const c of (partie.cfg && partie.cfg.custom) || []) {
    if (!c.tricks) continue;
    for (const p of partie.players) {
      extra += ((manche.bonus[p.id] || {})['x' + c.id] || 0) * c.tricks;
    }
  }
  return { cards: cartes, extra, cap: cartes + extra };
}

/* Bareme, ecrit depuis le tableau des regles. */
export function scoreOracle(annonce, plis, cartes, bonusCond, cfg, acquis, pari) {
  const ecart = Math.abs(annonce - plis), juste = ecart === 0;
  let base = 0, bonus = 0;
  if (cfg.scoring === 'rascal') {
    const potentiel = (cfg.rascal === 'cannonball' ? 15 : 10) * cartes;
    if (cfg.rascal === 'cannonball') {
      base = juste ? potentiel : 0;
      bonus = juste ? bonusCond : 0;
    } else if (juste) {
      base = potentiel; bonus = bonusCond;
    } else if (ecart === 1) {
      base = Math.round(potentiel / 2); bonus = Math.round(bonusCond / 2);
    }
  } else if (annonce === 0) {
    base = juste ? 10 * cartes : -10 * cartes;
  } else {
    base = juste ? 20 * plis : -10 * ecart;
  }
  if (cfg.scoring !== 'rascal') bonus = (juste || !cfg.bonusIfExact) ? bonusCond : 0;
  const adj = acquis || 0;
  const mise = pari || 0;
  const bet = mise ? (juste ? mise : -mise) : 0;
  return { base, bonus, adj, bet, total: base + bonus + adj + bet, exact: juste, diff: ecart };
}

/* Deroule d'une partie : points par manche, cumuls, classement. */
export function derouleOracle(partie) {
  const par = {}, cum = {}, idx = [];
  partie.players.forEach(p => { par[p.id] = []; cum[p.id] = []; });
  const courant = {};
  partie.players.forEach(p => { courant[p.id] = 0; });

  partie.rounds.forEach((manche, ri) => {
    if (!manche.locked) return;
    idx.push(ri);
    const cartes = cartesOracle(partie.cfg, partie.players.length, ri);
    for (const p of partie.players) {
      const annonce = manche.bids[p.id], plis = manche.tricks[p.id];
      const b = manche.bonus[p.id] || {};
      const poches = bonusOracle(b, partie.cfg);
      const s = (annonce == null || plis == null)
        ? { base: 0, bonus: 0, adj: 0, bet: 0, total: 0, exact: false, diff: 0 }
        : scoreOracle(annonce, plis, cartes, poches.cond, partie.cfg, poches.free, b.wager);
      courant[p.id] += s.total;
      par[p.id].push(s);
      cum[p.id].push(courant[p.id]);
    }
  });

  const tot = partie.players
    .map(p => ({ id: p.id, name: p.name, total: courant[p.id] }))
    .sort((a, b) => b.total - a.total);
  return { par, cum, idx, tot, jouees: idx.length };
}

export function resultatOracle(partie) {
  if (partie.manual) {
    const tot = partie.players
      .map(p => ({ id: p.id, name: p.name, total: (partie.finals || {})[p.id] || 0 }))
      .sort((a, b) => b.total - a.total);
    return { tot, manual: true, deroule: null };
  }
  const d = derouleOracle(partie);
  return { tot: d.tot, manual: false, deroule: d };
}

/* Rangs partages : autant de joueurs strictement devant, plus un. */
export const rangsOracle = tot => tot.map(t => 1 + tot.filter(x => x.total > t.total).length);

function fiche() {
  return {
    games: 0, wins: 0, podiums: 0, sum: 0, best: null, worst: null,
    rounds: 0, exact: 0, zeroTry: 0, zeroOk: 0, bestRound: null, bonus: 0, skByM: 0,
    streak: 0, margin: 0, detailed: 0, powers: 0, pir: {}, wagerNet: 0, wagerCount: 0, avg: 0
  };
}

/* Statistiques agregees. Les series de victoires sont comptees par balayage
   des parties du joueur dans l'ordre du temps, plutot que par accumulateur. */
export function statsOracle(parties) {
  const S = {}, H = {};
  const prendre = id => S[id] || (S[id] = fiche());
  const ordre = parties.slice().sort((a, b) => (a.date || 0) - (b.date || 0));
  const victoires = {};   // suite de victoires par joueur, dans l'ordre

  for (const g of ordre) {
    const res = resultatOracle(g);
    if (!res.tot.length) continue;
    const tete = res.tot[0].total;
    const rangs = rangsOracle(res.tot);

    res.tot.forEach((t, i) => {
      const s = prendre(t.id);
      s.games++;
      s.sum += t.total;
      s.best = s.best == null ? t.total : Math.max(s.best, t.total);
      s.worst = s.worst == null ? t.total : Math.min(s.worst, t.total);
      if (rangs[i] <= 3) s.podiums++;
      const gagne = t.total === tete;
      (victoires[t.id] = victoires[t.id] || []).push(gagne);
      if (gagne) {
        s.wins++;
        const second = res.tot[1] ? res.tot[1].total : null;
        if (second != null) s.margin = Math.max(s.margin, t.total - second);
      }
      for (const u of res.tot) {
        if (u.id === t.id) continue;
        const k = t.id + '|' + u.id;
        H[k] = H[k] || { w: 0, n: 0 };
        H[k].n++;
        if (t.total > u.total) H[k].w++;
      }
    });

    if (!res.manual) {
      for (const p of g.players) {
        const s = prendre(p.id);
        s.detailed++;
        (g.rounds || []).forEach(manche => {
          if (!manche.locked) return;
          const annonce = manche.bids[p.id] || 0;
          const plis = manche.tricks[p.id] || 0;
          const b = manche.bonus[p.id] || {};
          s.rounds++;
          if (annonce === plis) s.exact++;
          if (annonce === 0) { s.zeroTry++; if (plis === 0) s.zeroOk++; }
          const poches = bonusOracle(b, g.cfg);
          s.bonus += poches.cond + poches.free;
          s.skByM += b.skByM || 0;
          for (const k of b.pir || []) { s.powers++; s.pir[k] = (s.pir[k] || 0) + 1; }
          if (b.wager) { s.wagerCount++; s.wagerNet += (annonce === plis ? b.wager : -b.wager); }
        });
        for (const x of (res.deroule.par[p.id] || [])) {
          s.bestRound = s.bestRound == null ? x.total : Math.max(s.bestRound, x.total);
        }
      }
    }
  }

  for (const [id, s] of Object.entries(S)) {
    s.avg = s.games ? Math.round(s.sum / s.games) : 0;
    /* Plus longue suite de victoires consecutives. */
    let plus = 0, courante = 0;
    for (const gagne of victoires[id] || []) {
      courante = gagne ? courante + 1 : 0;
      if (courante > plus) plus = courante;
    }
    s.streak = plus;
  }
  return { S, H };
}

/* Classement du hall of fame : victoires, puis moyenne, puis parties. */
export function hofOracle(stats, noms) {
  return Object.keys(stats)
    .map(id => ({ id, name: noms[id] || '?', ...stats[id] }))
    .sort((a, b) => b.wins - a.wins || b.avg - a.avg || b.games - a.games)
    .map(x => x.id);
}

/* Perimetre : bareme, nombre de joueurs, anciennete en mois. */
export function filtreOracle(parties, f) {
  return parties.filter(g => {
    const bareme = g.cfg ? g.cfg.scoring : 'classic';
    if (f.scoring && f.scoring !== 'all' && bareme !== f.scoring) return false;
    if (f.size && f.size !== 'all') {
      const n = g.players.length;
      if (f.size === '2-3' && n > 3) return false;
      if (f.size === '4-5' && (n < 4 || n > 5)) return false;
      if (f.size === '6+' && n < 6) return false;
    }
    if (f.months && f.months !== 'all' && f.now) {
      const age = f.now - (g.date || 0);
      if (age > f.months * 30.44 * 864e5) return false;
      if (age < -864e5) return false;
    }
    return true;
  });
}
