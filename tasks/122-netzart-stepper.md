# Auftrag 122 — 3C-3: Netzart-Stepper im Panel Netz — PLAN (Typ K, Prüfstufe L2)

Branch `task/122-netzart-stepper` von main `ba342fc3` (Merge 121). **Stand: nur dieser Plan, nichts gebaut, auf Freigabe und Abstimmung der Skizze (§1) warten.** Nicht mergen, nicht pushen, `docs/quellen/` nie committen, nur explizite `git add`-Pfade. Stoppregel: Zwischenmeldung ≥ 93 %, Stopp ≥ 98 % (Woche bei Planende 74 %, 5 h 44 %).

Gelesen: `index.html` (Netz-Zeile 615–640, Mehr-Overlay 1449–1517), `ui-net.js`, `ui-net-readout.js`, `sketch.js:560–800` (`initNetControls`, `commit`, `render`, `netControlsSync`, `axisFromSpec`, `adoptNetState`), `sketch.js:2415, 4437, 4455, 4483, 5319–5328, 5410`, `ui-phone-config.js:114–120, 205–218`, `ui-i18n.js` (Schlüssel `net.*`), `reports/085.md`, `reports/quellenlesung/00-uebersicht.md`, `ROADMAP.md:313`, `Claude.md`, `reports/120-messung.md`, `reports/121.md`. Nicht gelesen: `style.css` (Netz-Regeln), die Netz-Tests im Einzelnen, `ui-phone.js` (Umhängen der Elemente), `docs/baselines.md` über den Kopf hinaus.

## 0. Kurzfassung und was ich gefunden habe
1. **Das Panel Netz steckt in `sketch.js`**, nicht in `ui-net.js`: der Zustand `ui` (Achsen, Gesetz, Stärke, Fokus, Gebiet, Makro) und `commit()`, `netControlsSync()`, `adoptNetState()` liegen als `initNetControls()` in `setup()` (Zeilen 584–797). `ui-net.js` verdrahtet nur Markup, Sperrgründe und Stepper. **Ein Stepper, der das Möbiusnetz schaltet und den Netzart-1-Zustand erhält, braucht deshalb eine kleine Änderung in `sketch.js` (Freigabe, §4).** Die acht geschützten Funktionen (alles Zeitleisten-Funktionen) bleiben unberührt, kein `/* */`.
2. **Die Lücke aus 121 ist größer als gemeldet** (§4): nicht nur `commit()`, sondern auch `stateDomain()` (liest ein 3C-Spec als „Einzeln“, setzt `ui.domain` zurück), `setDomain()` (schreibt `domain`/`repeat` in das 3C-Spec), `netControlsSync()` (`isField` aus `ui.domain`, `faceOk`, Feld-Hinweise: **unter 3C wäre die Flächenfüllung gesperrt**, obwohl der Kern sie kann) und `adoptNetState()`.
3. **Beschriftung: nicht entscheidbar ohne Sie** (§2, Fragen 1 und 2): die Quellen benutzen „Netzart 1.1“ für zwei verschiedene Dinge. Mein Vorschlag steht fest, ist aber ausdrücklich als Frage gestellt.
4. **Layout-Baselines ändern sich** (Netz-Tab, Desktop und Telefon), und `baseline-cleanup-11.json` hat nur ≈ 104 KB Luft bis 1 MB (Frage 5).
5. Aufwand **L**, Risiko **mittel bis hoch** (Layout-Baselines, Telefon-Konfiguration mit festen Breiten, `sketch.js` in `setup()`).

## 1. Skizze (Abstimmungsgrundlage; neue Bedienelemente und Positionen nur nach Ihrer Zustimmung)
Netz-Zeile (`#nav-netz`, ab 768 px), von links nach rechts: **Netzart-Stepper** | Inhalt je Netzart | Mehr.
```
A  aus            [≋ Netzart  ◂ — ▸ ]  │ [Sin][Tan][Geo] grau  [Stärke ◂0,5▸] grau │ ⋯
                    ^ "—", Beschriftung "Netzart: aus"        ^ Grund beim Tippen: "Das Gesetz gilt für Netzart 1."
B  Netzart 1      [≋ Netzart  ◂ 1 ▸ ]  │ [Sin][Tan][Geo]       [Stärke ◂0,5▸]      │ ⋯
                                          (Mehr: X/Y, Einzeln/Gekachelt/Feld, Makro, Fokus, Netzlinien, Umkehren, Wechseln)
C  Netzart 3C     [≋ Netzart  ◂ 3C ▸]  │ a ◂2▸  b ◂4▸  [ganz|halb]  W 6 · Streckung 2,7 ⚠ │ ⋯
                                          (Mehr: Vorschläge für 800 × 600, Netzlinien, Rahmen = Leinwand, Netzarten-Liste)
```
- **Stepper:** derselbe Baustein wie Stärke und Fokus (`UI.stepper`, Display mit `role="spinbutton"`, Chevrons ▴▾, Pfeiltasten Hoch/Runter und Links/Rechts auf dem Display, Halten wiederholt). Das Display zeigt „—“, „1“ oder „3C“; `aria-valuetext` den vollen Namen („Netzart 1, Barenscharen“, „Netzart 3C, Möbiusnetz“, „Netzart aus“), `aria-valuemin/max` = 0 und die Zahl der wählbaren Stufen. Es ersetzt den Knopf „Aus“: `.net-kind-btn[data-kind=regular]` bleibt als verstecktes technisches Element (`hidden`, nicht in der Tab-Reihenfolge), damit `sketch.js` und seine Tests unverändert lesen.
- **Stufen und Sperren** (gilt, solange die Form-Regel der Zeile greift: nur Basis-Ebene, sonst ist die ganze Zeile `aria-disabled` mit Grund, wie heute):
  | Eintrag | Quadrat | Dreieck | Sechseck |
  |---|---|---|---|
  | — (aus) | ja | ja | ja |
  | Netzart 1 | ja (Einzeln, Gekachelt, Feld) | ja (nur Feld) | ja (nur Feld) |
  | Netzart 3C (Möbiusnetz) | ja, Familie □N | **nein**, sichtbar mit Grund: „Das Möbiusnetz für das Dreieck folgt (3C-2, nur ganzes Format).“ | **nein**, mit Grund: „Beim Sechseck fehlt die Auslassregel (Messung 7); es gibt kein Möbiusnetz.“ |
  | Netzart 2, 3A, 3B, 4 bis 10 | nein, **Liste unter Mehr** (Zeile je Netzart, grau, mit Grund), und der Stepper nennt beim Tippen über 3C hinaus den Grund („Weitere Netzarten sind noch nicht umgesetzt: Netzart 2 und 3A/3B brauchen Trapez-, Kreis- oder Sternrahmen, 4 bis 10 gekrümmte Linien.“) | gleich | gleich |
  Auf dem Dreieck und dem Sechseck steht 3C also **im Stepper sichtbar, aber nicht anwählbar**: der Chevron zeigt den Grund als Hinweis (wie die Stärke an ihrer Grenze), nichts verschwindet, nichts stürzt.
- **„—“:** der Display zeigt „—“; die Netzart-1-Gruppe (Sin/Tan/Geo und Stärke) bleibt sichtbar und `aria-disabled` mit Grund (die bestehende Regel „nie ausblenden“, Frage 3). Das 3C-Cluster ist dann nicht da.
- **Netzart 3C:** an die Stelle der Netzart-1-Gruppe tritt: **a** (Stepper 2 bis b−1), **b** (Stepper a+1 bis 12), **Format** (Radiogruppe ganz | halb) und eine Anzeigezeile „W 6 · Streckung 2,7“. Familie □N steht nur im Namen („Möbiusnetz □N“). `b` über 9 ist wählbar (Kern: 12), die **Vorschlagsliste** (Mehr) bietet nur b ≤ 9 an.
- **Telefon (≤ 767 px):** die vorhandene Aufteilung in Unterreiter bleibt: „Art“ = Zeile 1 der Stepper (statt der vier Knöpfe), Zeile 2 die Netzart-1-Stärke oder bei 3C a, b, Format; W/Streckung in der Readout-Zeile (`#net-readout`, heute: Gebiet und Größe). Feste Breiten in `ui-phone-config.js` (Stepper 117/109, Knöpfe 48/60 auf 320 px): a und b je ein Stepper (117), Format ein Doppelknopf (96) → zwei Zeilen im Reiter „Art“. Das ist ein neues Layout: Frage 4.

## 2. Benennung (Hinterreiter, Band II) — Herleitung
| Quelle | Aussage |
|---|---|
| `reports/085.md:70–79` (Tabelle, Belege S. 2–163) | Netzart 1 (`1.1`) = (1) Barenschar + (1) Barenschar, Gesetze Sinus (`>`) / Tangens (`<`) / geometrische Reihe (Fechner), 10 Netzfamilien; Netzart 3 (`2.2`) = A) rundes Bild, B) Hauptpunkt, **C) Das Möbiusnetz** (S. 47–52). Netzart 4: keine Matrixzahl (`—`, Abb. 5–7), Tangentenschar. |
| `ROADMAP.md:313`, `Claude.md` (Stepper-Vermerk) | Stufen in der Schreibweise der Gerstner-Matrix: 1.1 = Netzart 1, 1.2 = 2, 2.2 = 3, 1.3 = 5, 1.4 = 6, 2.3 = 7, 2.4 = 8, 3.3 = 9, 4.4 = 10; Familien (□N, △N, \*N, DN, …) liegen darunter und werden von der Form bestimmt. |
| `reports/quellenlesung/00-uebersicht.md` | Namen: 3C „Die Möbiusnetze“, k je Familie; Klassen A bis D sind meine Einschätzung der App-Eignung, keine Quelle. |
| `core/netwarp.js:42`, `index.html:1498` | „Feld (Modell 2) = Hinterreiters **Netzart 1.1**, Fig. 8.1/8.2“: hier bezeichnet „1.1“ das **Feld**, nicht die ganze Netzart 1. |
**Mein Vorschlag:** Anzeige und Namen in Hinterreiters Zählung, die Matrixzelle nur als Zusatz im Tooltip: **„Netzart 1“** (Name „Barenscharen“; Tooltip „Matrix 1.1“) und **„Netzart 3C“** (Name „Möbiusnetz“; Tooltip „Netzart 3, Variante C, Matrix 2.2“). Der Stepper-Eintrag ist die **Variante 3C**, nicht „2.2“, weil die Matrixzelle 2.2 auch 3A und 3B enthält, die nicht gebaut sind. Gesetze weiter Sinus/Tangens/Geometrisch, Gebiete Einzeln/Gekachelt/Feld (Begriffe der App, nicht Hinterreiters). **Widerspruch, den ich nicht auflöse:** „1.1“ heißt im Code das Feld, im ROADMAP die ganze Netzart 1 (Fragen 1 und 2). Nicht gesehen: S. 7/8 (Kombinationstabelle) im Original.

## 3. Möbiusnetz-Bedienung
- **Spec:** `netProjectiveSpec(a, b, format)` aus 121; keine Kernänderung erwartet. Gültigkeit 2 ≤ a < b ≤ 12 vom Kern, die Stepper liefern nur gültige Paare; eine Grenze erklärt sich beim Tippen („b muss größer als a sein“, „a ist mindestens 2: a = 1 ist nicht gebaut“, „b ist höchstens 12“).
- **Anzeige:** `netProjectiveInfo(spec, canvasW, canvasH)` am **tatsächlichen Canvas** (aus `canvasW`, `canvasH`, nicht nur a, b): W, Streckung. Warnstufen: Streckung > 2 (Quelle S. 17 „höchstens 1 : 2“, Auslegung, Messung 6) und W außerhalb 7 bis 12 (Optimum Quadrat). Die Anzeige bleibt Hinweis: **gewählt werden darf es** (Frage 6), mit Text „Streckung 2,7: die Maschen sind stark verzerrt (Richtwert höchstens 2)“ und „W 6: unter dem Optimum 7 bis 12“. Beispiel 2,4 ganz bei 4:3: W 6, Streckung 2,73 (gemessen in 121): beide Warnungen.
- **Vorschläge** (unter Mehr, Abschnitt „Vorschläge für 800 × 600“): alle (a, b, Format) mit b ≤ 9, W im Optimum 7 bis 12, Streckung ≤ 2 **am aktuellen Canvas** (Suche über `netProjectiveInfo`, einige Dutzend Aufrufe), sortiert nach Streckung, höchstens 8 Knöpfe „3,7 halb · W 10 · 1,6“; antippen setzt a, b, Format. Gibt es keine: Text „Für 600 × 900 gibt es keine Kombination mit Streckung höchstens 2; die beste ist …“ (die mit der kleinsten Streckung, markiert).
- **Beim Einschalten** (Stepper → 3C): Voreinstellung = der erste Vorschlag, sonst die kleinste Streckung; war 3C vorher gewählt, die letzte Wahl (Panel-Gedächtnis).
- **Rahmen = Leinwand** (Entscheidung 121): im Mehr ein Satz „Das Netz füllt die ganze Leinwand; das Seitenverhältnis bestimmt die Streckung.“

## 4. Wechsel der Zustände und die Panel-Lücke (`sketch.js`, Freigabe nötig)
**Was bleibt, was geht:** Muster, Ebenen, freie Knoten, Flächenfarben bleiben (reguläre Koordinaten, `commit()` rührt sie nie an). Das **Gedächtnis von Netzart 1** (`ui`: Achsen, Gesetz, Stärke, Fokus, Gebiet, Makro) bleibt erhalten, solange 3C gewählt ist: 3C → 1 stellt es wieder her; das **Gedächtnis von 3C** (a, b, Format) bleibt beim Wechsel zu 1 oder „—“. „—“ löscht beides nicht (heute löscht Aus die Stärke nicht). Zurückgesetzt wird nur das, was die neue Netzart nicht kennt (Feld-Größenhinweise, Makro). Die Sperren (Kurve, Frei) gelten unter jedem Netz wie heute; die Flächenfüllung unter 3C ist erlaubt (Basis und Ebenen auf dem Basisgitter, Feld-Regel).
**Eine Zeile Haken, kleinste Änderung:** `sketch.js` bekommt in `initNetControls()` (i) `const is3C = () => !!baseNetTransform && baseNetTransform.kind === 'projective';` (ii) **`window.netArtSet(art, params)`**: `'off'` setzt beide Achsen auf `regular` und ruft `commit()`; `'n1'` stellt das Gedächtnis her (war es „aus“, Sinus mit den bestehenden Voreinstellungen `applyNetKindChoice`); `'3c'` setzt `baseNetTransform = netProjectiveSpec(a, b, format)`, hebt `netLive` der Zeitleiste auf (wie `commit()` es tut), ruft `render()`, `netControlsSync()`, `redraw()` und die zwei `sync*`-Hooks; (iii) **Wächter** an den Stellen, die ein 3C-Spec als Netzart 1 lesen würden:
| Stelle (`sketch.js`) | Wirkung heute unter 3C | Änderung |
|---|---|---|
| `stateDomain()` (601) | liest „Einzeln“, `ui.domain` wird überschrieben | gibt bei 3C `null` zurück (die Aufrufer prüfen `sd &&`) |
| `setDomain()` (602) | schreibt `domain`/`repeat` in das 3C-Spec | tut bei 3C nichts am Spec |
| `commit()` (635–642) | ersetzt das Spec durch ein Netzart-1-Spec | bei 3C früher Ausstieg: nur `render()`/`netControlsSync()`/`redraw()` |
| `adoptNetState()` (785) | liest `spec.x` (undefiniert) und setzt das Gedächtnis zurück | bei 3C Gedächtnis erhalten, nur `render()` |
| `netControlsSync()` (699 ff.) | `isField = ui.domain === 'field'` → Feld-Hinweise; **`faceOk` ist falsch → Flächenknopf gesperrt**; Makro-/Größen-Hinweise | `isField` und die Hinweise nur ohne 3C; `faceOk = (isField \|\| is3C) && …`; Hinweiszeile „3C: …“ |
Alles andere (`axisFromSpec`, `render()` für die Gesetzeknöpfe) bleibt. Geschätzt 30 Zeilen, ohne `/* */`. Prüfung: eine Quellcode-Sabotage je Wächter (§7).

## 5. Formunabhängigkeit: die Tabelle
Eine Tabelle in einem **neuen, reinen Modell** `ui-net-art.js` (UMD wie `ui-net-readout.js`, kein DOM): `NETART` = geordnete Liste `{id, label, name, matrix, shapes: {square, triangle, hex}}` mit je `available` oder `reason` (i18n-Schlüssel); `netArtEntries(shape)`, `netArtStep(shape, current, dir)` → `{to}` oder `{to: null, reason}`, `netArtSuggest(info, W, H)`. **Eine Stelle**, die 3C-2 (Dreieck, ganzes Format) später nur um eine Zeile erweitert (`triangle: {available: true, formats: ['full']}`). Der Grund für „kein 3C auf Dreieck/Sechseck“ steht heute **nur** im Kern (`netProjectiveEffective(…, shape).reason`, englisch); die Tabelle hat die deutschen und englischen Texte (ui-i18n) und prüft im Test, dass sie dem Kern nicht widerspricht (`available` ⇔ `netWarpForBase(spec3C, shape, …) !== null`).

## 6. Dateien (je Zeile)
| Datei | Rolle |
|---|---|
| `ui-net-art.js` | **neu**: reine Tabelle, Schritte, Vorschläge (Script-Tag in `index.html`, `?v=`) |
| `ui-net.js` | **schreiben**: Stepper verdrahten, 3C-Cluster (a, b, Format), Readout, Netzarten-Liste, Sperrgründe, `aria-valuetext` |
| `ui-net-readout.js` | **evtl.** eine reine Funktion für „W · Streckung“ (sonst in `ui-net-art.js`); `readoutText` und seine gepinnten Zeilen bleiben |
| `ui-i18n.js` | **schreiben**: ca. 30 Schlüssel `net.art.*` DE/EN (Namen, Gründe, Warnungen, Tooltips, Listenzeilen) |
| `index.html` | **schreiben**: Stepper vor `#nav-kinds`, 3C-Cluster, Mehr-Abschnitte; `?v=` in allen drei Seiten gemeinsam |
| `style.css` | **schreiben**: Breiten der Zeile, Warnfarbe; Telefon-Regeln nur in `@media (max-width: 767px)` mit `html.ph` (Regel aus `docs/agent-rules.md`) |
| `ui-phone-config.js` | **schreiben (Telefon-Layout, Freigabe)**: Reiter „Art“ |
| `sketch.js` | **schreiben, Freigabe nötig** (§4): nur in `initNetControls()` |
| `core/*.js` | **unverändert erwartet** (`netProjectiveInfo`, `netProjectiveSpec`, `netAnimationCompat` existieren); eine Änderung nur mit Begründung und Freigabe |
| `core/tiling.js`, `faces.js`, `facecolor.js`, `spatial-morph-render.js`, Off-Path-Golden, `gallery/`, die acht Funktionen in `sketch.js` | **geschützt, unverändert** |
| `tools/ui/baseline-*.json` | **nicht ändern**; neue Datei erst nach Freigabe (§8) |
**`?v=`:** neues Tag ohne Ziffer nach dem Datum (Regel `\d+[a-z]+`, `test-esm-cachebust`), z. B. `20261230netart`. **Erwartete Pins (alt → neu), erst `proof.sh` zeigt sie:** die Netz-Tests der UI (`tools/ui/test-net-lock.js`, `test-net-lock-reasons.js`, `test-net-readout.js`, `test-net-family-readout.js`, `test-net-even-ui.js`, `-hex-even-ui`, `-triangle-even-ui`, `test-phone-config.js`), die Quelltext-Vergleiche gegen eine Basis (`sketch.js`-Bereiche, `index.html`), die i18n-Prüfungen (Schlüssel-Gleichheit DE/EN) und die „core unchanged“-Tests nur bei einem `core/`-Eingriff. Jeder Pin in einem eigenen Commit mit alt → neu.

## 7. Testplan
**Harness** `tools/ui/test-netart-model.js` (importiert `ui-net-art.js`, `core/netwarp.js`): Tabelle für alle drei Formen (Quadrat: —, 1, 3C ok; Dreieck/Sechseck: 3C mit Grund); `netArtStep` an beiden Enden und über 3C hinaus (Grund, `to: null`); Tabelle gegen den Kern (`available` ⇔ Warp vorhanden); `netArtSuggest` am Canvas 800 × 600 / 600 × 600 / 1200 × 600 / 600 × 900 gegen Messung 6 (b ≤ 9, W 7 bis 12, Streckung ≤ 2) und der Fall „keine Kombination“; Stepper-Grenzen a < b, 2 ≤ a, b ≤ 12.
**Source-/Sandbox-Test** `tools/ui/test-netart-sketch.js` (lädt `sketch.js` wie `test-net-even-ui.js`): Wechsel — → 1 → 3C → 1 → — : Spec, Gedächtnis (Gesetz, Stärke, Gebiet bleiben), `netArtSet('3c')` überschreibt nichts durch `commit()`/`adoptNetState()`/`netControlsSync()`, kein `repeat`/`domain` im 3C-Spec, Flächenknopf unter 3C frei, Kurve/Frei gesperrt, Zeitleiste (zwei 3C-Zustände interpolierbar, 3C ↔ 1 mit Grund abgelehnt).
**Sabotagen (≥ 5, jede muss rot werden):** S1 Tabelle erlaubt 3C auf dem Dreieck; S2 `commit()` ohne Wächter (die 121-Lücke); S3 `stateDomain()` ohne Wächter; S4 `faceOk` ohne 3C; S5 `netArtSuggest` ignoriert das Canvas-Verhältnis; S6 Stepper lässt b ≤ a zu; S7 `adoptNetState()` setzt das Gedächtnis zurück; S8 Wechsel 3C → 1 verliert das Gesetz.
**Browser (echte Bedienung, App im Fenster):** Stepper durchschalten (—, 1, 3C, über 3C hinaus mit Grund; Tastatur: Pfeile auf dem Display, Tab-Reihenfolge, VoiceOver-Text per `aria-valuetext` gelesen); a, b, Format ändern, Vorschlag antippen; Wechsel Feld ↔ 3C und Einzeln ↔ 3C (Muster und Ebenen bleiben); Zeitleiste mit zwei Möbius-Zuständen und mit 3C ↔ Netzart 1 (abgelehnt, Text); Dreieck und Sechseck (3C sichtbar mit Grund, kein Absturz); Telefonbreite 375; Konsole fehlerfrei; Bildschirmfotos der Zustände A/B/C und der Grenzfälle in `reports/122-bilder/` (nicht committet, Pfade im Bericht); **Golden 30/30** (main gegen Arbeitsbaum im selben Fenster, Ergebnisobjekte, FNV); ohne Netz ändert sich kein Code-Pfad (Off-Path-Vergleich wie 121 Test 9).
**Prüfstufe:** `bash tools/guard.sh main` (FAIL nur für `sketch.js`), `bash tools/proof.sh L2 122` (L3 nicht nötig: `faces.js`/`facecolor.js` unberührt).

## 8. Layout-Baselines
Der Netz-Tab ändert sich (Stepper, 3C-Cluster, Mehr-Abschnitte); alle neun Desktopbreiten und das Telefon sind betroffen. **Vorschlag, nur mit Freigabe:** nach dem Bau (nach den Pins, eigener Commit) `tools/ui/baseline-netzart-12.json` (Breiten ≥ 768, Rezept in `Claude.md` „Recording a baseline“, alle Breiten in **einem** Zug) und `tools/ui/baseline-phone-6.json` (320/375/430, je ≈ 100 s) aufnehmen, mit `before`-Notiz; `compare-baseline.js` alt gegen neu: **nur Unterschiede im Netz-Tab dürfen auftreten**, jede andere Differenz ist ein Fehler. Danach `Claude.md` (aktuelle Referenzen) und `docs/baselines.md` je einen Satz. Größe: `baseline-cleanup-11.json` 944 KB (Obergrenze 1 MB, 104 KB Luft): Frage 5.

## 9. Aufwand, Risiko, Commits
| Teil | Aufwand | Risiko |
|---|---|---|
| `ui-net-art.js` + Modelltest | S | gering |
| i18n-Schlüssel | S | gering |
| `sketch.js`-Haken und Wächter + Test | M | **mittel** (`setup()`, Sperrlogik, Zeitleiste) |
| Desktop: `index.html`, `ui-net.js`, `style.css` | M | mittel (Layout, Tastatur, Zugänglichkeit) |
| Telefon: `ui-phone-config.js` | M | mittel–hoch (feste Breiten auf 320 px) |
| Pins | S–M | gering |
| Baselines (Aufnahme und Vergleich) | M | Zeit, Größe |
| Browser-Prüfung, Golden, Bericht | M | Zeit |
Commits: (1) Plan; (2) `ui-net-art.js` + Test (zuerst rot); (3) i18n; (4) `sketch.js` + Test; (5) Desktop; (6) Telefon; (7) `?v=` (alle drei Seiten); (8) Pins (alt → neu); (9) Baselines (eigener Commit, nach Freigabe); (10) `ROADMAP.md`/`Claude.md`; (11) Bericht. Nach jedem Commit lauffähiger Stand (die neue Datei ist bis (5) ohne Wirkung).

## 10. Offene Fragen an Sie (nur was Code und Quellen nicht beantworten)
1. **Beschriftung:** „Netzart 1“ und „Netzart 3C“ (Matrix 1.1 / 2.2 nur im Tooltip) — oder die Matrixzahlen „1.1“ / „2.2“ als Anzeige? Der Konflikt: `ROADMAP.md:313` und `reports/085.md:70–72` machen 1.1 zur ganzen Netzart 1 und 2.2 zur ganzen Netzart 3 (A, B, C), aber 2.2 stünde dann für eine einzige gebaute Variante (3C); `core/netwarp.js:42` und `index.html:1498` nennen das **Feld** „Netzart 1.1“. *Empfehlung: „1“ und „3C“.*
2. **Name der Netzart 1** im Namen/Tooltip: „Barenscharen“ (085, Hinterreiters Wort „Barenschar“) oder „Parallelenscharen“ (so nennt es der Kopf von `core/netwarp.js`)? Die Bezeichnung „Quadratnetz mit ungleichen Abständen“ steht ebenda. *Empfehlung: „Barenscharen“, nicht am Original (S. 10) geprüft.*
3. **Bei „—“:** die Netzart-1-Gruppe (Sin/Tan/Geo, Stärke) sichtbar und gesperrt mit Grund (bestehende Regel „nie ausblenden“) oder ausgeblendet? *Empfehlung: sichtbar, gesperrt.*
4. **Telefon:** die 3C-Bedienung im Reiter „Art“ jetzt mitbauen (neues Layout, feste Breiten, Telefon-Baseline) oder das Telefon in 3C-3 nur den Stepper bekommt und die 3C-Werte (a, b, Format) dort erst später? *Empfehlung: mitbauen; sonst gäbe es einen Zustand, den man am Telefon nicht ändern kann.*
5. **Baseline-Größe:** `baseline-cleanup-11.json` hat 104 KB Luft bis 1 MB (`Claude.md`: „the next extension needs a trim“). Trimmen (was?) oder die Grenze anheben? Wo die Grenze steht (Test oder Regel), habe ich nicht nachgesehen.
6. **Streckung über 2 / W außerhalb 7 bis 12:** nur warnen (Wahl bleibt frei, wie die Vorschlagsliste nur empfiehlt) oder die Wahl blockieren? *Empfehlung: warnen.*
7. **`sketch.js`-Eingriff** in `initNetControls()` wie §4 (Haken `netArtSet`, vier Wächter, keine Änderung an den acht Funktionen): freigegeben? Die Alternative (das Gedächtnis des Panels nach außen verlegen) wäre größer.
8. **Texte der Kernsätze:** die Gründe, die `netAnimationCompat` liefert („a 3C net … cannot be interpolated …“), sind englisch und stehen in `core/`; die Zeitleisten-Anzeige übersetzt sie heute nicht. Übersetzen (Karte in `ui-i18n.js`, kein Kerneingriff) oder englisch lassen? *Empfehlung: lassen; nur die neuen Stepper-Texte zweisprachig.*

## Nicht geprüft
`style.css` und `ui-phone.js` nicht gelesen (die Umbaustellen des Telefons stehen im Plan als Annahme: Elemente werden umgehängt, nicht geklont); die Netz-Tests nur nach Namen; ob eine Regel/ein Test die 1-MB-Grenze der Baseline erzwingt; S. 7/8 und S. 10 des Originals nicht gesehen (Namen nach `reports/085.md` und den Lesenotizen); die Bedienung am Gerät (Touch).
