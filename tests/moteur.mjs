/* Charge le moteur de score tel qu'il est ecrit dans index.html.
   Le bloc entre les marqueurs ne depend d'aucune API du navigateur : on peut
   donc l'evaluer en Node pur et le soumettre a des dizaines de milliers de
   cas, ce qu'un aller-retour par la page ne permettrait pas. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function chargerMoteur() {
  const html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  const debut = html.indexOf('/*ENGINE_START*/');
  const fin = html.indexOf('/*ENGINE_END*/');
  if (debut < 0 || fin < 0) throw new Error('marqueurs du moteur introuvables dans index.html');
  const source = html.slice(debut, fin);

  const noms = ['DECK', 'PIRATES', 'BONUS_DEFS', 'deckSize', 'maxCards', 'cardsForRound',
    'bonusSplit', 'bonusPoints', 'roundCapacity', 'scoreRound', 'scoreRoundAll',
    'standings', 'ranks', 'leaders', 'gameResult', 'emptyStat', 'computeStats',
    'hofRank', 'filterGames', 'SERIES_HEX', 'PICTOS', 'contrast', 'deltaE',
    'ensureReadable', 'closePairs'];
  /* eslint-disable no-new-func */
  return new Function(`${source}\nreturn {${noms.join(',')}};`)();
}

export const CLASSIQUE = { scoring: 'classic', bonusIfExact: true, loot: true, kraken: true, whale: true, custom: [] };
export const MITRAILLE = { scoring: 'rascal', rascal: 'grapeshot', bonusIfExact: true, loot: true, kraken: true, whale: true, custom: [] };
export const BOULET = { scoring: 'rascal', rascal: 'cannonball', bonusIfExact: true, loot: true, kraken: true, whale: true, custom: [] };
