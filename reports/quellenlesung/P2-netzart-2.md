# P2 — Einleitung (S. 2–9) und Netzart 2 (S. 23–29)

Die Einleitungsseiten (S. 2–9, wobei auch die im Auftrag als fehlend gemeldete S. 9 als `109.png` im Ordner vorhanden ist und gelesen wurde!) definieren die fünf primären Linienscharen `(1)` Barenschar, `(2)` Strahlenbüschel, `(3)` Kreisbüschel, `(4)` Kreisschar und `(5)` Tangentenschar, die sekundären Linienscharen sowie auf S. 7–8 die vollständige **Kombinationstabelle für alle 10 Netzarten**.
**Netzart 2** (`(1) Barenschar + (2) Strahlenbüschel`, Matrixzelle `1+2`, S. 23–29) umfasst drei Varianten: **2A** (nach Netzart 1, Trapezrahmen), **2B** (mit Hauptpunkt, Komplexe für Vielecke/Quadrat) und **2C** (Baren nach der Tangensfunktion geordnet + gleichwinkliges Strahlenbüschel im Rechteckrahmen). In **2C** besteht das Quadratnetz `□N` ausschließlich aus geraden Linien im Rechteckrahmen (Klasse B), während die Diagonalscharen zwei gekrümmte Hyperbelscharen sind (alle übrigen 9 Familien von 2C sind daher Klasse C).

---

## Teil I: Einleitung — Voraussetzungen, Linienscharen und Kombinationstabelle (S. 2–9)

### 1. Voraussetzungen (S. 2)
- Netze bestehen aus sich überkreuzenden Linienscharen („Netzbestandteile“), die selbst keine Maschen bilden, sondern nur Bänder aus der Fläche schneiden.
- Drei allgemeine Voraussetzungen für eine Linienschar:
  1. **Stetig und möglichst einfacher Natur**: Es kommen nur **Gerade oder Kreise** als primär bestimmende Linienzüge in Frage (die abgeleiteten Diagonalnetze bilden manchmal schon Kurven höherer Ordnung, deren Punkte aber durch Gerade und Kreise denkbar einfach bestimmt sein sollen).
  2. **Mindestens in einer Flächenrichtung endlich**: Kombiniert man zwei solcher Scharen, entsteht allseitige Begrenzung.
  3. **Logisch begründetes Ende bei handlichen Maßen**: Im Gegensatz zur geometrischen Reihe (Fechnersches Gesetz, bei dem die Distanzen ohne bestimmtes Ende unter die Schwelle sinken) soll auch der kleinste Abstand und die durch ihn bestimmte kleinste Masche handliche Maße haben.

### 2. Die fünf primären Linienscharen (S. 2–6)
- **1.) Die Barenschar** (S. 2–3):
  - **a) mit nach aussen abnehmenden, nach der Sinusfunktion geordneten Abständen** (S. 2–3): Halbkreis in `E = 2, 3, 4..., allgemein n` gleiche Teile geteilt, Lote auf den Halbmesser gezogen. Notation mit Zeichen `>` für nach außen kleiner werdende Abstände: `E> = 6` (Fig. 1). Um den kleinsten Abstand größer zu machen, teilt man in `n + a` Teile und lässt an beiden Enden Teile weg: `E> = 6 + 1` (Fig. 2, Halbkreis in 7 Teile geteilt, beidseitig `1/14` weggelassen).
  - **b) mit nach aussen zunehmenden, nach der Tangensfunktion geordneten Abständen** (S. 3): Notation `<`. Gleichwinkliges Strahlenbüschel mit einer Geraden geschnitten (Fig. 3 und 4). Da der letzte, unendlich große Abstand nicht benützt werden kann, bricht man mit dem vorletzten oder früher ab. Hilfskreis in `n + 1`, `n + 2` oder `n + 3` gleiche Teile geteilt; Notation: `E< = n + a` (Fig. 3: `E< = 6 + 1`; Fig. 4: `E< = 6 + 2`).
- **2.) Das Strahlenbüschel** (S. 3–4):
  - Schnittpunkt rückt aus dem Unendlichen ins Endliche (`Focus`), teilt den vollen Winkel in `E = n` gleiche Teile. Nach Ostwald werden Winkel stets in Bruchteilen von `1` gemessen: `E = 4/4, 8/8, 16/16, 32/32..., 6/6, 12/12, 24/24..., 3/3, 9/9, 27/27..., eventuell noch 10/10, 20/20..., und 15/15, 30/30...` (letztere selten).
  - Im Kreisrund gibt es eine zentrische Lage (Fig. 5: `zentrisches Strahlenbüschel, E = 12/12`) und viele exzentrische Lagen (Fig. 6: `exzentrisches Strahlenbüschel, E = 12/12`).
- **3.) Das Kreisbüschel** (S. 4):
  - Die geraden Strahlen des Büschels werden als Kreise mit unendlichen Radien aufgefasst; gibt man den Radien endliche Größe, entsteht das Kreisbüschel (alle Kreise gehen durch den gemeinsamen `Focus` und schneiden sich dort unter gleichen Winkeln `1/n`).
  - Fig. 7: `zentrisches Kreisbüschel, E = 12/12`; Fig. 8: `exzentrisches Kreisbüschel, E = 12/12`.
- **4.) Die Kreisschar** (S. 5–6):
  - Die Schar barer Geraden wird als Kreisschar mit unendlich großen Radien aufgefasst; bei endlichen Radien entsteht die Kreisschar mit Bestimmungsstück `R` (Anzahl der Abstände).
  - **a) Nach der Sinusfunktion kleiner werdende Abstände** (S. 5): Kreisviertel in `R = n` gleiche Teile geteilt, Punkte auf den Durchmesser projiziert ergibt die Kreisradien `M-1, M-2, M-3..., M-n`.
    - Zentrischer Fall: Fig. 9 (`zentrische Kreisschar, R = 4`, gemeinsamer Mittelpunkt `M`).
    - Exzentrischer Fall: Fig. 10 (`exzentrische Kreisschar, R = 4`). Die Kreismittelpunkte wandern auf einem Rahmendurchmesser bis zu einem **Hauptpunkt `H`**, dessen Lage als Maß der Exzentrizität (`Exz`) dient. Bewährte einfache Brüche für die Teilung des Durchmessers durch `H`: `1/1, 4/5, 3/4, 2/3, 3/5, 1/2, 2/5, 1/3, 1/4`. Konstruktion der Mittelpunkte `M_1, M_2, M_3...`: über `H` einen zweiten, kleineren Viertelkreis mit Radius `H - M` errichten, gleich einteilen und auf die Strecke `H - M` loten.
  - **b) Nach der Tangensfunktion zunehmende Abstände** (S. 5–6): Bei `R = n` Abständen wird das Kreisviertel in `n+1, n+2` oder `n+3` gleiche Teile geteilt. Strahlenbüschel zum Mittelpunkt `M` schneidet auf der Geraden `a-a` (gleich lang wie der Radius des Rahmenkreises) `n` Teile an; Loten auf den Rahmendurchmesser liefert die Radien `M-1, M-2, ..., M-n` (Fig. 11: `zentrische Kreisschar, R = 4+1`). Bei exzentrischer Anordnung (Fig. 12: `exzentrische Kreisschar, R = 4+1`) wird die Konstruktion im verkleinerten Maßstab über `H` mit Radius `H-M` und Strecke `a'-a'` für die Mittelpunkte `M_1, M_2, ..., M_n` wiederholt.
- **5.) Die Tangentenschar** (S. 6):
  - Lässt man den Focus eines Strahlenbüschels zum Kreise werden, verdoppelt sich jeder Strahl in zwei bare Tangenten (Fig. 13: `E = 12/12`). Bildet bereits selbst Maschen (Übergang zwischen einzelner Linienschar und Netz). Ebenso bilden die Tangentenscharen von Ellipsen, Parabeln und Hyperbeln Netze (Berührungspunkte durch Strahlenbüschel aus einem der Foca oder durch Kegelschnitt nach darstellender Geometrie wie Fig. 213).

### 3. Sekundäre Linienscharen und Kombinationsgesetz (S. 6–7)
- **6.) Sekundäre Linienscharen** (S. 6–7): Erscheinen beim Aufbau eines Netzes aus den Bestandteilen 1 bis 5 als abgeleitete Scharen (Diagonalnetze):
  - `das Kreisdoppelbüschel`
  - `das Hyperbeldoppelbüschel`
  - `die Hyperbelschar`
  - `die Ellipsenschar`
  - `das Spiralenbüschel`
  - `die Schlingenschar`
- **Kombinationsgesetz (S. 7)**:
  - Aus den Linienscharen 1 bis 4 ergeben sich zehn Kombinationen: `1+1, 1+2, 1+3, 1+4; 2+2, 2+3, 2+4; 3+3, 3+4; 4+4`.
  - „Und manche dieser Zusammenstellungen können zwei Variationen aufweisen, die das Zu- oder Abnehmen der Distanzen betreffen. Mehr nicht, denn wir dürfen erfahrungsgemäss nie eine grösser werdende mit einer kleiner werdenden Schar kombinieren.“ (S. 7).
  - Da einige Zusammenstellungen sich sehr gleichen (namentlich `2+4` und `3+4` unter Netzart 8), wird dort nur eine Netznummer gesetzt, und dafür das Tangentennetz `(5)` als Netzart 4 aufgenommen, sodass es wieder genau zehn Netzarten sind.

### 4. Wörtliche Tabelle für die Kombination der Linienscharen (S. 7–8)

| Netzart | Gruppe | Kombination der Linienscharen | Hinweise | Gestaltungsart |
| :--- | :--- | :--- | :--- | :--- |
| **1** | GERADE UND GERADE | `(1) Barenschar + (1) Barenschar.` | `2A, 1B.` / `1A.` | `A) Abstände nach der Sinus- u. Tangensfunktion geordnet.` / `B) Abstände nach geometrischen Reihen geordnet.` |
| **2** | GERADE UND GERADE | `(1) Barenschar + (2) Strahlenbüschel.` | `1A.` / `8A.` / `3A, 5B.` | `A) Nach Netzart 1` / `B) Mit Hauptpunkt.` / `C) Baren nach der Tangensfunktion geordnet.` |
| **3** | GERADE UND GERADE | `(2) Strahlenbüschel + (2) Strahlenbüschel.` | `2C, 4A.` `7B, 9B_1.` / `9B_1.` / `2C` | `A) Mit rundem Bildrahmen.` / `B) Mit Hauptpunkt.` / `C) Das Möbiusnetz.` |
| **4** | GERADE UND GERADE | `(5) Tangentennetz.` | `3A, 4B.` / `4A, 4G.` / `4D, 4G.` / `4C, 4G.` / `4F, 4G.` / `4E, 4G.` / `4B - F.` | `A) Kreistangentennetz.` / `B) Afines Ellipsentangentennetz.` / `C) Homologes Ellipsentangentennetz.` / `D) Parabeltangentennetz.` / `E) Afines Hyperbeltangentennetz.` / `F) Homologes Hyperbeltangentennetz.` / `G) Die Sehnennetze.` |
| **5** | GERADE + KREIS | `(1) Barenschar + (3) Kreisbüschel.` | `2B, 8B.` / `9A_4.` | `A) Mit Hauptpunkt.` / `B) Mit halbkreisförmigem Rahmen.` |
| **6** | GERADE UND KREIS | `(1) Barenschar + (4) Kreisschar.` | `10` | *(keine Unterpunkte in Spalte Gestaltungsart)* |
| **7** | GERADE UND KREIS | `(2) Strahlenbüschel + (3) Kreisbüschel.` | `9A_4.` / `3A, 9B.` | `A) Gemeinsamer Focus.` / `B) Zwei verschiedene Foca.` |
| **8** | GERADE UND KREIS | `(2) Strahlenbüschel + (4) Zentr. oder exzentr. Kreisschar.` | `2B, 8B.` | `A) Mit kreis- und halbkreisförmigem Bildrahmen.` / `B) Metamorphes Netz mit rechteckigem Bildrahmen.` |
| *(8 forts.)* | *(KREIS UND KREIS)* | `(3) Kreisbüschel + (4) zentr. od. exzentr. Kreisschar` | `5A, 8A.` | `Mit kreisförmigem Bildrahmen.` |
| **9** | KREIS UND KREIS | `(3) Kreisbüschel + (3) Kreisbüschel.` | `7A.` / `7A` / `9A_4.` / `9A_3, 5B.` / `3A, 3B.` / `10` | `A) Gemeinsamer Focus.` `1) Zentrische Lage.` `2) Exzentrische Lage.` `3) Mit Leitellipse oder Leitparabel.` `4) Mit Leithyperbel.` / `B) Verschiedene Foca.` `1) In naher Lage.` `2) In weiter Lage.` |
| **10** | KREIS UND KREIS | `(4) Kreisschar + (4) Kreisschar.` | `6, 9B.` | `A) Zwei gleichabständige, konzentrische Kreisscharen.` / `B) Kreisscharen mit wandernden Mittelpunkten.` `1) Gleichabständig auf einer Geraden.` `2) Gleichabständig auf einem Kreis.` `3) Nach der Tangensfunktion auf einer Leitlinie.` `4) Nach der Sinusfunktion auf einer Geraden.` |

*(Hinweis auf S. 8–9: Netzart 1 wird als einfachste am ausführlichsten beschrieben; ihre Überlegungen kehren modifiziert in allen anderen Fällen wieder. Ziel ist kein mathematisches Lehrbuch, sondern ein Handwerkszeug der konkreten Augenkunst, insbesondere des Farb- und Formwandelspiels.)*

---

## Teil II: Netzart 2 — Barenschar + Strahlenbüschel (S. 23–29)

### Gemeinsame Definition (Matrixzelle)
- **Scharenpaar**: `(1) Barenschar + (2) Strahlenbüschel` (Gruppe: `GERADE UND GERADE`).
- **Matrixzelle**: `1.2` (bzw. `1+2` laut S. 7).

---

## Variante 2A: Gestaltung nach Netzart eins (S. 23)

### 1. Definition
- **Netzscharen**: Eine Barenschar (geordnet nach denselben Gesetzen wie bei Netzart 1, also Sinus `>` oder Tangens `<`) überkreuzt von einem **ungleichwinkligen Strahlenbüschel** mit Schnittpunkt (`Focus`) im Endlichen.
- **Matrixzelle**: `1.2` (Variante A, Hinweis auf S. 7: `1A`).

### 2. Konstruktion
- **S. 23 (Fig. 67, 68)**:
  - „Damit die Begrenzung allseitig sei, ist das hier zu verwendende Büschel nicht gleichwinklig; vielmehr muss ein Zu- oder Abnehmen seiner Winkel nach aussen hin statthaben. Das lässt sich am besten erreichen, wenn man folgende Konstruktion benützt, die sich eng an jene von Netzart eins anschliesst:“
  - In **Fig. 67 (`□N>`, `E = 4 x 4`, `W = 16`)**: Links ein Halbkreis in 4 Teile (`1/4`) für die waagerechte Sinus-Barenschar; oben ein Halbkreis über der oberen Trapezseite in 4 Teile (`1/4`) geteilt, dessen projizierte Teilpunkte mit dem unten liegenden `Focus` verbunden werden.
  - In **Fig. 68 (`□N<`, `E = 4 x 4`, `W = 16`)**: Links ein Hilfskreis mit `1/5`-Teilung für die waagerechte Tangens-Barenschar; über der oberen Trapezseite ein Hilfskreis mit `1/6`-Teilung für die Strahlen zum `Focus`.

### 3. Linienart
- **Grundnetz (`□N`)**: Reine Geradenscharen (waagerechte Baren + schräge Strahlen aus dem Focus).
- **Diagonalscharen**: Im Text auf S. 23 nicht eigens gezeichnet, da auf die Formensammlung von Netzart 1 verwiesen wird (durch die projektive Verzerrung des Rechtecks zum Trapez werden die Diagonalscharen von Netzart 1 perspektivisch verzerrt).

### 4. Rahmen
- **Trapezförmig** („Wir bekommen auf diese Weise ein Netz, das trapezförmig ist und je nach den gewählten Bestimmungsstücken jede beliebige Proportion annehmen kann.“ S. 23).

### 5. Maschenzahl W und Optimum
- Identisch mit Netzart 1 (`W = k * E_1 * E_2`).
- Dokumentierte Figuren:
  - **Fig. 67** (S. 23): `□N>`, `E = 4 x 4`, `W = 16`.
  - **Fig. 68** (S. 23): `□N<`, `E = 4 x 4`, `W = 16`.

### 6. Varianten und Besonderheiten
- Sowohl für abnehmende (`>`, Sinus, Fig. 67) als auch für zunehmende (`<`, Tangens, Fig. 68) Abstände konstruierbar.
- Autor verzichtet auf eine eigene Formensammlung, „insbesondere, weil man einen trapezförmigen Bildrahmen ohne ganz besondere Nötigung nicht brauchen wird.“ (S. 23).

### 7. Beziehung zu Netzart 1 und anderen Netzarten
- „Mathetisch ist es aber stets mit Netz eins vergleichbar, und es werden sich alle die dort aufgezeigten Fälle wiederholen.“ (S. 23).

### 8. Einordnung für die App (Einschätzung)
- **Einschätzung**: **Klasse D** (bzw. **Klasse B**, wenn auf das Trapez verzichtet wird) — ist lediglich eine Zentralprojektion (Trapez-Verzerrung) von Netzart 1 und benötigt einen trapezförmigen Bildrahmen.

---

## Variante 2B: Gestaltung mit Hauptpunkt (S. 23–24)

### 1. Definition
- **Netzscharen**: Eine nur nach einer Richtung hin begrenzte Barenschar + ein gleichwinkliges Strahlenbüschel, dessen Focus in die Mitte der Barenschar gelegt wird; verwendet werden Teilausschnitte („Komplexe“).
- **Matrixzelle**: `1.2` (Variante B, Hinweis auf S. 7: `8A`).

### 2. Konstruktion
- **S. 23–24 (Fig. 69–71)**:
  - Man legt den Focus des gleichwinkligen Strahlenbüschels in die Mitte der Barenschar und benützt dreieckige Teilausschnitte („Komplexe“, Fig. 69), aus denen man Vier-, Sechs- und Achtecke usw. zusammensetzt (Fig. 70: Sechseck, Fig. 71: Quadrat).
  - Fig. 69 zeigt links den Komplex für ein Sechseck mit `E_1 = 2, E_2 = 2/12` (Öffnungswinkel `2/12` am Focus, 2 Barenabstände nach der Sinusfunktion mittels Viertelkreisbogen links) und rechts für ein Quadrat mit `E_1 = 2, E_2 = 2/8` (Öffnungswinkel `2/8`).
  - „Beim Focus degenerieren die Quadratmaschen zu Dreiecken; sie müssen aber, wie jede feinere Unterteilung erweist, als Quadrate aufgefasst und verwendet werden, siehe Fig. 94.“ (S. 23).

### 3. Linienart
- Reine Geraden innerhalb jedes Komplexes (die konzentrisch um den Hauptpunkt gruppierten Baren bilden geschlossene Polygonringe, die vom Strahlenbüschel radial durchschnitten werden).

### 4. Rahmen
- **Reguläre Vielecke**: Vier-, Sechs-, Achtecke usw. (Fig. 70 ist ein reguläres Sechseck, Fig. 71 ist ein **Quadrat**!).

### 5. Maschenzahl W und Optimum
- Dokumentierte Figuren:
  - **Fig. 69** (S. 23): `Komplex für ein Sechseck mit E_1 = 2, E_2 = 2/12; und für ein Quadrat mit E_1 = 2, E_2 = 2/8.`
  - **Fig. 70** (S. 24): `W = 24` (Sechseck aus 6 Komplexen zu je 4 Maschen).
  - **Fig. 71** (S. 24): `W = 16` (Quadrat aus 4 Komplexen zu je 4 Maschen).

### 6. Varianten und Besonderheiten
- Degeneration der innersten Quadratmaschen am Focus zu Dreiecken.
- Für `E_2 = 2/8` (4 Komplexe zu je `90°`) entsteht ein **quadratischer Rahmen** (Fig. 71) aus konzentrischen Quadratringen und einem zentralen Strahlenbüschel.

### 7. Beziehung zu Netzart 1 und anderen Netzarten
- **Zu Netzart 8 (S. 24)**: „Wir kommen zu einer Gestaltung, die mathetisch mit jener von Netzart acht übereinstimmt und dort die idealste Form annimmt. Wir wollen daher dort die Untersuchung systematisch weiterführen und uns hier auf Andeutungen beschränken.“ (Bei Netzart 8 treten Kreisscharen an die Stelle der Polygonringe aus Baren).

### 8. Einordnung für die App (Einschätzung)
- **Einschätzung**: **Klasse B** für den Vier-Komplexe-Fall (Fig. 71, quadratischer Rahmen mit radialen Strahlen und konzentrischen Quadratringen aus geraden Segmenten) bzw. **Klasse D** für Sechs-, Achtecke usw.

---

## Variante 2C: Baren nach der Tangensfunktion geordnet (S. 24–29)

### 1. Definition
- **Bausteine (S. 25, Abschnitt III)**:
  1. „Die zwei Netzscharen sind verschieden voneinander: ein Strahlenbüschel und eine Barenschar.“ (Laut S. 24: ein **gleichwinkliges Strahlenbüschel** mit `E = n/n` und eine **Barenschar, die nach der Tangensfunktion geordnet ist**).
  2. „Die zwei Diagonalscharen bestehen aus zwei Hyperbelscharen, die durch den Focus des Strahlenbüschels gehen und im Falle von `W` Wiederholungen gegengleich symetrisch sind; bei `W/2` Wiederholungen jedoch nicht.“
  3. „Von den beiden Halbdiagonalnetzen ist i. R. nur eines gut brauchbar.“
- **Matrixzelle**: `1.2` (Variante C, Hinweise auf S. 7: `3A, 5B`).

### 2. Konstruktion
- **Netzkonstruktion (S. 24, Abschnitt I)**:
  - „Die ergiebigste Möglichkeit finden wir, wenn wir ein gleichwinkliges Strahlenbüschel mit einer Barenschar kombinieren, die nach der Tangensfunktion geordnet ist; als Beispiele siehe die Fig. 72 bis 75.“
  - „Der Focus liegt mit Vorteil ausserhalb des Bildes, wobei es symetrische (Fig. 73) und unsymetrische Gestaltungen gibt (Fig. 72 und 74). Ausnahmsweise kann er aber auch im Bildinnern liegen (Fig. 75).“
  - „Der Einteilungsfaktor `E` des Strahlenbüschels sei `12/12, 16/16, 20/20, 24/24..., allgemein n/n`. Die Punkte, wo die Strahlen die gegenüberliegenden Bildränder treffen, seien laufend von `0` bis `(n/4 - 1)` nummeriert, wie es die gegebenen Quadratnetz-Beispiele zeigen.“
  - **Konstruktiver Zusammenhang der beiden Scharen (aus Fig. 72–75 ersichtlich)**:
    - Das gleichwinklige Strahlenbüschel `E = n/n` aus dem Focus schneidet auf der seitlichen vertikalen Bildkante (die parallel zum Mittelstrahl `0` verläuft) Punkte im Tangens-Abstand `y_k = d * tan(2\pi k / n)` für `k = a, a+1, ..., b` an.
    - Durch genau diese Schnittpunkte `k = a ... b` am vertikalen Bildrand laufen die waagerechten Geraden der **nach der Tangensfunktion geordneten Barenschar**!
- **Natürliche Proportion und affine Schrägprojektion (S. 24–25)**:
  - Die natürliche Proportion der Bilder ist durch `E` und `(a - b)` eindeutig bestimmt und pflegt i. R. einfach zu bleiben („Näheres darüber enthält die Netzorgel.“).
  - „Man kann diese Proportionen durch affine Schrägprojektion nach Bedarf verändern, d. h. indem man bei gleichbleibenden Breitenmassen alle Längenmasse um denselben Bruchteil verkürzt.“ (S. 24–25).

### 3. Linienart
- **Netzscharen (NS)**: Beide Netzscharen (gleichwinkliges Strahlenbüschel + Tangens-Barenschar) bestehen **nur aus geraden Linien**!
- **Diagonalscharen (DS)**: Beide Diagonalscharen sind **gekrümmte Hyperbelscharen**, die durch den Focus des Strahlenbüschels gehen (S. 25).
- Folglich besteht in Variante 2C **nur die Familie `1) Die Quadratnetze (NS + NS)` ausschließlich aus geraden Linien** (Fig. 72–75). Alle anderen 9 Familien (`DN`, `HDN`, `□MN`, `TN`, `△GN`, `△N`, `*N`, `△MN`, `*MN`, Fig. 76–93) enthalten mindestens eine der beiden Hyperbelscharen und weisen daher gekrümmte Linien auf!

### 4. Rahmen
- **Exaktes Rechteck** in allen 10 Familien:
  - Beim unsymmetrischen halben Format (`W/2`, z. B. Fig. 72, 74): begrenzt durch den Strahl `0` (senkrechte rechte Bildkante), die dazu parallele linke Bildkante sowie oben durch die Bare `a` und unten durch die Bare `b`.
  - Beim symmetrischen ganzen Format (`W`, z. B. Fig. 73): verdoppelt (gespiegelt) um den Mittelstrahl `0`.
  - Beim zweifach symmetrischen Format mit Focus im Bildinnern (`2W`, Fig. 75): vier Quadranten um den Focus.

### 5. Maschenzahl W und Optimum (S. 24–29)
- **Allgemeine Wiederholungsformel (S. 24, Abschnitt II)**:
  - Symmetrisch gestaltete ganze Formate haben `W` Wiederholungen, unsymmetrische halbe Formate zählen `W/2` (und das zweifach symmetrische Format mit Focus im Innern in Fig. 75 zählt `2W`).
  - Die Länge des Bildes wird durch zwei nummerierte Punkte `(a - b)` angegeben:
    1. `a` gibt beim unsymmetrischen, halben Quadratnetz die Zahl der Maschen an, die an die weniger unterteilte Barenseite (oben) stoßen. Es kann ganze Zahlen von `1` bis `n/4 - 3` durchlaufen.
    2. `b` gibt beim unsymmetrischen, halben Quadratnetz die Zahl der Maschen an, die an die enger unterteilte Barenseite (unten) stoßen.
  - „Da stets `b = (n/4 - 1)` ist, ist `E` indirekt an der allgemeinen Formel `W = k (b^2 - a^2)` beteiligt, welche die Wiederholungszahl fürs ganze Netz und für alle Familien gibt. `k` sind die in der ‚Interpolationstabelle‘ Seite 17 gegebenen Konstanten.“ (S. 24; Hinweis: In einigen Figuren, z. B. Fig. 87/88 mit `E = 32/32, 2-7` und `E = 32/32, 3-7` oder Fig. 93 mit `E = 32/32, 2-7`, ist `b = 7 = n/4 - 1`, in Fig. 78 mit `E = 32/32, 4-7` ebenfalls `b = 7`).
- **Die zehn Netzfamilien mit ihren Formeln und Beispielen (S. 25–29)**:
  1. **Die Quadratnetze, `(NS + NS)`** (S. 25–26): `W = b^2 - a^2` (`k = 1`)
     - Fig. 72 (S. 25): `□N`, `E = 20/20`, `1-4` (`a=1, b=4`), `W/2 = 7,5; unsymetrisch.`
     - Fig. 73 (S. 25): `□N`, `E = 16/16`, `1-3` (`a=1, b=3`), `W = 8, symetrisch.`
     - Fig. 74 (S. 26): `□N`, `E = 24/24`, `2-5` (`a=2, b=5`), `W/2 = 10,5; unsymetrisch.`
     - Fig. 75 (S. 26): `□N`, `E = 12/12`, `1-3` (`a=1, b=3`), `2W = 16; zweifach symetrisch.`
  2. **Die Diagonalnetze, `(DS + DS)`** (S. 26): `W = 2(b^2 - a^2)` (`k = 2`)
     - Fig. 76 (S. 26): `DN`, `E = 16/16`, `1-3`, `W/2 = 8; unsymetr.`
  3. **Die Halbdiagonalnetze** (S. 26): `W = 1/2 (b^2 - a^2)` (`k = 1/2`)
     - Fig. 77 (S. 26): `HDN`, `E = 24/24`, `2-5`, `W = 10,5; symetrisch.`
     - Fig. 78 (S. 26): `HDN`, `E = 32/32`, `4-7`, `W/2 = 8,2; unsymetrisch.`
  4. **Die Quadratmischnetze, `(NS + DS)`** (S. 26–27): `W = b^2 - a^2` (`k = 1`)
     - Für ganze Formate gibt es zwei Fälle, für halbe deren vier, jedoch haben nur zwei davon gute Begrenzung:
       - `a) der geeigneten Diagonalschar + Barenschar (Fig. 79).`
       - `b) der geeigneten Diagonalschar + Strahlenbüschel (Fig. 80).`
     - Fig. 79 (S. 27): `□MN`, `E = 24/24`, `2-5`, `W/2 = 10,5`.
     - Fig. 80 (S. 27): `□MN`, `E = 24/24`, `2-5`, `W/2 = 10,5`.
     - Fig. 81 (S. 27): `□MN`, `E = 16/16`, `1-3`, `W = 8`.
     - Fig. 82 (S. 27): `□MN`, `E = 16/16`, `1-3`, `W = 8`.
  5. **Die Totalnetze, `(□N + DN)`** (S. 27): `W = 4(b^2 - a^2)` (`k = 4`)
     - *(Unnummerierte Figur unten links auf S. 27 neben `5) Die Totalnetze` und `6) Die Dreieck-gruppennetze`; auf S. 28 geht es mit Fig. 85 weiter — die beiden Figuren unten auf S. 27 entsprechen also Fig. 83 und Fig. 84, deren Beschriftung im Druck ausgelassen wurde! In der linken Figur ist `a=1, b=3`, `TN`; in der rechten Figur `a=1, b=3`, `△GN`).*
  6. **Die Dreieckgruppennetze, `(□N + HDN)`** (S. 27): `W = 2(b^2 - a^2)` (`k = 2`)
     - *(Siehe Hinweis zu 5: die beiden Figuren unten auf S. 27 tragen im Original keine Bildunterschrift `Fig. 83` / `Fig. 84`).*
  7. **Die Dreiecknetze, `(□N + DS)`** (S. 28): `W = b^2 - a^2` (Hinweis: im Original steht auf S. 28 `W = b^2 - a^2`, die angegebenen Zahlenwerte `1-4, W/2 = 15` entsprechen aber `k = 2`, also `W = 2(b^2 - a^2) = 2*(16 - 1) = 30`, `W/2 = 15`!)
     - „Ganze Formate haben eine Lösung; halbe deren zwei.“
     - Fig. 85 (S. 28): `△N`, `E = 20/20`, `1-4`, `W/2 = 15`.
     - Fig. 86 (S. 28): `△N`, `E = 20/20`, `1-4`, `W/2 = 15`.
  8. **Die Sechsecknetze, `(□N + DS)`** (S. 28): `W = (b^2 - a^2)/3` (`k = 1/3`)
     - „Jedes Dreiecknetz ergibt drei Sechsecknetze von verschiedenem ästhetischem Wert. Also bei ganzen Formaten drei Lösungen; bei halben deren sechs. Wir geben jeweils nur die beste.“
     - Fig. 87 (S. 28): `*N`, `E = 32/32`, `2-7`, `W/2 = 7,5`.
     - Fig. 88 (S. 28): `*N`, `E = 32/32`, `3-7`, `W/2 = 6,6`.
  9. **Die Dreieckmischnetze, `(HDN + NS)`** (S. 28–29): `W = b^2 - a^2` (`k = 1`)
     - Zwei gutbegrenzte Lösungen:
       - `a) des tauglichen Halbdiagonalnetzes + Barenschar (Fig. 89).`
       - `b) des tauglichen Halbdiagonalnetzes + Strahlenbüschel (Fig. 90).`
     - Fig. 89 (S. 29): `△MN`, `E = 24/24`, `2-5`, `W/2 = 10,5`.
     - Fig. 90 (S. 29): `△MN`, `E = 24/24`, `2-5`, `W/2 = 10,5`.
  10. **Die Sechseckmischnetze, `(HDN + NS)`** (S. 29): `W = (b^2 - a^2)/6` (`k = 1/6`)
      - „Von einem und demselben Dreieckmischnetz können drei Sechseckmischnetze abgeleitet werden. Es gibt also sechs Lösungen; doch haben nicht alle gleich hübsche Abgrenzung.“
      - „Die zweite Lösung mit dem Strahlenbüschel hat nur gute Begrenzung, wenn `(b - a)` durch drei dividierbar ist.“ (S. 29).
      - Fig. 91 (S. 29): `*MN`, `E = 40/40`, `3-9`, `W/2 = 6`.
      - Fig. 92 (S. 29): `*MN`, `E = 40/40`, `3-9`, `W/2 = 6`.
      - Fig. 93 (S. 29): `*MN`, `E = 32/32`, `2-7`, `W = 7,5`.

### 6. Varianten und Besonderheiten
- Vier Formattypen beim Quadratnetz `□N`:
  - Halbes unsymmetrisches Format (`W/2`, Focus unter einer unteren Ecke außerhalb des Bildes, Fig. 72, 74).
  - Ganzes symmetrisches Format (`W`, Focus mittig unter der Unterkante außerhalb des Bildes, Fig. 73).
  - Zweifach symmetrisches Doppelformat (`2W`, Focus im Zentrum des Bildinnern, wobei der Streifen zwischen `-a` und `+a` nicht unterteilt ist, Fig. 75).
- Im Unterschied zu Netzart 4E (wo in `△N` und `*N` zwei Tangentenscharen und eine Tangens-Barenschar ein rein geradliniges Dreieck-/Sechsecknetz bilden) sind bei Netzart 2C bereits die beiden Grundscharen das Strahlenbüschel und die Tangens-Barenschar, sodass die Diagonalscharen gekrümmte Hyperbeln sind!

### 7. Beziehung zu Netzart 1 und anderen Netzarten
- **Zu Netzart 1 (S. 17 / S. 24–25)**: Verwendet exakt dieselben Familienfaktoren `k` aus der Interpolationstabelle S. 17 auf der Grundmaschenzahl `(b^2 - a^2)`.
- **Zu Netzart 3A und 5B (S. 7)**: In der Tabelle auf S. 7 wird bei 2C auf `3A, 5B` verwiesen.

### 8. Einordnung für die App (Einschätzung)
- **Einschätzung**: **Klasse B** für das Quadratnetz `□N` von 2C (Fig. 72–75: reine Geraden aus Tangens-Barenschar und gleichwinkligem Strahlenbüschel im exakten Rechteckrahmen, durch einfache trigonometrische Rand-Abbildung darstellbar); **Klasse C** für die Familien 2 bis 10 von 2C (`DN` bis `*MN`, Fig. 76–93), da deren Diagonalscharen gekrümmte Hyperbelscharen sind.

---

## 9. Gelesene Seiten, Lücken und offene Fragen (Paket P2)

- **Gelesene Seiten**:
  - Einleitung: S. 2 (`102_Netze.png`), S. 3 (`103.png`), S. 4 (`104.png`), S. 5 (`105.png`), sowie zusätzlich S. 6 (`106.png`), S. 7 (`107.png`), S. 8 (`108.png`) und S. 9 (`109.png`).
  - Netzart 2: S. 23 (`123.png`), S. 24 (`124.png`), S. 25 (`125.png`), S. 26 (`126.png`), S. 27 (`127.png`), S. 28 (`128.png`), S. 29 (`129.png`).
- **Hinweis zu S. 9 (`109.png`)**:
  - Im Auftrag war S. 9 als fehlend vermerkt („und S. 9 (fehlt, nur melden)“). Die Datei `docs/quellen/109.png` ist jedoch im Verzeichnis vorhanden (3.280.989 Bytes, vom 17. Nov.) und wurde gelesen; sie enthält den kurzen Schlusssatz der Einleitung (9 Zeilen).
- **Unklare Stellen / Druckfehler im Original**:
  - Auf **S. 27 unten** sind die beiden Figuren zu `5) Die Totalnetze` und `6) Die Dreieck-gruppennetze` abgedruckt, aber die Bildunterschriften (`Fig. 83` und `Fig. 84`) fehlen auf der Seite.
  - Auf **S. 28 oben** lautet die Formel bei `7) Die Dreiecknetze, (□N + DS)` im Druck `W = b^2 - a^2` (statt `W = 2(b^2 - a^2)`), während die Beispielwerte in Fig. 85 und 86 (`E = 20/20, 1-4, W/2 = 15`) mit `k = 2` (`W/2 = 15 = 4^2 - 1^2`) berechnet sind.
