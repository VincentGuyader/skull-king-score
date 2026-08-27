/* Verifie les livrables de la boutique : dimensions des PNG, longueurs des
   champs de la fiche, absence de tirets typographiques (U+2013, U+2014).
   Usage : node store/check.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
let ko = 0;
const fail = m => { ko++; console.log('KO ' + m); };

/* Dimensions d'un PNG, lues dans l'en-tete IHDR. */
function pngSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 1, 4) !== 'PNG') return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], type: b[25] };
}
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const EXPECT = {
  'play-phone-1080x1920': [1080, 1920],
  'appstore-6.7-1290x2796': [1290, 2796],
  'appstore-6.5-1284x2778': [1284, 2778],
  'appstore-ipad-12.9-2048x2732': [2048, 2732],
  'play-feature-graphic-1024x500.png': [1024, 500],
  'play-icon-512.png': [512, 512],
  'appstore-icon-1024.png': [1024, 1024]
};

console.log('== PNG ==');
const rows = [];
for (const f of walk(HERE).filter(f => f.endsWith('.png'))) {
  const s = pngSize(f);
  const rel = path.relative(HERE, f);
  const key = Object.keys(EXPECT).find(k => rel.includes(k));
  const exp = key && EXPECT[key];
  const ok = exp && s.w === exp[0] && s.h === exp[1];
  rows.push(`${ok ? 'ok' : 'KO'} ${s.w}x${s.h} ${s.type === 6 ? 'RGBA' : s.type === 2 ? 'RGB' : 'type' + s.type}${s.depth} ${(fs.statSync(f).size / 1024).toFixed(0)} Ko  ${rel}`);
  if (!ok) fail('dimensions ' + rel);
}
rows.sort().forEach(r => console.log(r));

console.log('== Fiche ==');
const LIMITS = [['Titre', 30], ['Title', 30], ['Titel', 30], ['Título', 30], ['Sous-titre', 30], ['subtitle', 30], ['Untertitel', 30], ['Subtítulo', 30],
  ['Description courte', 80], ['short description', 80], ['Kurzbeschreibung', 80], ['Descripción breve', 80],
  ['Mots-clés', 100], ['keywords', 100], ['Schlüsselwörter', 100], ['Palabras clave', 100],
  ['Texte promotionnel', 170], ['promotional text', 170], ['Werbetext', 170], ['Texto promocional', 170],
  ['Description complète', 4000], ['Full description', 4000], ['Vollständige Beschreibung', 4000], ['Descripción completa', 4000]];
for (const lang of ['fr', 'en', 'de', 'es']) {
  const md = fs.readFileSync(path.join(HERE, 'listing', lang + '.md'), 'utf8');
  const sections = md.split(/^## /m).slice(1);
  for (const sec of sections) {
    const nl = sec.indexOf('\n');
    const head = sec.slice(0, nl);
    const body = sec.slice(nl + 1).trim();
    if (/^(Note|Nota|Hinweis)/.test(head)) continue;
    const lim = LIMITS.find(([k]) => head.toLowerCase().includes(k.toLowerCase()));
    if (!lim) continue;
    const n = [...body].length;
    const ok = n <= lim[1];
    console.log(`${ok ? 'ok' : 'KO'} ${lang} ${head.split('(')[0].trim()} : ${n}/${lim[1]}`);
    if (!ok) fail(lang + ' ' + head);
  }
}

console.log('== Tirets typographiques ==');
const files = [...walk(HERE).filter(f => /\.(md|html|mjs)$/.test(f)), path.join(ROOT, 'privacy.html')];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const i = t.search(/[\u2013\u2014]/);
  if (i >= 0) fail(`tiret U+${t.codePointAt(i).toString(16)} dans ${path.relative(ROOT, f)} vers l'octet ${i}`);
}
console.log(ko ? `${ko} probleme(s)` : 'tout est conforme');
process.exit(ko ? 1 : 0);
