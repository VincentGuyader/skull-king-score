/* Serveur de recette instrumente, pour mesurer la couverture de index.html.
   Le bloc script est passe par istanbul au moment de servir la page, et
   chaque page envoie son compteur des le chargement, puis toutes les
   200 ms, avec une derniere tentative a la fermeture. Un compteur est l'etat cumule de sa page : le
   serveur garde le dernier recu par page et ne les fusionne qu'au rapport,
   sinon les nombres d'executions s'additionneraient a chaque envoi.
   GET /__report ecrit les rapports dans COV_OUT et repond le resume.
   Pas de sendBeacon : sa limite de 64 ko est bien en dessous du compteur
   (environ 500 ko), et fetch avec keepalive subit la meme limite. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInstrumenter } from 'istanbul-lib-instrument';
import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.env.COV_OUT || path.join(ROOT, 'coverage'));
const PORT = Number(process.env.PORT || 8123);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml'
};

fs.mkdirSync(OUT, { recursive: true });
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
if (html.split('<script>').length !== 2 || html.split('</script>').length !== 2) {
  throw new Error('index.html doit contenir un seul bloc <script> : le decoupage suppose une paire unique');
}
const debut = html.indexOf('<script>') + '<script>'.length;
const fin = html.lastIndexOf('</script>');
const source = html.slice(debut, fin);
/* Le bloc est ecrit a part : les rapports pointent sur ce fichier, dont les
   lignes sont celles de index.html decalees de l'en-tete HTML. */
const APP = path.join(OUT, 'app.js');
fs.writeFileSync(APP, source);
const instrumente = createInstrumenter({ esModules: false, produceSourceMap: false }).instrumentSync(source, APP);
/* La sonde precede le code applicatif : une page qui plante au chargement
   envoie quand meme ce qu'elle a parcouru. */
const sonde = `
;(function(){ var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  function envoi(){ try{ if(window.__coverage__) fetch('/__cov?page=' + id, {method:'POST', body: JSON.stringify(window.__coverage__)}).catch(function(){}); }catch(e){} }
  setInterval(envoi, 200); addEventListener('DOMContentLoaded', envoi); addEventListener('load', envoi);
  addEventListener('pagehide', envoi); addEventListener('beforeunload', envoi); })();`;
const page = html.slice(0, debut) + sonde + instrumente + html.slice(fin);

const parPage = new Map();
let recus = 0;

function fusion() {
  const carte = libCoverage.createCoverageMap({});
  for (const etat of parPage.values()) carte.merge(etat);
  return carte;
}
function resume(carte) {
  const s = carte.getCoverageSummary();
  const ligne = (nom, m) => `${nom.padEnd(12)} ${String(m.pct).padStart(6)} % (${m.covered}/${m.total})`;
  return [`envois recus ${recus}, pages ${parPage.size}`, ligne('lignes', s.lines), ligne('instructions', s.statements),
    ligne('fonctions', s.functions), ligne('branches', s.branches)].join('\n');
}

const serveur = http.createServer((req, res) => {
  const [url, query = ''] = req.url.split('?');
  if (req.method === 'POST' && url === '/__cov') {
    const id = new URLSearchParams(query).get('page') || 'sans-id';
    req.setEncoding('utf8');
    let corps = '';
    req.on('data', c => { corps += c; });
    req.on('end', () => {
      try { parPage.set(id, JSON.parse(corps)); recus++; } catch (e) { console.error('envoi illisible :', e.message); }
      res.writeHead(204); res.end();
    });
    return;
  }
  if (url === '/__report') {
    const carte = fusion();
    const ctx = libReport.createContext({ dir: OUT, coverageMap: carte, defaultSummarizer: 'nested' });
    for (const type of ['html', 'json', 'json-summary']) reports.create(type).execute(ctx);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(resume(carte));
    return;
  }
  let rel;
  try { rel = decodeURIComponent(url); } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('adresse illisible'); return;
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const fichier = path.resolve(ROOT, '.' + rel);
  if (!fichier.startsWith(ROOT) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('introuvable'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fichier)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (fichier === path.join(ROOT, 'index.html')) res.end(page); else fs.createReadStream(fichier).pipe(res);
});

serveur.listen(PORT, '127.0.0.1', () => {
  console.log('couverture : http://127.0.0.1:' + PORT + '/ (rapports dans ' + OUT + ')');
});
