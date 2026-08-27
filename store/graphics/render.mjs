/* Rend feature-graphic.html en PNG 1024x500. Usage : node store/graphics/render.mjs */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await page.goto('file://' + path.join(HERE, 'feature-graphic.html'));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(HERE, 'play-feature-graphic-1024x500.png'), omitBackground: false });
await browser.close();
