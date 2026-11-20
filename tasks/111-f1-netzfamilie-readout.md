# Auftrag 111 — F1: Familienname im Netz-Readout (Typ K, Prüfstufe L3)

Branch `task/111-f1-netzfamilie-readout` von main `706bef72` (Merge 110). Grundlage: `tasks/110-n4-netzarten-plan.md` (F1), `reports/110.md`. **Dieser Text ist der Plan zur Freigabe; gebaut wird erst danach.** `docs/quellen/` wird nie committet, nur explizite `git add`-Pfade.

## 0. Befunde vorab (gelesen, nicht gebaut)
- **Es gibt zwei Stellen mit Text zum Netz:** (a) `#net-readout` (`ui-net.js:167`, Modell `ui-net-readout.js`): **eine** Zeile unter den Gebietstasten, nur im Telefon-Layout sichtbar (`style.css:236`, `html.ph` / `html.sr-netz`, Höhe 20 px, einzeilig mit Auslassungspunkten); (b) `#net-field-info` (`sketch.js:720`, `htmlOnce(fieldInfo, …)`): der längere Feld-Absatz, nur wenn ein Netz im Feld aktiv ist; er ist **heute fest englisch** gesetzt, nur der Optimum-Hinweis (106) kommt aus `UI.t`.
- **Pins auf den Readout-Text:** `readoutText(...)` wird von `test-net-field-2d`, `test-net-field-hex`, `test-net-readout-tick`, `test-net-even-ui` mit festen Zeichenketten geprüft („Feld: 9 × 7 Kacheln, Rand angeschnitten“ usw.). **`readoutText` bleibt darum byte-gleich;** der Name kommt als **eigene reine Funktion** dazu und wird erst in `ui-net.js` vorangestellt. Dadurch ändern sich diese Pins nicht.
- **Sichttest der Zeichen (im Browser gemessen):** Die UI-Schrift `SuisseIntl` hat weder □ (U+25A1) noch △ (U+25B3) noch eine eigene Breite für sie: die Breite fällt auf die Systemschrift zurück (□ 7,59 px wie `sans-serif`, △ 14 px wie `sans-serif`). Das Zeichen wird also von der **Systemschrift** gezeichnet; auf dieser Maschine (macOS) sichtbar, auf anderen Systemen von der dortigen Ersatzschrift abhängig. „\*“ und „N“ hat `SuisseIntl`. Der Sichttest nach dem Bau (Screenshot Desktop und Telefon, 320 und 375 px) ist Teil der Prüfung; sieht △ oder □ dort wie ein leeres Kästchen aus, wird der Plan auf den Rückfall (§4) umgestellt.

## 1. Was sich ändert
| # | Datei | Änderung |
|---|---|---|
| 1 | `ui-net-readout.js` | neue reine Funktion `readoutFamily(shape, domain, active, t)`: Schlüssel `net.family.<shape>` nur wenn `domain === 'field'` **und** `active` (Netz aktiv, Art ≠ Aus) und die Form eine der drei ist, sonst `''`. `readoutText`, `readoutDomain`, `readoutKey` unverändert. Export `readoutFamily`, Schlüsseltabelle `FAMILY_KEYS`. |
| 2 | `ui-net.js:167` (Zeile des Readouts) | `text = family ? family + ' · ' + text : text`, `family = window.netReadout.readoutFamily(currentShape, dom, netWarpActive(), UI.t)`. Nur diese eine Zeile; kein neues Element. |
| 3 | `sketch.js` (Netz-Steuerung, ~Z. 718–720, **Freigabe nötig**) | `const famHint = window.UI && UI.t && evenShape ? ' ' + UI.t('net.family.info.' + currentShape) : ''` und `${famHint}` am Ende der Vorlage von `#net-field-info` (nach `${optHint}`). Die Pins `test-net-lock`/`-reasons` prüfen nur den englischen Satz „Face fills are exact …“, der unverändert bleibt. Keine der acht geschützten Funktionen. |
| 4 | `ui-i18n.js` | sechs neue Schlüssel (§2), de und en. |
| 5 | `index.html`, `gallery.html`, `color-harmony/ui/index.html` | `?v=20261225sechseckgerade` → `?v=20261226netzfamilie`. |
| 6 | `ROADMAP.md`, `CLAUDE.md` (`Claude.md`) | je ein Satz zu F1. |
Nicht berührt: `core/` (also `tiling.js`, `faces.js`, `facecolor.js`, `spatial-morph-render.js`, `netwarp.js`), Export, Session, Zeitleiste, Golden, Baselines, `gallery/v2`, Zählung W, die acht Funktionen in `sketch.js`.

## 2. Wo und wann der Name erscheint (Vorschlag)
- **Telefon-Readout (`#net-readout`):** `△N · Feld: 9 × 7 Kacheln, Rand angeschnitten` (Dreieck), `□N · Feld: 5 × 5 Kacheln` (Quadrat), `*N · Feld: 15 × 15 Sechsecke, Rand angeschnitten` (Sechseck). Das Telefon hat schon ein Readout, also kommt der Name dorthin. Nur im Gebiet **Feld** und nur bei **aktivem Netz** (Art ≠ Aus); Einzeln, Gekachelt und Aus: Zeile unverändert, kein Name.
- **Desktop (`#net-field-info`):** am Ende des Absatzes ein kurzer Satz mit Namen und Seite der Quelle (nur Feld, nur aktives Netz).
- **Länge im Telefon:** die Zeile ist einzeilig und kürzt mit Auslassungspunkten (CSS, unverändert). Der Zusatz „△N · “ kostet etwa 7 Zeichen; bei 320 px kann das Dreieck-Feld („…, Rand angeschnitten“) am Ende gekürzt werden. Das wird gemessen (320, 375, 430); gekürzt wird am Ende, der Name steht vorn und bleibt sichtbar. Ändere ich an der CSS-Zeile nichts.

## 3. Texte (wörtlich)
| Schlüssel | de | en |
|---|---|---|
| `net.family.square` | □N | □N |
| `net.family.triangle` | △N | △N |
| `net.family.hex` | \*N | \*N |
| `net.family.info.square` | Netzfamilie □N (Quadratnetz, Hinterreiter Band II, S. 10). | Net family □N (square net, Hinterreiter vol. II, p. 10). |
| `net.family.info.triangle` | Netzfamilie △N (Dreiecknetz, Hinterreiter Band II, S. 14). | Net family △N (triangle net, Hinterreiter vol. II, p. 14). |
| `net.family.info.hex` | Netzfamilie \*N (Sechsecknetz, Hinterreiter Band II, S. 14). | Net family \*N (hexagon net, Hinterreiter vol. II, p. 14). |
Die ersten drei sind in de und en gleich (reine Zeichen); die dictionary-Prüfung „de ≠ en“ gilt für sie nicht, der neue Test prüft sie auf Vorhandensein in beiden Sprachen. Seiten gelesen: □N S. 10, △N und \*N S. 14 (`reports/110.md`).

## 4. Rückfall, falls der Sichttest ein leeres Kästchen zeigt
Der Name wird dann nur mit den Buchstaben geschrieben: „QN“, „DN“, „SN“ sind **nicht** die Quellenkürzel und würden verwechselt; stattdessen im Readout „Quadratnetz · Feld: …“ / „Dreiecknetz · …“ / „Sechsecknetz · …“ (längere Zeile, bei 320 px stärker gekürzt) und die Zeichen nur im Desktop-Satz. Das Fallback entscheidet der Sichttest, nicht ich; ich frage in diesem Fall vor dem Weiterbauen.

## 5. Prüfung
- **Neuer Test (L2)** `tools/ui/test-net-family-readout.js`: (1) reine Funktion: je Form (Quadrat, Dreieck, Sechseck) × Gebiet (Feld, Gekachelt, Einzeln) × aktiv (an, aus) × Sprache (de, en): Name nur bei Feld und aktiv, sonst `''`; unbekannte Form `''`; (2) die echte `ui-net.js`-Zeile liefert „△N · Feld: …“ (Fake-DOM wie `test-net-readout-tick`), bei Art Aus nur „Feld: …“/„Einzeln: …“ ohne Namen; (3) Schlüssel vorhanden in de und en, die drei Zeichen-Schlüssel haben das Zeichen ihrer Form, die Sätze nennen Seite 10 / 14; (4) `readoutText` byte-gleich zu main für alle (Gebiet × n × m); (5) `#net-field-info` trägt den Satz je Form nur bei aktivem Feld-Netz (echte `initNetControls`, wie `test-net-even-ui`), de und en, der englische Absatz „Face fills are exact …“ bleibt.
- **Sabotagen auf Kopien (je rot):** falscher Name für die Form (Dreieck zeigt □N); Name auch bei Art Aus; Name auch bei Gekachelt/Einzeln; Schlüssel fehlt in en; `readoutText` mit Namen (Pins rot); `${famHint}` entfernt.
- **Pins:** erwartet keine (Readout-Text unverändert); `test-i18n` (Wörterbuchliste) nur, falls er die Schlüsselzahl prüft; gegebenenfalls eigener Commit mit alt → neu.
- `bash tools/guard.sh main` (FAIL erwartet: `sketch.js`), `bash tools/proof.sh L3 111`; geschützte Dateien gegen main leer.
- **Browser (echt):** AUS-Pfad-Golden 30/30 (main gegen Arbeitsbaum, **gleiches Fenster, frischer Ursprung**, Pane sichtbar); Sichttest Desktop und Telefon (320, 375, 430) für □, △, \*: Screenshot, Breite, Kürzung; Readout bei Art Aus, Einzeln, Gekachelt ohne Namen.
- `test-crossfade-match`: bei Rot unter Last einzeln wiederholen.

## 6. Offen (nur falls du abweichst)
Zwei Entscheidungen stecken im Vorschlag: der Name steht **vor** der Zeile („△N · Feld: …“, nicht dahinter), und im Desktop kommt ein eigener Satz am Ende von `#net-field-info` (auch dort steht heute Text nur auf Englisch; der neue Satz folgt der Sprache). Wenn der Name nur im Telefon gewünscht ist, entfällt Punkt 3.
