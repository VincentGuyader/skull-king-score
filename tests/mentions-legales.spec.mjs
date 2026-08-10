import { test, expect } from '@playwright/test';
import { boot, watchErrors, player } from './helpers.mjs';

/* La mention de marque vit au bas de l'aide-memoire, dans un bloc replie :
   on la trouve quand on la cherche, elle n'encombre pas la table de jeu. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const BOB = player('jB', 'Bob', { color: '#d95926', icon: '💀' });
const LANGUES = ['fr', 'en', 'de', 'es'];

test('les mentions sont repliees mais presentes sur l aide-memoire', async ({ page }) => {
  const errs = watchErrors(page);
  await boot(page, { roster: [ANNE, BOB] });
  await page.evaluate(() => go('help'));

  const bloc = page.locator('details.about');
  await expect(bloc, 'le bloc existe').toBeVisible();
  expect(await bloc.evaluate(d => d.open), 'replie par defaut').toBe(false);
  await expect(page.locator('details.about p').first(), 'le texte est cache tant qu on n ouvre pas')
    .toBeHidden();
  expect(errs).toEqual([]);
});

test('ouvrir les mentions revele la marque et son detenteur', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB] });
  await page.evaluate(() => go('help'));
  await page.locator('details.about summary').click();

  const texte = await page.locator('details.about').textContent();
  expect(texte, 'le detenteur de la marque').toContain('Grandpa Beck');
  expect(texte, 'le nom du jeu, avec le symbole').toContain('Skull King®');
  expect(texte, 'l absence de lien avec l editeur').toMatch(/indépendante/);
});

test('la mention existe dans les quatre langues', async ({ page }) => {
  for (const lang of LANGUES) {
    await boot(page, { roster: [ANNE, BOB], lang });
    await page.evaluate(() => go('help'));
    await page.locator('details.about summary').click();
    const texte = await page.locator('details.about').textContent();
    expect(texte, `${lang} : detenteur`).toContain('Grandpa Beck');
    expect(texte.length, `${lang} : texte consequent`).toBeGreaterThan(180);
    expect(texte, `${lang} : pas de gabarit non interpole`).not.toContain('${');
  }
});

test('le bloc s ouvre au clavier et porte un intitule', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB] });
  await page.evaluate(() => go('help'));
  const resume = page.locator('details.about summary');
  const intitule = (await resume.textContent()).trim();
  expect(intitule.length, 'un intitule lisible').toBeGreaterThan(3);

  await resume.focus();
  await page.keyboard.press('Enter');
  expect(await page.locator('details.about').evaluate(d => d.open), 'ouvert au clavier').toBe(true);
});

test('la zone tactile du depliant reste confortable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await boot(page, { roster: [ANNE, BOB], lang: 'de' });
  await page.evaluate(() => go('help'));
  const r = await page.locator('details.about summary').boundingBox();
  expect(Math.round(r.height), 'hauteur de la cible').toBeGreaterThanOrEqual(44);

  await page.locator('details.about summary').click();
  const d = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth, vue: document.documentElement.clientWidth
  }));
  expect(d.doc, 'aucun debordement horizontal a 320 px en allemand').toBeLessThanOrEqual(d.vue);
});

test('les mentions n apparaissent pas ailleurs que dans l aide', async ({ page }) => {
  await boot(page, { roster: [ANNE, BOB] });
  for (const vue of ['setup', 'hof', 'roster']) {
    await page.evaluate(v => { goRoot(v); }, vue);
    await expect(page.locator('details.about'), `ecran ${vue}`).toHaveCount(0);
  }
});
