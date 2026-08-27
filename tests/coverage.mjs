/* Couverture de l'application : lance le serveur instrumente, y fait passer
   la recette Chromium, puis ecrit les rapports dans coverage/ et affiche le
   resume. Un seul moteur suffit : la couverture mesure le code parcouru,
   pas le navigateur.

   Le serveur ordinaire de la recette ne doit pas tourner sur le meme port,
   sinon Playwright le reutiliserait et mesurerait une page non instrumentee. */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(RACINE, 'coverage');
const PORT = 8123;
const URL = `http://127.0.0.1:${PORT}/`;

async function attendre(url, essais = 40) {
  for (let i = 0; i < essais; i++) {
    try { const r = await fetch(url); if (r.ok) return; } catch (e) { /* pas encore pret */ }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('le serveur de couverture ne repond pas sur ' + url);
}

try {
  const r = await fetch(URL);
  if (r.ok) throw new Error(`un serveur tourne deja sur ${URL} : arretez-le avant de mesurer la couverture`);
} catch (e) {
  if (!(e.cause && e.cause.code === 'ECONNREFUSED')) throw e;
}

fs.rmSync(OUT, { recursive: true, force: true });
const serveur = spawn(process.execPath, [path.join(RACINE, 'tests', 'coverage-server.mjs')],
  { env: { ...process.env, PORT: String(PORT), COV_OUT: OUT }, stdio: ['ignore', 'inherit', 'inherit'] });
try {
  await attendre(URL);
  const recette = spawnSync('npx', ['playwright', 'test', '--project=chromium', ...process.argv.slice(2)],
    { cwd: RACINE, stdio: 'inherit', shell: process.platform === 'win32' });
  /* Les derniers envois partent a la fermeture des pages. */
  await new Promise(r => setTimeout(r, 1500));
  const rapport = await (await fetch(URL + '__report')).text();
  console.log('\nCouverture de index.html (recette Chromium)\n' + rapport);
  console.log('rapport detaille : ' + path.join(OUT, 'index.html'));
  process.exitCode = recette.status || 0;
} finally {
  serveur.kill();
}
