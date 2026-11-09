# 019 Filter-Schalter in der sichtbaren Steuerzeile des Pairing-Editors
Typ: K
Stufe: L2
Git: neuer Branch task/019-filter-steuerzeile von task/018-d3-filter-ui (erwarteter HEAD 7afe53ba). Kein Merge, kein Push.
     Arbeit und Bericht getrennt committen, usage.csv-Zeile ergänzen.
Regeln: docs/agent-rules.md. Bericht: reports/019.md (höchstens 30 Zeilen). Plan in 5 Zeilen vor der Arbeit.

## Befund
Der Schalter aus 018 (#timeline-pairing-conclusive) liegt im Original-Browser #timeline-pairing-browser (meist display:none) und
ist nie sichtbar. Sichtbar ist die Steuerzeile des Pairing-Editors (Zeilenwahl 1/2/3, ▲ ▼ ⇄, ‹ n/N ›, ☰ "Alle Zuordnungen",
↺ "Standard"; vermutlich ui-phone-pairing.js und/oder index.html/sketch.js). Gewünscht: Schalter in dieser Zeile zwischen ☰ und ↺,
Wirkung auf Liste UND Durchblättern.

## Vorab
`git log -1 --oneline`, `git status --short` (leer). Per grep lesen, wo ☰ und ↺ erzeugt werden, wie ‹ n/N › und ▲ ▼ die Kandidaten
durchlaufen, timelineConclusiveView, timelineEnrichPairingCandidates, renderTimelinePairingBrowser, ui-phone-pairing.js.
Bei unklarer Ursache oder zwei Wegen: STOP mit 2 Optionen.

## Ziel
1. Icon-Button (aria-pressed, Tooltip/aria-label de/en "Nur schlüssige Zuordnungen") zwischen ☰ und ↺. Eine gemeinsame
   Zustandsvariable; der alte Button im Original-Browser entfällt oder spiegelt sie.
2. Standard AN, nicht gespeichert.
3. Bei AN gilt der Filter für Liste und für ‹ n/N ›/▲ ▼ (Zähler zählt die schlüssigen). Reihenfolge des Filters.
4. Freie Enden: Filter wirkungslos, Schalter inaktiv, Hinweis. Leer: Meldung, Schalter bedienbar.
5. Aktuell gewählte Zuordnung, die herausfällt: bleibt gezeichnet, Zähler zeigt dies sinnvoll (im Bericht beschreiben, nicht raten).

## Entscheidung des Auftraggebers (auf die Rückfrage zu 3, ‹ › und ▲ ▼ ändern die aktuelle Zuordnung, sie durchlaufen keine Liste)
- ‹ › springt nur über Varianten der Zeile, bei denen die ganze Zuordnung schlüssig ist; k/c zählt nur diese.
- ▲ ▼ bleiben ungefiltert und frei (bei AN nie deaktiviert).
- Liste und Zähler "x von y schlüssig" sind gefiltert.
- Ist die aktuelle Zuordnung selbst unschlüssig (etwa nach ▲ ▼): ‹ › springt zur nächsten schlüssigen in Richtung des Pfeils,
  der Zähler zeigt "–/c" statt k/c. Im Bericht beschreiben.
- Prüfpunkt 2 und die Sabotage "Filter nur auf Liste, nicht auf ‹ ›" entsprechend; zusätzlich ein Test: ▲ ▼ ist bei AN nie deaktiviert.

## Nicht ändern
Die acht geschützten Funktionen in sketch.js (byte-identisch), core/*, tools/morph/off-path-golden.json, Baselines.
Bestehende Pin-Tests nur mit eigenem Commit und Begründung. Checkbox/label in der Zeitleisten-Gruppe sind verboten (Button verwenden).

## Prüfpunkte
1. Sichtbarkeit: Schalter in der sichtbaren Steuerzeile, Breite/Höhe > 0 (DOM-Stub-Test wie bestehende; zusätzlich echte Messung bei
   390 und 1280 px, wenn ein Headless-Browser im Repo existiert, sonst im Bericht als "nicht gemessen" vermerken).
2. Klick schaltet Filter; Liste und ‹ n/N › ändern sich konsistent.
3. Standard AN; AUS zeigt alle (z. B. 6/6).
4. Leer, freie Enden, Wechsel der Segmente (Zustand bleibt).
5. de/en, test-i18n grün.
6. Acht Funktionen byte-gleich zu main; `git diff --quiet main..HEAD -- core/ tools/morph/off-path-golden.json` Exit 0.
7. Geschützte Tests 57/57 und 61/61.

## Sabotagen (höchstens 3, auf Kopien)
Schalter nicht rendern; Standard AUS; Filter nur auf Liste, nicht auf Durchblättern.

## Prüfung
`bash tools/proof.sh L2 019`. Bericht: Hash vor/nach, Dateien, Prüfpunkte, Sabotagen, Testzahlen, /usage vorher/nachher, Abweichungen.
