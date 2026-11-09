# Auftrag 026 — Messung Farbmischung (Stern/Raute im Morph)

**Typ:** R (Reine Messung, keine Produktcode-Änderung)
**Branch:** `task/026-messung-farbmischung`
**Prüfstufe:** L1

## Symptom (Nutzer, Screenshot)
Zwei Keyframe-Ebenen, in beiden hat der Stern Farbe 1 (Violett) und die Raute Farbe 2 (Gelb). Im Morph (räumlich UND zeitlich/1.8-Playback) mischen die Farben zur Mitte hin zu Pastell; links und rechts (`t=0`, `t=1`) sind sie klar.
**Erwartung:** Bei klarer Flächenzuordnung bleiben die Farben klar (Stern violett, Raute gelb), nur dort wo eine Fläche in A und B verschiedene Farben hat, wird überblendet.

## Aufgabe
Fall nachbauen (Quadrat, zwei Keyframe-Ebenen mit Stern/Raute, Farben wie oben; Messvorlage `tools/morph/measure-color-jumps.js` und `tools/morph/test-spatial-morph-color.js`).
Bei `t = 0, 0.25, 0.5, 0.75, 1` für beide Pfade (`spatialMorphRenderFaceColors`, `playbackCrossfadeColors`/`crossfadeFaceColors`) je Fläche messen:
- Soll-Farbe (Farbe der entsprechenden Fläche in A bzw. B)
- Ist-Farbe
- Abstand im linearen Licht
- Ob die Fläche in A und B dieselbe Fläche ist (Zuordnung über Schwerpunkt/Orbit)

Pflicht: Messgröße pro Fläche, nicht Mittelwert.

## Zu klären
1. Wird pro Ort (Feld A gegen Feld B an derselben Position) oder pro zugeordneter Fläche gemischt?
2. Gemeinsame Ursache beider Pfade?
3. Welche Zuordnung Fläche A zu Fläche B existiert heute, und was fehlt?
4. Zwei Optionen für den Fix mit Schutz-Bewertung (`core/facecolor.js`, `core/spatial-morph-render.js`, Pins, Prüfstufe), noch nicht umsetzen.

## Grenzen
- **Erlaubte Dateien:** `tasks/026-messung-farbmischung.md`, `tools/morph/measure-color-blend.js`, `reports/026.md`
- **Verboten:** `sketch.js`, `core/*`, `tools/morph/off-path-golden.json`, Baselines. Kein Merge, kein Push.
- **Prüfung:** `bash tools/proof.sh L1 026`
