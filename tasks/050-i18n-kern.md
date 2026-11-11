# Auftrag 050 — i18n Kern (sketch.js, core/color.js)

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/050-i18n-kern.md mit diesem Text an. Bericht: reports/050.md (höchstens 30 Zeilen). Branch: task/050-i18n-kern von main. Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Befund:** Im englischen UI erscheint u. a. "Sin und Tan brauchen mindestens 4 Knoten; Knoten von 3 auf 4 gesetzt." auf Deutsch. Reste laut tools/i18n/export-untranslated.js: sketch.js 2 Meldungen, core/color.js 4 Einträge.

**Aufgabe:** Auf ui-i18n.js umstellen (Muster 043 bis 046: Schlüssel mit Parametern, deutscher Text als Fallback, Deutsch zeichengleich):
1. sketch.js: die zwei Meldungen (per grep nach "brauchen mindestens 4 Knoten" und "ungerade Größe"). Die Ausdrücke dahinter als benannte Parameter. Wege prüfen, wie sketch.js an UI.t kommt (typeof-Schutz, Fallback wenn UI fehlt). Die acht geschützten Funktionen bleiben byte-gleich; liegt eine Meldung in einer davon: STOP mit 2 Optionen.
 EN: Sin and Tan need at least 4 nodes; nodes changed from {from} to 4. | Field needs an odd size (3, 5, 7, 9); {size} does not fit, so single net. The size stays {kept}. (Parameternamen nach Quelltext anpassen.)
2. core/color.js: Isotones (Schwarzgleiche) -> Black (isotints); Isotints (Weißgleiche) -> Isotints; Shadow series (Schattenreihe) -> Shadow series; Richtung -> Direction. Prüfen, ob die Texte in der UI erscheinen und wie sie laufen (Daten/Namen oder Anzeige); wenn core/ keinen Zugriff auf UI.t hat, Lösung mit minimalem Eingriff vorschlagen oder STOP mit 2 Optionen. Deutsch zeichengleich.
3. Export neu erzeugen: offene Einträge in sketch.js und core/color.js = 0 (sonst listen).

**Nicht ändern:** acht geschützte Funktionen in sketch.js, core/tiling.js, core/faces.js, core/facecolor.js, core/spatial-morph*.js, tools/morph/off-path-golden.json, Baselines. Pins nur mit eigenem Commit und Begründung. ?v= bumpen (z. B. 20261111ihta).

**Prüfung:** bash tools/proof.sh L3 050 plus AUS-Pfad-Golden im Browser (Verfahren: Kopfkommentar tools/morph/measure-off-path.js, Beispiel reports/011.md; das holt den offenen Nachweis aus 038 nach); geschützte Tests 57/57 und 61/61, test-i18n, test-p5-names. Deutsch-Gleichheitstest (alte Meldung = UI.t-de = Fallback), Sabotage (2): en leer; Parameter vertauscht. Bericht: Hashes, Zählung, Parameternamen, /usage vorher/nachher, was nicht im Browser gesehen wurde.
