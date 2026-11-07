#!/usr/bin/env node
'use strict';

/*
 * usage-report.js
 *
 * Liest standardmaeßig "usage.csv" aus dem aktuellen Arbeitsverzeichnis
 * (alternativ ueber den ersten Befehlszeilen-Parameter) und berichtet je
 * Typ (Spalte "Typ/Stufe"):
 *   - Anzahl aller Auftraege
 *   - Anzahl ohne voellemaendigen Messwert
 *   - Summe der 5-Stunden-Differenz (nachher - vorher)
 *   - Durchschnitt dieser Differenz
 * Summe und Durchschnitt werden nur ueber Zeilen gebildet, in denen sowohl
 * "vorher" als auch "nachher" vorhanden und numerisch sind.
 *
 * Am Ende: Gesamtzahl aller Auftraege und Zahl der Auftraege mit
 * voellemaendigem Messwert.
 *
 * Keine Abhaengigkeiten, keine externe Ausfuehrung.
 */

const fs = require('fs');

// Standard-Reihenfolge der Spalten, falls die CSV-Datei keine Kopfzeile hat.
const DEFAULT_COLUMNS = [
  'Nr',
  'Typ/Stufe',
  'Werkzeug',
  'Dauer',
  'vorher',
  'nachher',
  'Iterationen',
  'Ergebnis',
];

// Fallback-Indizes (0-basiert) fuer Typ, vorher, nachher ohne Kopfzeile.
const DEFAULT_TYP_IDX = 1;
const DEFAULT_VOR_IDX = 4;
const DEFAULT_NACH_IDX = 5;

function readLines(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    process.stderr.write(
      'Fehler: Datei konnte nicht gelesen werden: ' + filePath + '\n' +
      (err && err.message ? err.message : String(err)) + '\n'
    );
    process.exit(1);
  }
  // Ggf. UTF-8-BOM entfernen.
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1);
  }
  const lines = raw.split(/\r?\n/);
  // Letzte leere Zeile (durch abschliessenden Zeilenumbruch) entfernen.
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }
  return lines.filter((l) => l.trim() !== '');
}

function normalize(cell) {
  return String(cell).trim().toLowerCase();
}

function isNumeric(cell) {
  if (cell === undefined || cell === null) return false;
  const text = String(cell).trim();
  if (text === '') return false;
  const n = Number(text);
  return Number.isFinite(n);
}

function splitCsv(line) {
  // Die vorangehenden Spalten (Nr ... Iterationen) enthalten keine Kommas.
  // Die letzte Spalte "Ergebnis" darf Kommas enthalten, ist aber fuer die
  // numerischen Spalten irrelevant und wird ohnehin nicht ausgewertet.
  return line.split(',');
}

function buildColumnMap(header) {
  const map = {};
  header.forEach((cell, idx) => {
    const key = normalize(cell);
    if (key && !(key in map)) {
      map[key] = idx;
    }
  });
  return map;
}

function resolveIndex(map, candidates, fallback) {
  for (const cand of candidates) {
    for (const key of Object.keys(map)) {
      if (key === cand || key.indexOf(cand) !== -1) {
        return map[key];
      }
    }
  }
  return fallback;
}

function looksLikeHeader(fields) {
  const first = normalize(fields[0]);
  if (first === 'nr' || first === 'nr.' || first === 'nr ') {
    return true;
  }
  const joined = fields.map(normalize).join('|');
  return joined.indexOf('vorher') !== -1 && joined.indexOf('nachher') !== -1;
}

function formatNumber(value) {
  // Auf zwei Nachkommastellen runden und ueberfluessige Nachkommastellen
  // entfernen (z. B. 7,5 -> "7.5", 5,0 -> "5").
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

function analyze(filePath) {
  const lines = readLines(filePath);
  if (lines.length === 0) {
    process.stderr.write('Fehler: Keine Zeilen in ' + filePath + '\n');
    process.exit(1);
  }

  const firstFields = splitCsv(lines[0]);
  let typIdx;
  let vorherIdx;
  let nachherIdx;
  let dataLines;

  if (looksLikeHeader(firstFields)) {
    const map = buildColumnMap(firstFields);
    typIdx = resolveIndex(map, ['typ/stufe', 'typ'], DEFAULT_TYP_IDX);
    vorherIdx = resolveIndex(map, ['vorher'], DEFAULT_VOR_IDX);
    nachherIdx = resolveIndex(map, ['nachher'], DEFAULT_NACH_IDX);
    dataLines = lines.slice(1);
  } else {
    typIdx = DEFAULT_TYP_IDX;
    vorherIdx = DEFAULT_VOR_IDX;
    nachherIdx = DEFAULT_NACH_IDX;
    dataLines = lines;
  }

  const byType = new Map();
  let totalRows = 0;
  let completeRows = 0;

  for (const line of dataLines) {
    totalRows += 1;
    const fields = splitCsv(line);

    const typeRaw = fields[typIdx];
    const type = typeRaw === undefined || typeRaw === null ? '' : String(typeRaw).trim();
    if (type === '') {
      // Zeile ohne Typ kann keinem Typ zugeordnet werden.
      continue;
    }

    let bucket = byType.get(type);
    if (!bucket) {
      bucket = { total: 0, incomplete: 0, complete: 0, sum: 0 };
      byType.set(type, bucket);
    }
    bucket.total += 1;

    const vorherRaw = fields[vorherIdx];
    const nachherRaw = fields[nachherIdx];

    if (isNumeric(vorherRaw) && isNumeric(nachherRaw)) {
      const diff = Number(String(nachherRaw).trim()) - Number(String(vorherRaw).trim());
      bucket.sum += diff;
      bucket.complete += 1;
      completeRows += 1;
    } else {
      bucket.incomplete += 1;
    }
  }

  const types = Array.from(byType.keys()).sort();

  const out = [];
  for (const type of types) {
    const b = byType.get(type);
    out.push('--- ' + type + ' ---');
    out.push('Aufträge gesamt: ' + b.total);
    out.push('Aufträge ohne vollständigen Messwert: ' + b.incomplete);
    out.push('Summe der Differenzen (h): ' + formatNumber(b.sum));
    if (b.complete > 0) {
      out.push('Durchschnitt der Differenzen (h): ' + formatNumber(b.sum / b.complete));
    } else {
      out.push('Durchschnitt der Differenzen (h): —');
    }
    out.push('');
  }

  out.push('Gesamt:');
  out.push('Aufträge gesamt: ' + totalRows);
  out.push('Aufträge mit vollständigem Messwert: ' + completeRows);

  return out.join('\n') + '\n';
}

function main() {
  const inputPath = process.argv[2] || 'usage.csv';
  const output = analyze(inputPath);
  process.stdout.write(output);
}

if (require.main === module) {
  main();
}

module.exports = {
  analyze,
  formatNumber,
  readLines,
  buildColumnMap,
  resolveIndex,
  looksLikeHeader,
  DEFAULT_COLUMNS,
};
