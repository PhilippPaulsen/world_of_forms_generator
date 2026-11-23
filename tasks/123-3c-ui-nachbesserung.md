# Auftrag 123 — Nachbesserung Netzart-Stepper 3C — PLAN (Typ K, Prüfstufe L2)

Branch `task/123-3c-ui-nachbesserung` von main `6a80dd8e` (Merge 122). **Stand: nur dieser Plan, nichts gebaut, auf Freigabe der Skizze (§1) warten.** Nicht mergen, nicht pushen, `docs/quellen/` nie committen, nur explizite `git add`-Pfade. Stoppregel: Zwischenmeldung ≥ 93 %, Stopp ≥ 98 % (Woche bei Planstart 79 %).

Gelesen/geprüft für diesen Plan: `ui-net-art.js`, `ui-net.js` (`syncArt`), `ui-i18n.js` (Schlüssel `net.art.*`, `net.3c.*`), `sketch.js` (`initNetControls`, `syncTimelineNetUi` 1026, Zeitleistenstatus 4100), `ui-phone-config.js` (Reiter Art/Achsen), Zustand 3C am Telefon im Browser (375 px, Netzart 1 vorher Geometrisch).

## 0. Kurzfassung
1. **Rohe Schlüssel: Ursache gefunden.** `ui-net-art.js` (`stepA`, `stepB`) liefert die Schlüssel `net.art.reason.aMin`, `.aMax`, `.bMin`, `.bMax`; **sie fehlen in `ui-i18n.js`** (ich habe sie in 122 nie angelegt). `UI.t` fällt dann laut Kopfkommentar auf den Schlüssel selbst zurück, deshalb die Meldung `net.art.reason.bMin`. Mein Modelltest prüfte nur, dass ein Schlüssel-*String* zurückkommt, nicht dass er im Wörterbuch steht. Eine Skriptprüfung aller benutzten `net.art.*`/`net.3c.*`-Schlüssel findet **genau diese vier** fehlenden (52 benutzt, 0 ohne EN).
2. Die Netz-Zeile wird schmaler: a und b so breit wie der Netzart-Stepper, Format als zwei Icons, die Anzeige „W · Streckung“ verschwindet aus der Zeile (nur ein Warnzeichen, wenn etwas zu warnen ist), die Zahlen stehen unter „Mehr“ in „Maße“.
3. **Unter 3C wirkungslos oder irreführend (am Telefon gemessen):** „Umkehren“ ist sichtbar und aktiv, wenn Netzart 1 zuletzt Geometrisch war; der Fokus-Stepper (Reiter Achsen) ist gesperrt, **sagt aber „Fokus gilt für Sin und Tan“**; die Achsen-Reihe ist unsichtbar und lässt im Reiter Achsen eine leere Zeile. Vollständige Liste §3.
4. Aufwand **M**, Risiko **mittel** (Layout-Baselines, Telefon-Slots); keine Änderung in `core/`.

## 1. Skizze (zur Abstimmung)
**Desktop, Netz-Zeile ab 768 px** (Netzart-Stepper = ▦ + zwei Zeichen + Chevrons; a und b **gleich breit wie er**):
```
—   [▦ —  ▴▾]  │ [Sin][Tan][Geo] grau  [∿ 0,5 ▴▾] grau │ ⋯
1   [▦ 1  ▴▾]  │ [Sin][Tan][Geo]       [∿ 0,5 ▴▾]      │ ⋯
3C  [▦ 3C ▴▾]  │ [a 3 ▴▾] [b 7 ▴▾] [▭][▯̶]   ⚠           │ ⋯        (⚠ nur wenn Streckung > 2 oder W außerhalb 7 bis 12)
```
- **a, b:** `a` / `b` als Buchstabe wie bisher, Display `min-width: 2ch` (bis „12“), sonst die Maße des Netzart-Steppers; gemessen heute ca. 72 px gegen ca. 66 px, die Differenz ist der 4ch-Display (`.stepper-display`).
- **Format-Icons** (Stil der App: Strich 1,75 px, `currentColor`, 18 px, viewBox 24, keine Füllung, nichts Glasiges), zwei Knöpfe im Radiogruppen-Verhalten wie heute (`role="radio"`, `aria-checked`, Zustand = `active`):
  - **ganz:** Rechteck `M4 6 H20 V18 H4 Z`
  - **halb:** die rechte Hälfte mit gestrichelter Mittelachse: `M12 6 H20 V18 H12 Z` plus `M12 3 V21` gestrichelt (die Hälfte p ≥ q liegt rechts der Achse)
  - `aria-label` und Tooltip „Format: ganz, von Rand zu Rand“ / „Format: halb, bis zur Mittelachse“ (die bestehenden Schlüssel `net.3c.format.*` bleiben, nur ohne sichtbaren Text); Breite je `--target`.
- **Warnzeichen:** ein 18-px-Dreieck-Icon (Strich, wie die anderen) mit `!`, **nur sichtbar, wenn eine Warnung gilt** (`hidden` sonst); `role="img"`, `aria-label` = der Warntext, Tooltip gleich. Kein Platz in der Zeile, wenn es nicht erscheint (kein Layout-Sprung der Steppers, es sitzt nach dem Format).
- **Mehr unter 3C** (neu geordnet): **„Maße“** (immer): „W 10 · Streckung 1,6“, darunter die Warntexte falls vorhanden und der Satz „Das Netz füllt die ganze Leinwand (600 × 600) …“; dann „Vorschläge“, dann „Netzarten“. Schlüssel neu: `net.3c.measure.title`.

**Telefon (≤ 767 px), Reiter „Art“** (Breiten wie 122: 117/109 und 48; die Stepper bleiben dort so breit, die Zeile reicht nicht für „schmaler“ — Frage 2):
```
—   Zeile 1: [▦ —] [∿ 0,5] [⋯]          Zeile 2: [Sin][Tan][Geo] grau
1   Zeile 1: [▦ 1] [∿ 0,5] [⋯]          Zeile 2: [Sin][Tan][Geo]  (⇄ nur bei Geo)
3C  Zeile 1: [▦ 3C] [a 3] [⋯]           Zeile 2: [b 7] [⇄ grau] [▭][▯̶]      (⇄ nur wenn Netzart 1 zuletzt Geo war)
```
- Format auch am Telefon als Icons (48 px je Knopf, Maße wie heute).
- **Umkehren** unter 3C: sichtbar, **ausgegraut, `aria-disabled`**, Grund beim Tippen „Umkehren gilt für Netzart 1.“; es passt neben b und Format (b 109 + 8 + 48 + 8 + 104 = 277 ≤ 288 bei 320 px; bei 375 px gemessen: nebeneinander, 141 bis 301). Ist Netzart 1 nicht auf Geometrisch, bleibt es wie bisher unsichtbar.
- Kein Warnzeichen in den zwei Zeilen (kein Platz bei 320 px): die **Readout-Zeile des Mehr-Blatts** trägt „⚠ W 6 · Streckung 2,7“ (Frage 1).
- **Reiter Achsen unter 3C:** die Achsen-Reihe (XY/X/Y) bleibt **sichtbar und gesperrt** (Grund „Die Achsen gelten für Netzart 1.“), der Fokus-Stepper gesperrt mit „Der Fokus gilt für Netzart 1.“ (heute: „Fokus gilt für Sin und Tan“, falsch).

## 2. Schlüssel, Ursache, Texte
**Ursache:** vier Schlüssel nie angelegt (s. o.). Zusätzlich fehlte jede Prüfung, dass ein vom Code benutzter Schlüssel im Wörterbuch steht.
| Schlüssel | DE | EN |
|---|---|---|
| `net.art.reason.aMin` | a ist mindestens 2. | a is at least 2. |
| `net.art.reason.aMax` | a muss kleiner als b sein. | a must be smaller than b. |
| `net.art.reason.bMin` | b muss größer als a sein. | b must be larger than a. |
| `net.art.reason.bMax` | b ist höchstens 12. | b is at most 12. |
| `net.art.reason.needsN1.reverse` | Umkehren gilt für Netzart 1. | Reverse applies to net type 1. |
| `net.art.reason.needsN1.axes` | Die Achsen gelten für Netzart 1. | The axes apply to net type 1. |
| `net.art.reason.needsN1.focus` | Der Fokus gilt für Netzart 1. | The focus applies to net type 1. |
| `net.art.reason.needsN1.strength` | Die Stärke gilt für Netzart 1. | The strength applies to net type 1. |
| `net.3c.measure.title` | Maße | Measures |
| `net.3c.warn.title` | Hinweis zum Netz | Note on the net |
Die bestehenden `needsN1` („Das Gesetz gilt für Netzart 1. Netzart 1 wählen.“) bleibt für Sin/Tan/Geo bei „—“; die Formulierung „a = 1 ist nicht gebaut“ steht nur in `core/netwarp.js` (englisch, nie im UI) und im Plan 121; die Session-Prüfung sagt „2 ≤ a < b ≤ 12“ ohne diesen Satz.
**Alle Gründe im 3C-Kontext (DE und EN lesbar), Bestandsaufnahme:**
| Ort | Quelle | Stand |
|---|---|---|
| Stepper-Chevrons (Netzart, a, b) | `ui-net-art.js` → `ui-i18n.js` | **vier Schlüssel fehlten**, werden angelegt |
| Sperren Netzart-1-Knöpfe (Gesetz, Stärke, Fokus, Achsen, Umkehren) | `ui-net.js` → `ui-i18n.js` | Gesetz/Stärke vorhanden; Fokus (Telefon, falscher Grund), Achsen, Umkehren neu |
| 3C auf Dreieck/Sechseck, Mehr-Liste | `ui-net-art.js` | vorhanden (DE/EN) |
| Sperren von Kurve/Frei/Fläche unter einem Netz (`lockBtn`) | `sketch.js` (`initNetControls`) | **nur Englisch**, auch für jedes Netz außer 3C (Bestand seit 4c); wie in 122 bleibt es, Frage 3 |
| Zeitleiste: „Net NOT animated … 3C … cannot be interpolated …“ | `core/netwarp.js` (`_netProjCompat`), angezeigt in `sketch.js:1031` und `4100` | **nur Englisch** (Entscheidung 8 aus 122; die Auftragsvorgabe „DE und EN lesbar“ verlangt es jetzt) |
| Session abgelehnt (`_vNetSpec`) | `core/session.js` | Englisch, Entwicklertext des Validators, nicht im UI |

## 3. Netzart-1-Knöpfe unter 3C: vollständige Liste und Soll
| Knopf | Heute unter 3C | Soll |
|---|---|---|
| Sin / Tan / Geo (`.net-kind-btn`) | ausgeblendet | bleibt ausgeblendet (die ganze Gruppe) |
| Stärke-Stepper (Zeile) | ausgeblendet | bleibt |
| Stärke fein (Mehr) | gesperrt, Grund „Das Gesetz gilt …“ | Grund `needsN1.strength` |
| Fokus fein (Mehr), Fokus-Stepper (Telefon, Reiter Achsen) | gesperrt; **Telefon: falscher Grund** („Fokus gilt für Sin und Tan“) | Grund `needsN1.focus` |
| Achsen XY/X/Y | **unsichtbar** (leere Zeile im Reiter Achsen am Telefon; Desktop: in Mehr per CSS aus) | **Telefon: sichtbar, gesperrt** mit `needsN1.axes`; Desktop: bleibt aus (ganze Reihe nicht anwendbar, kein Platz mit Funktion) |
| Gebiet Einzeln/Gekachelt/Feld, Makro, Alternate, Familien-/Feld-/Größen-Hinweise | ausgeblendet (Sketch und Sync) | bleiben ausgeblendet |
| **Umkehren** | **Telefon: sichtbar und aktiv** (wenn Geo zuletzt gewählt war), wirkungslos | sichtbar, `aria-disabled`, Grund `needsN1.reverse` |
| Netzlinien | wirkt | bleibt aktiv |
| Kurve, Frei | gesperrt (bestehender englischer Grund) | bleibt |
| Fläche | frei (Basis und Basisgitter) | bleibt |
Regel dahinter: ein Netzart-1-Knopf ist unter 3C **gesperrt mit Grund, wo das Layout ihm einen festen Platz gibt** (Telefon-Slots, Felder), und **ausgeblendet, wo er in einer ganzen, nicht anwendbaren Reihe sitzt** (Desktop-Mehr). Nichts bleibt aktiv und wirkungslos.

## 4. Dateien (je Zeile)
| Datei | Änderung |
|---|---|
| `ui-net.js` | Format-Icons (Zustand, `aria-*`), Warnzeichen, Reihenfolge Mehr („Maße“), Sperren mit Grund (Achsen, Fokus, Umkehren), Fokus-Grund am Telefon |
| `ui-net-art.js` | Texte unverändert, aber `suggest`/Schritte unberührt; ergänzt: ein reiner Helfer `netArt.measureLine(info, lang)` (Maße-Text) |
| `ui-i18n.js` | zehn neue Schlüssel (§2) |
| `index.html` | Format-Knöpfe als SVG-Icons (ohne Text), Warn-Icon, Abschnitt „Maße“, a/b-Stepper-Klassen; `?v=` in den drei Seiten gemeinsam (Tag ohne Ziffer nach dem Datum) |
| `style.css` | a/b/Netzart gleich breit (Display 2ch), Icons, Warnzeichen; Telefon nur im Netz-Block (Regel aus 122: Netz-Regeln in ihren Block) |
| `ui-phone-config.js` | Reiter Art: Format als Icons (Breiten unverändert 48); evtl. `follow`-Grund des Fokus-Steppers unter 3C |
| `sketch.js` | **nur `initNetControls()`**, falls nötig: Sperre von Umkehren unter 3C im 3C-Zweig von `netControlsSync()` (eine Zeile `reverseBtn`); sonst kein Eingriff. Die Zeitleisten-Texte (Frage 3) lägen **außerhalb** von `initNetControls()` (`1031`, `4100`): nur mit Freigabe |
| `core/` | **unverändert**, die acht Funktionen in `sketch.js` unberührt, kein `/* */`, Off-Path-Golden und `gallery/` unberührt |
**Erwartete Pins (alt → neu):** `test-phone-config` (Format-Knöpfe, Art-Reihen), `test-phone-engine` (Attrappe `net-format`, Knöpfe), `test-i18n*` (neue Markup-Schlüssel, deutsche Texte gleich), `test-netart-sketch`/`test-netart-model` (eigene, erweitert), die Netz-Tests der UI nach Lauf (`test-net-lock*`), die Quelltext-Pins auf `sketch.js` (Basis des letzten `sketch.js`-Commits: `test-morph-view`, `test-lines-toggle`, `test-anim-png-driver` nur bei einer Änderung in `sketch.js`). Jeder Pin in eigenem Commit mit alt → neu.

## 5. Testplan
**Neuer Test** `tools/ui/test-netz-i18n-keys.js` (Quelltext/Sandbox): extrahiert **jeden Schlüssel, den die Netz-Dateien an `UI.t`/`tt`/`tr`/`data-i18n*` geben** — Quelle: `ui-net.js`, `ui-net-art.js`, `ui-net-readout.js`, der `initNetControls()`-Ausschnitt von `sketch.js`, der Netz-Teil von `index.html` und `ui-phone-config.js` — dazu **jeden Schlüssel, den die Modellfunktionen zurückgeben** (`netArt.step/stepA/stepB`, `entries().reason`, `later()`; alle Zustände, nicht nur die Grenzen) und die dynamischen Familien (`net.art.name.<id>`, `net.art.tip.<id>`); prüft: im Wörterbuch vorhanden, DE und EN nicht leer, Platzhalter in beiden Sprachen gleich. **Umfang-Vorschlag:** die Familien `net.art.*`, `net.3c.*`, `net.reason.*`, `reason.net.*`, `reason.strength|focus.*`, `note.net.*`, `net.readout.*`, `net.family.*`, `net.hint.*` (alles, was das Panel Netz anzeigt). Die ganze App (alle Panels) wäre ein eigener Auftrag: die dynamischen Schlüssel dort sind viel zahlreicher.
**Sabotagen (≥ 3, geplant 6):** S1 ein Schlüssel aus `ui-i18n.js` entfernt (`net.art.reason.bMin`) → rot; S2 Umkehren unter 3C aktiv (Sperre entfernt) → rot; S3 ein Icon-Knopf ohne `aria-label` → rot; S4 ein Schlüssel nur DE → rot; S5 Fokus-Grund am Telefon wieder „Sin und Tan“ unter 3C → rot; S6 Warnzeichen immer sichtbar → rot.
**Modell-/Sketch-Tests** erweitern: `netArt.measureLine`, Warnbedingung (Streckung > 2 oder W außerhalb 7 bis 12) an den Beispielen 2,4 ganz bei 4:3 (warnt) und 3,7 halb bei 1:1 (warnt nicht); Sperre von Umkehren unter 3C im Sandbox-Test von `initNetControls()`.
**Browser:** jede Grenze der Stepper (a ≤ 2 abwärts, a ≥ b−1 aufwärts, b ≥ 12, b ≤ a+1) löst eine **lesbare** Meldung aus, DE und EN (`?lang=en`); Netz-Zeile bei 768, 1100, 1440 px (Breiten der drei Stepper gleich, Icons sichtbar, Warnzeichen erscheint und verschwindet, Tooltip/`aria-label`); Telefon 320 und 375 px (Reiter Art und Achsen in „—“, „1“, „3C“, Umkehren gesperrt); Zeitleiste mit zwei 3C-Zuständen; Konsole fehlerfrei; **Golden 30/30** (main gegen Arbeitsbaum im selben Fenster); ohne Netz kein geänderter Code-Pfad.
**Prüfstufe:** `bash tools/guard.sh main` (FAIL nur für `sketch.js`, falls er sich ändert), `bash tools/proof.sh L2 123`.

## 6. Baselines (nur mit Freigabe)
Der Netz-Tab ändert sich wieder (Stepper-Breiten, Icons, Mehr-Reihenfolge, Telefon-Reihe). Vorschlag wie in 122: **neue Dateien** `tools/ui/baseline-netzart-13.json` (sechs Zellen ab 768 px) und `tools/ui/baseline-phone-7.json` (neun Zellen); Vorgänger unverändert; **zusätzlich dieselben Zellen auf main `6a80dd8e` mit demselben `measure-layout.js`** aufnehmen und dagegen vergleichen (`compare-baseline.js`: nur `/netz`-Unterschiede erlaubt, Form und Farbe null). Größe: `baseline-netzart-12.json` hat 945 KB, die neue Datei wird etwa gleich groß (weiche Grenze 1 MB, nicht erzwungen). Aufnahmezeit etwa 35 Minuten (alle Breiten in **einem** Zug, Viewport-Emulation darf nicht ablaufen). Eigener Commit, nach den Pins.

## 7. Aufwand, Risiko, Commits
| Teil | Aufwand | Risiko |
|---|---|---|
| Schlüssel + neuer Test + Modellhelfer | S | gering |
| Sperren (Umkehren, Achsen, Fokus-Grund) inkl. `sketch.js`-Zeile | S–M | mittel (Telefon-`follow`) |
| Netz-Zeile: Breiten, Icons, Warnzeichen, „Maße“ | M | mittel (Layout) |
| Telefon: Icons, Reiter Achsen | S–M | mittel |
| Pins, `?v=`, Baselines, Browser, Golden, Bericht | M | Zeit |
Commits: (1) Plan; (2) Schlüssel (`ui-i18n.js`) + `test-netz-i18n-keys.js` (zuerst rot); (3) Modellhelfer + Modelltest; (4) Sperren (`ui-net.js`, evtl. `sketch.js`) + Sketchtest; (5) Netz-Zeile (`index.html`, `ui-net.js`, `style.css`); (6) Telefon (`ui-phone-config.js`, `style.css`); (7) `?v=`; (8) Pins; (9) Baselines; (10) ROADMAP/Claude.md; (11) Bericht.

## 8. Offene Fragen an Sie
1. **Warnzeichen am Telefon:** in den zwei Zeilen ist bei 320 px kein Platz; mein Vorschlag: nur die Readout-Zeile im Mehr-Blatt („⚠ W 6 · Streckung 2,7“). Alternative: das Warnzeichen auf die Mehr-Taste (kleiner Punkt). *Empfehlung: Readout-Zeile.*
2. **Breite am Telefon:** a, b und der Netzart-Stepper bleiben dort bei 117/109 px (Telefon-Raster, Display 48 px). Schmaler (ca. 85 px) würde die Telefon-Konfiguration und alle Breitenprüfungen berühren, ohne dass die Zeile etwas gewinnt. *Empfehlung: nur Desktop schmaler.*
3. **Englische Zeitleisten- und Sperrgründe** (§2, zwei Zeilen „nur Englisch“): übersetzen? Die Zeitleiste verlangt zwei Zeilen in `sketch.js` **außerhalb** von `initNetControls()` (`1031`, `4100`) und eine Abbildungstabelle der drei 3C-Texte in `ui-net-art.js`; die Sperrgründe von Kurve/Frei/Fläche liegen in `initNetControls()` (Bestand, gelten für jedes Netz, nicht nur 3C). *Empfehlung: die drei 3C-Zeitleistentexte und die 3C-Fläche-Sperre übersetzen (nur 3C-Kontext), den Rest als Bestand lassen.*
4. **Umkehren unter 3C:** sichtbar ausgegraut (wie von Ihnen verlangt) oder ausgeblendet wie Sin/Tan/Geo? Sichtbar nimmt am Telefon den Platz neben b und Format (passt), ist aber nur da, wenn Netzart 1 zuletzt Geometrisch war (sonst unsichtbar wie heute). *Empfehlung: ausgegraut, wie verlangt.*
5. **Icon-Vorschlag** halb = rechte Hälfte mit gestrichelter Mittelachse: einverstanden, oder lieber linke Hälfte gefüllt (wie „halb voll“)? Das echte halbe Format zeigt p ≥ q, also die rechte Seite der Achse.

## Nicht geprüft
Die Fokus-Stepper-`follow`-Regel der Telefon-Konfiguration nur beschrieben, nicht gelesen (Risiko für Punkt 3); wie die englische Oberfläche am Telefon aussieht; die drei Breiten (768/1100/1440) der Netz-Zeile nach der Änderung (erst nach dem Bau messbar).
