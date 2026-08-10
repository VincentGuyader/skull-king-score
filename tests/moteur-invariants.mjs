import fc from 'fast-check';
import { CLASSIQUE, MITRAILLE, BOULET } from './moteur.mjs';
import {
  bonusOracle, capaciteOracle, cartesOracle, paquetOracle, scoreOracle,
  derouleOracle, resultatOracle, rangsOracle, statsOracle, hofOracle, filtreOracle
} from './moteur-oracle.mjs';

/* Trois mutations du moteur resistent a cette suite, et c'est normal : elles
   ne changent rien au comportement. Verifie par enumeration exhaustive.

   Math.round(pot/2) contre Math.floor : la branche du pli d'ecart n'existe
   qu'en Mitraille, ou le potentiel vaut 10 par carte, donc toujours pair.

   !r.manual && r.st contre || : une partie manuelle n'a pas de deroule, une
   partie detaillee en a toujours un. Les deux ecritures selectionnent le
   meme ensemble.

   f.size && f.size!=='all' contre || : entrer dans le bloc avec une valeur
   vide ou 'all' ne declenche aucune des trois comparaisons qui suivent.

   cfg && Array.isArray(cfg.seq) && cfg.seq.length contre || : quand la garde
   interieure rejette deja toute valeur qui n'est pas un nombre de cartes
   plausible, entrer avec une sequence illisible retombe sur la progression
   officielle par le meme chemin.

   Toutes les autres mutations du coeur du calcul sont attrapees. */

/* Les regles qui doivent tenir quoi qu'il arrive, decrites une seule fois.
   La suite Playwright en fait un test chacune ; le harnais de mutation les
   rejoue en memoire sur un moteur volontairement abime, pour mesurer ce que
   ces regles attrapent vraiment. */

const annonce = fc.integer({ min: 0, max: 20 });
const plis = fc.integer({ min: 0, max: 20 });
const cartes = fc.integer({ min: 1, max: 15 });
const bonus = fc.integer({ min: 0, max: 300 });
const ajust = fc.integer({ min: -200, max: 200 });
const pari = fc.constantFrom(0, 10, 20);
const bareme = fc.constantFrom(CLASSIQUE, MITRAILLE, BOULET);

function vrai(condition, message) {
  if (!condition) throw new Error(message);
}
const eq = (a, b, quoi) => vrai(a === b, `${quoi} : ${a} au lieu de ${b}`);

const PIRATES_CLES = ['rosie', 'bendt', 'rascal', 'juanita', 'harry'];

const regleMaison = fc.record({
  id: fc.constantFrom('cA', 'cB', 'cC'),
  name: fc.constant('maison'),
  pts: fc.integer({ min: -60, max: 60 }),
  max: fc.integer({ min: 1, max: 3 }),
  tricks: fc.integer({ min: 0, max: 2 }),
  cond: fc.constantFrom('bid', 'always')
});

/* Une feuille de bonus complete : compteurs officiels, ajustement libre,
   pouvoirs de pirates, pari du Rascal, et compteurs de regles maison. */
const feuilleBonus = regles => fc.record({
  c14: fc.integer({ min: 0, max: 3 }), b14: fc.integer({ min: 0, max: 1 }),
  mByP: fc.integer({ min: 0, max: 2 }), pBySK: fc.integer({ min: 0, max: 5 }),
  skByM: fc.integer({ min: 0, max: 1 }), loot: fc.integer({ min: 0, max: 2 }),
  free: fc.integer({ min: -80, max: 80 }),
  wager: fc.constantFrom(0, 0, 10, 20),
  pir: fc.subarray(PIRATES_CLES),
  extras: fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 3, maxLength: 3 })
}).map(b => {
  const sortie = { ...b };
  delete sortie.extras;
  regles.forEach((c, i) => { if (b.extras[i % 3]) sortie['x' + c.id] = b.extras[i % 3]; });
  return sortie;
});

/* Une partie sur deux suit une sequence de distribution : sans cela, la
   variante « Attaque eclair » et ses cousines ne seraient jamais parcourues. */
const partieDetaillee = fc.tuple(
  fc.integer({ min: 2, max: 8 }),
  fc.uniqueArray(regleMaison, { minLength: 0, maxLength: 2, selector: c => c.id }),
  bareme,
  fc.option(fc.array(fc.integer({ min: 1, max: 12 }), { minLength: 1, maxLength: 10 }), { nil: null })
).chain(([n, regles, cfg, seq]) => {
  const joueurs = Array.from({ length: n }, (_, i) => ({ id: 'j' + i, name: 'J' + i }));
  return fc.record({
    date: fc.integer({ min: 1600000000000, max: 1800000000000 }),
    manches: fc.array(fc.record({
      bids: fc.array(annonce, { minLength: n, maxLength: n }),
      tricks: fc.array(plis, { minLength: n, maxLength: n }),
      bonus: fc.array(fc.option(feuilleBonus(regles), { nil: undefined }), { minLength: n, maxLength: n }),
      extra: fc.integer({ min: -2, max: 4 }),
      locked: fc.boolean()
    }), { minLength: 1, maxLength: 8 })
  }).map(({ date, manches }) => ({
    id: 'g', date,
    cfg: { ...cfg, custom: regles, rounds: manches.length, ...(seq ? { seq } : {}) },
    players: joueurs, manual: false,
    rounds: manches.map(m => ({
      bids: Object.fromEntries(joueurs.map((p, i) => [p.id, m.bids[i]])),
      tricks: Object.fromEntries(joueurs.map((p, i) => [p.id, m.tricks[i]])),
      bonus: Object.fromEntries(joueurs.flatMap((p, i) => m.bonus[i] ? [[p.id, m.bonus[i]]] : [])),
      extra: m.extra, locked: m.locked
    }))
  }));
});

/* Partie saisie a la main : que des scores finaux, aucune manche. */
const partieManuelle = fc.integer({ min: 2, max: 6 }).chain(n => fc.record({
  date: fc.integer({ min: 1600000000000, max: 1800000000000 }),
  finals: fc.array(fc.integer({ min: -300, max: 600 }), { minLength: n, maxLength: n })
}).map(({ date, finals }) => {
  const joueurs = Array.from({ length: n }, (_, i) => ({ id: 'j' + i, name: 'J' + i }));
  return {
    id: 'g', date, cfg: { ...CLASSIQUE, custom: [] }, players: joueurs,
    rounds: [], manual: true,
    finals: Object.fromEntries(joueurs.map((p, i) => [p.id, finals[i]]))
  };
}));

const partieAleatoire = fc.oneof({ weight: 4, arbitrary: partieDetaillee },
                                  { weight: 1, arbitrary: partieManuelle });

/* Compare deux objets champ a champ, en nommant le premier ecart. */
function memeObjet(a, b, quoi) {
  const ja = JSON.stringify(a, Object.keys(a || {}).sort());
  const jb = JSON.stringify(b, Object.keys(b || {}).sort());
  if (ja !== jb) {
    const cles = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of cles) {
      const va = JSON.stringify((a || {})[k]), vb = JSON.stringify((b || {})[k]);
      if (va !== vb) throw new Error(`${quoi} : ${k} vaut ${va} au lieu de ${vb}`);
    }
    throw new Error(`${quoi} : ${ja} au lieu de ${jb}`);
  }
}

/* Cas de reference tires des regles officielles. */
const REFERENCE = [
  ['manche 5, annonce 2, 2 plis', CLASSIQUE, 2, 2, 5, 0, 0, 0, 40],
  ['manche 5, annonce 2, 3 plis', CLASSIQUE, 2, 3, 5, 0, 0, 0, -10],
  ['manche 5, annonce 4, 2 plis', CLASSIQUE, 4, 2, 5, 0, 0, 0, -20],
  ['manche 7, annonce 0, 0 pli', CLASSIQUE, 0, 0, 7, 0, 0, 0, 70],
  ['manche 7, annonce 0, 1 pli', CLASSIQUE, 0, 1, 7, 0, 0, 0, -70],
  ['manche 7, annonce 0, 3 plis', CLASSIQUE, 0, 3, 7, 0, 0, 0, -70],
  ['Mitraille 6 cartes 3/3 +20', MITRAILLE, 3, 3, 6, 20, 0, 0, 80],
  ['Mitraille 6 cartes 3/4 +20', MITRAILLE, 3, 4, 6, 20, 0, 0, 40],
  ['Mitraille 6 cartes 3/5', MITRAILLE, 3, 5, 6, 0, 0, 0, 0],
  ['Boulet 6 cartes 2/2 +20', BOULET, 2, 2, 6, 20, 0, 0, 110],
  ['Boulet 6 cartes 2/3', BOULET, 2, 3, 6, 0, 0, 0, 0],
  ['annonce 1 ratee, 30 de bonus', CLASSIQUE, 1, 0, 5, 30, 0, 0, -10],
  ['annonce 1 juste, 35 de bonus, -10', CLASSIQUE, 1, 1, 5, 35, -10, 0, 45],
  ['annonce 1 ratee, 35 de bonus, -10', CLASSIQUE, 1, 0, 5, 35, -10, 0, -20],
  ['pari 20 gagne', CLASSIQUE, 2, 2, 5, 0, 0, 20, 60],
  ['pari 20 perdu', CLASSIQUE, 2, 3, 5, 0, 0, 20, -30]
];

export function invariants(M, opts = {}) {
  /* endOnFailure coupe la reduction de contre-exemple : precieuse pour lire
     un echec, ruineuse quand le harnais de mutation tue des centaines de
     mutants a la chaine. */
  const fin = opts.endOnFailure ? { endOnFailure: true } : {};
  const R = { numRuns: opts.runs || 3000, ...fin };
  const P = { numRuns: Math.max(40, Math.round((opts.runs || 3000) / 4)), ...fin };

  return [
    ['les cas de reference du bareme', () => {
      for (const [nom, cfg, b, t, c, bp, adj, w, attendu] of REFERENCE) {
        eq(M.scoreRound(b, t, c, bp, cfg, adj, w).total, attendu, nom);
      }
    }],

    ['le total est la somme de ses parties', () => {
      fc.assert(fc.property(annonce, plis, cartes, bonus, bareme, ajust, pari, (b, t, c, bp, cfg, adj, w) => {
        const r = M.scoreRound(b, t, c, bp, cfg, adj, w);
        eq(r.total, r.base + r.bonus + r.adj + r.bet, 'total');
        for (const k of ['base', 'bonus', 'adj', 'bet', 'total']) vrai(Number.isFinite(r[k]), k + ' fini');
      }), R);
    }],

    ['le Rascal ne descend pas sous zero', () => {
      fc.assert(fc.property(annonce, plis, cartes, bonus, fc.constantFrom(MITRAILLE, BOULET), (b, t, c, bp, cfg) => {
        const r = M.scoreRound(b, t, c, bp, cfg, 0, 0);
        vrai(r.base >= 0, 'base ' + r.base);
        vrai(r.bonus >= 0, 'bonus ' + r.bonus);
      }), R);
    }],

    ['une annonce a zero ratee coute dix par carte', () => {
      fc.assert(fc.property(fc.integer({ min: 1, max: 20 }), cartes, bonus, ajust, (t, c, bp, adj) => {
        eq(M.scoreRound(0, t, c, bp, CLASSIQUE, adj, 0).base, -10 * c, 'annonce a zero ratee');
      }), R);
    }],

    ['annonce tenue vingt par pli, ratee dix par ecart', () => {
      fc.assert(fc.property(fc.integer({ min: 1, max: 20 }), plis, cartes, (b, t, c) => {
        eq(M.scoreRound(b, t, c, 0, CLASSIQUE, 0, 0).base,
          b === t ? 20 * t : -10 * Math.abs(b - t), 'base classique');
      }), R);
    }],

    ['le pari est gagne ou perdu en entier', () => {
      fc.assert(fc.property(annonce, plis, cartes, bonus, bareme, pari, (b, t, c, bp, cfg, w) => {
        eq(M.scoreRound(b, t, c, bp, cfg, 0, w).bet, w === 0 ? 0 : (b === t ? w : -w), 'pari');
      }), R);
    }],

    ['l ajustement libre traverse sans etre touche', () => {
      fc.assert(fc.property(annonce, plis, cartes, bonus, bareme, ajust, (b, t, c, bp, cfg, adj) => {
        eq(M.scoreRound(b, t, c, bp, cfg, adj, 0).adj, adj, 'ajustement');
      }), R);
    }],

    ['en Mitraille, un pli d ecart vaut la moitie', () => {
      fc.assert(fc.property(fc.integer({ min: 1, max: 19 }), cartes, bonus, (b, c, bp) => {
        const plein = M.scoreRound(b, b, c, bp, MITRAILLE, 0, 0);
        const proche = M.scoreRound(b, b + 1, c, bp, MITRAILLE, 0, 0);
        eq(proche.base, Math.round(plein.base / 2), 'base a un pli');
        eq(proche.bonus, Math.round(plein.bonus / 2), 'bonus a un pli');
      }), R);
    }],

    ['les bonus suivent l option annonce juste', () => {
      fc.assert(fc.property(annonce, plis, cartes, bonus, (b, t, c, bp) => {
        eq(M.scoreRound(b, t, c, bp, CLASSIQUE, 0, 0).bonus, b === t ? bp : 0, 'bonus conditionnes');
        eq(M.scoreRound(b, t, c, bp, { ...CLASSIQUE, bonusIfExact: false }, 0, 0).bonus, bp, 'bonus libres');
      }), R);
    }],

    ['les deux poches de bonus se recomposent', () => {
      const compteurs = fc.record({
        c14: fc.integer({ min: 0, max: 3 }), b14: fc.integer({ min: 0, max: 1 }),
        mByP: fc.integer({ min: 0, max: 2 }), pBySK: fc.integer({ min: 0, max: 5 }),
        skByM: fc.integer({ min: 0, max: 1 }), loot: fc.integer({ min: 0, max: 2 }), free: ajust
      });
      fc.assert(fc.property(compteurs, b => {
        const s = M.bonusSplit(b, CLASSIQUE);
        eq(s.cond + s.free, M.bonusPoints(b, CLASSIQUE), 'somme des poches');
        eq(s.free, b.free, 'poche libre');
      }), R);
    }],

    ['le plafond de cartes tient dans le paquet', () => {
      fc.assert(fc.property(fc.integer({ min: 2, max: 8 }), fc.integer({ min: 0, max: 14 }),
        fc.record({ loot: fc.boolean(), kraken: fc.boolean(), whale: fc.boolean() }), (n, ri, cfg) => {
          const c = M.cardsForRound(cfg, n, ri);
          vrai(c >= 1 && c <= ri + 1, 'cartes ' + c);
          vrai(c * n <= M.deckSize(cfg), 'paquet dépassé');
        }), R);
    }],

    ['le cumul est la somme des manches', () => {
      fc.assert(fc.property(partieAleatoire, g => {
        const st = M.standings(g);
        for (const p of g.players) {
          const somme = st.per[p.id].reduce((s, x) => s + x.total, 0);
          eq(st.cum[p.id].length ? st.cum[p.id][st.cum[p.id].length - 1] : 0, somme, 'cumul');
          eq(st.per[p.id].length, st.played, 'manches empilees');
        }
        eq(st.idx.length, st.played, 'indices');
        vrai(st.idx.every((v, i) => i === 0 || v > st.idx[i - 1]), 'indices croissants');
      }), P);
    }],

    ['le classement est trie et les rangs suivent', () => {
      fc.assert(fc.property(partieAleatoire, g => {
        const st = M.standings(g), rk = M.ranks(st.tot);
        eq(rk[0], 1, 'premier rang');
        for (let i = 1; i < st.tot.length; i++) {
          vrai(st.tot[i - 1].total >= st.tot[i].total, 'tri');
          if (st.tot[i - 1].total === st.tot[i].total) eq(rk[i], rk[i - 1], 'rang partage');
          else vrai(rk[i] > rk[i - 1], 'rang qui progresse');
        }
        vrai(M.leaders(st.tot).length >= 1, 'au moins un joueur en tete');
      }), P);
    }],

    ['aucune statistique ne depasse son plafond', () => {
      fc.assert(fc.property(fc.array(partieAleatoire, { minLength: 1, maxLength: 6 }), parties => {
        const { S, H } = M.computeStats(parties);
        for (const [id, s] of Object.entries(S)) {
          vrai(s.wins <= s.games, id + ' victoires');
          vrai(s.podiums <= s.games, id + ' podiums');
          vrai(s.exact <= s.rounds, id + ' annonces justes');
          vrai(s.zeroOk <= s.zeroTry, id + ' zero reussies');
          vrai(s.zeroTry <= s.rounds, id + ' zero tentees');
          vrai(s.streak <= s.wins, id + ' serie');
          vrai(s.margin >= 0, id + ' ecart');
          vrai(Number.isFinite(s.avg), id + ' moyenne');
        }
        for (const [k, d] of Object.entries(H)) vrai(d.w <= d.n, 'face a face ' + k);
      }), { numRuns: Math.max(20, P.numRuns / 3), ...fin });
    }],

    ['le face a face se lit dans les deux sens', () => {
      fc.assert(fc.property(fc.array(partieAleatoire, { minLength: 1, maxLength: 5 }), parties => {
        const { H } = M.computeStats(parties);
        for (const cle of Object.keys(H)) {
          const [a, b] = cle.split('|');
          const inv = H[b + '|' + a];
          vrai(!!inv, cle + ' sans miroir');
          eq(inv.n, H[cle].n, 'rencontres');
          vrai(H[cle].w + inv.w <= H[cle].n, 'avantages');
        }
      }), { numRuns: Math.max(20, P.numRuns / 3), ...fin });
    }],

    ['les filtres de perimetre gardent ce qu ils doivent', () => {
      fc.assert(fc.property(fc.array(partieAleatoire, { minLength: 0, maxLength: 8 }), parties => {
        const now = 1700000000000;
        eq(M.filterGames(parties, { scoring: 'all', size: 'all', months: 'all', now }).length,
          parties.length, 'sans filtre');
        for (const taille of ['2-3', '4-5', '6+']) {
          const gardees = M.filterGames(parties, { size: taille, months: 'all', now });
          for (const g of gardees) {
            const n = g.players.length;
            const dedans = taille === '2-3' ? n <= 3 : taille === '4-5' ? (n >= 4 && n <= 5) : n >= 6;
            vrai(dedans, `filtre ${taille} laisse passer ${n} joueurs`);
          }
          const rejetees = parties.filter(g => !gardees.includes(g));
          for (const g of rejetees) {
            const n = g.players.length;
            const dedans = taille === '2-3' ? n <= 3 : taille === '4-5' ? (n >= 4 && n <= 5) : n >= 6;
            vrai(!dedans, `filtre ${taille} rejette a tort ${n} joueurs`);
          }
        }
        for (const bar of ['classic', 'rascal']) {
          for (const g of M.filterGames(parties, { scoring: bar, months: 'all', now })) {
            eq(g.cfg.scoring, bar, 'filtre de bareme');
          }
        }
      }), P);
    }],

    ['le bareme concorde avec le temoin', () => {
      fc.assert(fc.property(annonce, plis, cartes, bonus, bareme, ajust, pari, (b, t, c, bp, cfg, adj, w) => {
        memeObjet(M.scoreRound(b, t, c, bp, cfg, adj, w),
          scoreOracle(b, t, c, bp, cfg, adj, w), 'manche');
      }), R);
    }],

    ['les bonus concordent avec le temoin, regles maison comprises', () => {
      const avecRegles = fc.uniqueArray(fc.record({
        id: fc.constantFrom('cA', 'cB', 'cC'), name: fc.constant('m'),
        pts: fc.integer({ min: -60, max: 60 }), max: fc.integer({ min: 1, max: 3 }),
        tricks: fc.integer({ min: 0, max: 2 }), cond: fc.constantFrom('bid', 'always')
      }), { minLength: 0, maxLength: 3, selector: c => c.id });
      fc.assert(fc.property(avecRegles, regles => {
        const cfg = { ...CLASSIQUE, custom: regles };
        const b = { c14: 2, b14: 1, mByP: 1, pBySK: 3, skByM: 1, loot: 2, free: -25 };
        regles.forEach((c, i) => { b['x' + c.id] = i + 1; });
        memeObjet(M.bonusSplit(b, cfg), bonusOracle(b, cfg), 'poches de bonus');
        eq(M.bonusPoints(b, cfg), bonusOracle(b, cfg).cond + bonusOracle(b, cfg).free, 'total des bonus');
      }), R);
    }],

    ['le paquet et les cartes distribuees concordent', () => {
      fc.assert(fc.property(fc.integer({ min: 2, max: 8 }), fc.integer({ min: 0, max: 14 }),
        fc.record({ loot: fc.boolean(), kraken: fc.boolean(), whale: fc.boolean() }), (n, ri, cfg) => {
          eq(M.deckSize(cfg), paquetOracle(cfg), 'taille du paquet');
          eq(M.cardsForRound(cfg, n, ri), cartesOracle(cfg, n, ri), 'cartes distribuees');
        }), R);
    }],

    ['la sequence de distribution concorde avec le temoin', () => {
      fc.assert(fc.property(
        fc.array(fc.integer({ min: 1, max: 14 }), { minLength: 1, maxLength: 12 }),
        fc.integer({ min: 2, max: 8 }), fc.integer({ min: 0, max: 14 }),
        (seq, n, ri) => {
          const cfg = { loot: true, kraken: true, whale: true, seq };
          eq(M.cardsForRound(cfg, n, ri), cartesOracle(cfg, n, ri), 'cartes selon la sequence');
          vrai(M.cardsForRound(cfg, n, ri) >= 1, 'jamais zero carte');
          vrai(M.cardsForRound(cfg, n, ri) <= M.maxCards(cfg, n), 'jamais plus que le paquet');
        }), R);
      /* Une sequence d'un autre type, venue d'une sauvegarde abimee ou d'une
         version future, doit ramener a la progression officielle et non a des
         manches sans cartes. */
      for (const seq of ['oui', 7, {}, true, [], [null, 2], ['a'],
                         [0, 3], [-2, 4], [2.5, 6], [Infinity], [NaN, 3]]) {
        const cfg = { loot: true, kraken: true, whale: true, seq };
        for (const ri of [0, 1, 4, 9]) {
          const c = M.cardsForRound(cfg, 4, ri);
          vrai(Number.isInteger(c) && c >= 1, 'sequence ' + JSON.stringify(seq) + ' donne ' + c);
          eq(c, cartesOracle(cfg, 4, ri), 'sequence ' + JSON.stringify(seq) + ', manche ' + (ri + 1));
        }
      }
      /* Les six suggestions du livret 2022, page 27. */
      const livret = {
        noodd: [2, 2, 4, 4, 6, 6, 8, 8, 10, 10], ready: [6, 7, 8, 9, 10],
        flash: [5, 5, 5, 5, 5], barrage: Array(10).fill(10),
        whirl: [9, 9, 7, 7, 5, 5, 3, 3, 1, 1], bedtime: [1]
      };
      for (const [nom, seq] of Object.entries(livret)) {
        const cfg = { loot: true, kraken: true, whale: true, seq };
        seq.forEach((attendu, i) => {
          eq(M.cardsForRound(cfg, 4, i), Math.min(attendu, M.maxCards(cfg, 4)), nom + ', manche ' + (i + 1));
        });
      }
    }],

    ['la capacite de la manche concorde avec le temoin', () => {
      fc.assert(fc.property(partieDetaillee, g => {
        g.rounds.forEach((_, ri) => {
          memeObjet(M.roundCapacity(g, ri), capaciteOracle(g, ri), 'capacite manche ' + (ri + 1));
        });
      }), P);
    }],

    ['le deroule complet concorde avec le temoin', () => {
      fc.assert(fc.property(partieDetaillee, g => {
        const st = M.standings(g), t = derouleOracle(g);
        eq(st.played, t.jouees, 'manches jouees');
        eq(JSON.stringify(st.idx), JSON.stringify(t.idx), 'indices des manches');
        for (const p of g.players) {
          eq(JSON.stringify(st.cum[p.id]), JSON.stringify(t.cum[p.id]), 'cumul de ' + p.id);
          st.per[p.id].forEach((x, i) => memeObjet(x, t.par[p.id][i], `manche ${i + 1} de ${p.id}`));
        }
        eq(JSON.stringify(st.tot.map(x => [x.p.id, x.total])),
           JSON.stringify(t.tot.map(x => [x.id, x.total])), 'classement');
      }), P);
    }],

    ['le resultat d une partie concorde, manuelle comprise', () => {
      fc.assert(fc.property(partieAleatoire, g => {
        const r = M.gameResult(g), t = resultatOracle(g);
        eq(r.manual, t.manual, 'nature de la partie');
        eq(JSON.stringify(r.tot.map(x => [x.id, x.total])),
           JSON.stringify(t.tot.map(x => [x.id, x.total])), 'classement');
      }), P);
    }],

    ['les rangs concordent avec le temoin', () => {
      fc.assert(fc.property(partieAleatoire, g => {
        const tot = M.gameResult(g).tot;
        eq(JSON.stringify(M.ranks(tot)), JSON.stringify(rangsOracle(tot)), 'rangs');
        eq(JSON.stringify(M.leaders(tot).map(x => x.id)),
           JSON.stringify(tot.filter(x => x.total === tot[0].total).map(x => x.id)), 'joueurs en tete');
      }), P);
    }],

    ['toutes les statistiques concordent avec le temoin', () => {
      fc.assert(fc.property(fc.array(partieAleatoire, { minLength: 1, maxLength: 6 }), parties => {
        const parties2 = parties.map((g, i) => ({ ...g, id: 'g' + i }));
        const a = M.computeStats(parties2), b = statsOracle(parties2);
        eq(JSON.stringify(Object.keys(a.S).sort()), JSON.stringify(Object.keys(b.S).sort()), 'joueurs');
        for (const id of Object.keys(b.S)) memeObjet(a.S[id], b.S[id], 'fiche de ' + id);
        eq(JSON.stringify(Object.keys(a.H).sort()), JSON.stringify(Object.keys(b.H).sort()), 'rencontres');
        for (const k of Object.keys(b.H)) memeObjet(a.H[k], b.H[k], 'face a face ' + k);
      }), { numRuns: Math.max(30, P.numRuns / 2), ...fin });
    }],

    ['le classement du hall of fame concorde avec le temoin', () => {
      fc.assert(fc.property(fc.array(partieAleatoire, { minLength: 1, maxLength: 6 }), parties => {
        const parties2 = parties.map((g, i) => ({ ...g, id: 'g' + i }));
        const { S } = M.computeStats(parties2);
        const noms = Object.fromEntries(Object.keys(S).map(id => [id, id]));
        eq(JSON.stringify(M.hofRank(S, noms).map(x => x.id)),
           JSON.stringify(hofOracle(S, noms)), 'ordre du classement');
      }), { numRuns: Math.max(30, P.numRuns / 2), ...fin });
    }],

    ['le perimetre concorde avec le temoin, periodes comprises', () => {
      const filtre = fc.record({
        scoring: fc.constantFrom('all', 'classic', 'rascal'),
        size: fc.constantFrom('all', '2-3', '4-5', '6+'),
        months: fc.constantFrom('all', 1, 3, 12, 36)
      });
      fc.assert(fc.property(fc.array(partieAleatoire, { minLength: 0, maxLength: 8 }), filtre,
        fc.integer({ min: 1700000000000, max: 1800000000000 }), (parties, f, now) => {
          const parties2 = parties.map((g, i) => ({ ...g, id: 'g' + i }));
          const args = { ...f, now };
          eq(JSON.stringify(M.filterGames(parties2, args).map(g => g.id)),
             JSON.stringify(filtreOracle(parties2, args).map(g => g.id)),
             `perimetre ${f.scoring}/${f.size}/${f.months}`);
        }), P);
    }],

    ['une manche ou un joueur n a pas d annonce est neutralisee', () => {
      /* Arrive quand une fiche est ajoutee apres le debut d'une partie : la
         manche existe, mais pas la ligne du nouveau venu. */
      const joueurs = [{ id: 'jA', name: 'A' }, { id: 'jB', name: 'B' }];
      const g = {
        id: 'g', date: 1700000000000, cfg: { ...CLASSIQUE, custom: [] }, players: joueurs,
        rounds: [
          { bids: { jA: 1, jB: 0 }, tricks: { jA: 1, jB: 0 }, bonus: {}, locked: true },
          { bids: { jA: 2 }, tricks: { jA: 2 }, bonus: {}, locked: true },
          { bids: { jA: 1, jB: 1 }, tricks: { jB: 1 }, bonus: {}, locked: true }
        ]
      };
      const sc = M.scoreRoundAll(g, 1);
      eq(sc.jB.total, 0, 'joueur sans annonce');
      eq(sc.jB.exact, false, 'et pas compte comme juste');
      vrai(sc.jA.total !== 0, 'le joueur present marque bien');
      const sc2 = M.scoreRoundAll(g, 2);
      eq(sc2.jA.total, 0, 'joueur sans plis');
      const st = M.standings(g), t = derouleOracle(g);
      for (const p of joueurs) {
        eq(JSON.stringify(st.cum[p.id]), JSON.stringify(t.cum[p.id]), 'cumul de ' + p.id);
      }
    }],

    ['le classement du hall of fame supporte un nom manquant', () => {
      const stats = {
        jA: { wins: 2, avg: 30, games: 3 },
        jB: { wins: 2, avg: 40, games: 3 },
        jC: { wins: 0, avg: 10, games: 1 }
      };
      const partiels = { jA: 'Anne' };   // jB et jC n'ont plus de fiche
      const rang = M.hofRank(stats, partiels);
      eq(rang.map(x => x.id).join(','), 'jB,jA,jC', 'ordre');
      /* Troisieme depart : a victoires et moyenne egales, le plus assidu
         passe devant. Sans ce cas, inverser la soustraction ne se voit pas. */
      const exAequo = {
        jX: { wins: 1, avg: 25, games: 2 },
        jY: { wins: 1, avg: 25, games: 9 },
        jZ: { wins: 1, avg: 25, games: 5 }
      };
      eq(M.hofRank(exAequo, {}).map(x => x.id).join(','), 'jY,jZ,jX', 'depart aux parties jouees');
      eq(JSON.stringify(M.hofRank(exAequo, {}).map(x => x.id)),
         JSON.stringify(hofOracle(exAequo, {})), 'concordance sur le troisieme depart');
      eq(rang[0].name, '?', 'nom absent remplace');
      eq(rang.find(x => x.id === 'jA').name, 'Anne', 'nom present conserve');
      eq(JSON.stringify(M.hofRank(stats, partiels).map(x => x.id)),
         JSON.stringify(hofOracle(stats, partiels)), 'concordance avec le temoin');
    }],

    ['les bornes de periode se jouent au jour pres', () => {
      const JOUR = 864e5, now = 1750000000000;
      for (const mois of [1, 3, 12, 36]) {
        const limite = mois * 30.44 * JOUR;
        const cas = [
          ['juste dedans', now - limite + JOUR, true],
          ['juste dehors', now - limite - JOUR, false],
          ['aujourd hui', now, true],
          ['demain', now + JOUR / 2, true],
          ['dans trois jours', now + 3 * JOUR, false]
        ];
        for (const [nom, date, attendu] of cas) {
          const parties = [{ id: 'g', date, cfg: CLASSIQUE, players: [{ id: 'a' }, { id: 'b' }], rounds: [] }];
          const garde = M.filterGames(parties, { months: mois, now }).length === 1;
          vrai(garde === attendu, `${mois} mois, ${nom} : ${garde ? 'gardee' : 'rejetee'}`);
          eq(garde, filtreOracle(parties, { months: mois, now }).length === 1, `temoin, ${mois} mois, ${nom}`);
        }
      }
    }],

    ['en Mitraille, un bonus impair se partage a l arrondi', () => {
      /* Le potentiel est toujours pair, donc seul un bonus impair distingue
         l'arrondi du plancher. Un bonus impair vient des regles maison. */
      for (const bp of [1, 3, 15, 25, 45, 99]) {
        const r = M.scoreRound(3, 4, 6, bp, MITRAILLE, 0, 0);
        eq(r.bonus, Math.round(bp / 2), `bonus ${bp} a un pli d ecart`);
        vrai(r.bonus !== Math.floor(bp / 2) || bp % 2 === 0, `bonus ${bp} arrondi et non tronque`);
      }
      const cfg = { ...MITRAILLE, custom: [{ id: 'cA', name: 'm', pts: 25, max: 2, tricks: 0, cond: 'bid' }] };
      const b = { xcA: 1 };
      const poches = M.bonusSplit(b, cfg);
      eq(poches.cond, 25, 'regle maison impaire');
      eq(M.scoreRound(2, 3, 5, poches.cond, cfg, 0, 0).bonus, 13, '25 partage a un pli donne 13');
    }],

    ['les pouvoirs de pirates sont comptes un par un', () => {
      const joueurs = [{ id: 'jA', name: 'A' }, { id: 'jB', name: 'B' }];
      const manche = (pirA, pirB) => ({
        bids: { jA: 1, jB: 0 }, tricks: { jA: 1, jB: 0 },
        bonus: { jA: { pir: pirA }, jB: { pir: pirB } }, locked: true
      });
      const g = {
        id: 'g', date: 1700000000000, cfg: { ...CLASSIQUE, custom: [] }, players: joueurs,
        rounds: [manche(['rosie', 'harry'], ['rascal']), manche(['rosie'], [])]
      };
      const { S } = M.computeStats([g]);
      eq(S.jA.powers, 3, 'pouvoirs de A');
      eq(S.jA.pir.rosie, 2, 'Rosie deux fois');
      eq(S.jA.pir.harry, 1, 'Harry une fois');
      eq(S.jB.powers, 1, 'pouvoirs de B');
      memeObjet(S.jA.pir, statsOracle([g]).S.jA.pir, 'histogramme de A');
    }],

    ['le temoin lui-meme respecte les cas de reference', () => {
      for (const [nom, cfg, b, t, c, bp, adj, w, attendu] of REFERENCE) {
        eq(scoreOracle(b, t, c, bp, cfg, adj, w).total, attendu, 'temoin, ' + nom);
      }
    }],

    ['les couleurs de serie sont lisibles sur le fond', () => {
      for (const c of M.SERIES_HEX) vrai(M.contrast(c, '#16202b') >= 3, 'contraste de ' + c);
    }],

    ['toute couleur saisie devient lisible', () => {
      fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffff }), n => {
        const hex = '#' + n.toString(16).padStart(6, '0');
        vrai(M.contrast(M.ensureReadable(hex, '#16202b').color, '#16202b') >= 3, 'apres correction de ' + hex);
      }), R);
    }]
  ];
}
