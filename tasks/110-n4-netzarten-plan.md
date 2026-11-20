# Auftrag 110 — N4: weitere Netzarten, Bestand gegen Quelle und Plan (Typ U, Prüfstufe L1)

Branch `task/110-n4-netzarten-plan` von main `b5edb332` (Merge 109). Nichts gebaut: keine Änderung in `core/`, `sketch.js`, `ui-*.js`, Tests. Neu nur dieser Plan und `reports/110.md`. Bestandstabelle, Definitionen, Seitenangaben und die Liste des Nicht-Gelesenen stehen im Bericht; hier steht, was (nicht) gebaut werden soll.

## 0. Kernaussage in sechs Zeilen
1. Die App hat **ein** Netz-Verfahren (Warp F auf die Knoten, gerade Sehnen) mit drei Gesetzen (Sinus, Tangens, Geometrisch), drei Gebieten (Einzeln, Gekachelt, Feld) und drei Formen. Die Quelle kennt **zehn Netzarten**; Netzart 1 hat zehn Familien (□N, DN, HDN, □MN, △TN, △GN, △N, \*N, △MN, \*MN).
2. **Abgedeckt** sind □N (Quadrat), △N (Dreieck) und \*N (Sechseck), die zwei letzten mit benannten Abweichungen (rechtwinklige Halbmasche der Quelle gegen gleichseitiges Dreieck der App; glatte gegen gerade Kanten; Rahmen).
3. Die **übrigen sieben Familien** sind keine neuen Warps, sondern **andere Linienauswahlen** über demselben Gitter (Diagonalscharen). Sie haben in der App keinen Träger; als Anzeige (Netzlinien) wären sie möglich.
4. **Netzarten 2 bis 10** brauchen andere Abbildungen, gekrümmte Linien, runde und trapezförmige Rahmen und neue Formen: außerhalb der Architektur (gerade Sehnen, Rechteck-Canvas, drei Formen). Die Quelle stuft 2 A selbst als „mit Netz eins vergleichbar, nicht nötig“ ein.
5. **N2b** und **N2c** haben keine Quelle; zurückstellen. Die E1 ≠ E2 der Quelle sind im Feld über X ≠ Y schon da.
6. **Empfehlung: keine neue Netzart bauen.** Zwei kleine, optionale Folgen (F1 Familienname im Readout, F2 Diagonal-Anzeige für das Quadrat), beide nur nach Entscheidung (§5).

## 1. Einträge (je ein möglicher Folgeauftrag)
Geschützt in allen Einträgen: `core/tiling.js`, `core/faces.js`, `core/facecolor.js`, `core/spatial-morph-render.js`, Golden, Baselines, `gallery/v2`; ihre Änderung ist **in keinem Eintrag nötig** (sonst stoppen und fragen).
| # | Eintrag | Beschreibung | Dateien | Aufwand / Risiko | Abhängigkeit | Typ / Stufe | Freigaben |
|---|---|---|---|---|---|---|---|
| **F1** | Familienname im Readout | Zeile „Netz: □N (Quadratnetz)“ / „△N (Dreiecknetz)“ / „\*N (Sechsecknetz)“ im bestehenden Readout, de und en; kein neues Bedienelement. Die Form bestimmt die Familie, die Sperre „Netztyp passt zur Form“ gilt damit von selbst. | `ui-net-readout.js`, `ui-net.js`, `ui-i18n.js`, `index.html` (`?v=`), Pins (`test-net-readout*`, `test-i18n-core`, `test-info-card` falls betroffen) | klein / gering (Text, Pins) | keine | K / L2 | Wortlaut |
| **F2** | Diagonal-Anzeige (Quadrat) | Unter „Netzlinien zeigen“ wahlweise **eine Diagonalschar** (oder beide, oder die Halbdiagonale) der Quadratmaschen als **glatte Kurve** (Tabelle S. 11–16: DN, HDN, □MN, △GN, △TN lesen sich so). Reine Anzeige wie das heutige Overlay: nicht im Export, kein Einfluss auf Muster, Knoten, Flächen. | `core/netwarp.js` (`netGridLines`, neuer Schalter), `ui-net.js`, `sketch.js` (Netz-Steuerung, Freigabe), `ui-i18n.js`, Tests (`test-net-lines-overlay`), `?v=` | klein–mittel / gering (Overlay, Standard aus; Frame-Zeit nur bei eingeschaltetem Overlay) | F1 optional | K / L2 | Bedienelement (Vorschlag unten) |
| F3 | Treue Dreieck (rechtwinklige Masche) | Dreieck-Feld mit der **halbierten Rechteckmasche** der Quelle statt der gleichseitigen: neue Form oder neuer Rahmen (orthogonaler Kasten „O“, in 087c gemessen: Knick 3,8–7,1 px, bei X = Y nur 86,7 % Deckung, Flächen gesperrt). | `core/netwarp.js`, voraussichtlich `core/tiling.js` (Gitterbau) | hoch / hoch | – | R, dann K / L3 | **STOP-Regel `tiling.js`** |
| F4 | Glatte Kanten Dreieck/Sechseck | Diagonal- und Sechseckkanten als glatte Kurven statt Polygonzug/Sehnen: im Feld nur als **Anzeige** (Spline durch die abgebildeten Knoten) möglich, nicht als Zeichnung (Flächen und Export bleiben stückweise gerade). | `core/netwarp.js`, `core/faces.js` (Zellflächen) | hoch / hoch (Kurve ≠ Fläche) | F2 | R / L2 | `faces.js` |
| F5 | Teilausschnitt (Viertel) | „Ausschnitt eines größeren Netzes“ (Fig. 46–53): Netz-Sicht um (dx, dy) Maschen versetzt oder Viertelausschnitt; die App hat Fokus (Verschiebung der engsten/weitesten Masche), aber keinen Ausschnitt. | `core/netwarp.js`, UI | mittel / mittel (Feldrand, Export `fieldBase`) | – | U (erst klären) | – |
| F6 | Netzart 2 A (Trapez, projektiv) | Perspektivische Abbildung der Quadratmasche (Strahlenbüschel statt zweiter Barenschar): Geraden bleiben gerade, Sehnen wären **exakt**. Quelle: „nicht nötig“. | neue Abbildungsklasse in `core/netwarp.js`, Session, Export, UI | hoch / mittel | – | R (Machbarkeit) | – |
| F7 | Netzarten 2 B, 5 A (Komplexe mit Hauptpunkt) | Sektor-Netze um einen Hauptpunkt für Vier-, Sechs-, Achtecke (Fig. 69–71, 276/277). Berührt die Form „Sechseck/Dreieck“ als Sektoren; Lesestand zu gering (S. 24–29, 85–87 nicht gelesen). | – | unklar | Quellen lesen | U | – |
| F8 | Netzarten 3 bis 10 | Kreisbüschel, Kreisscharen, Tangentennetze, runde Rahmen. Gekrümmte Linien (die App zeichnet gerade Sehnen: `core/netwarp.js`, „straight lines only“), runde Bildrahmen, neue Formen. | neue Module, `core/tiling.js`, `core/faces.js` | sehr hoch / sehr hoch | – | nicht beauftragen | – |
| F9 | Netzart 4 (Tangentennetze als Linien-Erzeuger) | Reine Geradenscharen (Tangenten an Kreis/Ellipse/…), kein Warp: ein **Muster-Erzeuger**, nicht ein Netz der heutigen Art. Nicht mit dem Netz-Blatt verwechseln. | neues Modul | hoch / mittel | – | R | – |
| **N2b** | Maschen ≠ Kacheln (E_i teilt X_i) | 104 §3. **Ohne Quelle:** die Quelle kennt keine Kacheln; ihre E1 × E2 sind die Maschen, die das Feld mit X × Y schon hat. Nutzen nur: große Felder (X · Y > 12) mit kleinem W (Optimum 7–12). | `core/netwarp.js`, `core/session.js`, `ui-net*.js` | klein–mittel / gering, aber UI-Zeile | – | K / L3 | UI |
| **N2c** | `macroX/macroY` (Einzeln/Gekachelt) | 085. App-Erweiterung (geschachteltes Netz, `spec.macro`). Die Quelle zeigt E1 ≠ E2 nur im geschlossenen Netz. | `core/netwarp.js`, UI | klein–mittel / gering | – | K / L2 | UI |

## 2. Empfohlene Reihenfolge und Begründung
1. **Nichts bauen, bis §5 Frage 1 entschieden ist.** Die Abweichungen von △N und \*N (rechtwinklig/gleichseitig, glatt/gerade, Rahmen) sind Auslegung, nicht Fehler; F3 und F4 wären teuer, riskant und berühren geschützte Dateien.
2. **F1** (Familienname im Readout) zuerst, falls gewünscht: billig, gibt dem Anwender die Quelle zurück (Name und Kürzel der Netzart), ändert kein Bild. Voraussetzung der Idee „Netztyp passt zur Form“, ohne Auswahl.
3. **F2** (Diagonal-Anzeige) danach, falls gewünscht: die einzige Familie-Erweiterung, die ohne neue Abbildung auskommt; schaltet die Quadrat-Familien DN, HDN, △GN, △TN und □MN als **sichtbare** Netzlinien frei (Hinterreiter S. 11–16), standardmäßig aus.
4. **F5, F6, F7, F9:** erst U/R, wenn der Nutzer ein Ziel nennt; nicht jetzt. **F8: nicht beauftragen.** **N2b, N2c: verwerfen oder zurückstellen**, keine Quelle, kein Nutzer-Ziel genannt.
Begründung: Nutzen für den Anwender liegt in sichtbarer Quellentreue bei kleinem Risiko (F1, F2); alles andere ist Aufwand ohne Rückhalt in der Quelle (N2b, N2c) oder ein neues Programm (F6 bis F9).

## 3. Ausdrückliche Bewertung
- **N2b** lohnt sich **nicht**: Es ist eine App-Erweiterung. Hinterreiters E1 × E2 sind Maschen; sie sind im Feld X × Y (105/106 für gerade und ungerade). Das einzige Argument (W-Optimum 7–12 bei großen X · Y) ist als **Hinweis** (106) gelöst; es für Dreieck und Sechseck zu übertragen hängt an einer ungeklärten Zählung (§5 Frage 4). Das Gesetz des Optimums „verwirft“ nach der Quelle Netze außerhalb der Grenzen; die App lässt sie zu.
- **N2c** bleibt zurück: das geschachtelte Netz (`macro`) ist eine App-Idee (Gebiet Einzeln/Gekachelt); die Quelle hat nur E1 ≠ E2. Wer **E1 ≠ E2 im geschlossenen Einzel-Netz** will, bräuchte zwei Ordnungen (`gridSpec.ordnung` ist ein Skalar): das ist **nicht** N2c, sondern ein Eingriff in den Gitterbau (`core/forms.js`, Baselines): nicht empfohlen; das Feld mit X ≠ Y bildet die Quelle ab.
- **Netzauswahl in der UI** (nur Vorschlag, nichts gebaut): Eine **Auswahl** der zehn Familien ist für den Anwender nicht sinnvoll, weil nur drei Träger (Formen) existieren und die Form die Familie festlegt. „Netztyp muss zur Form passen“ wird daher **durch den Aufbau erfüllt** (keine Sperre, keine Warnung, keine automatische Zuordnung nötig). Sichtbar gemacht wird die Zuordnung durch F1; gewählt wird nichts.
```text
Readout (heute):  Feld: 9 × 7 Kacheln, Rand angeschnitten
Readout (F1):     Netz △N (Dreiecknetz) · Feld: 9 × 7 Kacheln, Rand angeschnitten       [Quadrat: □N, Sechseck: *N (Sechsecknetz)]
Netzlinien (F2):  [Netzlinien zeigen]  Diagonale: [Aus | ╱ | ╲ | ╳ | Halb]               (nur Quadrat; Standard Aus)
```
Position: im Blatt Netz unter „Netzlinien zeigen“ bzw. im bestehenden Readout, keine neue Leiste; **vorher abstimmen** (Telefon-Layout nicht gesehen).

## 4. Messgrößen und Sabotagen (für F1 und F2, falls beauftragt)
- **F1:** Readout-Tabelle Form × Größe × Sprache (de, en), keine neue Taste; `?v=`; Pins `test-net-readout`, `test-i18n-core`; Sabotagen: Name der falschen Form, Name fehlt in en.
- **F2:** Overlay-Test (Diagonale sitzt auf den abgebildeten Maschenecken, 0 px; Kurve glatt, keine Knicke an den Maschenlinien; nicht im Export; Frame-Zeit mit Overlay aus ≤ +1 %; Golden 30/30); Sabotagen: Diagonale in falscher Richtung, Overlay in den Export geschrieben, Standard an.

## 5. Offene Fragen an den Nutzer
siehe `reports/110.md` Teil 4 bzw. unten (fünf Fragen mit Empfehlung):
1. **Treue gegen Auslegung bei △N und \*N:** (a) so lassen, Abweichungen (gleichseitig, Polygonzug, Parallelogramm-Rahmen) als bewusste App-Auslegung dokumentieren (**Empfehlung**); (b) Treue anstreben (rechtwinklige Halbmasche, glatte Kanten): eigener Auftrag R, danach K, mit STOP-Regel `tiling.js`; (c) nur glatte Kanten als Anzeige (F4).
2. **Familienname im Readout (F1):** (a) ja, „Netz: □N / △N / \*N“ mit Namen (**Empfehlung**); (b) nur Kürzel; (c) nein.
3. **Diagonal-Anzeige für das Quadrat (F2):** (a) ja, unter Netzlinien (**Empfehlung, klein, Standard aus**); (b) nein, die übrigen Familien bleiben unsichtbar; (c) als eigene Netzart wählbar (nicht empfohlen: kein Träger in der App).
4. **Optimum W für Dreieck (8–16) und Sechseck (6–10):** (a) kein Hinweis, weil W dort nicht X · Y ist (**Empfehlung**); (b) Zählung klären (Dreiecke im Canvas) und Hinweis wie beim Quadrat: eigener U-Auftrag.
5. **Netzarten 2 bis 10 und N2b, N2c:** (a) alles zurückstellen und im ROADMAP als „nicht beauftragt, Quelle gelesen bis auf Netzart 2–10“ vermerken (**Empfehlung**); (b) Machbarkeitsstudie F6 (Trapez, projektiv) und F7 (Hauptpunkt-Komplexe) als Typ R; (c) N2b doch, wegen Optimum.
