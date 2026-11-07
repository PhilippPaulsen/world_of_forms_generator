#!/usr/bin/env node
'use strict';

/*
 * check-usage-report.js
 *
 * Fuehrt usage-report.js gegen die Test-Fixture aus und vergleicht die
 * voellemaendige Ausgabe mit fest erwarteten Zahlen.
 *
 * Erfolg: "N/N checks passed" auf stdout, Exit-Code 0.
 * Misserfolg: "M/N checks passed" (M < N) und Exit-Code 1.
 *
 * Bewusst der Dateiname "check-*" statt "test-*".
 */

const { execFileSync } = require('child_process');
const path = require('path');

const REPORT_PATH = path.join(__dirname, 'usage-report.js');
const FIXTURE_PATH = path.join(__dirname, 'fixtures', 'usage.csv');

// Fest erwartete Ausgabe fuer die Fixture (deterministisch).
const EXPECTED_LINES = [
  '--- L0 ---',
  'Aufträge gesamt: 2',
  'Aufträge ohne vollständigen Messwert: 0',
  'Summe der Differenzen (h): 10',
  'Durchschnitt der Differenzen (h): 5',
  '',
  '--- L1 ---',
  'Aufträge gesamt: 2',
  'Aufträge ohne vollständigen Messwert: 1',
  'Summe der Differenzen (h): 10',
  'Durchschnitt der Differenzen (h): 10',
  '',
  '--- M ---',
  'Aufträge gesamt: 1',
  'Aufträge ohne vollständigen Messwert: 0',
  'Summe der Differenzen (h): 5',
  'Durchschnitt der Differenzen (h): 5',
  '',
  '--- R ---',
  'Aufträge gesamt: 3',
  'Aufträge ohne vollständigen Messwert: 1',
  'Summe der Differenzen (h): 15',
  'Durchschnitt der Differenzen (h): 7.5',
  '',
  'Gesamt:',
  'Aufträge gesamt: 8',
  'Aufträge mit vollständigem Messwert: 6',
];

const EXPECTED_OUTPUT = EXPECTED_LINES.join('\n') + '\n';

let actualOutput;
try {
  actualOutput = execFileSync(process.execPath, [REPORT_PATH, FIXTURE_PATH], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  process.stderr.write('Fehler: Report-Skript lief nicht erfolgreich:\n');
  process.stderr.write(String(err && err.message ? err.message : err) + '\n');
  if (err && err.stdout) {
    process.stderr.write('--- stdout ---\n' + String(err.stdout) + '\n');
  }
  if (err && err.stderr) {
    process.stderr.write('--- stderr ---\n' + String(err.stderr) + '\n');
  }
  process.exit(1);
}

const checks = [];

// Einzelne Vorhandenseins-Pruefungen fuer die erwarteten Zeilen.
for (const line of EXPECTED_LINES) {
  if (line === '') continue;
  checks.push({
    name: 'Zeile vorhanden: "' + line + '"',
    ok: actualOutput.indexOf(line + '\n') !== -1,
  });
}

// Endgueltige Pruefung: die voellemaendige Ausgabe muss exakt stimmen.
checks.push({
  name: 'vollständige Ausgabe exakt erwartet',
  ok: actualOutput === EXPECTED_OUTPUT,
});

const total = checks.length;
const passed = checks.reduce((acc, c) => acc + (c.ok ? 1 : 0), 0);

for (const c of checks) {
  if (!c.ok) {
    process.stderr.write('FEHLGESCHLAGEN: ' + c.name + '\n');
  }
}

if (passed !== total) {
  process.stderr.write('Erwartete Ausgabe war:\n' + EXPECTED_OUTPUT + '\n');
  process.stderr.write('Erhaltene Ausgabe war:\n' + actualOutput + '\n');
}

console.log(passed + '/' + total + ' checks passed');

process.exit(passed === total ? 0 : 1);
