import { test, expect } from '@playwright/test';
import { boot, roster, game, round, blank, head, watchErrors } from './helpers.mjs';

/* Issue #51 : depuis les scores, « Manche 8 → » ouvrait la manche suivante
   sans entree d'historique. Le bouton precedent (navigateur, geste Android,
   chevron) ne faisait rien : l'ecran restait sur la manche 8 alors que la
   table en etait encore a la 7. */

const J = roster('Anne', 'Bob');
const jouees = Array.from({ length: 7 }, () => round({ j0: 1, j1: 0 }, { j0: 1, j1: 0 }));
const PARTIE = () => game({ players: J, rounds: [...jouees, blank(), blank(), blank()], cur: 6, phase: 'res' });

test('le bouton precedent ramene de la manche suivante aux scores', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: J, game: PARTIE() });
  expect((await head(page)).view).toBe('scores');
  await expect(page.locator('#next')).toHaveText('Manche 8 →');

  await page.locator('#next').click();
  await expect(page.locator('#hTitle')).toContainText('Manche 8/10');

  await page.goBack();
  await expect(page.locator('#hTitle'), 'retour aux scores, pas manche 8').toHaveText('Scores');
  expect((await head(page)).view).toBe('scores');
  expect((await head(page)).sub).toBe('7/10 manches jouées');
  await expect(page.locator('#next'), 'la manche a reprendre reste la 8').toHaveText('Manche 8 →');
  expect(errs).toEqual([]);
});

test('le chevron de l en tete fait de meme', async ({ page }) => {
  await boot(page, { roster: J, game: PARTIE() });
  await page.locator('#next').click();
  await expect(page.locator('#hBack')).toBeVisible();
  await page.locator('#hBack').click();
  await expect(page.locator('#hTitle')).toHaveText('Scores');
  await expect(page.locator('#hBack'), 'les scores sont la racine').toBeHidden();
});

test('une entree d historique orpheline ne bloque pas le retour', async ({ page }) => {
  /* L'aide puis le menu « Scores » laissent une entree d'historique que la
     pile en memoire ne connait plus : le retour tombait dedans et etait
     ignore. */
  await boot(page, { roster: J, game: PARTIE() });
  await page.evaluate(() => go('help'));
  await page.evaluate(() => goRoot('scores'));
  await page.locator('#next').click();
  await expect(page.locator('#hTitle')).toContainText('Manche 8/10');
  await page.goBack();
  await expect(page.locator('#hTitle')).toHaveText('Scores');
});

test('le libelle de la manche suivante suit la premiere manche non validee', async ({ page }) => {
  /* Manche 3 rouverte et revalidee : cur pointe sur la 3, la suivante a
     reprendre est la 8. */
  await boot(page, { roster: J, game: { ...PARTIE(), cur: 2 } });
  await expect(page.locator('#next')).toHaveText('Manche 8 →');
});
