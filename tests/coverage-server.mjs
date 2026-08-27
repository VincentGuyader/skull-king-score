/* Serveur de recette instrumente, pour mesurer la couverture de index.html.
   Le bloc script est passe par istanbul au moment de servir la page, et la
   page renvoie son compteur au serveur toutes les 250 ms et avant de se
   fermer. GET /__report ecrit les rapports dans COV_OUT et repond le resume.
   Pas de sendBeacon : sa limite de 64 ko est bien en dessous du compteur. */
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
const debut = html.indexOf('<script>') + '<script>'.length;
const fin = html.lastIndexOf('</script>');
const source = html.slice(debut, fin);
/* Le bloc est ecrit a part : les rapports pointent sur ce fichier, dont les
   lignes sont celles de index.html decalees de l'en-tete HTML. */
const APP = path.join(OUT, 'app.js');
fs.writeFileSync(APP, source);
const instrumente = createInstrumenter({ esModules: false, produceSourceMap: false }).instrumentSync(source, APP);
const sonde = `
;(function(){ function envoi(){ try{ if(window.__coverage__) fetch('/__cov', {method:'POST', body: JSON.stringify(window.__coverage__)}).catch(function(){}); }catch(e){} }
  setInterval(envoi, 250); addEventListener('pagehide', envoi); addEventListener('beforeunload', envoi); })();`;
const page = html.slice(0, debut) + instrumente + sonde + html.slice(fin);

const carte = libCoverage.createCoverageMap({});
let recus = 0;

function resume() {
  const s = carte.getCoverageSummary();
  const ligne = (nom, m) => `${nom.padEnd(12)} ${String(m.pct).padStart(6)} % (${m.covered}/${m.total})`;
  return [`envois recus ${recus}`, ligne('lignes', s.lines), ligne('instructions', s.statements),
    ligne('fonctions', s.functions), ligne('branches', s.branches)].join('\n');
}

const serveur = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (req.method === 'POST' && url === '/__cov') {
    let corps = '';
    req.on('data', c => { corps += c; });
    req.on('end', () => {
      try { carte.merge(JSON.parse(corps)); recus++; } catch (e) { console.error('envoi illisible :', e.message); }
      res.writeHead(204); res.end();
    });
    return;
  }
  if (url === '/__report') {
    const ctx = libReport.createContext({ dir: OUT, coverageMap: carte, defaultSummarizer: 'nested' });
    for (const type of ['html', 'json', 'json-summary']) reports.create(type).execute(ctx);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(resume());
    return;
  }
  let rel = decodeURIComponent(url);
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
