#!/usr/bin/env node
// Task 026 — Messung Farbmischung (Stern Violett / Raute Gelb) in beiden Morph-Pfaden.
// Misst je Fläche (NICHT Mittelwert) bei t = 0, 0.25, 0.5, 0.75, 1:
//   - Pfad 1: playbackCrossfadeColors / crossfadeFaceColors (core/facecolor.js)
//   - Pfad 2: spatialMorphRenderFaceColors (core/spatial-morph-render.js)
// Ausgegeben werden je Fläche: Fläche (Stern / Raute), Zuordnung über Schwerpunkt+Orbit (sameFace),
// Soll-Farbe (A/B), Ist-Farbe (Hex + Linear-RGB), Abstand im linearen Licht (L2 und Max-Kanal),
// sowie Treffer in Feld A / Feld B pro Samplepunkt.

'use strict';

const { makeRenderWorld } = require('./render-harness');

const STUB = `
  var __stack = [];
  push = () => { __stack.push(null); };
  pop = () => { __stack.pop(); };
  noStroke = () => {};
  stroke = () => {};
  strokeWeight = () => {};
  noFill = () => {};
  fill = () => {};
  beginShape = () => {};
  vertex = () => {};
  bezierVertex = () => {};
  endShape = () => {};
  var CLOSE = 'close';
`;

const TS = [0, 0.25, 0.5, 0.75, 1];

// Euklidischer Abstand und Max-Kanal-Differenz im linearen sRGB-Licht (0..1)
function linearDistance(linIst, linSoll) {
  const dr = linIst[0] - linSoll[0];
  const dg = linIst[1] - linSoll[1];
  const db = linIst[2] - linSoll[2];
  return {
    l2: Math.hypot(dr, dg, db),
    maxCh: Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db))
  };
}

// Prüft per Orbit-Typ (Eckenzahl + Zentralsymmetrie vs. Eck-Rauten-Orbit) und Schwerpunkt,
// ob Fläche f dem 8-Eck-Stern oder einer der 4 Eck-Rauten in A und B entspricht.
function matchFaceToKeyframes(face, refFacesA, refFacesB, cellCtr, cellSpan) {
  const n = face.verts.length;
  const dx = face.centroid.x - cellCtr.x;
  const dy = face.centroid.y - cellCtr.y;
  const distCenter = Math.hypot(dx, dy);

  const isStarOrbit = (n === 8 && distCenter < cellSpan * 0.05);
  // Eck-Raute: 4-Eck auf einer der 4 Hauptdiagonalen (||dx| - |dy|| < 0.05*span) und Fläche >= 1000
  const isCornerDiamond = (n === 4 && Math.abs(Math.abs(dx) - Math.abs(dy)) < cellSpan * 0.05 && face.area >= 1000);

  if (isStarOrbit) {
    const refA = refFacesA.find((rf) => rf.verts.length === 8 && Math.hypot(rf.centroid.x - cellCtr.x, rf.centroid.y - cellCtr.y) < cellSpan * 0.05);
    const refB = refFacesB.find((rf) => rf.verts.length === 8 && Math.hypot(rf.centroid.x - cellCtr.x, rf.centroid.y - cellCtr.y) < cellSpan * 0.05);
    const dA = refA ? Math.hypot(refA.centroid.x - face.centroid.x, refA.centroid.y - face.centroid.y) : Infinity;
    const dB = refB ? Math.hypot(refB.centroid.x - face.centroid.x, refB.centroid.y - face.centroid.y) : Infinity;
    return {
      role: 'Stern (8-Eck)',
      orbitKey: '8-gon@center',
      sameFace: Boolean(refA && refB && dA < cellSpan * 0.05 && dB < cellSpan * 0.05),
      distA: dA,
      distB: dB
    };
  }

  if (isCornerDiamond) {
    const sx = Math.sign(dx), sy = Math.sign(dy);
    const findCornerIn = (list) => list.find((rf) =>
      rf.verts.length === 4 &&
      Math.abs(Math.abs(rf.centroid.x - cellCtr.x) - Math.abs(rf.centroid.y - cellCtr.y)) < cellSpan * 0.05 &&
      rf.area >= 1000 &&
      Math.sign(rf.centroid.x - cellCtr.x) === sx &&
      Math.sign(rf.centroid.y - cellCtr.y) === sy
    );
    const refA = findCornerIn(refFacesA);
    const refB = findCornerIn(refFacesB);
    const dA = refA ? Math.hypot(refA.centroid.x - face.centroid.x, refA.centroid.y - face.centroid.y) : Infinity;
    const dB = refB ? Math.hypot(refB.centroid.x - face.centroid.x, refB.centroid.y - face.centroid.y) : Infinity;
    const qLabel = `${dx < 0 ? 'L' : 'R'}${dy < 0 ? 'O' : 'U'}`;
    return {
      role: `Raute_${qLabel} (4-Eck)`,
      orbitKey: `4-gon@${qLabel}`,
      sameFace: Boolean(refA && refB),
      distA: dA,
      distB: dB
    };
  }

  return null;
}

function runScenario(cfg) {
  const w = makeRenderWorld('square', cfg.n, 3, 'rotation_reflection6');
  w.set(STUB);

  // Farbe 1 = Violett (Ostwald Hue 12), Farbe 2 = Gelb (Ostwald Hue 0)
  const VIOLET = { hue: 12, w: 0.036, s: 0.11, rule: 'test', params: null };
  const YELLOW = { hue: 0,  w: 0.036, s: 0.11, rule: 'test', params: null };
  const hexViolet = w.run(`resolveColor(OSTWALD_REFERENCE_SYSTEM, ${JSON.stringify(VIOLET)}).hex`);
  const hexYellow = w.run(`resolveColor(OSTWALD_REFERENCE_SYSTEM, ${JSON.stringify(YELLOW)}).hex`);
  const linViolet = w.run(`cssColorToLinear(${JSON.stringify(hexViolet)})`);
  const linYellow = w.run(`cssColorToLinear(${JSON.stringify(hexYellow)})`);

  const idA = w.addKeyframeLayer(cfg.connsA, { showFaces: true });
  const idB = w.addKeyframeLayer(cfg.connsB, { showFaces: true });
  const pbId = w.addKeyframeLayer(cfg.connsA, { isTimelinePlayback: true, enabled: true, showFaces: true });

  // Färbe in BEIDEN Keyframe-Ebenen den 8-Eck-Stern mit Violett und den größten 4-Eck-Rauten-Orbit mit Gelb
  const setupLayer = (layerIdx) => w.run(`(function(){
    var L = additionalLayers[${layerIdx}], sh = faceSheetOverrideOfLayer(L);
    var res = computeCellFaces(L.connections, L.nodes, null, null, sh);
    var grp = sheetGroupElements(L.nodes, sh);
    var keys = computeFaceTrailKeys(res, grp);
    var trails = computeFaceTrails(res, grp);
    L.faceAssignments = new Map();
    var assignedYellow = false;
    trails.forEach(function(tr){
      var fIdx = keys.indexOf(tr.key);
      var f0 = res.faces[fIdx];
      if (tr.faceCount === 1 && f0 && f0.nodeIds.length === 8) {
        setFaceAssignment(L.faceAssignments, tr.key, ${JSON.stringify(VIOLET)});
      } else if (!assignedYellow && tr.faceCount === 4 && f0 && f0.nodeIds.length === 4) {
        setFaceAssignment(L.faceAssignments, tr.key, ${JSON.stringify(YELLOW)});
        assignedYellow = true;
      }
    });
    var byId = new Map(res.nodes.map(function(n){ return [n.id, n]; }));
    var xs = sh.outerCorners.map(function(p){ return p.x; });
    return {
      ctr: sh.centroid,
      span: Math.max.apply(null, xs) - Math.min.apply(null, xs),
      faces: res.faces.map(function(f){
        var verts = f.nodeIds.map(function(id){ return byId.get(id); }).filter(Boolean).map(function(n){ return { x: n.x, y: n.y }; });
        var cx = verts.reduce(function(a,p){ return a+p.x; }, 0) / verts.length;
        var cy = verts.reduce(function(a,p){ return a+p.y; }, 0) / verts.length;
        return { verts: verts, centroid: { x: cx, y: cy }, area: f.area };
      })
    };
  })()`);

  const dataA = setupLayer(idA);
  const dataB = setupLayer(idB);

  w.setTimeline([idA, idB], {
    playbackLayerIndex: pbId,
    segmentPairings: [cfg.pairing || null],
    segmentFlips: [cfg.flips || null],
    segmentMembers: [cfg.members || null]
  });

  // 1) Pfad 1: playbackCrossfadeColors / crossfadeFaceColors (core/facecolor.js)
  const playbackRows = [];
  for (const t of TS) {
    const stepData = w.run(`(function(){
      timeline.elapsedMs = ${t * 2000};
      applyTimelineFrame();
      var pb = additionalLayers[${pbId}];
      var sh = faceSheetOverrideOfLayer(pb);
      var res = computeCellFaces(pb._morphConnections || pb.connections, pb._morphNodes || pb.nodes, null, null, sh);
      var colors = playbackCrossfadeColors(res);
      var fA = keyframeFieldFor(${idA});
      var fB = keyframeFieldFor(${idB});
      var byId = new Map(res.nodes.map(function(n){ return [n.id, n]; }));
      return res.faces.map(function(f, fi){
        var verts = f.nodeIds.map(function(id){ return byId.get(id); }).filter(Boolean).map(function(n){ return { x: n.x, y: n.y }; });
        var cx = verts.reduce(function(a,p){ return a+p.x; }, 0) / verts.length;
        var cy = verts.reduce(function(a,p){ return a+p.y; }, 0) / verts.length;
        var pts = faceSamplePoints(verts);
        var hitVA = 0, hitYA = 0, hitGA = 0, hitVB = 0, hitYB = 0, hitGB = 0;
        for (var k = 0; k < pts.length; k++) {
          var cA = _lookupField(fA, pts[k]), cB = _lookupField(fB, pts[k]);
          var hA = cA ? linearToHex(cA) : null, hB = cB ? linearToHex(cB) : null;
          if (hA === ${JSON.stringify(hexViolet)}) hitVA++; else if (hA === ${JSON.stringify(hexYellow)}) hitYA++; else hitGA++;
          if (hB === ${JSON.stringify(hexViolet)}) hitVB++; else if (hB === ${JSON.stringify(hexYellow)}) hitYB++; else hitGB++;
        }
        return {
          fi: fi,
          verts: verts,
          area: f.area,
          centroid: { x: cx, y: cy },
          istHex: colors[fi],
          istLin: cssColorToLinear(colors[fi]),
          hitsA: hitVA + 'V/' + hitYA + 'Y/' + hitGA + 'G',
          hitsB: hitVB + 'V/' + hitYB + 'Y/' + hitGB + 'G'
        };
      });
    })()`);

    for (const f of stepData) {
      const m = matchFaceToKeyframes(f, dataA.faces, dataB.faces, dataA.ctr, dataA.span);
      if (!m) continue;
      const sollHex = m.role.startsWith('Stern') ? hexViolet : hexYellow;
      const sollLin = m.role.startsWith('Stern') ? linViolet : linYellow;
      const dist = linearDistance(f.istLin, sollLin);
      playbackRows.push({
        path: 'playbackCrossfadeColors',
        t,
        fi: f.fi,
        role: m.role,
        sameFace: m.sameFace,
        distA: Math.round(m.distA),
        distB: Math.round(m.distB),
        sollHex,
        istHex: f.istHex,
        distL2: Number(dist.l2.toFixed(4)),
        distMaxCh: Number(dist.maxCh.toFixed(4)),
        hitsA: f.hitsA,
        hitsB: f.hitsB
      });
    }
  }

  // 2) Pfad 2: spatialMorphRenderFaceColors (core/spatial-morph-render.js)
  const spatialRows = [];
  for (const t of TS) {
    const stepData = w.run(`(function(){
      var seg = resolveTimelineKeyframeCoords(timeline, 0);
      var ch = spatialMorphChooseCorners([seg.from, seg.to], 'linear');
      var L0 = additionalLayers[${idA}];
      var s = { outerCorners: L0.outerCorners, centroid: L0.centroid, nodes: L0.nodes, shape: L0.shape, symmetryMode: L0.symmetryMode };
      var faceSheet = { shape: s.shape, symmetryMode: s.symmetryMode, centroid: s.centroid, outerCorners: s.outerCorners, gridMatchesBase: true };
      var prepared = spatialMorphPrepareLines(ch, s.outerCorners);
      var wTile = { w00: ${1 - t}, w10: ${t}, w01: 0, w11: 0 };
      var cellLines = prepared.map(function(pl){
        return [pl.a, pl.b].map(function(d){
          return spatialMorphAnchoredPoint(d, wTile, wTile, false);
        });
      });
      var tileFaces = spatialMorphRenderTileFaces(cellLines, s, faceSheet);
      var cornerFields = spatialMorphRenderCornerFields([${idA}, ${idB}, ${idA}, ${idB}], 2, 'linear');
      var colors = spatialMorphRenderFaceColors(tileFaces, cornerFields, wTile);
      var byId = new Map(tileFaces.nodes.map(function(n){ return [n.id, n]; }));
      return tileFaces.faces.map(function(f, fi){
        var verts = f.nodeIds.map(function(id){ return byId.get(id); }).filter(Boolean).map(function(n){ return { x: n.x, y: n.y }; });
        var cx = verts.reduce(function(a,p){ return a+p.x; }, 0) / verts.length;
        var cy = verts.reduce(function(a,p){ return a+p.y; }, 0) / verts.length;
        var samples = spatialMorphFaceSamples(verts);
        var hitVA = 0, hitYA = 0, hitGA = 0, hitVB = 0, hitYB = 0, hitGB = 0;
        for (var k = 0; k < samples.length; k++) {
          var cA = spatialMorphRasterSample(cornerFields[0].raster, samples[k].x, samples[k].y);
          var cB = spatialMorphRasterSample(cornerFields[1].raster, samples[k].x, samples[k].y);
          var hA = cA ? linearToHex(cA) : null, hB = cB ? linearToHex(cB) : null;
          if (hA === ${JSON.stringify(hexViolet)}) hitVA++; else if (hA === ${JSON.stringify(hexYellow)}) hitYA++; else hitGA++;
          if (hB === ${JSON.stringify(hexViolet)}) hitVB++; else if (hB === ${JSON.stringify(hexYellow)}) hitYB++; else hitGB++;
        }
        return {
          fi: fi,
          verts: verts,
          area: f.area,
          centroid: { x: cx, y: cy },
          istHex: colors[fi],
          istLin: cssColorToLinear(colors[fi]),
          hitsA: hitVA + 'V/' + hitYA + 'Y/' + hitGA + 'G',
          hitsB: hitVB + 'V/' + hitYB + 'Y/' + hitGB + 'G'
        };
      });
    })()`);

    for (const f of stepData) {
      const m = matchFaceToKeyframes(f, dataA.faces, dataB.faces, dataA.ctr, dataA.span);
      if (!m) continue;
      const sollHex = m.role.startsWith('Stern') ? hexViolet : hexYellow;
      const sollLin = m.role.startsWith('Stern') ? linViolet : linYellow;
      const dist = linearDistance(f.istLin, sollLin);
      spatialRows.push({
        path: 'spatialMorphRenderFaceColors',
        t,
        fi: f.fi,
        role: m.role,
        sameFace: m.sameFace,
        distA: Math.round(m.distA),
        distB: Math.round(m.distB),
        sollHex,
        istHex: f.istHex,
        distL2: Number(dist.l2.toFixed(4)),
        distMaxCh: Number(dist.maxCh.toFixed(4)),
        hitsA: f.hitsA,
        hitsB: f.hitsB
      });
    }
  }

  return { cfg, hexViolet, hexYellow, playbackRows, spatialRows };
}

// Nachbau des Nutzer-Falls: Quadrat (N=4, D4 / rotation_reflection6),
// Keyframe A = [[1,12]] (Stern Violett + 4 Eck-Rauten Gelb),
// Keyframe B = [[1,8]]  (größerer Stern Violett + 4 Eck-Rauten Gelb; schlüssiges Default-Pairing dangling=0, nodeMiss=0, boundaryMiss=0)
const scenarios = [
  {
    name: 'Quadrat N=4 (D4): Keyframe A=[[1,12]] -> Keyframe B=[[1,8]] (Stern Violett #a596d3, 4 Eck-Rauten Gelb #9fa868)',
    n: 4,
    connsA: [[1, 12]],
    connsB: [[1, 8]]
  }
];

for (const sc of scenarios) {
  const out = runScenario(sc);
  console.log(`\n=== ${sc.name} ===`);
  console.log(`Soll Stern (Violett): ${out.hexViolet} | Soll Raute (Gelb): ${out.hexYellow}`);
  console.log('Pfad                         | t    | fi | Fläche          | sameFace | dC(A,B) | Soll    | Ist     | dLin(L2) | dLin(Max) | Samples in A  | Samples in B');
  console.log('-----------------------------+------+----+-----------------+----------+---------+---------+---------+----------+-----------+---------------+--------------');
  for (const r of [...out.playbackRows, ...out.spatialRows]) {
    const dc = `${r.distA}/${r.distB}`.padEnd(7);
    console.log(
      `${r.path.padEnd(28)} | ${String(r.t).padEnd(4)} | ${String(r.fi).padStart(2)} | ${r.role.padEnd(15)} | ${String(r.sameFace).padEnd(8)} | ${dc} | ${r.sollHex} | ${r.istHex} | ${r.distL2.toFixed(4).padStart(8)} | ${r.distMaxCh.toFixed(4).padStart(9)} | ${r.hitsA.padEnd(13)} | ${r.hitsB}`
    );
  }
}
