import { test, expect } from '@playwright/test';
import { boot, roster, game, round, blank, head, watchErrors, tapBar, setCounter } from './helpers.mjs';

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
     reprendre est la 8. Le libelle et la cible doivent dire la meme chose. */
  const errs = watchErrors(page);
  await boot(page, { roster: J, game: { ...PARTIE(), cur: 2 } });
  await expect(page.locator('#next')).toHaveText('Manche 8 →');
  await page.locator('#next').click();
  await expect(page.locator('#hTitle')).toContainText('Manche 8/10');
  expect(errs).toEqual([]);
});

/* Sommes-nous sur l'entree racine de l'historique ? go() marque les
   siennes ; la racine n'a pas de marque. history.length ne dit rien : une
   entree depassee vers l'arriere y reste comptee. */
const racine = page => page.evaluate(() => !(history.state && history.state.sk));

test('valider une manche ne laisse pas d entree d historique orpheline', async ({ page }) => {
  /* Sinon chaque manche validee coute un appui « precedent » pour rien sur
     l'ecran des scores. */
  const errs = watchErrors(page);
  await boot(page, { roster: J, game: PARTIE() });
  await tapBar(page, '#next');
  await expect(page.locator('#hTitle')).toContainText('Manche 8/10');
  expect(await racine(page), 'la manche est empilee').toBe(false);
  await tapBar(page, '#ok');
  await expect(page.locator('#ok')).toHaveText('Valider la manche');
  await tapBar(page, '#ok');
  await expect(page.locator('#hTitle')).toHaveText('Scores');
  await expect(page.locator('#hBack')).toBeHidden();
  await page.waitForTimeout(200);
  expect(await racine(page), 'l historique est revenu a la racine').toBe(true);
  expect(await page.evaluate(() => backStack.length)).toBe(0);
  expect(errs).toEqual([]);
});

test('« revenir aux scores » ne laisse pas d entree orpheline non plus', async ({ page }) => {
  await boot(page, { roster: J, game: PARTIE() });
  await tapBar(page, '#next');
  await tapBar(page, '#backSc');
  await expect(page.locator('#hTitle')).toHaveText('Scores');
  await page.waitForTimeout(200);
  expect(await racine(page)).toBe(true);
});

test('rouvrir une manche depuis les scores empile aussi l ecran', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: J, game: PARTIE() });
  await tapBar(page, '#undoR');
  await expect(page.locator('#hTitle')).toContainText('Manche 7/10');
  await expect(page.locator('#hBack')).toBeVisible();
  await page.locator('#hBack').click();
  await expect(page.locator('#hTitle')).toHaveText('Scores');
  expect(errs).toEqual([]);
});

test('le chevron en phase de resultats ramene aux scores sans perdre les plis', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: J, game: PARTIE() });
  await tapBar(page, '#next');
  await tapBar(page, '#ok');
  await expect(page.locator('#ok')).toHaveText('Valider la manche');
  await setCounter(page, 0, 2);
  await page.locator('#hBack').click();
  await expect(page.locator('#hTitle')).toHaveText('Scores');
  expect(await page.evaluate(() => G.rounds[7].tricks.j0), 'les plis saisis restent').toBe(2);
  await tapBar(page, '#next');
  await expect(page.locator('#hTitle')).toContainText('Manche 8/10');
  expect(errs).toEqual([]);
});
