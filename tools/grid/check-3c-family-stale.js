// Task 125, Zusatz: liest core/netwarp.js nur (aendert nichts). Frage: lehnt netAnimationCompat ein Paar zweier 3C-Specs ab, die beide auf der DREIECKS-Flaeche als △N gezeichnet
// werden, nur weil in einem das gespeicherte `family` nach einem Formwechsel noch □N ist (netProjectiveForShape benennt es erst beim Lesen um)?
//   node tools/grid/check-3c-family-stale.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'core', 'netwarp.js'), 'utf8'), ctx);
const sq = '□N', tr = '△N';
const mk = (fam, a, b) => ({ kind: 'projective', a, b, format: 'full', family: fam });
const stale = mk(sq, 2, 4), fresh = mk(tr, 3, 5), fresh2 = mk(tr, 2, 4);
const eff = s => ctx.netProjectiveEffective(s, 'triangle').valid, shown = s => ctx.netProjectiveForShape(s, 'triangle').family;
console.log('Auf der Dreiecks-Flaeche: stale (gespeichert □N) gueltig:', eff(stale), 'gezeichnet als', shown(stale), '| fresh (gespeichert △N) gueltig:', eff(fresh), 'gezeichnet als', shown(fresh));
const cmp = (n, A, B) => { const c = ctx.netAnimationCompat(A, B); console.log(n.padEnd(46), JSON.stringify(c)); return c; };
const r1 = cmp('stale □N -> fresh △N (beide am Dreieck gezeichnet)', stale, fresh);
const r2 = cmp('fresh △N -> stale □N', fresh, stale);
const r3 = cmp('fresh △N -> fresh △N (Kontrolle)', fresh2, fresh);
const r4 = cmp('stale □N -> stale □N (Kontrolle)', stale, mk(sq, 3, 5));
const r5 = cmp('Quadrat (echt) □N -> Dreieck △N (soll abgelehnt)', stale, fresh);
console.log(!r1.ok && !r2.ok && r3.ok ? 'BEFUND: ein gueltiges △N-Paar wird mit "family differs" abgelehnt, wenn eines der Specs nach dem Formwechsel noch □N gespeichert hat' : 'kein Befund');
// die Lerp-Zeile uebernimmt from.family, ein aufgenommenes Paar mit gleicher (veralteter) Familie wird dagegen gar nicht umbenannt:
const lerp = ctx.netLerpSpecs(stale, mk(sq, 3, 5), 0.5); console.log('netLerpSpecs(stale, stale) family:', lerp && lerp.family, '(gezeichnet wird es ueber netProjectiveForShape als', lerp && shown(lerp) + ')');
