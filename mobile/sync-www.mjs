/* Copie les assets web de la racine du depot vers mobile/www/.
   Le service worker n'est pas embarque : dans un WebView natif, les fichiers
   sont deja locaux et une couche de cache supplementaire ne ferait que
   masquer la version livree avec l'application. */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const www = join(here, 'www');

const SW_BLOCK = /if\('serviceWorker' in navigator[^\n]*\{\n[^\n]*serviceWorker\.register[^\n]*\n\}\n/;

function stripServiceWorker(html) {
  if (!SW_BLOCK.test(html)) {
    throw new Error('sync-www: bloc d\'enregistrement du service worker introuvable dans index.html');
  }
  const out = html.replace(SW_BLOCK, '');
  if (/serviceWorker\.register/.test(out)) {
    throw new Error('sync-www: un appel serviceWorker.register subsiste apres nettoyage');
  }
  return out;
}

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

const html = readFileSync(join(root, 'index.html'), 'utf8');
writeFileSync(join(www, 'index.html'), stripServiceWorker(html));
cpSync(join(root, 'manifest.webmanifest'), join(www, 'manifest.webmanifest'));
cpSync(join(root, 'icons'), join(www, 'icons'), { recursive: true });

for (const f of ['index.html', 'manifest.webmanifest', 'icons/icon-512.png']) {
  if (!existsSync(join(www, f))) {
    throw new Error(`sync-www: fichier manquant apres copie : ${f}`);
  }
}
console.log(`sync-www: ${www} pret (index.html sans service worker, manifest, icons/)`);
