# Auftrag 126 — Fehlender Grund bei ungültigem 3C-Spec nach Formwechsel — PLAN (Typ K, Prüfstufe L2)

Branch `task/126-3c-grund-sichtbar` von main `3ece907b` (Merge 124). **Stand: nur dieser Plan geschrieben, nichts gebaut, auf Freigabe warten.** Nicht mergen, nicht pushen, `docs/quellen/` nie committen, nur explizite `git add`-Pfade. Stoppregel: Zwischenmeldung ≥ 93 %, Stopp ≥ 98 % Wochenkontingent (Woche bei Planstart 86 %).

Gelesen: `reports/124.md`, `ui-net.js` (`syncArt`, `warnShow`), `ui-net-art.js`, `index.html:675, 1495–1502, 1569`, `style.css:984–991, 1509, 1725`, `ui-phone-config.js:118, 218`, `ui.js` (Benachrichtigung `UI.notify`), `sketch.js` (`say`). Nicht gelesen: `ui-phone-engine.js` im Detail (Verhalten ausgeblendeter Zeilenelemente: Risiko unten).

## 1. Reproduktion und Ursache (Browser, echte Bedienung, App im Fenster, Konsole fehlerfrei)
**Fall 1** (Quadrat, 3C, Format „halb“ → Dreieck) und **Fall 2** (Dreieck, 3C, a = 1 → Quadrat), nachgestellt mit Klicks auf Netzart-Stepper, Format-Icon und Formknopf; Zustand danach: Spec bleibt (`family` evtl. veraltet), `netProjectiveEffective` ungültig, **kein Netz**. Für jede Breite habe ich alle sichtbaren Elemente mit dem Grundtext gesucht (Größe > 0, `offsetParent`):

| Breite | Warnzeichen `#net-3c-info` | sichtbarer Grundtext |
|---|---|---|
| 768, 1100, 1440 px (Desktop) | da, `hidden` aus, 18 × 36 px, **nur das Dreieck-Symbol**, Text nur im Tooltip (`title`, `aria-label`) | **keiner** (die drei Elemente mit dem Text liegen im geschlossenen Mehr-Overlay: 0 × 0) |
| 375 px (Telefon) | **0 × 0, gar nicht gezeichnet** | **keiner** (nur `#net-readout` im geschlossenen Mehr-Blatt `#more-netz`: `display: none`) |

**Ursache (Fundstellen):**
1. *Desktop:* Das Warnzeichen (`index.html:675`, `ui-net.js:214` `warnShow`, `style.css:987`) ist ein reines Symbol; der Grund steht nur im Tooltip (erst beim Hover, am Touch gar nicht) und in `#net-3c-measure` / `#net-3c-note` im **Mehr-Overlay** (`index.html:1495–1498`), das der Nutzer dazu öffnen müsste. Es gibt keinen sichtbaren Text ohne Zutun. Der Zustand wird korrekt synchronisiert (das Zeichen erscheint nach dem Formwechsel in der nächsten UI-Runde; ein falsch gesetztes `hidden` oder ein Synchronisierungsfehler ist nicht die Ursache), und das Zeichen sieht genau wie die Streckungswarnung aus, ist also nicht als „kein Netz, weil …“ lesbar.
2. *Telefon:* `#net-3c-info` liegt in `#nav-netz` in `.nav-rows` (`index.html:463`), und `html.ph .nav-rows` ist `display: none` (`style.css:1509`): das Zeichen wird am Telefon **nie** gezeigt. Der Grund steht dort nur in der Readout-Zeile des **Mehr-Blatts** (`ui-phone-config.js:218`, `#net-readout`), also hinter „…“.
3. *Bericht 124 hat das falsch gemeldet:* ich habe `aria-label` und `offsetParent` des Zeichens gelesen („erscheint“), nicht, dass **kein Text** zu sehen ist und dass das Zeichen am Telefon 0 × 0 hat. Das war mein Prüffehler; er steht im Bericht 126 als Berichtigung.
4. Die Warnbedingung selbst (Streckung/W) ist nicht die Ursache: ein ungültiges Spec setzt seit 124 den Grund in `syncArt` (`fmtWhy`, `ui-net.js:218–236`).

## 2. Vorschlag zur Abstimmung (Skizze), ohne Änderung am Zustand des Nutzers
**A (empfohlen), zwei Teile:**
- **A1 Benachrichtigung** (bestehende Komponente `UI.notify` über `window.say`, Schlüssel `net-3c-invalid`, Art `warn`, **einmal je Zustand**: erscheint beim Wechsel in den ungültigen Zustand (Formwechsel, Laden einer Session, a/b/Format-Bedienung), `UI.notifyClear` beim Wechsel zurück in einen gültigen; ab 60 Zeichen mit Schließknopf, am Telefon 1 sichtbar). Volltext, ohne Hover, überall.
- **A2 Bleibende Kurzzeile**, solange der Zustand ungültig ist:

```
Desktop, Netz-Zeile (nur bei ungültigem Spec, sonst nichts):
 [3C ▾] [a 3 ▾] [b 7 ▾] [▭] [▯]  ⚠ Am Dreieck nur ganzes Format.        ...
                                   └ Warnzeichen + Kurztext, Volltext im Tooltip und unter Mehr > Maße

Telefon, Panel Art (neue dritte Zeile, nur bei ungültigem Spec):
 [3C ▾] [a 3 ▾] [...]
 [b 7 ▾] [▭] [▯]
 ⚠ Am Dreieck nur ganzes Format.
```
  Die Streckungs- und W-Warnung bleiben beim Symbol allein (wie 123; sie sind Hinweise, kein fehlendes Netz).
- Mehr > „Maße“ trägt weiter den Volltext (wie 124), das Zeichen behält Tooltip und `aria-label`.

**B (Alternative, nicht empfohlen): beim Formwechsel das Spec automatisch gültig machen** (halb → ganz, a → Mindestwert) und das einmal sagen. Gegen B: es überschreibt die Wahl des Nutzers (Entscheidung 124: halb bleibt im Spec), Fall 2 ändert das Bild (a = 1 → 2), und der Rückweg Dreieck → Quadrat stellt „halb“ nicht wieder her. Es bleibt eine Zustandsänderung, auch wenn sie angesagt wird.
**C (kleinste Lösung): nur A1**, kein neues Element, keine neue Position.

**Neue Texte (DE / EN), Vorschlag zum Wortlaut:**
| Schlüssel | DE | EN |
|---|---|---|
| `net.3c.invalid.triHalf` (Voll) | Kein Netz: Am Dreieck gibt es das Möbiusnetz nur im ganzen Format (die Mittelachse schneidet Dreiecke). „ganz“ wählen. | No net: on the triangle the Möbius net exists in the full format only (the middle axis cuts triangles). Choose “full”. |
| `net.3c.invalid.short.triHalf` (Kurz) | Am Dreieck nur ganzes Format. | Triangle: full format only. |
| `net.3c.invalid.aMin` (Voll) | Kein Netz: Am Quadrat hat das Möbiusnetz a ≥ 2 (am Dreieck a ≥ 1). a auf 2 oder mehr stellen. | No net: on the square the Möbius net needs a ≥ 2 (a ≥ 1 on the triangle). Set a to 2 or more. |
| `net.3c.invalid.short.aMin` (Kurz) | Am Quadrat ist a mindestens 2. | On the square a is at least 2. |
| `net.3c.invalid.other` (Voll und Kurz) | Kein Netz: Dieses Möbiusnetz ist für diese Form ungültig. | No net: this Möbius net is not valid for this shape. |

Die vorhandenen Texte `net.art.reason.n3c.triHalf` und `net.art.reason.aMin` bleiben (Tooltip des Format-Icons, Stepper-Sperre).

## 3. Umsetzung
- **`ui-net-art.js` (rein):** `invalidHint(core, spec, shape)` → `null` oder `{ key, shortKey, level: 'invalid' }`: Gültigkeit aus dem Kern (`netProjectiveEffective(netProjectiveForShape(spec, shape), shape)`), Zuordnung: Format (Dreieck, halb) → `triHalf`; a unter Mindestwert der Form → `aMin`; sonst → `other`. `hintSig(spec, shape, lang)` für „einmal je Zustand“ (enthält die Form: ein Formwechsel gibt eine neue Signatur).
- **`ui-net.js`:** `syncArt` ruft `invalidHint`; neues `<span id="net-3c-reason">` (Kurztext, sichtbar nur bei Hinweis), Zeichen und Kurztext als eine Gruppe; bei Signaturwechsel `window.say('net-3c-invalid', Volltext, 'warn')` bzw. `UI.notifyClear`; Readout-Zeile des Telefons unverändert (trägt `⚠ Grund`).
- **`index.html`:** `<span id="net-3c-reason" hidden>` neben `#net-3c-info` (Z. 675) und `?v=` (drei Seiten gemeinsam). **`style.css`:** Regel für `#net-3c-reason` (Schriftgröße `--size-secondary`, einzeilig, Ellipse, nur sichtbar ohne `hidden`); am Telefon die neue Zeile. **`ui-phone-config.js`:** dritte Zeile im Panel Art mit `net-3c-reason` (nur nach Zustimmung zur neuen Position).
- `ui-i18n.js`: die fünf Schlüssel oben. Kein `core/`, `sketch.js` unberührt, Off-Path-Golden, Baselines, `gallery/` unberührt.
- **Ohne Netz ändert sich kein Code-Pfad:** der neue Zweig läuft nur bei `baseNetTransform.kind === 'projective'` und ungültigem Spec; sonst wie heute (Golden 30/30, `test-draw-writes`).

## 4. Dateien (je Zeile)
| Datei | Rolle |
|---|---|
| `ui-net-art.js`, `ui-net.js`, `ui-i18n.js` | schreiben |
| `index.html` | ein `<span>`, `?v=` (gemeinsam mit `gallery.html`, `color-harmony/ui/index.html`) |
| `style.css` | Regel(n) für `#net-3c-reason` (Desktop, Telefon) |
| `ui-phone-config.js` | dritte Zeile im Panel Art (nur mit Zustimmung zu A2 am Telefon) |
| `tools/ui/test-netart-model.js`, `test-netz-i18n-keys.js`, `test-netz-nachbesserung.js` (Quelltext von `ui-net.js`), neu `tools/ui/test-netz-grund.js` | Tests |
| `tasks/126-…md`, `reports/126.md` | Plan, Bericht |
**Erwartete Pins (alt → neu):** `test-phone-config` (Zeilenzahl Panel Art 2 → 3, falls A2 am Telefon; Regelzahl Netz-Block), `test-phone-engine` (Attrappe `net-3c-reason`), `test-netz-nachbesserung` (Quelltext von `warnShow`/`syncArt`), `test-netart-model` (additiv, kein alt → neu). `core/`-Pins: keine. **Baselines:** nur Vorschlag und Vermerk: die Baseline-Szenarien (Netzart 1, kein ungültiges 3C) zeigen die neuen Elemente nie (`hidden`), erwartet 0 Differenzen; ich nehme **nicht** auf, ohne Ihre Freigabe, und messe vorher die Rechtecke der Netz-Zeile mit und ohne Hinweis (Vermerk in `docs/baselines.md`).

## 5. Testplan
- **Pur (Sandbox, nicht nur Browser):** `tools/ui/test-netz-grund.js`: für jede Form (Quadrat, Dreieck, Sechseck) × Format (ganz, halb) × a (0, 1, 2) × b (≤ a, 13, nicht ganzzahlig): wenn der Kern das Spec ablehnt, gibt `invalidHint` einen Schlüssel zurück, dessen DE- und EN-Text vorhanden und nicht leer sind (kein roher Schlüssel, gleiche Platzhalter); wenn der Kern es annimmt, ist der Hinweis `null`. Fall 1 und Fall 2 namentlich (Zustand → sichtbarer Kurz- und Volltext, DE und EN). Signatur: Formwechsel ändert `hintSig`.
- **`test-netz-i18n-keys.js` erweitert:** alle Gründe, die `invalidHint` liefern kann, sind Wörterbuchschlüssel (Modellausgabe wie 123).
- **Quelltext von `ui-net.js`/`index.html`/`style.css`** (Muster `test-netz-nachbesserung`): `net-3c-reason` existiert, `syncArt` ruft `invalidHint`, `say('net-3c-invalid'…)` und `notifyClear` stehen im Quelltext, der Kurztext wird nicht nur in `title` geschrieben, die Phone-Regel blendet `#net-3c-reason` nicht aus.
- **Sabotagen (≥ 3, jede rot):** (S1) Kurzzeile fehlt (nur `warnShow`); (S2) Hinweis nur im Tooltip (Kurztext nicht als `textContent`); (S3) Signatur ohne Form → nach Formwechsel nicht neu gemeldet; (S4) `invalidHint` für „a unter Mindestwert“ fehlt (Fall 2); (S5) `invalidHint` für Dreieck halb fehlt (Fall 1); (S6) Schlüssel fehlt im Wörterbuch; (S7) Hinweis auch bei gültigem Spec.
- **Browser** (App im Fenster, echte Bedienung, `read_console_messages` fehlerfrei): beide Fälle, **DE und EN**, **768, 1100, 1440 und 375 px**: sichtbarer Text vorhanden (Größe > 0, nicht abgeschnitten, kein Überlauf, `scrollWidth` = Viewport), die Benachrichtigung erscheint genau einmal je Zustand und verschwindet beim Wechsel zurück, am Telefon Zeile und Benachrichtigung gleichzeitig; Bildschirmfotos als Leinwand-Abzüge nach `reports/126-bilder/` (nicht committen), Bedienelemente mit Rechtecken belegt.
- **Golden 30/30** (main `git archive` Port 8992 und Arbeitsbaum Port 8991 im selben Fenster), `bash tools/guard.sh main` (erwartet: PASS, `core/` und `sketch.js` unverändert gegen main), `bash tools/proof.sh L2 126`.

## 6. Aufwand, Risiko, Commits
| Teil | Aufwand | Risiko |
|---|---|---|
| `invalidHint`, Signatur, Texte | S | gering |
| `ui-net.js` (Zeile, Benachrichtigung), `index.html`, `style.css` Desktop | S | gering |
| Telefon: dritte Zeile im Panel Art | M | mittel (Verhalten der Zeilen-Engine bei ausgeblendeten Elementen und Pins `test-phone-config`/`-engine`; ich lese `ui-phone-engine.js` vor dem Bau) |
| Tests, Browser, Bericht | M | Zeit |
Commits: (1) Plan; (2) Modell + Texte + Tests (rot); (3) `ui-net.js`/`index.html`/`style.css` Desktop; (4) Telefon (falls freigegeben); (5) Pins alt → neu; (6) `?v=`; (7) Bericht.

## 7. Offene Fragen an Sie
1. **A, B oder C?** (Empfehlung A.) Bei C entfällt die Kurzzeile, am Telefon bleibt nur die Benachrichtigung.
2. **Neue Position am Telefon** (dritte Zeile im Panel Art, nur bei ungültigem Spec) und **Kurztext neben dem Warnzeichen am Desktop**: einverstanden? Alternative ohne neue Position: Kurztext **ersetzt** am Desktop das Warnzeichen-Symbol-Tooltip nicht, aber das Zeichen wird anklickbar und öffnet Mehr > Maße (nur Desktop; am Telefon bleibt A1).
3. **Wortlaut** der Kurz- und Volltexte (Abschnitt 2), besonders „ganz“ in Anführungszeichen im Volltext.
4. **„Einmal je Zustand“** für die Benachrichtigung (nach dem Schließen nicht wieder, bis sich der Zustand ändert) oder bei jedem Formwechsel neu?

## Nicht geprüft (bis jetzt)
Touch ohne Hover (Tooltip) nur aus dem Quelltext abgeleitet, nicht mit echtem Touch; Verhalten von `ui-phone-engine.js` bei einem ausgeblendeten Zeilenelement (nicht gelesen); Fall 2 am Desktop nicht eigens nachgestellt (gleicher Codepfad wie Fall 1 am Desktop, am Telefon nachgestellt); Screenreader.
