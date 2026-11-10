# Auftrag 039 — Aufräumen: Vorlagen und Roadmap

**Typ U (nur Dokumentation und Vorlagen), Prüfstufe L1.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/039-aufraeumen.md mit diesem Text an. Bericht: reports/039.md (höchstens 30 Zeilen). Branch: task/039-aufraeumen von main (erwarteter HEAD b8ee6f5e). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Schreiben nur:** ROADMAP.md, docs/claude-context.md (falls dort Stand geführt wird), Claude.md (nur der "Now"-Absatz, Zeilenzahl 38 beibehalten), tasks/_template.md, reports/_template.md, Task-Datei, Bericht, usage.csv. Kein Code, keine Tests, keine ?v=-Änderung (keine Skripte betroffen).

**Aufgabe:**
1. **tasks/_template.md und reports/_template.md anlegen** (existieren nicht; Bericht 016 nannte das). Inhalt aus dem Format von tasks/038-*.md und reports/038.md ableiten: Typ/Prüfstufe, Regeln, Branch, Befund, Vorab, Ziel, Nicht ändern, Prüfpunkte, Sabotagen, Prüfung; Bericht höchstens 30 Zeilen mit Hashes, Prüfpunkten, Sabotagen, Testzahlen, /usage vorher/nachher, Abweichungen, "nicht im Browser gesehen". Ein Hinweis: Task-Datei VOR der Arbeit anlegen; Berichtsname reports/NNN.md; proof.sh-Nummer dreistellig.
2. **ROADMAP.md ("Spatial morph: staged plan" und passende Abschnitte) aktualisieren,** knapp, je Punkt ein bis zwei Zeilen, Task-Nummer nennen:
   - d3 Filter fertig (015 bis 023): Score auf symmetrie-geschlossenen Linien (021), Bildtest im Hintergrund (022), nodeMiss/boundaryMiss nur Sortierung (023); offen: Lockerung Score-dangling (336 auf bis zu 448), volle Suche K2, Anzeige "x von y"/Score in der Liste sichtbar machen.
   - Linien-Schalter (024): Zyklus AUS/AN/Slider, Rahmen bleibt bei AUS, Gallery zeichnet immer Linien.
   - Playback-Farben (026 bis 031): Flächenzuordnung statt Ortsabtastung; Spatial-Farben (032 bis 034) nur Linear/Radial mit zwei Keyframes, Flächen unter 5 % der Zelle weiter Raster. Bekannte Einschränkungen: Dreieck +4 Byte und dLin 0.0656 (akzeptiert); Pin in test-spatial-morph-color.js gelockert (p = 1: 70 % auf 60 %, Schwelle 65 auf 55 %, Begründung: überlappungsgewichteter Mittelwert); Bilinear und Kacheln mit Gewichten an w01/w11 bleiben Raster; Rest-Pastell im Spatial-Pfad (Stern/Raute 0.317 auf 0.105); Messkette 027 bis 033 in tools/morph/measure-face-match.js reproduzierbar.
   - SVG-Export (025, 035, 036): Flächen, Linien mit Stärke, räumliche Morph-Zwischenstellung, keine p5-Warnung. Bewusst nicht exportiert (gewollt): Netz-Overlay-Linien, Cross-Layer-Flächen (Funktion derzeit nicht aktivierbar), Hover-Umriss. Feine Nähte zwischen Flächen im Viewer vertretbar (Haarriss-Schutz weggelassen).
   - Performance (037, 038): Frame-Memo im räumlichen Morph, Browser-Median 429 auf 25 ms (Muster: 2 Ebenen, je 2 Linien, 2 Farben); dichtes Hexagon im Browser nicht gemessen (Node 313 bis 456 ms); AUS-Pfad-Golden im Browser für 038 nicht nachgewiesen.
   - Ebenen ohne Füllung: Entscheidung A (nur Linien, gewollt).
   - Offene Kleinigkeiten als Liste: Ebenen-"Mehr" an Canvas-Kante, Statuscode "Basis plus Ebene mit anderer Linienzahl", Flächen bei "keine Symmetrie", Symmetrie der Ebenen, Ebenen-Felder am Desktop, Linienzuordnung vereinfachen, doppelte Render-Schleife (gemeinsame Quelle, L3), Namensumgehung layer['nod'+'es'] in core/spatial-morph.js, Übersetzung der übrigen Texte. Nicht getestet: Firefox, Screenreader, echtes kleines Telefon, Querformat.
3. **Claude.md "Now"-Absatz und docs/claude-context.md** auf main = Stand nach 038 bringen (ein bis zwei Sätze, Zeilenzahl von Claude.md bleibt 38).
4. Veraltete Aussagen ("Flächen folgen", "Netz wird ignoriert" als aktueller Stand, "Frame-Zeit 520 bis 860 ms, vorerst nicht optimieren") korrigieren oder als Verlauf kennzeichnen; per grep belegen, welche Stellen geändert wurden.

**Nicht ändern:** Code, Tests, Baselines, off-path-golden.json, sketch.js, core/*, tools/*.js, alte Berichte und Tasks.

**Prüfung:** `bash tools/proof.sh L1 039` und `tools/guard.sh main` (beide müssen PASS bleiben); `git diff --stat main..HEAD` darf nur .md-Dateien und usage.csv nennen (im Bericht bestätigen). Bericht: Hashes, geänderte Dateien, ersetzte Aussagen (alt -> neu, kurz), /usage vorher/nachher, Abweichungen. Arbeit und Bericht getrennt committen, usage.csv-Zeile.
