# Auftrag 062 — G6a Session-Schema 2

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/062-g6a-session-v2.md mit diesem Text an. Bericht: reports/062.md (höchstens 30 Zeilen). Branch: task/062-g6a-session-v2 von main (erwarteter HEAD f76e5d3a). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Grundlage:** reports/055.md (§3 G6, §5, §6 Session 2), reports/056.md (G6 geteilt in G6a/G6b; Fehlliste G6: quarantineSession + Rollback, ungültige Kombination in validateSession), reports/060.md, reports/061.md (gridSpec Basis und Ebenen, projectGridSpec, projectLayerGridSpec). Entscheidungen: Rückwärtskompatibilität entfällt (Schema 1 wird mit 'schema-version' abgewiesen); nur Session. Export (JSON/SVG) und URL/Paste sind G6b, nicht hier; Lage 2 bleibt in der App gesperrt (validate lehnt sie weiter ab, sofern nicht allowLage2 im Test).

**Ziel G6a (eine Kernänderung):** Session-Schema 2.
1. Schritt 1, Messung vor jeder Änderung: per git grep alle Stellen von SESSION_SCHEMA_VERSION, settings.nodeCount, sheet nodeCount, sessionNodeFingerprint, _layerGridFingerprint, validateSession, planSessionRestore, buildSessionSnapshot, collectSessionState, _buildSessionObjects, quarantineSession, fixtures/scenarios (tools/session/*) listen. Weicht stark von reports/056.md ab oder zwei Wege: STOP mit 2 Optionen.
2. SESSION_SCHEMA_VERSION = 2. settings.grid = {shape, ordnung, lage} und sheet.grid je Ebene ersetzen nodeCount; Legacy-Sonderfall c = 1 (legacyC1) muss roundtrippen. Fingerprint umfasst grid UND ID->u/v bzw. Knotenpaare (inkl. freier Endpunkte), nicht nur die Knotenzahl. Timeline-Members und konkrete Verbindungen unverändert.
3. validateSession: ungültige Kombinationen (z. B. triangle/ordnung 2/lage 2, Lage 2 in der App, ordnung 0, fremde Form) -> invalid und Quarantäne; Schema 1 -> 'schema-version'. Restore vollständig planen, dann atomar anwenden, Rollback wie bisher (gridRevision bleibt unberührt, 16 Apply-Schritte).
4. Gespeicherte Altstände (localStorage/Autosave) werden bei Schema 1 sauber verworfen mit verständlicher Meldung (i18n de/en), kein Absturz.

**Nicht ändern:** acht geschützte Funktionen in sketch.js (byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, tools/morph/off-path-golden.json, Baselines, JSON/SVG-Export, URL/Paste. Pins nur mit eigenem Commit und Begründung (Liste im Bericht; erwartet: tools/session/*). ?v= gemeinsam bumpen (z. B. 20261117gridff).

**Prüfpunkte:** (1) Roundtrip Schema 2 mit Basis, 4 Ebenen, Timeline, Members, Farben, freien Endpunkten, Alt-Netz: Zustand vorher = nachher (Test gegen alten Stand für die Geometrie). (2) c = 1 roundtrippt. (3) Schema 1 deterministisch abgewiesen, Meldung de/en; ungültiger Import ohne Teilmutation. (4) Ungültige Kombinationen -> invalid/Quarantäne (je ein Fall). (5) Fingerprint ändert sich bei anderer ordnung, lage, Form und bei verschobenem Knoten; gleich bei gleicher Geometrie. (6) Rollback vor jedem Apply-Schritt: gleiche Objekte, gridRevision unberührt. (7) AUS-Pfad-Golden im Browser 30/30; geschützte Tests 61/61 und 57/57, test-p5-names, test-i18n.

**Sabotagen (je auf Kopien):** Lage fehlt im Snapshot; Fingerprint nur Knotenzahl; durchgereichter nodeCount statt grid; Schema-Version nicht erhöht; Quarantäne umgangen.

**Prüfung:** bash tools/proof.sh L3 062 plus AUS-Pfad-Golden im Browser (Verfahren: Kopfkommentar tools/morph/measure-off-path.js). Bericht: Hashes, Stellenliste, Messwerte, Sabotagen, /usage vorher/nachher, was nicht im Browser gesehen wurde.
