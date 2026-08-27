import { test, expect } from '@playwright/test';
import { boot, player, game, blank } from './helpers.mjs';

/* Dans l'aide-memoire, une ligne cle-valeur porte a droite une valeur
   courte : un bareme, un bonus, ou l'etiquette « info » / « compte » d'un
   pirate. Elle reste sur la ligne du nom, meme quand le nom ou sa
   description est long (Rosie, Mary Thorne, le Rascal sur un ecran etroit).
   Une regle qui tient en une phrase (monstres marins, cartes de l'extension)
   se lit sous son nom, en maigre, sur une seule colonne. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const partie = () => game({
  id: 'gA', players: [ANNE, BOB],
  cfg: { rounds: 10, pirates: true, kraken: true, whale: true, loot: true, ext: true },
  rounds: Array.from({ length: 10 }, blank), cur: 0, phase: 'bid'
});

for (const lang of ['fr', 'en', 'de', 'es']) {
  for (const largeur of [320, 390]) {
    test(`les etiquettes restent sur la ligne du nom a ${largeur} px en ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 900 });
      await boot(page, { roster: [ANNE, BOB], game: partie(), lang });
      await page.evaluate(() => go('help'));
      const tombees = await page.evaluate(() =>
        [...document.querySelectorAll('#app .kv')]
          .filter(kv => kv.children.length === 2)
          .filter(kv => {
            const [nom, val] = kv.children;
            return val.getBoundingClientRect().top > nom.getBoundingClientRect().top + 4;
          })
          .map(kv => kv.children[0].textContent.trim().slice(0, 30)));
      expect(tombees, 'aucune valeur sous son nom').toEqual([]);
    });
  }
}

/* Les cartes se reperent par leur titre ou leur voisinage : la fonction de
   reperage voyage vers la page sous forme de texte. */
const CARTES = {
  'la section Extension': [10, "[...document.querySelectorAll('#app h2')].find(h => h.textContent.includes('Extension')).nextElementSibling"],
  'la carte des monstres': [5, "document.querySelector('#app .hier + div')"]
};
for (const [nom, [attendu, cible]] of Object.entries(CARTES)) {
  test(`${nom} decrit chaque regle sous son nom, sur une seule colonne`, async ({ page }) => {
    await boot(page, { roster: [ANNE, BOB], game: partie(), lang: 'fr' });
    await page.evaluate(() => go('help'));
    const lignes = await page.evaluate(cible => {
      const carte = new Function('return ' + cible)();
      return [...carte.querySelectorAll('.kv')].map(kv => ({
        spans: kv.children.length,
        gras: getComputedStyle(kv.querySelector('small') || kv).fontWeight,
        chiffres: getComputedStyle(kv.firstElementChild).fontVariantNumeric
      }));
    }, cible);
    expect(lignes.length, 'toutes les lignes').toBe(attendu);
    for (const l of lignes) {
      expect(l.spans, 'une seule colonne').toBe(1);
      expect(Number(l.gras), 'description en maigre').toBeLessThan(600);
      expect(l.chiffres, 'pas de chiffres tabulaires sur un nom').toBe('normal');
    }
  });
}
