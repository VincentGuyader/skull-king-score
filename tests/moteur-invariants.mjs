import fc from 'fast-check';
import { CLASSIQUE, MITRAILLE, BOULET } from './moteur.mjs';

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

const partieAleatoire = fc.integer({ min: 2, max: 8 }).chain(n => fc.record({
  joueurs: fc.constant(Array.from({ length: n }, (_, i) => ({ id: 'j' + i, name: 'J' + i }))),
  manches: fc.array(fc.record({
    bids: fc.array(annonce, { minLength: n, maxLength: n }),
    tricks: fc.array(plis, { minLength: n, maxLength: n }),
    locked: fc.boolean()
  }), { minLength: 1, maxLength: 10 }),
  cfg: bareme
})).map(({ joueurs, manches, cfg }) => ({
  id: 'g', date: 1700000000000, cfg: { ...cfg, rounds: manches.length },
  players: joueurs,
  rounds: manches.map(m => ({
    bids: Object.fromEntries(joueurs.map((p, i) => [p.id, m.bids[i]])),
    tricks: Object.fromEntries(joueurs.map((p, i) => [p.id, m.tricks[i]])),
    bonus: {}, locked: m.locked
  }))
}));

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
  const R = { numRuns: opts.runs || 3000 };
  const P = { numRuns: Math.max(40, Math.round((opts.runs || 3000) / 4)) };

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
      }), { numRuns: Math.max(20, P.numRuns / 3) });
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
      }), { numRuns: Math.max(20, P.numRuns / 3) });
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
