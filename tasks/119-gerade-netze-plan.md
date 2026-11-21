# Auftrag 119 — Netze aus Geraden (Möbiusnetz 3C, Tangentennetze 4E/4C): Prüfung und Plan

**Typ U (lesen, prüfen, Plan), Prüfstufe L1.** Branch `task/119-gerade-netze-plan` von main (`f846cd5a`, Merge 118). Nichts gebaut; geschrieben nur dieser Plan, `reports/119.md`, `tools/grid/check-gerade-netze.js` (reine Rechnung, importiert nichts aus `core/`) und die ungetrackte Quellenlesung `reports/quellenlesung/` (Q1). Kein Merge, kein Push, `docs/quellen/` nicht committet.

## 0. Kurzfassung
1. **3C ist der einzige Kandidat, der in die App passt, ohne die Linienlogik zu ändern.** Das Netz ist das Bild des Quadratgitters unter **einer einzigen Homographie H**. H bildet jede Gerade auf eine Gerade ab: Netzlinien, Diagonalen, jede Linie eines Musters und jede Flächenkante bleiben exakt gerade, auch über Kachelgrenzen. Es gibt keine Knoten-Näherung, keine Teilung an Kachelgrenzen, `invert` ist eine 3×3-Inverse.
2. **Aber „sehr geringer Aufwand“ (Q1) stimmt nicht.** `core/netwarp.js` ist durchgehend *trennbar* gebaut (`fx(s)`, `fy(t)`, affin je Kachel, Spec `kind: trig|geometric`). H passt in keinen dieser Haken. Dazu kommen ein Fluchtlinien-Problem (Kacheln an der Spitze des Keils) und ein Rahmen, der ein 45°-gedrehtes Trapez im Gitter ist. Mein Urteil: **mittel bis groß**, ein Kernauftrag (Typ K) plus Folgeaufträge.
3. **4E und 4C sind keine Abbildungen der Ebene**, sondern Konstruktionen: Knoten sind Schnitte gerader Tangenten, die Barenschar hat Tangens-Abstände (das ist nicht projektiv: eine Homographie macht aus gleichen Abständen harmonische, nie tan-Abstände). Für beliebige Punkte (freie Knoten, Flächenecken) muss man eine Abbildung erfinden (bilinear je Masche). Aussagen von Q1 („geschlossene projektive Abbildung“, „triviale 1D-Randabbildung“) sind **nicht belegt**.
4. **Empfehlung:** 3C zuerst, aber erst nach Entscheidung der Fragen in §5 (Stepper-Rolle, Orientierung, Familien). 4E danach als eigener Auftrag, 4C zurückstellen. Reihenfolge und Begründung §3.

## 1. Prüfung der tragenden Aussagen

### 1.1 Gelesen
Berichte: `P4` (3C, §Variante 3C), `P1` (Einleitung, 4C, 4E, 4F), `P2` (2C), `reports/110.md`, `reports/085.md` (nur die Netzart-Zeilen), `core/netwarp.js` (Kopf, `makeNetWarp`, `_netTriangleField`, `_netHexField`, `applyNetWarp`, `invertNetWarp`, `netWarpSplitSegment`, `netWarpFieldLocal`, `netTransformExportData`, `netWarpRefineFaces`), dazu `core/faces.js:1342–1375` (`drawFaceFillsAtTile`), `core/curves.js:470–481` (Senke). Nicht gelesen: P3, P5, P6, P7, 00-uebersicht.
Seiten (Bilder, 7 von höchstens 8): **S. 47, 48, 49** (147–149.png), **S. 59** (159), **S. 72, 73** (172, 173). Nicht gesehen: S. 7/8 (Kombinationstabelle), 50–52, 60–68, 70/71, 74–77. Die Bewertungen der Familien dort stützen sich allein auf Q1.

### 1.2 Stichprobe gegen die Quelle
| Aussage (Q1) | Seite / Figur | Ergebnis |
|---|---|---|
| 3C: Perspektive eines regulären Quadratnetzes, zwei Fluchtpunkte F₁, F₂, Diagonalschar 1 über Teilpunkt T₁, Diagonalschar 2 als Baren (T₂ im Unendlichen) | S. 47, Fig. 147 | **bestätigt** (Text wörtlich) |
| „einziges Gesamtnetz aus lauter Geraden … auch das Diagonalnetz“ | S. 47 | **bestätigt** (wörtlich) |
| Bildrand = Netzmaschen **oder deren Diagonalen**, Rechteck beliebiger Proportion | S. 47 unten | **bestätigt** |
| Ganzes Format: begrenzt durch die Strahlen aus F₁, F₂ senkrecht zur Basis, W Wiederholungen; halbes: Strahl aus einem Focus und der aus T₁, W/2 | S. 47/48, Fig. 148 | **bestätigt**: F₁ und F₂ liegen über der linken und rechten Kante, T₁ über der Mitte |
| W = k/2·(b²−a²); a = Quadratmaschen am unteren (lockeren), b am oberen (engen) Rand | S. 48 II, Fig. 148 (a=1, b=4, W=7,5), Fig. 149 (a=2, b=4, W=6), Fig. 150 (a=3, b=6, W/2=6,8) | **bestätigt**; rechnerisch 7,5 / 6 / 13,5 (ganzes Netz), 6,75 (halbes, Fig. 150) |
| Bausteine: zwei Netzscharen bei W gegengleich, bei W/2 nicht; Diagonalscharen verschieden (Strahlenbüschel aus T₁ und Barenschar) | S. 48 III | **bestätigt** |
| Zehn Familien, k wie S. 17 (□N ½·, DN 1·, HDN ¼· …, W=(b²−a²)·k/2) | S. 48 bis 49 (□N, DN, HDN gesehen) | **bestätigt für □N, DN, HDN**; S. 50 bis 52 nicht gesehen |
| 4E: Scheiteltangenten oben/unten, Punkte 0..n/2 am Focus-Büschel 2E, auf der Gegenseite rückwärts, jede Tangente verbindet gleichnamige Punkte | S. 72 II, 1–3 | **bestätigt** (Text) |
| 4E: Rahmen aus den zwei Scheiteltangenten und zwei Baren; W = k·(n²/4 − a²); Teilausschnitte ½, ¼ | S. 72 IV, V | **bestätigt** |
| 4E: Diagonalscharen = Barenschar (Tangens-Abstände) + Hyperbelschar; nur ein Halbdiagonalnetz brauchbar | S. 72 III, VI | **bestätigt** (Text) |
| 4E: □N besteht aus Geraden; DN/HDN zeigen Baren (senkrecht zu den Scheiteltangenten) und gekrümmte Hyperbeln | S. 73, Fig. 214–221 | **bestätigt** im Bild |
| 4E: △N und \*N mit Barenschar rein gerade (Fig. 234, 236, 238, 240, 242) | S. 75, 76 | **nicht prüfbar** (nicht gesehen) |
| 4C: vier Rahmenseiten gesetzlich (Hauptscheiteltangente, zwei Nebenscheiteltangenten, Leitlinie); Diagonalnetz aus Strahlenbüschel 2E und Kegelschnittschar; W = k·n²/8 − k·(n/2 − S)² | S. 59 (Text; die Formel steht auf S. 63, nicht gesehen) | **bestätigt** (Rahmen, Bausteine, abgekürzte Verfahren Schritt 1–4); W-Formel **nicht prüfbar** |

### 1.3 3C: was die Rechnung (`tools/grid/check-gerade-netze.js`) zeigt
- **Knoten und Orientierung.** Q1 schreibt „reguläres Quadratgitter (u, v)“ mit x = u/v, u ∈ [−v, v]. Das ist **missverständlich**: (u, v) sind hier die **Diagonalachsen** des Quadratnetzes. Mit den Achsen p, q der Quadratmaschen gilt u = p−q, v = p+q. Die Netzscharen p = const und q = const laufen auf F₁, F₂ (x = ±1 auf dem Horizont); p−q = const läuft auf T₁ (x = 0); p+q = const sind die Baren (T₂). Das Rechteck ist das Bild des **Gitterausschnitts p, q ≥ 0, a ≤ p+q ≤ b**, eines rechtwinkligen Keilstumpfs. Seine Kanten links/rechts sind Netzlinien (p=0, q=0), oben/unten **Maschendiagonalen** (p+q = a, b). Das ist genau „Bildrand = Maschen oder deren Diagonalen“.
- **Abbildung.** H(p, q) = ( (p−q)/(p+q) , (1/a − 1/(p+q)) / (1/a − 1/b) ) mit x ∈ [−1, 1] (ganzes Format), [0, 1] (halbes). Rechnung: Geraden bleiben Geraden bis 7·10⁻¹⁷. Die Fläche des Ausschnitts ist (b²−a²)/2 Maschen, also W aus Fig. 148, 149, 161 exakt. Ein beliebiges Seitenverhältnis ist ein affines Strecken des Bildes nach H.
- **Maschen am Rand.** Links/rechts ganze Maschen, oben/unten **halbe** (Dreiecke) beim Quadrat, weil die Baren die Maschen diagonal schneiden. In einer Dreiecksgitter-App liegen die Baren p+q = const dagegen **auf Gitterlinien** (Dreieckseiten): dort sind die Ränder sauber.
- **Abweichung von Q1:** Der Abstand des Horizonts über der Oberkante ist nicht H/(b−a), sondern **a/(b−a)·H**; beide stimmen nur für a = 1 (Fig. 148). Für a = 2, b = 4 rechne ich 1,0·H, Q1 0,5·H; durch Bild nicht entschieden (nur a = 1 geprüft).
- **Homographie auch für die Diagonalscharen?** Ja, weil H jede Gerade des Gitters auf eine Gerade abbildet. Dass T₂ im Unendlichen liegt (Baren) ist das Bild der Richtung p+q = const.

### 1.4 4E und 4C: was ich nicht bestätigen kann
- **Gerade Linien, Knoten als Schnitte zweier Geradenscharen:** ja (Text S. 72, Bilder S. 73).
- **Ist das Netz ein Bild des Gitters unter einer festen Abbildung?** Nein im Sinn von 3C. Eine Barenschar mit **Tangens-Abständen** (S. 70, 72) kann kein Homographiebild äquidistanter Parallelen sein (Homographie ergibt harmonische, 1/k-Abstände). Das Netz ist eine **Konstruktion** (Knoten = Schnitte), kein Warp der Ebene.
- **Meine Gegenprobe** (Lesart: ein Tangentenbündel L(k): oben tan(kπ/n), unten s·cot(kπ/n), s = 1 affin, s ≠ 1 homolog): die Knoten bleiben auf Geraden, gleichsinnige Schnitte mit i+j = const liegen auf einem Strahlenbüschel (Streuung < 10⁻¹⁵), **aber die senkrechten Baren der Quelle (Fig. 218–221) reproduziert die Lesart nicht**. Die Beschriftung der beiden Netzscharen (gegengleich, Fig. 213/253) ist aus dem Text allein nicht rekonstruierbar. **Folge: Die Knotenformel von 4E/4C ist nicht verifiziert.** Ich schreibe sie in den Plan nicht als Formel, sondern als Aufgabe (§3, Stufe E0).
- **Fehlstelle der Quelle für die App:** Eine fertige Knotenformel ist für Punkte außerhalb des Gitters (freie Knoten, Flächenecken, Strecken zwischen Knoten verschiedener Maschen) nicht gegeben. Es braucht eine Fortsetzung, z. B. bilinear je Masche (Maschen sind Vierecke, keine Parallelogramme).

## 2. Passung zur App

### 2.1 Was `core/netwarp.js` heute kann
Ein Warp F(x, y) = (f(x), g(y)) auf **Kachelkoordinaten** (s, t) des Rahmens {c0, v1, v2}, im Feld je Kachel affin (`netFieldLaw`, `P_k`), `applyNetWarp` / `invertNetWarp` (Bisektion bzw. geschlossene Form je Kachel), `netWarpSplitSegment` knickt Linien an Kachelgrenzen, `netWarpFieldLocal` bildet einen Klick auf die Zentralkachel zurück, Dreieck- und Sechseck-Felder (`_netTriangleField`, `_netHexField`) sind dasselbe über ein anderes Gitter-Parallelogramm. Spec: `{x:{kind,w,focus}, y, domain, macro}`.
**Es fehlt für 3C:** ein nicht trennbarer Warp (H), ein Spec-Typ „projektiv“ (a, b, Format ganz/halb, Familie), ein Rahmen als Keilstumpf (kein Rechteck im Gitter), Behandlung von Punkten auf/hinter der Fluchtlinie (p+q ≤ 0).

### 2.2 Folgen je Bauteil (3C)
| Bauteil | Wirkung |
|---|---|
| Linien (Senke `drawCurvedBezier`, `core/curves.js:479–481`) | Sehne zwischen zwei abgebildeten Endpunkten = exaktes Bild der Strecke (H erhält Geraden) → **Netzlinien sind genau die Sehnen**. `netWarpSplitSegment` entfällt (liefert null). Kritisch: Strecken über die Fluchtlinie p+q = 0 (Kacheln an der Keilspitze) → Teilen oder Verwerfen an der Senke. |
| Flächenfüllung (`drawFaceFillsAtTile`, `core/faces.js:1363–1374`) | Polygone werden **je Ecke** über `applyNetWarp` gesetzt → **bleibt exakt**, ohne `netWarpRefineFaces` (nichts zu teilen, H erhält Polygonkanten). Gilt, wenn der Warp `field` trägt. Tiles ganz außerhalb: der Haken `netWarpTileOutsideCanvas` ist in `faces.js` schon vorhanden und in `netwarp.js` definiert, nur auf `refineFaces` begrenzt → **Erweiterung nur in `netwarp.js`**. |
| `invertNetWarp`, Hit-Test, `netWarpFieldLocal` | H⁻¹ geschlossen (3×3). Hit-Test und Klick auf die Zentralkachel dadurch **einfacher** als heute. Zuordnung Bildpunkt → Kachel: Floor der (p, q) (nicht der (s, t) des Feldes). |
| `netLerpSpecs`, Zeitleiste (`netAnimationCompat`) | Interpolierbar sind a, b stetig (jede reelle Matrix H ist eine Homographie), aber **nicht** gegen das reguläre Netz: das reguläre Gitter ist an den Rand ausgerichtet, das 3C-Gitter ist es um 45° gedreht. → wie „Regular ↔ Feld bei geradem Maß“: nicht interpolierbar, sichtbar ablehnen. Zwischen zwei 3C-Specs: ja. |
| Session, Export (`netTransformExportData`, `netTransformFromExport`) | neuer Typ `kind: "projective"` mit a, b, Format, Familie; `geometryIsRegular: true` bleibt wahr (Knoten und Kanten regulär, der Warp wird beschrieben); Flächen wie im Feld (regular central cell, `facesMapping` neu formulieren). `fieldBase` gilt nur für gerade Quadratachsen. Alte Leser kennen den Typ nicht → neue Feldversion oder eigener Schlüssel statt Stille. |
| Spatial Morph (`core/spatial-morph-render.js:507`, Faces unter Feld offen) | wie heute: unter einem Feld-Warp sind Morph-Flächen offen; 3C erbt das unverändert. |
| Baselines, Golden, Pins | `core/` ändert sich: die zwei protokollierten Tests (61, 57), Off-Path-Golden (ohne Warp byte-gleich) müssen weiter laufen: Aufbau so, dass **ohne Netz kein Code-Pfad sich ändert**. Layout-Baselines nur bei neuen UI-Elementen. |

### 2.3 Passung 4E / 4C
Alle Netzlinien gerade, aber Maschen sind beliebige **Vierecke**: Je Kachel affin geht nicht mehr. Nötig: bilinear je Masche (Inverse = quadratische Gleichung) und Netzlinie = Sehne zwischen Nachbarknoten nur **für Gitterlinien**; Linien quer durch die Masche (Diagonalen innerhalb der Kachel, freie Knoten) werden gekrümmt-erwartbar gesehnt, sodass „Netzlinie = Sehne“ **nicht exakt** gilt für Muster, die nicht auf Gitterlinien liegen. Flächen: je Ecke bilinear gesetzt, die Kante ist die Sehne → konsistent mit dem Zeichnen, aber nicht das Bild der regulären Fläche.

### 2.4 Zuordnung zur Form
- **□N (Quadrat):** Netz p, q auf F₁, F₂; Baren/T₁-Fächer = Zellendiagonalen (Muster-abhängig).
- **△N (Dreieck der App):** Das 60°-Gitter hat als dritte Schar p+q = const (Dreieckseite) = die **Barenvariante** (Fig. 160, 162); die T₁-Variante (Fig. 159, 161) braucht p−q, die lange Rautendiagonale, die im Dreiecksgitter keine Gitterlinie ist. → in der App nur eine der zwei Lösungen.
- **\*N (Sechseck):** feines Rhombengitter; ob 3C-Rand und Auslassungen („Fig. 165–167: zweite Lösung hat keine einfache Abgrenzung“) in der App sauber aufgehen, ist **nicht geprüft**.
- **„Netztyp muss zur Form passen“ (Quelle):** weiter gültig: die Form gibt die Familie vor (110 §1). 3C ändert das nicht, fügt aber eine Achse „Netzart“ hinzu (§4).
- **Maß und Optimum:** W = k/2·(b²−a²) (S. 48); Optimum 7–12 Quadrate, 8–16 Dreiecke, 6–10 Sechsecke (S. 17); a=2, b=4 → 6 (Quadrat, an der unteren Grenze), a=3, b=5 → 8, a=3, b=6 → 13,5 (□N, über dem Optimum). Streckung ≤ 1:2 (S. 17) im Bild nach H prüfen.

## 3. Stufenplan
Aufwand: S ≤ ½ Tag Agent, M, L. Risiko für Baselines/Golden/Pins/Export/Flächen/Morph/Zeitleiste/Session je kurz.

### Stufe 3C-0 — Messauftrag (Typ R, L1)
Prototyp H in `tools/grid/` (kein `core/`): Bildmaße, Knotenabstände, Randmaschen für □, △ (Barenvariante), Familien □N, DN, □MN, △N; Gegenprobe der 10 W-Werte S. 48–52 (a, b, Format); Abbild eines Kachelmusters (Linien + Flächen) und Fluchtlinien-Kacheln. **Aufwand S, Risiko nil.** Ergibt die Zahlen für §5.

### Stufe 3C-1 — Kern: projektiver Warp für das Quadrat (Typ K, L2)
`makeNetWarp`-Zweig `projective` (Spec, `applyNetWarp`/`invertNetWarp`/`netWarpFieldLocal`, Senke an der Fluchtlinie, `netWarpTileOutsideCanvas` erweitert), Export/Session-Typ. Geschützt: `core/tiling.js`, `core/faces.js`, `core/facecolor.js`, `core/spatial-morph-render.js` (alles bleibt). Schreiben: `core/netwarp.js`, `core/curves.js` (Senke), `core/export.js`/`session` nur für den Typ. **Aufwand M–L. Risiko mittel** (Export/Session/Zeitleiste, Fluchtlinie; Baselines ohne Netz unverändert). Abhängig von 3C-0 und §5.1–5.3. Freigabe: Eingriff `curves.js`, Export-Format, ggf. die Tile-Schleife (`tiling.js`), falls die Kacheln der Keilspitze dort ausgeschlossen werden müssen (Plan: ohne `tiling.js`, durch Verwerfen am Senke/Haken).

### Stufe 3C-2 — Dreieck und Sechseck (Typ K, L2), nach 3C-1
Rahmen {c0, v1, v2} aus `_netTriangleField` / `_netHexField` unter H. Dreieck eine Variante (Baren). **Aufwand M. Risiko mittel** (Dreieckfläche, Sechseck-Hook `refineFaces` muss mit H zusammen laufen: für H nicht nötig, kollidiert nicht).

### Stufe 3C-3 — UI: Stepper „Netzart“ (Typ K + UI-Freigabe, L3)
Siehe §4. **Aufwand M, Risiko mittel–hoch** (Layout-Baselines, Texte DE/EN, `docs/terminology.md`).

### Stufe E0 — 4E: Knotenformel und Abbildung klären (Typ R)
Fig. 213 (S. 71) und S. 74–76 lesen, die Beschriftung der Scharen rekonstruieren, Knotenformel an Fig. 214–217 prüfen (Zahl der Linien, Maschenbreiten), Fortsetzung bilinear gegen die Figur. **Aufwand S–M.**

### Stufe 4E-1 — Netz aus Tangentenscharen (Typ K, L2)
Warp je Masche bilinear (mit Tangens-Baren als Rahmen S. 72). Nur □N und die geradlinigen Familien (□MN, △N, \*N mit Barenschar). **Aufwand L, Risiko hoch**: keine Sehnen-Identität für Muster quer durch Maschen, Flächen (je Ecke bilinear, eigene Prüfung), Inverse quadratisch. Abhängig von E0 und 3C-1 (gemeinsamer Warp-Typ „nicht trennbar“).

### Stufe 4C — homolog (Typ K, L2): zurückstellen
Wie 4E, aber mit Leitlinie und Nebenscheitel S; Formel nicht gesehen; Q1-Einordnung „Klasse B“ nicht belegt. **Aufwand L.**

### Reihenfolge und Begründung
1. **3C-0**, dann **3C-1** (Quadrat), **3C-2**, **3C-3**.
2. **E0**, dann **4E-1**; 4C zurückstellen.
Gründe: Nur 3C hat eine geschlossene, durch H exakt beschriebene Abbildung, behält alle Geraden und Flächenkanten, beantwortet „beliebiges Rechteck“ ohne Angriff auf `faces.js`/`tiling.js`. 4E braucht erst E0 (die Formel ist nicht bestätigt) und einen neuen Warp-Typ ohne Sehnen-Identität. **Lohnt sich 3C zuerst: ja. „Sehr geringer Aufwand“ (Q1): nein; mittel bis groß**, weil `netwarp.js` überall von Trennbarkeit und Kachel-Affinität ausgeht.

## 4. Bedienung (Skizze, nur Vorschlag, vorher abstimmen)
Stepper statt „Aus/Off“ im Blatt Netz: **— / 1.1 / 1.2 / 2.2 / …** (Netzart in Gerstner-Schreibweise: 1.1 = Netzart 1, 1.2 = 2, 2.2 = 3 [mit 3C], 1.3 = 5, 1.4 = 6, 2.3 = 7, 2.4 = 8, 3.3 = 9, 4.4 = 10; Netzart 4 = Tangentenschar, Bericht 085, und keine Zahl auf S. 54–83). Anfangs **aktiv: —, 1.1** (Bestand: Gesetz Sinus/Tangens/Geo) und **2.2** erst nach 3C-3; alle anderen grau mit Hinweis „folgt“. Gesetz (Sinus, Tangens, Geo) gilt nur bei 1.1; bei 2.2 treten **a, b** und Format (ganz/halb) an seine Stelle; Tangens-Gesetz von 4E später als eigener Wert. Familie kommt von der Form (Quadrat □N, Dreieck △N, Sechseck \*N, 110 §5) und erscheint nur im Readout. Netzart 4 (4E, 4C) als Eintrag mit Untermenü E/C erst nach 4E-1.

## 5. Offene Fragen an den Nutzer
1. **Orientierung des Quadratnetzes bei 3C.** (a) 45° gedreht wie die Quelle (Rand liegt auf Maschendiagonalen, halbe Maschen oben/unten) *(empfohlen: nur so ist es das Möbiusnetz)*; (b) Gitter achsenparallel, Baren statt Diagonalen als Linien (anderes Netz, nicht 3C).
2. **Wählbare Parameter.** (a) a, b ganze Zahlen plus Format ganz/halb, W wird angezeigt *(empfohlen, wie die Quelle)*; (b) nur ein „Perspektivstärke“-Regler.
3. **Familien beim Dreieck.** (a) nur die Barenvariante (Fig. 160, 162), weil das 60°-Gitter nur sie enthält *(empfohlen)*; (b) auf Quelle bestehen und das Gitter ändern: nicht empfohlen.
4. **Zeitleiste.** (a) 3C nur zwischen zwei 3C-Netzen interpolierbar, sonst sichtbar abgelehnt *(empfohlen)*; (b) Übergang vom regulären Netz mit Drehung erfinden.
5. **Stepper und Gesetz.** (a) Stepper ersetzt das Aus/An, Gesetz nur bei 1.1 *(empfohlen)*; (b) beide Achsen getrennt.
6. **4E vor oder nach dem Stepper?** (a) 3C-1 bis 3C-3, dann E0 *(empfohlen)*; (b) E0 vorziehen, falls Tangentennetze wichtiger sind.

## Nicht geprüft
Seiten 50–52, 60–68, 70–71, 74–77, 7/8 nicht gesehen; Figuren 154–169, 183–211, 234–252 nur nach Q1. Berichte P3, P5, P6, P7, 00 nicht gelesen. Rechnung nur numerisch (Node, kein Browser, keine Messung am App-Code); 4E/4C-Knotenformel **nicht** reproduziert; Horizontabstand für a ≠ 1 nicht am Bild entschieden.
