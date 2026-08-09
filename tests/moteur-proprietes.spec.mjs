import { test, expect } from '@playwright/test';
import { chargerMoteur } from './moteur.mjs';
import { invariants } from './moteur-invariants.mjs';

/* Verification par proprietes. Au lieu de cas choisis a la main, des milliers
   de tirages confrontes a des regles qui doivent tenir quoi qu'il arrive.
   Les regles vivent dans moteur-invariants.mjs, partagees avec le harnais de
   mutation : ce que la CI verifie est exactement ce que la mutation mesure. */

const M = chargerMoteur();
const runs = Number(process.env.FC_RUNS || 3000);

for (const [nom, verifier] of invariants(M, { runs })) {
  test(nom, () => { verifier(); });
}

/* Defaut connu, en attente d'arbitrage sur les teintes. L'application avertit
   le joueur quand deux couleurs sont a moins de 15 d'ecart perceptuel, mais sa
   propre palette compte 7 paires sous ce seuil sur 28, la pire a 7,1 entre le
   orange de la serie 2 et le rouge de la serie 8. A sept ou huit joueurs,
   l'application se plaint donc de couleurs qu'elle a elle-meme distribuees, et
   deux courbes deviennent difficiles a suivre. */
test.fixme('les couleurs de serie tiennent le seuil impose aux joueurs', () => {
  for (let i = 0; i < M.SERIES_HEX.length; i++) {
    for (let j = i + 1; j < M.SERIES_HEX.length; j++) {
      expect(M.deltaE(M.SERIES_HEX[i], M.SERIES_HEX[j]),
        `${M.SERIES_HEX[i]} contre ${M.SERIES_HEX[j]}`).toBeGreaterThanOrEqual(15);
    }
  }
});
