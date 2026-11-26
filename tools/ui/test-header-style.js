/*
 * tools/ui/test-header-style.js - task 148: the header of the Studio. The current tab differs by colour only (same Book weight), the header rings draw a stroke as thick as the stem of Suisse Book.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', '..', 'style.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
let failures = 0, checks = 0;
const check = (name, ok, detail) => { checks++; if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== undefined ? '  [' + detail + ']' : ''}`); };
const rule = sel => { const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g'); const all = []; let m; while ((m = re.exec(css))) all.push(m[1]); return all.length ? all.join(' ; ') : null; };   // every rule of that selector, joined
const tab = rule('.app-tabs a'), cur = rule('.app-tabs a[aria-current="page"]');
check('every header tab has the Book weight (var(--weight-regular))', /font-weight: var\(--weight-regular\)/.test(tab || ''));
check('the current tab has the SAME weight and is marked by colour only (black)', /font-weight: var\(--weight-regular\)/.test(cur || '') && /color: var\(--color-text\)/.test(cur || '') && !/weight-strong|underline/.test(cur || ''));
check('no other rule gives a header tab a heavier weight', !/\.app-tabs[^{]*\{[^}]*font-weight: var\(--weight-strong\)/.test(css));
const ring = rule('.app-header .icon-btn .ico');
const w = ring && /stroke-width: ([0-9.]+)/.exec(ring);
check('the header rings (Plus, Help, the website menu ring) have a stroke of 2.67 units = 2px at 18px (Suisse Book stem: 22 to 24 per 200px = 0.11 to 0.12 em, about 2px at 18px)', !!w && Math.abs(Number(w[1]) * 18 / 24 - 2) < 0.05, w && w[1]);
check('the generic icon stroke (steppers, rail) is unchanged (1.75)', /\.ico \{[^}]*stroke-width: 1\.75/.test(css));
check('the phone sub-tabs keep their own marking (not part of task 148)', /html\.ph \.ph-subtab\[aria-current="true"\] \{ font-weight: var\(--weight-strong\)/.test(css));
console.log(`\n${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? 'PASS' : 'FAIL');
process.exit(failures === 0 ? 0 : 1);
