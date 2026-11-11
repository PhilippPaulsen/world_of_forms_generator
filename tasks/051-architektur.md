# Auftrag 051 — Architektur-Ist-Aufnahme und Eignung für acht Vorhaben

**Typ R (Inventur, nur lesend), keine Prüfstufe.** Regeln: docs/agent-rules.md. Read-only mit genau diesen Ausnahmen: tasks/051-architektur.md und reports/051.md anlegen und auf dem Branch task/051-architektur committen (von main d6c3868e). Sonst nur lesende Befehle (git, grep, cat, sed, ls, node für reine Auswertung ohne Dateischreiben). Keine Tests ändern, kein Merge, kein Push. Bericht: reports/051.md, diesmal bis 80 Zeilen, Funktion/Datei statt Zeilennummern, jede Aussage per grep belegt.

**Ziel:** Architektur-Ist-Aufnahme des Generators und Eignung für acht geplante Vorhaben. Ergebnis: Zerlegung in Aufträge mit Reihenfolge, Risiken, Schutz, Messgrößen.

**Teil A, Ist-Aufnahme (kurz, je 3 bis 6 Zeilen):**
1. Modulkarte: Zustand (state.js), Gitter/Knoten/Formen (square, triangle, hexagon), Orbits/Symmetrie, Kurven (curveType, drawCurvedBezier), Flächen (faces.js), Farbe, Netz (netwarp, Netzarten), Zeitleiste/Ebenen/Morph, Export (SVG/PNG/JSON), UI-Schicht, i18n. Abhängigkeitsrichtungen, Globals, Hotspots (Dateigrößen, Zyklen), geschützte Zonen.
2. Wie wird die Knotenzahl je Form definiert und gezählt (Quadrat, Dreieck, Sechseck: Konvention, Indizierung, Schlüssel für Knoten-IDs)? Wo steckt die uneinheitliche Zählung? Wie hängen Orbits, Sessions, Gallery-Manifest und Orbit-IDs (z. B. "11+19") von der Knotenzählung ab?
3. Größenänderung: Wie entsteht ein Muster aus Linien, Größe und Knotenzahl, und was geht bei Änderung verloren?
4. Canvas: Wo ist die Größe festgelegt (feste 600 px? Skalierung, Kachelzahl, Export-Maße, Baselines)?
5. Netze: Netzarten, Parameter (Stärke, Fokus, Größe), Feld-Netz; welche Netzliste existiert, wie wäre eine feste Liste nummerierter Netze (Hinterreiter) abbildbar (Nummern gleich, Geometrie je Dreieck/Quadrat/Sechseck verschieden)?
6. Formorgel: Was ist sie heute (Seite/Modul), was könnte "Filter-Auswahl" sein?
7. Kurven und Flächen: Kurvenmodell (chord, sin, tan, geo, free), Bézier-Stand, wie erkennt faces.js Flächen (nur gerade Segmente?), was bräuchte Flächenerkennung für Kurven?
8. Export und Animation: Welche Frame-Pfade gibt es (Playback, Spatial Morph), was liefert generateSVGString pro Frame, was fehlt für PNG-Sequenz (ZIP ohne Bibliothek im Browser?), SVG-Sequenz, Lottie; Dateigröße.

**Teil B, Eignung für die acht Vorhaben:** (a) Muster bleibt bei Größenänderung erhalten; (b) Canvas-Größe einstellbar (nicht Mobile); (c) Netzorgel: Stepper mit Netznummern statt "Aus" (Netze von Hinterreiter, feste nummerierte Liste, je Form verschieden); (d) Knotenanzahl vereinheitlichen und "Formen zweiter Ordnung" (zusätzliche Knoten diagonal zu den Seitenlinien); (e) Formorgel-Filter-Auswahl; (f) Kurven als Flächen erkennen und einfärben; (g) Speichern/Exportieren von Animationen (PNG-Sequenz, dazu Vektorformat für Figma/After Effects); (h) Bézier-Kurven. Je Vorhaben: Ist-Stand, Hindernisse in der Architektur, empfohlene Zerlegung (Typ, Prüfstufe, Schutzdateien, Messgröße, geschätzte Auftragszahl), Abhängigkeiten zu den anderen.

**Teil C, Architektur-Empfehlung:** Welche Umbauten würden mehrere Vorhaben zugleich erleichtern (z. B. ein einheitliches Knotenmodell, Canvas-Größe als Parameter, Render-Senke für Export)? Reihenfolge, Risiko, Kosten. Außerdem Altlasten, die jetzt bereinigt werden sollten (doppelte Render-Schleife, Namensumgehungen, Pin-Tests, Globals).

**Abgleich:** ROADMAP.md lesen, Überschneidungen und Widersprüche zu den acht Vorhaben listen.

**Nicht ändern:** alles außer den zwei genannten Dateien.

Abschluss im Chat: Hash, git status --short, Zeilenzahl des Berichts.
