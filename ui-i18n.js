/*
 * The bilingual dictionary (sheets redesign, commit 1). Data and a few functions; no DOM at load, no state saved. Loaded BEFORE ui.js (which exposes it as UI.t, UI.lang, UI.setLang and UI.applyI18n) and before the
 * UI scripts that route a string through UI.t.
 *
 *   DICT                { key: { de, en } }; a text may hold {placeholders} ({n}, {k}, {m}), the same ones in both languages.
 *   t(key, params)      the text in the current language; {name} is replaced from params. Falls back to the German text, then to the key itself; never throws.
 *   lang / setLang(l)   'de' or 'en'; DEFAULT_LANG is the one constant that says which one the page starts in. ?lang=en or ?lang=de in the URL selects it at load (a preview: nothing is saved).
 *   applyI18n(root)     writes the dictionary strings into the elements of root (default: the document) that carry one of three attributes:
 *                         data-i18n="key"        the element's TEXT (its own text node; the children stay) when it has own text; an element WITHOUT own text (an icon button, a group, an input) gets its
 *                                                NAME instead: aria-label, and title when it has one. This is what the repo's data-i18n keys have always meant ("the key of the string this element carries").
 *                         data-i18n-label="key"  aria-label (and title when the element has one): for an element that has its own visible text AND a different name ("Geo", name "Geometrisch").
 *                         data-i18n-title="key"  title only.
 *                       Only a key that exists is applied; an element is never emptied.
 *
 * What changes language: only the strings that go through this dictionary (the elements above, and the scripts that call UI.t). With the default language (German) the page is NOT rewritten: the markup
 * keeps its German text exactly as authored, and the dictionary German of a markup key is checked against it by tools/ui/test-i18n.js. Nothing here changes <html lang>.
 */
(function (root) {
  'use strict';

  const DEFAULT_LANG = 'de';
  const LANGS = ['de', 'en'];

  const DICT = {
    // ---- the markup of index.html that already carried a data-i18n key (the German is the authored text; the English is new) ----
    'fold.3': { de: '3-zählig', en: '3-fold' },
    'fold.6': { de: '6-zählig', en: '6-fold' },
    'fold.hint': { de: 'Nur beim Sechseck, und nur mit Drehung.', en: 'Hexagon only, and only with rotation.' },
    'fold.title': { de: 'Zähligkeit (Sechseck)', en: 'Fold (hexagon)' },
    'group.netKind': { de: 'Netzart', en: 'Net type' },
    'group.shape': { de: 'Form', en: 'Shape' },
    'group.symmetry': { de: 'Symmetrie', en: 'Symmetry' },
    'help': { de: 'Hilfe', en: 'Help' },
    'info': { de: 'Info', en: 'Info' },
    'info.card': { de: 'Info', en: 'Info' },
    'layer.align': { de: 'An Basis angleichen', en: 'Align to base' },
    'layer.fold.3': { de: '3-zählig', en: '3-fold' },
    'layer.fold.6': { de: '6-zählig', en: '6-fold' },
    'layer.fold.group': { de: 'Ebene: Zähligkeit', en: 'Layer: fold' },
    'layer.mesh.group': { de: 'Ebene: Versatz um eine Masche', en: 'Layer: shift by one mesh width' },
    'layer.node.group': { de: 'Ebene: Knoten', en: 'Layer: nodes' },
    'layer.node.input': { de: 'Ebene: Knoten', en: 'Layer: nodes' },
    'layer.node.less': { de: 'Ebene: Knoten weniger', en: 'Layer: fewer nodes' },
    'layer.node.more': { de: 'Ebene: Knoten mehr', en: 'Layer: more nodes' },
    'layer.shape.group': { de: 'Ebene: Form', en: 'Layer: shape' },
    'layer.shape.square': { de: 'Quadrat', en: 'Square' },
    'layer.shape.triangle': { de: 'Dreieck', en: 'Triangle' },
    'layer.size.group': { de: 'Ebene: Größe', en: 'Layer: size' },
    'layer.size.input': { de: 'Ebene: Größe', en: 'Layer: size' },
    'layer.size.less': { de: 'Ebene: Größe weniger', en: 'Layer: smaller size' },
    'layer.size.more': { de: 'Ebene: Größe mehr', en: 'Layer: larger size' },
    'layers.rail': { de: 'Ebenen', en: 'Layers' },
    'layers.strip': { de: 'Ebenen', en: 'Layers' },
    'layers.table': { de: 'Ebenen', en: 'Layers' },
    'layers.remove.cancel': { de: 'Abbrechen', en: 'Cancel' },
    'layers.remove.confirm': { de: 'Entfernen', en: 'Remove' },
    'layers.remove.title': { de: 'Ebene entfernen?', en: 'Remove layer?' },
    'more': { de: 'Mehr', en: 'More' },
    'more.form': { de: 'Mehr', en: 'More' },
    'more.netz': { de: 'Mehr', en: 'More' },
    'more.rail': { de: 'Mehr', en: 'More' },
    'more.rail.button': { de: 'Mehr: Kurve, Frei, Freie Endpunkte, Alternatives Netz', en: 'More: curve, free, free endpoints, alternative net' },
    'net.focus': { de: 'Fokus', en: 'Focus' },
    'net.focus.exact': { de: 'Fokus, genau', en: 'Focus, exact' },
    'net.focus.group': { de: 'Fokus', en: 'Focus' },
    'net.focus.less': { de: 'Fokus weniger', en: 'Less focus' },
    'net.focus.more': { de: 'Fokus mehr', en: 'More focus' },
    'net.focus.value': { de: 'Fokus', en: 'Focus' },
    'net.kind.geometric': { de: 'Geometrisch', en: 'Geometric' },
    'net.kind.off': { de: 'Aus, regelmäßiges Netz', en: 'Off, regular net' },
    'net.kind.sinus': { de: 'Sinus', en: 'Sine' },
    'net.kind.tangens': { de: 'Tangens', en: 'Tangent' },
    'net.strength': { de: 'Stärke', en: 'Strength' },
    'net.strength.exact': { de: 'Stärke, genau', en: 'Strength, exact' },
    'net.strength.group': { de: 'Stärke', en: 'Strength' },
    'net.strength.less': { de: 'Stärke weniger', en: 'Less strength' },
    'net.strength.more': { de: 'Stärke mehr', en: 'More strength' },
    'net.strength.value': { de: 'Stärke', en: 'Strength' },
    'node.group': { de: 'Knoten', en: 'Nodes' },
    'node.input': { de: 'Knoten', en: 'Nodes' },
    'node.less': { de: 'Knoten weniger', en: 'Fewer nodes' },
    'node.more': { de: 'Knoten mehr', en: 'More nodes' },
    'rail.farborgel': { de: 'Farborgel (öffnet in neuem Tab)', en: 'Farborgel (opens in a new tab)' },
    'rail.formorgel': { de: 'Formorgel (öffnet in neuem Tab)', en: 'Formorgel (opens in a new tab)' },
    'rail.paste': { de: 'Muster einfügen (ein aus dem Katalog kopiertes Muster, als neue Ebene)', en: 'Paste Pattern (a pattern copied from the catalog, as a new layer)' },
    'restart.cancel': { de: 'Abbrechen', en: 'Cancel' },
    'restart.confirm': { de: 'Neu anfangen', en: 'Start over' },
    'restart.open': { de: 'Neu anfangen', en: 'Start over' },
    'restart.text': { de: 'Das aktuelle Muster mit allen Ebenen, Farben und der Zeitleiste wird verworfen. Das lässt sich nicht rückgängig machen.', en: 'The current pattern with all layers, colors and the timeline will be discarded. This cannot be undone.' },
    'restart.title': { de: 'Neu anfangen?', en: 'Start over?' },
    'shape.hex': { de: 'Sechseck', en: 'Hexagon' },
    'shape.square': { de: 'Quadrat', en: 'Square' },
    'shape.triangle': { de: 'Dreieck', en: 'Triangle' },
    'size.group': { de: 'Größe', en: 'Size' },
    'size.input': { de: 'Größe', en: 'Size' },
    'size.less': { de: 'Größe weniger', en: 'Smaller' },
    'size.more': { de: 'Größe mehr', en: 'Larger' },
    'sym.mirror': { de: 'Spiegelung', en: 'Mirror' },
    'sym.rotation': { de: 'Drehung', en: 'Rotation' },
    'tab.farbe': { de: 'Farbe', en: 'Color' },
    'tab.form': { de: 'Form', en: 'Shape' },
    'tab.netz': { de: 'Netz', en: 'Net' },
    'tabs.nav': { de: 'Bereiche', en: 'Sections' },
    'timeline.clear': { de: 'Zeitleiste entfernen', en: 'Remove timeline' },
    'timeline.confirm.cancel': { de: 'Abbrechen', en: 'Cancel' },
    'timeline.confirm.remove': { de: 'Entfernen', en: 'Remove' },
    'timeline.confirm.title': { de: 'Zeitleiste entfernen?', en: 'Remove timeline?' },
    'timeline.strip': { de: 'Zeitleiste', en: 'Timeline' },

    // ---- strings of the scripts of the phone layout that carry a key ----
    'notice.close': { de: 'Hinweis schließen', en: 'Close notice' },
    'more.farbe.button': { de: 'Mehr: Farben zurücksetzen, Knoten, Farborgel, Info, Download', en: 'More: reset colors, nodes, Farborgel, info, download' },
    'netz.lines.button': { de: 'Netzlinien zeigen', en: 'Show net lines' },
    'netz.reverse': { de: 'Richtung umkehren', en: 'Reverse direction' },
    'net.axes.both': { de: 'Beide Achsen', en: 'Both axes' },
    'net.axes.x': { de: 'Nur X', en: 'X only' },
    'net.axes.y': { de: 'Nur Y', en: 'Y only' },
    'trails.none': { de: 'Keine Flächen', en: 'No faces' },
    'trails.label.one': { de: 'Spur {k} · {m} Fläche', en: 'Trail {k} · {m} face' },
    'trails.label.other': { de: 'Spur {k} · {m} Flächen', en: 'Trail {k} · {m} faces' },
    'trails.prev': { de: 'Vorherige Farbe dieser Spur', en: 'Previous color of this trail' },
    'trails.next': { de: 'Nächste Farbe dieser Spur', en: 'Next color of this trail' },
    'trails.group': { de: 'Spuren', en: 'Trails' },

    // ---- the sheets redesign: the layer sheet ----
    'layer.shape.hexagon': { de: 'Sechseck', en: 'Hexagon' },
    'layer.sym.group': { de: 'Ebene: Symmetrie', en: 'Layer: symmetry' },
    'layer.sym.none': { de: 'Keine Symmetrie', en: 'No symmetry' },
    'layer.sym.mirror': { de: 'Spiegelung', en: 'Mirror' },
    'layer.sym.rotational': { de: 'Drehsymmetrie', en: 'Rotational symmetry' },
    'layer.nodes': { de: 'Ebene: Knoten', en: 'Layer: nodes' },
    'layer.size': { de: 'Ebene: Größe', en: 'Layer: size' },
    'layer.shiftX': { de: 'Versatz X', en: 'Shift X' },
    'layer.shiftY': { de: 'Versatz Y', en: 'Shift Y' },
    'layer.meshX': { de: 'Eine Masche in X', en: 'One mesh width in X' },
    'layer.meshY': { de: 'Eine Masche in Y', en: 'One mesh width in Y' },
    'layer.rotation': { de: 'Drehung', en: 'Rotation' },
    'layer.shiftX.more': { de: 'Versatz X mehr', en: 'Shift X more' },
    'layer.shiftX.less': { de: 'Versatz X weniger', en: 'Shift X less' },
    'layer.shiftY.more': { de: 'Versatz Y mehr', en: 'Shift Y more' },
    'layer.shiftY.less': { de: 'Versatz Y weniger', en: 'Shift Y less' },
    'layer.rotation.more': { de: 'Drehung mehr', en: 'Rotation more' },
    'layer.rotation.less': { de: 'Drehung weniger', en: 'Rotation less' },

    // ---- the timeline sheet ----
    'timeline.notKeyframe': { de: 'Gewählte Ebene ist kein Keyframe', en: 'The selected layer is not a keyframe' },
    'timeline.noKeyframes': { de: 'Noch keine Keyframes', en: 'No keyframes yet' },
    'timeline.need2': { de: 'Mindestens zwei Keyframes nötig', en: 'At least two keyframes needed' },
    'timeline.recaptureNet': { de: 'Netz der gewählten Ebene neu aufnehmen', en: 'Recapture the net of the selected layer' },
    'timeline.pairing': { de: 'Linienzuordnung', en: 'Line pairing' },
    'timeline.remove': { de: 'Zeitleiste entfernen', en: 'Remove timeline' },
    'timeline.segment': { de: 'Segment', en: 'Segment' },
    'timeline.line': { de: 'Linie {n}', en: 'Line {n}' },
    'timeline.endUp': { de: 'Ende nach oben', en: 'Move end up' },
    'timeline.endDown': { de: 'Ende nach unten', en: 'Move end down' },
    'timeline.reverse': { de: 'Richtung umkehren', en: 'Reverse direction' },
    'timeline.variantPrev': { de: 'Vorherige Variante', en: 'Previous variant' },
    'timeline.variantNext': { de: 'Nächste Variante', en: 'Next variant' },
    'timeline.listAll': { de: 'Alle Zuordnungen', en: 'All pairings' },
    'timeline.resetPairing': { de: 'Zuordnung zurücksetzen', en: 'Reset pairing' },
    'timeline.pairingDefault': { de: 'Zuordnung ist Standard', en: 'Pairing is the default' },
    'timeline.listBack': { de: 'Zurück zur Zuordnung', en: 'Back to the pairing' },
    'timeline.pairingCount': { de: '{shown} von {total} Zuordnungen', en: '{shown} of {total} pairings' },
    'timeline.pairingRow': { de: 'Zuordnung {order}, Σd² {value} px²', en: 'Pairing {order}, Σd² {value} px²' },
    'timeline.default': { de: 'Standard', en: 'Default' },
    'timeline.net.none': { de: 'Netz: nicht animiert', en: 'Net: not animated' },
    'timeline.net.partial': { de: 'Netz: Keyframe {n} ohne Netz', en: 'Net: keyframe {n} without a net' },
    'timeline.net.pending': { de: 'Netz: zweiten Keyframe hinzufügen', en: 'Net: add a second keyframe' },
    'timeline.net.incompatible': { de: 'Netz: nicht animierbar', en: 'Net: cannot be animated' },
    'timeline.net.constant': { de: 'Netz: gleich in allen Keyframes', en: 'Net: same in all keyframes' },
    'timeline.net.animated': { de: 'Netz: animiert ({n} Keyframes)', en: 'Net: animated ({n} keyframes)' },

    // ---- the Netz sheet ----
    'net.strengthFine': { de: 'Stärke fein', en: 'Strength (fine)' },
    'net.focusFine': { de: 'Fokus fein', en: 'Focus (fine)' },
    'net.strengthFine.more': { de: 'Stärke fein mehr', en: 'Strength (fine) more' },
    'net.strengthFine.less': { de: 'Stärke fein weniger', en: 'Strength (fine) less' },
    'net.focusFine.more': { de: 'Fokus fein mehr', en: 'Focus (fine) more' },
    'net.focusFine.less': { de: 'Fokus fein weniger', en: 'Focus (fine) less' },
    'net.domain.single': { de: 'Einzeln', en: 'Single' },
    'net.domain.tiled': { de: 'Gekachelt', en: 'Tiled' },
    'net.domain.field': { de: 'Feld', en: 'Field' },
    'net.readout.field': { de: 'Feld: {n} × {n} Kacheln', en: 'Field: {n} × {n} tiles' },
    'net.readout.tiled': { de: 'Gekachelt: {n} × {n}', en: 'Tiled: {n} × {n}' },
    'net.readout.single': { de: 'Einzeln: ein Netz', en: 'Single: one net' },
    'net.domain.single.title': { de: 'Einzeln: ein geschlossenes Netz, wie in Hinterreiters Figuren (Größe 1 füllt die Fläche)', en: "Single: one closed net, as in Hinterreiter's figures (Shape Size 1 fills the canvas)" },
    'net.domain.tiled.title': { de: 'Gekachelt: die gewarpte Kachel wird so oft über die Fläche wiederholt, wie die Größe sagt, jede Kopie gleich', en: 'Tiled: the warped tile is repeated across the canvas by Shape Size, every copy alike' },
    'net.domain.field.title': { de: 'Feld: das Gesetz spannt über alle Größe × Größe Kacheln; jede Kachel ist eine skalierte Kopie des angeklickten Musters (ungerade Größe 3, 5, 7, 9)', en: 'Field: the law spans all Shape Size x Shape Size tiles; each tile is a scaled copy of the clicked pattern (odd Shape Size 3, 5, 7, 9)' },
    'net.alternate.title': { de: 'Nur bei Gekachelt: jede zweite Kachel spiegeln, damit die Maschenweiten über die Nähte weiterlaufen (eine Deutung: das Buch zeigt das für Linienmotive, nicht für die Abstandsfunktion)', en: 'Only in Tiled mode: mirror every other tile so mesh widths run on across tile seams (an interpretation - the book shows this for line motifs, not for the spacing function)' },
    'net.hint.fieldOdd': { de: 'Feld braucht eine ungerade Größe (3, 5, 7, 9).', en: 'Field needs an odd Shape Size (3, 5, 7, 9).' },
    'net.macro': { de: 'Macro-Zellen (Macro × Micro)', en: 'Macro cells (macro × micro)' },
    'net.focus.title': { de: 'Wo die breiteste (Sinus) / schmalste (Tangens) Masche in der Kachel liegt: -1 = linker Rand, 0 = Mitte, +1 = rechter Rand', en: 'Where the widest (sinus) / narrowest (tangens) mesh sits in the tile: -1 = left edge, 0 = centre, +1 = right edge' },
    'net.alternate': { de: 'Kacheln spiegeln', en: 'Mirror alternate tiles' },
    'net.reason.fieldOdd': { de: 'Feld braucht eine ungerade Größe', en: 'Field needs an odd shape size' },
    'net.reason.focus': { de: 'Fokus gilt für Sin und Tan', en: 'Focus applies to Sin and Tan' },

    // ---- the phone layout's labels (sheets redesign, commit 6a): the sub-tab names, the sheet hosts (also the names of their "..." buttons), the tool row and sub-tab row groups ----
    'subtab.raster': { de: 'Raster', en: 'Grid' },
    'subtab.ebenen': { de: 'Ebenen', en: 'Layers' },
    'subtab.zeit': { de: 'Zeit', en: 'Time' },
    'subtab.harmonie': { de: 'Harmonie', en: 'Harmony' },
    'subtab.spuren': { de: 'Spuren', en: 'Trails' },
    'subtab.art': { de: 'Art', en: 'Type' },
    'subtab.achsen': { de: 'Achsen', en: 'Axes' },
    'phone.tools': { de: 'Werkzeuge', en: 'Tools' },
    'phone.subtabs': { de: 'Unterbereiche', en: 'Sub-sections' },
    'farbe.strategy.group': { de: 'Verteilungsstrategie', en: 'Distribution strategy' },
    'layers.more': { de: 'Ebenen-Einstellungen', en: 'Layer settings' },
    'timeline.more': { de: 'Zeitleiste: Mehr', en: 'Timeline: more' },

    // ---- the Info card (sheets redesign, commit 6b): the sections "Netz" and "Zeitleiste"; each line is one key, the German is the text of the markup; short on purpose (6c): no line over 140 characters ----
    'info.net.title': { de: 'Netz', en: 'Net' },
    'info.net.kinds': { de: 'Sinus: Maschen zum Kachelrand hin schmaler. Tangens: breiter. Geometrisch: gleiches Verhältnis.', en: 'Sine: meshes get narrower towards the tile edge. Tangent: wider. Geometric: same ratio each step.' },
    'info.net.field': { de: 'Feld: ein Gesetz über alle Kacheln, ungerade Größe von 3 bis 9.', en: 'Field: one law across all tiles, odd size from 3 to 9.' },
    'info.net.locks': { de: 'Solange ein Netz aktiv ist, sind Kurve und Frei aus.', en: 'While a net is active, Curve and Free are off.' },
    'info.tl.title': { de: 'Zeitleiste', en: 'Timeline' },
    'info.tl.keyframes': { de: 'Ein Keyframe ist eine Ebene mit gefüllter Raute. Sie muss zum vorigen passen (Form, Knotenzahl, Größe, Symmetrie, Linienzahl).', en: 'A keyframe is a layer with a filled diamond. It must match the previous one (shape, node count, size, symmetry, number of lines).' },
    'info.tl.net': { de: 'Das Netz bewegt sich nur, wenn jeder Keyframe ein Netz hat und je zwei benachbarte Netze zusammenpassen.', en: 'The net only moves when every keyframe has a net and each two neighbouring nets fit together.' },

    // ---- common ----
    'common.atMin': { de: 'Kleinster Wert erreicht.', en: 'Smallest value reached.' },
    'common.atMax': { de: 'Größter Wert erreicht.', en: 'Largest value reached.' },
    // the German keeps the full stop the two scripts that say it have always written (ui-layer.js, ui-layers.js)
    'common.noLayer': { de: 'Keine Ebene aktiv.', en: 'No layer active.' }
  };

  let lang = DEFAULT_LANG;

  function fill(text, params) {
    if (!params || typeof params !== 'object') return text;
    return text.replace(/\{(\w+)\}/g, function (m, name) { return Object.prototype.hasOwnProperty.call(params, name) && params[name] !== undefined && params[name] !== null ? String(params[name]) : m; });
  }

  function keyText(key) { try { return String(key); } catch (e) { return ''; } }
  // The text of a key: the current language, else German, else the key itself. Never throws (an unknown key, a bad params object, a non-string key).
  function t(key, params) {
    try {
      const e = Object.prototype.hasOwnProperty.call(DICT, key) ? DICT[key] : null;
      if (!e) return keyText(key);
      const text = (typeof e[lang] === 'string' && e[lang] !== '') ? e[lang] : (typeof e.de === 'string' && e.de !== '' ? e.de : keyText(key));
      return fill(text, params);
    } catch (err) { return keyText(key); }
  }
  function has(key) { try { return Object.prototype.hasOwnProperty.call(DICT, key); } catch (e) { return false; } }

  // the language the URL asks for (?lang=en | ?lang=de), else the default; the search string comes in as a parameter so a test can feed it
  function langFromSearch(search) {
    const m = /(?:^|[?&])lang=([A-Za-z]+)(?:&|$)/.exec(String(search || ''));
    const l = m ? m[1].toLowerCase() : '';
    return LANGS.indexOf(l) >= 0 ? l : DEFAULT_LANG;
  }

  // ---- the DOM part (a function of a root element; none of it runs at load unless the language is not the default) ----
  function ownTextNode(el) {
    const kids = el.childNodes || [];
    for (let i = 0; i < kids.length; i++) if (kids[i].nodeType === 3 && /\S/.test(kids[i].nodeValue || '')) return kids[i];
    return null;
  }
  function setName(el, text) {
    el.setAttribute('aria-label', text);
    if (el.hasAttribute('title')) el.setAttribute('title', text);
  }
  function applyEl(el) {
    const k = el.getAttribute('data-i18n'), kl = el.getAttribute('data-i18n-label'), kt = el.getAttribute('data-i18n-title');
    if (k && has(k)) {
      const own = ownTextNode(el);
      if (own) { own.nodeValue = t(k); }
      else setName(el, t(k));
    }
    if (kl && has(kl)) setName(el, t(kl));
    if (kt && has(kt)) el.setAttribute('title', t(kt));
  }
  function applyI18n(rootEl) {
    const r = rootEl || (typeof document !== 'undefined' ? document : null);
    if (!r || typeof r.querySelectorAll !== 'function') return 0;
    const list = r.querySelectorAll('[data-i18n], [data-i18n-label], [data-i18n-title]');
    let n = 0;
    for (let i = 0; i < list.length; i++) { applyEl(list[i]); n++; }
    if (r.nodeType === 1 && (r.hasAttribute('data-i18n') || r.hasAttribute('data-i18n-label') || r.hasAttribute('data-i18n-title'))) { applyEl(r); n++; }
    return n;
  }

  function setLang(l) {
    const next = LANGS.indexOf(l) >= 0 ? l : DEFAULT_LANG;
    const changed = next !== lang;
    lang = next;
    if (typeof document !== 'undefined' && document.documentElement) {
      applyI18n(document);
      if (changed && typeof document.dispatchEvent === 'function' && typeof Event === 'function') document.dispatchEvent(new Event('langchange'));
    }
    return lang;
  }

  const api = {
    DICT: DICT, DEFAULT_LANG: DEFAULT_LANG, LANGS: LANGS,
    t: t, has: has, langFromSearch: langFromSearch, applyI18n: applyI18n, setLang: setLang,
    get lang() { return lang; }
  };
  root.uiI18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // the URL selects the language BEFORE any script builds a string; the markup is rewritten only when it is not the default (German stays as authored)
  if (typeof location !== 'undefined' && location && typeof location.search === 'string') {
    const wanted = langFromSearch(location.search);
    if (wanted !== DEFAULT_LANG) {
      lang = wanted;
      if (typeof document !== 'undefined' && document.addEventListener) {
        const go = function () { applyI18n(document); };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
      }
    }
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
