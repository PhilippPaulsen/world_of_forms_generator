# P3 — Netzart 5, 6 und 7: Gerade + Kreis (S. 84–96)

Die Netzarten 5, 6 und 7 gehören in der Kombinationstabelle (S. 7–8) zur Gruppe **`GERADE + KREIS`** (bzw. `GERADE UND KREIS`):
- **Netzart 5** (`(1) Barenschar + (3) Kreisbüschel`, Matrixzelle `1.3`, S. 84–87): Variante **5A** mit Hauptpunkt (Polygon-/Quadratrahmen aus Komplexen) und Variante **5B** mit halbkreisförmigem Rahmen (`W = k * n^2 / 32`).
- **Netzart 6** (`(1) Barenschar + (4) Kreisschar`, Matrixzelle `1.4`, S. 88–93): Kreisrunder oder halbkreisförmiger Rahmen (`W = 2 k * r^2`), 12 Variationen (Sinus `>` / Tangens `<`, zentrisch / exzentrisch, Barenschar oder tangierendes Strahlenbüschel `2r`).
- **Netzart 7** (`(2) Strahlenbüschel + (3) Kreisbüschel`, Matrixzelle `2.3`, S. 94–96): Variante **7A** mit gemeinsamem Focus (zentrisch oder exzentrisch) und Variante **7B** mit zwei verschiedenen Foca (Kreisrahmen).
Da in allen drei Netzarten bereits eine der beiden primären Netzscharen aus Kreisen besteht und als Rahmen Halbkreise, Vollkreise oder Polygone dienen, fallen sämtliche Varianten unter **Klasse C** und **Klasse D** (für die aktuelle App-Architektur aus geraden Sehnen im Rechteck ohne gekrümmte Linien und ohne neuen Rahmen nicht direkt nutzbar).

---

## Netzart 5: Barenschar + Kreisbüschel (S. 84–87)

### 1. Definition
- **Grundscharen**: „Eine Barenschar sei kombiniert mit einem Kreisbüschel.“ (S. 84).
- **Matrixzelle**: `1.3` (`(1) Barenschar + (3) Kreisbüschel`, S. 7).
- **Zwei Gestaltungsarten (S. 7, S. 84)**:
  - **5A**: `Gestaltung mit Hauptpunkt` (S. 84, Hinweise auf S. 7: `2B, 8B`).
  - **5B**: `Gestaltung mit halbkreisförmigem Rahmen` (S. 84–87, Hinweis auf S. 7: `9A_4`).
- **Bausteine für 5B (S. 84)**:
  1. „Die beiden Netzscharen sind verschieden voneinander: ein Kreisbüschel und eine Barenschar.“
  2. „Die zwei Diagonalscharen sind verschieden voneinander: ein Spiralenbüschel und eine Schar krummer Strahlen.“ (Laut Text S. 84 oben: „Das Diagonalnetz besteht aus einem Büschel schwach gekrümmter Strahlen und einem Spiralenbüschel. Beide laufen im Focus zusammen.“).
  3. „Von den beiden Halbdiagonalnetzen taugt in Kombinationen meistens nur eines.“

### 2. Konstruktion
- **Variante 5A: Gestaltung mit Hauptpunkt (S. 84, Fig. 276, 277)**:
  - Schließt sich eng an Netzart 2B an und wird analog behandelt: Fig. 70 und 71 (aus Netzart 2B) werden umgearbeitet, indem die Strahlen durch Kreisbögen eines Kreisbüschels ersetzt werden („wobei wir die ‚Barenschar‘ recht frei behandeln müssen und damit auch in die Nähe von Netzart acht geraten. Beide der folgenden Figuren sind aus Komplexen zusammengesetzt.“).
  - Bestimmungsstücke: `D` (Zahl der Komplexe um den Hauptpunkt), `E` (Winkelanteil des Kreisbüschels je Komplex), `r` (Zahl der Ringe/Abstände der Barenschar).
- **Variante 5B: Gestaltung mit halbkreisförmigem Rahmen (S. 84–87, Fig. 278–294)**:
  - „Die wahrscheinlich beste Lösung erhalten wir, wenn wir den Bildrahmen halbkreisförmig machen und den Focus des Kreisbüschels in eine Ecke setzen. Da wo die Kreise den Halbmesser berühren, errichten wir unsere Baren senkrecht zu ihm, siehe Fig. 278.“ (S. 84).
  - Einteilungsfaktor des Kreisbüschels: `E = n/n` (in den Beispielen `12/12, 16/16, 20/20, 24/24, 28/28, 40/40`).

### 3. Linienart
- **Netzscharen**: Eine gerade Schar (Barenschar) + eine gekrümmte Schar (Kreisbüschel).
- **Diagonalscharen (5B)**: Beide gekrümmt (Spiralenbüschel + Schar krummer Strahlen).
- Es gibt in Netzart 5 **keine einzige Familie, die nur aus geraden Linien besteht**.

### 4. Rahmen
- **5A**: Reguläres Sechseck (Fig. 276, `D = 6`, einbeschrieben in Konstruktionskreis) bzw. Quadrat (Fig. 277, `D = 4`, einbeschrieben in Konstruktionskreis).
- **5B**: **Halbkreisförmiger Rahmen** (Basis = Durchmesser mit dem Focus in der rechten unteren Ecke, Bogen = oberster Halbkreis des Kreisbüschels).

### 5. Maschenzahl W und Optimum (S. 84–87)
- **Variante 5A**:
  - **Fig. 276** (S. 84): `□N`, `D = 6`, `E = 2/12`, `r = 2`, `W = 24`.
  - **Fig. 277** (S. 84): `□N`, `D = 4`, `E = 2/8`, `r = 2`, `W = 16`.
- **Variante 5B — Allgemeine Wiederholungsformel (S. 84)**:
  - `W = k * n^2 / 32`
- **Die zehn Familien von 5B mit ihren Formeln und Beispielen (S. 85–87)**:
  1. **Die Quadratnetze, `(NS + NS)`** (S. 85): `W = n^2 / 32` (`k = 1`)
     - Fig. 278 (S. 85): `□N`, `E = 20/20`, `W = 12,5`.
  2. **Die Diagonalnetze, `(DS + DS)`** (S. 85): `W = n^2 / 16` (`k = 2`)
     - Fig. 279 (S. 85): `DN`, `E = 12/12`, `W = 9`. (`Oder: HDN, E = 24/24.`)
     - Fig. 280 (S. 85): `DN`, `E = 12/12`, `W = 9`. (`Oder: HDN, E = 24/24.`)
  3. **Die Halbdiagonalnetze** (S. 85): `W = n^2 / 64` (`k = 1/2`)
     - Siehe Fig. 279 und Fig. 280 (`HDN, E = 24/24`, `W = 9`).
  4. **Die Quadratmischnetze, `(NS + DS)`** (S. 85): `W = n^2 / 32` (`k = 1`)
     - Fig. 281–284 (S. 85): jeweils `□MN`, `E = 16/16`, `W = 8`. (Fig. 281 und 283 kombinieren das Kreisbüschel mit je einer Diagonalschar; Fig. 282 und 284 kombinieren die senkrechte Barenschar mit je einer Diagonalschar).
  5. **Die Totalnetze, `(□N + DN)`** (S. 86): `W = n^2 / 8` (`k = 4`)
     - Fig. 285 (S. 86): `TN`, `E = 12/12`, `W = 18`.
  6. **Die Dreieckgruppennetze, `(□N + HDN)`** (S. 86): `W = n^2 / 16` (`k = 2`)
     - Fig. 286 (S. 86): `△GN`, `E = 16/16`, `W = 16`.
  7. **Die Dreiecknetze, `(□N + DS)`** (S. 86): `W = n^2 / 16` (`k = 2`)
     - Fig. 287 (S. 86): `△N`, `E = 16/16`, `W = 16`.
     - Fig. 288 (S. 86): `△N`, `E = 16/16`, `W = 16`.
  8. **Die Sechsecknetze, `(□N + DS)`** (S. 86): `W = n^2 / 96` (`k = 1/3`)
     - Fig. 289 (S. 86): `*N`, `E = 28/28`, `W = 8,2`.
     - Fig. 290 (S. 86): `*N`, `E = 28/28`, `W = 8,2`.
  9. **Die Dreieckmischnetze, `(NS + HDN)`** (S. 86): `W = n^2 / 32` (`k = 1`)
     - Fig. 291 (S. 86): `△MN`, `E = 20/20`, `W = 12,5`.
     - Fig. 292 (S. 86): `△MN`, `E = 20/20`, `W = 12,5`.
  10. **Die Sechseckmischnetze, `(NS + HDN)`** (S. 87): `W = n^2 / 192` (`k = 1/6`)
      - Fig. 293 (S. 87): `*MN`, `E = 40/40`, `W = 8,3`.
      - Fig. 294 (S. 87): `*MN`, `E = 40/40`, `W = 8,3`.

### 6. Varianten und Besonderheiten
- In 5B laufen alle Kreise des Kreisbüschels und beide Diagonalscharen im rechten unteren Eckpunkt (Focus) des Halbkreises zusammen.
- Die Baren stehen senkrecht auf dem Basis-Durchmesser an den Scheitel-/Berührungspunkten der Kreise (entspricht einer Sinus-Stufung vom Focus aus).

### 7. Beziehung zu Netzart 1 und anderen Netzarten
- **5A**: Eng verwandt mit Netzart 2B und Netzart 8 (S. 84).
- **5B**: Laut Tabelle S. 7 verwandt mit `9A_4` (und über die Halbkreis-Geometrie das krummlinige Gegenstück zu 2C).

### 8. Einordnung für die App (Einschätzung)
- **Einschätzung**: **Klasse C** (und für 5B bzw. Fig. 276 auch **Klasse D**), da bereits die Grundscharen und alle Diagonalscharen Kreisbögen bzw. Spiralen sind und 5B zwingend einen halbkreisförmigen Rahmen nutzt.

---

## Netzart 6: Barenschar + Kreisschar (S. 88–93)

### 1. Definition
- **Grundprinzip (S. 88, Abschnitt I)**: „Wir zeichnen eine gesetzlich geordnete Kreisschar und eine Barenschar, welche die Kreise berührt.“
- **Matrixzelle**: `1.4` (`(1) Barenschar + (4) Kreisschar`, S. 8).
- **Bausteine (S. 90, Abschnitt V — wichtige topologische Präzisierung durch Hinterreiter!)**:
  1. „Die beiden Netzscharen bestehen nicht, wie man zunächst meinen sollte, aus einer Kreis- und einer Barenschar. Man wird sich bei Kombinationsversuchen rasch davon überzeugen. Die Analogie zu den andern Netzarten ergibt sich nur, wenn wir annehmen, unsere Netzschar bestehe aus einer Schar Halbkreise, die vom tauglichen Teil der Baren fortgesetzt wird, siehe Fig. 302. Die zwei Netzscharen sind also bei kreisrundem Rahmen gegengleich symetrisch;“
  2. „die zwei Diagonalscharen im gleichen Falle ebenso. Beide Scharenarten haben merkwürdigerweise eine im Hauptpunkt endigende Gerade.“ (Laut S. 88 unten: „Das Diagonalnetz besteht aus Ovalen oder spindelförmigen Kurven.“).
  3. „Die beiden Halbdiagonalnetze.“

### 2. Konstruktion
- **Quadratnetzkonstruktion (S. 88)**:
  - Die Abstände seien nach der Sinus- (`>`, Fig. 295) und Tangensfunktion (`<`, Fig. 296) gestuft.
  - Kreis- und Barenschar haben ein und dasselbe **Bestimmungsstück `r`**, das die Zahl der Kreiszwischenräume angibt und gleich `2, 3, 4, 5 oder 6` sein kann.
  - Jede Masche des entstehenden Netzes muss als Viereck gedeutet werden, auch wenn sie zunächst nicht danach aussieht. Die Berührungsstellen der Kreise mit den Baren sind Eckpunkte:
    - Im einfachsten (zentrischen) Fall liegen sie auf einem Rahmendurchmesser (senkrecht zu den Baren durch `H`, siehe gestrichelte Linie in Fig. 295/296).
    - Bei den exzentrischen Variationen findet man sie durch Fällen der Lote aus den Kreismittelpunkten auf die entsprechenden Tangenten; auch dann liegen sie gesetzlich auf Geraden oder Kreisen.
  - „Beim Hauptpunkt `H` treffen auffallenderweise nur zwei statt der üblichen vier Netzmaschen zusammen, weshalb wir `d = 2)4` schreiben.“ (S. 88; auf S. 91 oben wird ergänzt: „Beim Hauptpunkt stossen entweder nur zwei volle Maschen zusammen, `d = 2)4`, siehe Fig. 303 bis 306; oder dann ist die den Punkt einschliessende Masche ein ‚Zweieck‘, `d = (2)4`, (Fig. 304 und 308).“).
- **Teilausschnitte und 12 Variationen (S. 88–89, Abschnitte III und IV)**:
  - Da die Wiederholungen bei kreisförmigem Rahmen rasch zu viele sind, braucht man oft **halbkreisförmige Teilausschnitte** mit `W/2` Wiederholungen, deren Basis mit der Barenschar (Fig. 297) oder senkrecht zu ihr läuft (Fig. 298).
  - Neben `>` (Sinus) und `<` (Tangens) sowie Vollkreis und Halbkreis gibt es folgende kombinierbare Variationen (insgesamt **12 Variationen**, die sich nur durch Proportion, nicht aber mathetisch unterscheiden und dieselbe Wiederholungszahl haben, S. 89):
    1. Die Kreisschar kann **zentrisch** (`Exz. = 0`) oder **exzentrisch** (z. B. `Exz. = 1/2`, Fig. 297, 298) sein; im letzteren Fall gibt es zwei verschiedene Arten der Ausführung (Barenschar bar zur Symmetrieachse wie Fig. 297, oder Barenschar senkrecht zur Symmetrieachse wie Fig. 298).
    2. **Ersetzt man die Barenschar durch ein tangierendes Strahlenbüschel `2r`**, dessen Focus einen wohlproportionierten Abstand von der Bildmitte hat, so gibt es bei der zentrischen Kreisschar eine (Fig. 299), bei der exzentrischen aber zwei brauchbare Lösungen (Fig. 300 und 301).

### 3. Linienart
- **Netzscharen**: Jede Netzschar ist aus einem Halbkreis und den anschließenden Tangenten-Halbgeraden (Baren bzw. Strahlen des tangierenden Strahlenbüschels) zusammengesetzt (Fig. 302 zeigt eine einzelne Netzschar `NS>, r = 3`: hufeisenförmig aus Halbkreis links + waagerechten Baren nach rechts!).
- **Diagonalscharen**: Ovale oder spindelförmige Kurven + eine im Hauptpunkt `H` endigende Gerade.
- Alle Familien enthalten gekrümmte Linien (Kreise und/oder Ovale/Spindeln).

### 4. Rahmen
- **Kreisförmig** (Vollkreis mit `W`) oder **halbkreisförmig** (Halbkreis mit `W/2`).

### 5. Maschenzahl W und Optimum (S. 88–93)
- **Allgemeine Wiederholungsformel bei kreisförmigem Rahmen (S. 88, Abschnitt II)**:
  - `W = 2 k * r^2` (bei halbkreisförmigem Rahmen `W/2 = k * r^2`).
- **Die zehn Netzfamilien mit ihren Formeln und Beispielen (S. 88–93)**:
  1. **Die Quadratnetze, `(NS + NS)`** (S. 88–90): `W = 2 * r^2` (`k = 1`)
     - Fig. 295 (S. 88): `□N>`, `r = 3`, `W = 18` (links, Sinus, zentrisch).
     - Fig. 296 (S. 88): `□N<`, `r = 3`, `W = 18` (rechts, Tangens, zentrisch).
     - Fig. 297 (S. 89): `□N<`, `r = 3`, `W/2 = 9`, `Barenschar bar zur Symetrieaxe`, `Exzentrizität = 1/2`.
     - Fig. 298 (S. 89): `□N<`, `r = 3`, `W/2 = 9`, `Barenschar senkrecht zur Symetrieaxe`, `Exzentrizität = 1/2`.
     - Fig. 299 (S. 89): `□N>`, `Exz. = 0`, `r = 3`, `W/2 = 9`, `Mit Strahlenbüschel 2r`.
     - Fig. 300 (S. 89): `□N>`, `Exz. = 1/2`, `r = 3`, `W/2 = 9`, `Mit Strahlenbüschel 2r`.
     - Fig. 301 (S. 89): `□N>`, `r = 3`, `W/2 = 9` (Hinweis: es ist ein Vollkreis abgebildet, also eigentlich `W = 18`, Beschriftung lautet `W/2 = 9, Exz. = 1/2`).
     - Fig. 302 (S. 89): `NS>`, `r = 3` (Darstellung einer einzelnen Netzschar).
  2. **Die Diagonalnetze, `(DS + DS)`** (S. 90): `W = 4 * r^2` (`k = 2`)
     - Fig. 303 (S. 90): `DN>`, `r = 2`, `W/2 = 8`. (`Oder: HDN>, r = 4, Basis parallel zur Barenschar.`)
     - Fig. 304 (S. 90): `DN<`, (`Oder: HDN<`, `r = 2, W/2 = 8` bzw. `r = 4`).
     - Fig. 305 (S. 90): `Idem, Basis senkrecht zur Barenschar` (`>`).
     - Fig. 306 (S. 90): `Idem` (`<`, Basis senkrecht zur Barenschar).
  3. **Die Halbdiagonalnetze** (S. 90): `W = r^2` (`k = 1/2`)
     - Fig. 307 (S. 90): `HDN>`, `r = 4`, `W/2 = 8`, `Basis parallel zur Barenschar`.
     - Fig. 308 (S. 90): `HDN<`, (`r = 4, W/2 = 8, Basis parallel zur Barenschar`).
  4. **Die Quadratmischnetze, `(NS + DS)`** (S. 91): `W = 2 r^2` (`k = 1`)
     - „Beim Hauptpunkt entsteht eine eingeknickte Quadratmasche.“
     - Fig. 309 (S. 91): `□MN, >`, `r = 2`, `W = 8`, `zentrisch, mit Barenschar`.
     - Fig. 310 (S. 91): `□MN <`, (`r = 2, W = 8, zentrisch, mit Barenschar`).
  5. **Die Totalnetze, `(□N + DS)`** (S. 91; Hinweis: im Druck steht `(□N + DS)` statt `(□N + DN)`, Formel hat aber `k = 4`): `W = 8 r^2` (`k = 4`)
     - Fig. 311 (S. 91): `△TN >`, `r = 2`, `W/2 = 16`, `Basis senkrecht zur Barenschar`.
     - Fig. 312 (S. 91): `△TN <`, (`r = 2, W/2 = 16, Basis senkrecht zur Barenschar`).
  6. **Die Dreieckgruppennetze, `(□N + HDN)`** (S. 91): `W = 4 r^2` (`k = 2`)
     - Fig. 313 (S. 91): `△GN >`, `r = 2`, `W = 16`, `zentrisch, mit Strahlenbüschel`.
     - Fig. 314 (S. 91): `△GN <`, (`r = 2, W = 16, zentrisch, mit Strahlenbüschel`).
  7. **Die Dreiecknetze, `(□N + DS)`** (S. 92): `W = 4 r^2` (`k = 2`)
     - Fig. 315 (S. 92): `△N >`, `r = 2`, `W = 16`, `zentrisch, mit Strahlenbüschel`.
     - Fig. 316 (S. 92): `△N <`, (`r = 2, W = 16, zentrisch, mit Strahlenbüschel`).
  8. **Die Sechsecknetze, `(□N + DS)`** (S. 92): `W = 2 * r^2 / 3` (`k = 1/3`)
     - Fig. 317 (S. 92): `*N >`, `r = 3`, `W = 6`, `exzentrisch, mit Strahlenbüschel`.
     - Fig. 318 (S. 92): `*N <`, (`r = 3, W = 6, exzentrisch, mit Strahlenbüschel`).
  9. **Die Dreieckmischnetze, `(NS + HDN)`** (S. 92): `W = 2 r^2` (`k = 1`)
     - Fig. 319 (S. 92): `△MN >`, `r = 2`, `W = 8`, `zentrisch, mit Strahlenbüschel`.
     - Fig. 320 (S. 92): `△MN <`, (`r = 2, W = 8, zentrisch, mit Strahlenbüschel`).
  10. **Die Sechseckmischnetze, `(NS + HDN)`** (S. 93): `W = r^2 / 3` (`k = 1/6`)
      - Fig. 321 (S. 93): `*MN >`, `r = 6`, `W/2 = 6`, `zentrisch; Basis parallel zur Barenschar`.
      - Fig. 322 (S. 93): `*MN <`, (`r = 6, W/2 = 6, zentrisch; Basis parallel zur Barenschar`).
      - Fig. 323 (S. 93): `*MN >`, `r = 6`, `W/2 = 6`, `zentrisch; Basis senkrecht zur Barenschar`.
      - Fig. 324 (S. 93): `*MN <`, (`r = 6, W/2 = 6, zentrisch; Basis senkrecht zur Barenschar`).

### 6. Varianten und Besonderheiten
- Singularität am Hauptpunkt `H`: Dort treffen nur 2 statt 4 Netzmaschen zusammen (`d = 2)4`), bzw. ein „Zweieck“ `d = (2)4` (S. 88, 91), bei `□MN` eine „eingeknickte Quadratmasche“ (S. 91) und bei `*MN` „Statt eines Sechsecks entsteht beim Hauptpunkt ein Dreieck. Sollte es schwierig sein, es organisch mit einem bestimmten Thema zu füllen, so wähle man einen Halbkreisausschnitt, wodurch man dem nicht stets lösbaren Problem ausweicht.“ (S. 93).
- Topologische Aufteilung der Scharen in Halbkreis + Tangenten-Fortsetzung (`Fig. 302`).

### 7. Beziehung zu Netzart 1 und anderen Netzarten
- Laut Tabelle S. 8 Hinweis auf **Netzart 10** (`Kreisschar + Kreisschar`, bei der die Barenschar ebenfalls zu einer zweiten Kreisschar gekrümmt wird).

### 8. Einordnung für die App (Einschätzung)
- **Einschätzung**: **Klasse C** und **Klasse D**, da sowohl der Rahmen (Kreis oder Halbkreis) als auch die Scharen (Halbkreise + Tangenten bzw. Ovale/Spindeln) gekrümmt sind.

---

## Netzart 7: Strahlenbüschel + Kreisbüschel (S. 94–96)

### 1. Definition
- **Grundscharen (S. 94)**: „Das Quadratnetz besteht aus einem Strahlenbüschel, das mit einem Kreisbüschel kombiniert ist. Beide Scharen müssen dasselbe Bestimmungsstück `E = n/n` haben. Die Foca können zusammenfallen oder verschieden sein.“
- **Matrixzelle**: `2.3` (`(2) Strahlenbüschel + (3) Kreisbüschel`, S. 8).
- **Zwei Varianten**:
  - **7A**: `Gemeinsamer Focus` (S. 94–95, Hinweis auf S. 8: `9A_4`), unterteilt in `1) Bei zentrischer Focuslage` (Fig. 325) und `2) Bei exzentrischer Focuslage` (Fig. 326).
  - **7B**: `Zwei verschiedene Foca` (S. 94, 96, Fig. 327, Hinweise auf S. 8: `3A, 9B`).

### 2. Konstruktion
- **Variante 7A: Gemeinsamer Focus (S. 94–95)**:
  - **1) Bei zentrischer Focuslage (Fig. 325, `E = 16/16`)**:
    - Die Kreise des Büschels sind gleich groß; ihre Mittelpunkte `M_1, M_2, M_3..., M_n` werden vom Strahlenbüschel auf einem `Leitkreis` angeschnitten (Fig. 325).
    - Der Rahmen bleibt kreisförmig und die Maschenbildung klar, auch wenn man das Kreisbüschel ausschwingen lässt. Es gibt halbkreisförmige Teilausschnitte verschiedener Art und Größe.
    - **Diagonalnetz**: Besteht aus einer konzentrischen Kreisschar mit `r = n/4` und aus einer steilen Spiralenschar mit `2E`.
  - **2) Bei exzentrischer Focuslage (Fig. 326, `E = 16/16`)**:
    - Die Kreise des Büschels sind verschieden groß; ihre Mittelpunkte `M_1, M_2, M_3..., M_n` werden vom Strahlenbüschel auf einem `Leitkreis` angeschnitten, zu welchem der Focus dieselbe Exzentrizität besitzt wie zum Bildrahmen (S. 94 — im Text steht als Druckfehler `Fig. 226`, gemeint ist `Fig. 326` auf S. 95!).
    - Das Kreisbüschel darf nicht ausschwingen, weil gegen außen die Maschen unklar werden und der Bildrahmen bohnenförmig.
    - **Diagonalnetz**: Besteht aus einer exzentrischen Kreisschar `>`; ihre Mittelpunkte `m_1, m_2, m_3..., m_x` werden vom Strahlenbüschel auf einem `Hilfskreis` bestimmt, der durch den Focus geht und gemeinsamen Mittelpunkt mit dem Leitkreis hat. Ein kleiner Kreis dieser Schar eignet sich vortrefflich als Bildrahmen. Die zweite Diagonalschar ist wiederum eine steile Spiralenschar.
- **Variante 7B: Zwei verschiedene Foca (S. 94, 96, Fig. 327 mit `E = 16/16`)**:
  - Man zeichnet die beiden Büschel auf zwei verschiedene Pauspapiere, die man aufeinanderlegt und nach Bedarf gegenseitig verschiebt. Nahe Focuslagen sind ergiebiger.
  - „Wenn je ein Strahl des einen Büschels durch den Focus des andern geht, sind Gesetzmässigkeit und Schönheit grösser. Und ebenso, wenn die Bestimmungsstücke für beide Büschel dieselben sind.“ (S. 94).
  - Entsprechend den beiden grau gezeichneten Vorschlägen in Fig. 327 können **ovale Teilausschnitte** als Bilder herausgelesen werden, wenn wir geschickt ihre Rahmenteilung `= n/2` machen.
  - **Diagonalnetz**: Besteht aus Kurven, die innerhalb gewisser Grenzen stetig verlaufen und somit brauchbar sind.

### 3. Linienart
- **Netzscharen**: Ein gerades Strahlenbüschel + ein gekrümmtes Kreisbüschel.
- **Diagonalscharen**:
  - In **7A**: Konzentrische bzw. exzentrische Kreisschar + steile Spiralenschar.
  - In **7B**: Gekrümmte Kurven höherer Ordnung.
- Keine Familie besteht nur aus geraden Linien.

### 4. Rahmen
- **7A**: **Kreisförmig** oder **halbkreisförmige Teilausschnitte** (bei zu starkem Ausschwingen im exzentrischen Fall bohnenförmig).
- **7B**: **Kreisförmig** oder **ovale Teilausschnitte** (in Fig. 327 grau eingezeichnet).

### 5. Maschenzahl W und Optimum
- Keine eigene Formel auf S. 94–96 angegeben, da S. 94 für 7A auf Netzart 8 und für 7B auf Netzart 3A und 9B verweist (in Fig. 325–327 ist jeweils `E = 16/16` dargestellt):
  - **Fig. 325** (S. 95): `Quadratnetz 7A, zentrischer Focus, E = 16/16`. (Mit `Leitkreis` und Mittelpunkten `M_1` bis `M_{16}`).
  - **Fig. 326** (S. 95): `Quadratnetz 7A. Exzentrischer Focus, E = 16/16`. (Mit `Leitkreis`, `M_1` bis `M_{16}`, `Hilfskreis`, `M` und `m_1` bis `m_5`).
  - **Fig. 327** (S. 96): `Quadratnetz sieben B), E = 16/16`.

### 6. Varianten und Besonderheiten
- **7B als Symmetriebrecher für 3A (S. 94)**: „Wir haben somit ein glänzendes Mittel zur Hand, alle symetrischen Netze der Netzart drei A unsymetrisch zu machen, unter Beibehalten aller mathetischen Verhältnisse.“ (Indem eines der beiden Strahlenbüschel von Netzart 3A zu einem Kreisbüschel gebogen wird!).

### 7. Beziehung zu Netzart 1 und anderen Netzarten
- **7A zu Netzart 8 (S. 94)**: „Wir können durchwegs auf Netzart acht verweisen, wo uns dieselben mathetischen Verhältnisse in reicherer Fülle wieder begegnen werden. Wir wollen sie dort systematisch bearbeiten. Es genügt, dort gut zu Hause zu sein; Netzart sieben A ist lediglich eine Variationsmöglichkeit mehr.“
- **7B zu Netzart 3A und 9B (S. 94)**: „Wir treffen auf ähnliche Verhältnisse wie bei Netzart drei A und neun B.“

### 8. Einordnung für die App (Einschätzung)
- **Einschätzung**: **Klasse C** und **Klasse D**, da das Kreisbüschel und alle Diagonalscharen (Kreise, Spiralen) gekrümmt sind und der Rahmen kreis-, halbkreis- oder ovalförmig ist.

---

## 9. Gelesene Seiten, Lücken und offene Fragen (Paket P3)

- **Gelesene Seiten**:
  - S. 84 (`184.png`) bis S. 96 (`196.png`) vollständig: `184.png`, `185.png`, `186.png`, `187.png`, `188.png`, `189.png`, `190.png`, `191.png`, `192.png`, `193.png`, `194.png`, `195.png`, `196.png`.
- **Nicht gelesene oder fehlende Seiten in P3**: Keine (alle 13 Seiten vorhanden und vollständig lesbar).
- **Unklare Stellen / Druckfehler im Original**:
  - Auf **S. 89** bei Fig. 301 steht `W/2 = 9`, obwohl im Gegensatz zu den Halbkreisen Fig. 297–300 ein Vollkreis (`W = 18`) gezeichnet ist.
  - Auf **S. 91** bei `5) Die Totalnetze` steht `(□N + DS)` statt `(□N + DN)`.
  - Auf **S. 94** in Abschnitt A 2) steht `(Fig. 226)` statt `(Fig. 326)`.
