# Auftrag 063 — G6b Export v2 und Pattern-Transport

**Typ K, Prüfstufe L3.** Regeln: docs/agent-rules.md. Lege zuerst (VOR jeder Arbeit) tasks/063-g6b-export-transport.md mit diesem Text an. Bericht: reports/063.md (höchstens 30 Zeilen). Branch: task/063-g6b-export-transport von main (erwarteter HEAD b3dcd67e). Kein Merge, kein Push. Plan in 5 Zeilen vorab.

**Grundlage:** reports/055.md (§3 G6, §6 URL/Paste, SVG/JSON), reports/056.md (G6b: export.js, sketch.js URL/Clipboard), reports/059.md (formatGridName/parseGridName, Linienschlüssel, GITTER_V2, unsortierte Tokenlisten werden vom Parser abgelehnt), reports/062.md (Session Schema 2). Entscheidungen: Rückwärtskompatibilität entfällt (alte Links/Paste werden mit verständlicher Versionsmeldung abgelehnt); Lage 2 bleibt gesperrt; Session-Datei-Import ist NICHT Teil dieses Auftrags. Der Katalog (gallery/, G7) bleibt unverändert und funktionsfähig; der alte Katalogrouter bleibt bis G7.

**Ziel G6b (eine Kernänderung):** Export v2 und Pattern-Transport.
1. Schritt 1, Messung vor jeder Änderung: per git grep alle Stellen von buildExportData, generateSVGString (Meta/Name), parseCatalogUrlParams, parseClipboardCatalogPattern, resolveCatalogPatternConnections, applyCatalogPattern, applyCatalogPatternToNewLayer, isWellFormedCatalogPattern, orbitIds/orbitId-Verbraucher in sketch.js und export.js listen. Weicht stark von reports/056.md ab oder zwei Wege: STOP mit 2 Optionen.
2. JSON-Export v2: meta.grid = {shape, ordnung, lage}, Knoten mit zahl/u/v (über opts.numbered, nur wo Lage 1 byte-gleiche Geometrie bleibt), Linien als Schlüssel (formatLineKey) zusätzlich zu konkreten Endpunkten, Ebenen mit gleichem Vertrag; kein nodeCount/orbitIds im neuen Export. Freie oder reduzierte Modi: Schlüssel/Name null.
3. SVG: Geometrie byte-gleich zu vorher; Name nur escaped in Metadaten (<, &, Überstrich testen); keine neue Geometrie.
4. URL/Paste v2: ?v=2&shape=&ordnung=&lage=&group=&lines=... und Paste-JSON {version:2, grid, group, lines}. Tokens vor dem Parsen sortieren (numerisch via compareLineKeys), vor jeder Mutation alle Tokens gegen die Tabelle validieren (Duplikate erhalten, Version und Gruppe begrenzt), layer=new bleibt. Alte orbitIds-Formate: ablehnen mit Meldung (i18n de/en), keine Konvertierung. Der Katalogrouter der Formorgel (gallery.js) bleibt bis G7 auf dem alten Format: Zwischenzustand im Bericht beschreiben (wie bleibt der Link Formorgel -> Generator benutzbar? Wenn zwei Wege: STOP mit 2 Optionen.

**Nicht ändern:** acht geschützte Funktionen in sketch.js (byte-gleich), core/faces.js, core/facecolor.js, core/tiling.js, tools/morph/off-path-golden.json, Baselines, gallery/. Pins nur mit eigenem Commit und Begründung. ?v= gemeinsam bumpen (z. B. 20261118gridfg).

**Prüfpunkte:** (1) SVG byte-gleich (Linien/Flächen/Morph, alle Formen). (2) Export-JSON v2: Roundtrip Linien -> Schlüssel -> Verbindungen gleich; Ebenen; freie Linien ohne Namen. (3) URL/Paste: gültige Muster aller Formen laden gleich der Quelle; ungültige Tokens, falsche Version, alte orbitIds: abgelehnt, keine Teilmutation. (4) Tokens unsortiert -> sortiert akzeptiert. (5) Meldungen de/en, test-i18n. (6) AUS-Pfad-Golden im Browser 30/30; geschützte Tests 61/61 und 57/57, test-p5-names.

**Sabotagen (je auf Kopien):** Token-Sortierung fehlt; Validierung nach Mutation; orbitIds durchgereicht; Name nicht escaped; Version nicht geprüft.

**Prüfung:** bash tools/proof.sh L3 063 plus AUS-Pfad-Golden im Browser. Bericht: Hashes, Stellenliste, Messwerte, Sabotagen, Zwischenzustand Formorgel, /usage vorher/nachher, was nicht im Browser gesehen wurde.
