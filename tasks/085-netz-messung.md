# Auftrag 085 — Netz bei nicht quadratischer Fläche: Bestand und Zerlegung (Typ R, nur lesen)

**Arbeitsordner (nur dieser):** der Worktree wof-085 (oder der Hauptordner, wenn 084 nicht läuft). Zuerst `pwd`, `git rev-parse --short HEAD`, `git branch --show-current` nennen. Ausnahme vom Schreibverbot: tasks/085-netz-messung.md (VOR der Arbeit), reports/085.md, ein Messskript tools/grid/measure-net-format.js. Kein Merge, kein Push, keine Änderung in core/, sketch.js oder an Tests.

**Anlass:** Das Netz soll auch bei nicht quadratischen Flächen (X≠Y, 077–081) gelten und schrittweise ausgebaut werden. Bekannt: `netWarpForBase` nur `square`; `netDomainEffective(spec, Rt)` und `netFieldLaw(axis, Rt)` verlangen EIN ungerades Rt (3..9) für beide Achsen; Feld-Netz gilt bei X≠Y als Einzel (078); Einzel und Gekachelt sind bei X=Y 100 % deckungsgleich über Größenwechsel (074). Hinterreiter-Netzarten (1.1–4.4) und die Netzkapitel 2–10 (docs/quellen, Bilder, nicht committen) sind teils noch nicht abgelegt.

**Zu messen und zu berichten (nichts vermuten, alles mit Stelle und Zahl):**
1. **Bestand Netz:** alle Netzarten und Modi (Einzel, Gekachelt, Feld, Alt-Netz/altNetSeed, baseNetTransform, baseNetAnimation, Netz-Schnappschüsse in der Zeitleiste). Je Modus: Datei:Funktion, Parameter (was ist Rt, was ist die Makrokachel), Eingabe in der UI (ui-net.js). Eine Tabelle.
2. **Wo steckt die Annahme „quadratisch“:** Liste aller Stellen (git grep: Rt, netDomainEffective, netFieldLaw, netWarpForBase, closedNetRectCorners, netSizeFactor, `_netSize`), mit der Annahme je Stelle (gleiche Achsen, ungerade, Mitte, Rotation) und was bei X≠Y heute passiert.
3. **Messung bei X≠Y (3 Formen, X,Y ∈ 1..9 Verhältnis ≤ 1:3):** (a) Einzel und Gekachelt: bleiben beim Wechsel (X,Y) → (X',Y') deckungsgleich? (b) Feld: das Gesetz je Achse `netFieldLaw(axis, Rt)`. In einer KOPIE (nicht im Repo) mit zwei Werten (Rt1, Rt2) ausprobieren und messen, ob ein Feld E1 × E2 konsistent aufgeht (Makrokachel, Rand, Fläche W×H aus 077/081) oder wo es bricht. (c) Welche (E1,E2) sind je Form bei welchem (X,Y) sinnvoll (ganze Makrokacheln auf der Fläche)? Tabelle.
4. **Quellenlage:** Welche Netzarten sind aus docs/quellen belegt (Seitenangabe, Netze ab 102_Netz), welche fehlen (Netzarten 2–10)? Keine Annahmen füllen.
5. **Zerlegung in Bauaufträge** („nach und nach ausbauen“): kleinste sinnvolle Stufe zuerst. Je Stufe: Ziel, Dateien, Schutzgrenzen (faces.js, tiling.js, facecolor.js, off-path-golden.json, acht Funktionen), Messgröße, Sabotagen, Aufwand/Risiko, Abhängigkeit zu Session/Export/Zeitleiste (079, 075). UI-Vorschlag nur als Skizze (neue Elemente müssen vorher abgestimmt werden).
6. **Offene Entscheidungen** an den Auftraggeber (höchstens 5), jeweils mit Empfehlung.

**Ausgabe reports/085.md (Länge begrenzt):** Tabellen aus 1–3, Quellenlage, Zerlegung, Entscheidungen. /usage vorher/nachher, was nicht gemessen wurde. Prüfung: `bash tools/guard.sh <Basis>` PASS und `bash tools/proof.sh L1 085`.
