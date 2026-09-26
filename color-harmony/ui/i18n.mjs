/** Change only DEFAULT_LOCALE to switch the entire interface. */
export const DEFAULT_LOCALE = 'de';
const pairs = {
  title:['Farborgel','Color organ'], subtitle:['Ein Instrument für Farbbeziehungen','An instrument for color relationships'],
  circle:['Kreis','Circle'], triangle:['Dreieck','Triangle'], register:['Register','Register'], harmony:['Harmonie','Harmony'],
  complementary:['Gegenfarben','Complementary'], three:['Dreier','Three-color group'], four:['Vierer','Four-color group'],
  triad:['Triade','Triad'], tetrad:['Tetrade','Tetrad'],
  chord3:['Dreier · symmetrischer Sonderfall: Triade','Three-color group · symmetric special case: triad'],
  chord4:['Vierer · symmetrischer Sonderfall: Tetrade','Four-color group · symmetric special case: tetrad'],
  white:['Weiß','White'], black:['Schwarz','Black'], shadow:['Schatten','Shadow'], value:['Wert','Value'], gray:['Grau','Gray'],
  isotint:['Weißgleiche · gleicher Weißanteil','Isotint · equal white content'],
  isotone:['Schwarzgleiche · gleicher Schwarzanteil','Isotone · equal black content'],
  shadowSeries:['Schattenreihe / psychologische Reingleiche','Shadow series / psychological equal purity'],
  isovalent:['Wertgleiche · gleiche Anteile über alle Farbtöne','Isovalent · equal contents across all hues'],
  atlas:['Atlas','Atlas'], continuum:['Verlauf','Continuum'], compound:['Zusammengesetzt','Compound'],
  shared:['Gemeinsames Glied','Shared member'], substitution:['Ersetzung','Substitution'], level:['Stufe','Level'],
  info:['Info','Info'], close:['Schließen','Close'], noAtlas:['Kein Atlaswert','No atlas value'], hue:['Farbton','Hue'],
  full:['Vollfarbe','Full color'], detail:['Wissenschaftliche Details','Scientific details'],
  selection:['Auswahl','Selection'], source:['Quelle der Beziehung','Relation source'], pages:['Seiten','Pages'],
  primary:['Primärquelle · Ostwald 1921','Primary source · Ostwald 1921'],
  contemporary:['Zeitgenössische Oklab-Interpolation','Contemporary Oklab interpolation'],
  displayNote:['Heutige Oklab-Bildschirmfarben · keine historischen Pigmentrekonstruktionen','Contemporary Oklab screen colors · not historical pigment reconstructions'],
  research:['Forschungsinstrument / 6A','Research instrument / 6A'],
  sourceNote:['Historische Struktur, zeitgenössische Darstellung.','Historical structure, contemporary rendering.'],
  depthNote:['Stufe bezeichnet hier die Tiefe des Gruppenbaums.','Level here means depth of the group tree.'],
  valueNote:['Wertgleiche: 24 diskrete Atlaswerte. Kein kontinuierlicher Pfad.','Isovalent: 24 discrete atlas values. No continuous path.'],
  pathNote:['Proben des gewählten Verlaufs. Ohne historische Farbetiketten.','Samples of the selected path. Without historical color labels.'],
  circleNote:['Ein Register. 24 Farbtöne.','One register. 24 hues.'],
  triangleNote:['28 Atlaswerte · nach Buchstaben geordnet','28 atlas values · arranged by letters'],
  analyticNote:['Analytisches Dreieck · Weiß / Schwarz / Vollfarbe','Analytical triangle · white / black / full color'],
  registerNote:['28 Register × 24 Farbtöne','28 registers × 24 hues'],
  harmonyNote:['Farben und ihre Beziehungen','Colors and their relationships'],
  sharedAxis:['Eine gemeinsame Grauachse','One shared gray axis'],
  sample:['Probe','Sample'], samples:['Verlauf wählen','Select a path sample'],
  gap:['Kreisabstände','Circular gaps'], lab:['Oklab','Oklab'], rgb:['sRGB','sRGB'],
  regular:['Kreisbeziehung','Circle relation'], example:['Beispiel','Example'], recursive:['Rekursiv','Recursive'],
  groupA:['Gruppe A','Group A'], groupB:['Gruppe B','Group B'], original:['Ursprung','Original'],
  replacement:['Ersatzgruppe','Replacement group'], active:['Ergebnis','Result'],
  provenance:['Aufbau','Construction'], retained:['Ursprung bleibt im Aufbau erhalten','Original retained in construction'],
  swatch:['Farbe auswählen','Select color'], skip:['Zum Farbfeld','Skip to color field'],
  relation:['Beziehung','Relation'], views:['Ansicht','View'], mode:['Darstellung','Display mode'],
  cardinality:['Farben im Kreis','Colors in circle'], graySelected:['Gemeinsamer Grauwert','Shared gray value'],
  previousHue:['Voriger Farbton','Previous hue'], nextHue:['Nächster Farbton','Next hue'],
  hueKeys:['Pfeiltasten: Farbton wechseln','Arrow keys: change hue'],
  gridKeys:['Pfeiltasten: Farbton und Register wechseln','Arrow keys: change hue and register'],
  originRegister:['Ausgangsregister','Source register'],
  sampleContext:['Verlauf am ausgewählten Farbton','Path at the selected hue'],
  atlasContext:['Atlasregister als Bezug','Atlas register as reference'],
  whiteCorner:['Weißpunkt','White point'], blackCorner:['Schwarzpunkt','Black point'],
  error:['Das Instrument konnte nicht geladen werden. Bitte den lokalen Startserver verwenden.','The instrument could not load. Please use the local server.']
};
export const messages = Object.freeze(Object.fromEntries(Object.entries(pairs).map(([key,[de,en]])=>[key,Object.freeze({de,en})])));
export function t(key, locale=DEFAULT_LOCALE) {
  if (!['de','en'].includes(locale)) throw new RangeError('Unsupported locale');
  if (!messages[key]) throw new Error(`Unknown translation: ${key}`);
  return messages[key][locale];
}
