# 015 Inventur: Zuordnungssuche d3
Typ: R (nur lesen)
Git: kein Code ändern. Nur tasks/015-inventur-d3.md und reports/015.md auf Branch task/015-inventur-d3
     (Ausgangs-HEAD da5900c0) anlegen und in zwei Commits committen. Kein Merge, kein Push.
Regeln: docs/agent-rules.md. Keine Tests, keine Baselines, kein Browser.
Arbeitsordner: `/Users/flipmac/Documents/flip/The World of Forms/world_of_forms_generator-farborgel-generator-integration`.
Referenz Prototyp (nur lesen): `/Users/flipmac/Documents/flip/The World of Forms/world_of_forms_morph_v2`.

Vorab: `git branch --show-current`, `git log -1 --oneline`, `git status --short` ausgeben und in die erste Berichtszeile übernehmen.
Erst per `grep -rn "d3\|permut\|reverse\|assign\|match" core tools/morph ROADMAP.md docs` die Fundstellen suchen, dann lesen.

Aufgabe: Inventur "Zuordnungssuche d3" (Zuordnung/Matching von Linien und Knoten zwischen zwei Keyframe-Ebenen im Morph: Permutation, Umkehrung, Mitglieder/Orbit-Mitglieder, Randknoten, beide Richtungen).

Zu klären (jeweils Datei:Funktion, keine Zeilennummern, keine Angabe ohne grep-Beleg):
1. Ist-Stand: Wie ordnet unser Morph heute Linien der Ebene A Linien der Ebene B zu (Funktion, Kriterium, Fehlerfälle, Statuscodes bei ungleicher Linienzahl)?
2. Was "d3" laut ROADMAP/Docs genau meint (Wortlaut zitieren, höchstens ein Satz) und was davon fehlt.
3. Prototyp: Gibt es dort eine Zuordnungssuche? Wenn ja Datei:Funktion, Suchraum (Permutation, Umkehrung je Linie, Orbit-Mitglieder, Randknoten), Kostenmaß, beide Richtungen A->B und B->A.
4. Lücke: Je Baustein (Permutation, Umkehrung, Mitglieder, Randknoten, beide Richtungen) ein Satz: vorhanden bei uns / nur im Prototyp / fehlt überall.
5. Messgröße: Welches Maß bildet "schlüssige Zuordnung" wirklich ab? Pflicht: freie Linienenden zählen (Lehre M1c), Vergleich mit Goldens, Farbsprünge pro Fläche. Welche vorhandenen Tests oder Goldens (Pfad) taugen dafür?
6. Schutz: Berührt eine Lösung eine der acht geschützten Funktionen in sketch.js oder core/tiling.js, core/faces.js, core/facecolor.js? Klar Ja oder Nein je Datei.
7. Risiken für AUS-Pfad und Rechenzeit (Suchraum-Größe, Frame-Zeit).

Bericht (reports/015.md, höchstens 30 Zeilen), Gliederung 1-7. Am Ende:
- Empfehlung: Zerlegung in Kern-Aufträge (Typ K, je höchstens 1 Kernänderung), mit Reihenfolge
- Offene Fragen an mich (höchstens 3)
Abschluss: Beide Dateien committen (zwei Commits: Task-Datei, Bericht). Im Chat nur: Hash, `git status --short`, Zeilenzahl des Berichts.
