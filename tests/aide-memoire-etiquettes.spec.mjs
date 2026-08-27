import { test, expect } from '@playwright/test';
import { boot, player, game, blank } from './helpers.mjs';

/* Dans l'aide-memoire, une ligne cle-valeur porte a droite une valeur
   courte : un bareme, un bonus, ou l'etiquette « info » / « compte » d'un
   pirate. Quand la partie gauche est longue (Rosie, Mary Thorne, le Rascal
   sur un ecran etroit), l'etiquette tombait sous le texte, comme une ligne
   de plus. Et la section Extension mettait ses descriptions entieres dans la
   colonne des valeurs, en gras et alignees a droite. */

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

test('la section Extension decrit chaque carte sous son nom, pas dans la colonne des valeurs', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB], game: partie(), lang: 'fr' });
  await page.evaluate(() => go('help'));
  const section = page.locator('#app h2').filter({ hasText: 'Extension' }).locator('xpath=following-sibling::div[1]');
  const lignes = await section.locator('.kv').evaluateAll(l => l.map(kv => ({
    spans: kv.children.length,
    gras: getComputedStyle(kv.querySelector('small') || kv).fontWeight
  })));
  expect(lignes.length, 'dix cartes ou regles').toBe(10);
  for (const l of lignes) {
    expect(l.spans, 'une seule colonne').toBe(1);
    expect(Number(l.gras), 'description en maigre').toBeLessThan(600);
  }
});
