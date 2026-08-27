import { test, expect } from '@playwright/test';
import { boot, player } from './helpers.mjs';

/* La section « A propos » de l'aide-memoire renvoie au depot GitHub de
   l'application, dans chaque langue, par un lien qui s'ouvre a part. */

const ANNE = player('jA', 'Anne', { color: '#3987e5', icon: '☠️' });
const DEPOT = 'https://github.com/VincentGuyader/skull-king-score';

for (const lang of ['fr', 'en', 'de', 'es']) {
  test(`le lien vers le depot est present en ${lang}`, async ({ page }) => {
    await boot(page, { roster: [ANNE], lang });
    await page.evaluate(() => go('help'));
    await page.locator('details.about summary').click();
    const lien = page.locator('details.about a[href^="https://github.com/"]');
    await expect(lien, 'un lien vers le depot').toHaveCount(1);
    expect(await lien.getAttribute('href')).toBe(DEPOT);
    expect(await lien.getAttribute('target'), 'ouvert a part').toBe('_blank');
    expect(await lien.getAttribute('rel'), 'sans fuite de contexte').toContain('noopener');
    expect((await lien.textContent()).trim().length, 'un libelle lisible').toBeGreaterThan(3);
  });
}
