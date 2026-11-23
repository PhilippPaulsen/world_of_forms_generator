# Messung 120 — Rohausgabe

## Messung 1: Horizontabstand (Bildmessung, Fig. 149 auf S. 49)

```
Fig. 149 (a=2, b=4): 14 Linienkandidaten; Rahmen 281 x 388 px (x: a-Seite -1 links, b-Seite +1 rechts)
  Stimmen 323  links bei Y=1.001  rechts bei Y=0.498
  Stimmen 318  links bei Y=0.000  rechts bei Y=0.489
  Stimmen 282  links bei Y=0.503  rechts bei Y=0.251
  Stimmen 276  links bei Y=0.506  rechts bei Y=0.744
  Stimmen 210  links bei Y=0.518  rechts bei Y=0.243
  Stimmen 191  links bei Y=1.021  rechts bei Y=0.490
  Stimmen 159  links bei Y=-0.487  rechts bei Y=0.237
  Stimmen 126  links bei Y=1.541  rechts bei Y=0.737
  Schnitt Linie 0 / 2 (ein Buendel): 0.99 Rahmenbreiten jenseits der b-Seite
  Schnitt Linie 1 / 3 (ein Buendel): 1.02 Rahmenbreiten jenseits der b-Seite
Fluchtpunkt jenseits der b-Seite, gemessen (Mittel aus 2): 1.01 H;  Plan 119 a/(b-a) = 1.00 H;  Q1 1/(b-a) = 0.50 H
Fusspunkte am oberen/unteren Rahmen (X-Achse a->b, -1..1): -0.922 0.346 0.345 0.371   Modell v=3: X = 2*y(3)-1 = 0.333 (Plan 119), linear ohne Perspektive 0.000
```

Erzeugt von `node tools/grid/measure-3c.js`; Modell H(p,q) = ((p-q)/(p+q), (1/a - 1/(p+q))/(1/a - 1/b)), Ausschnitt p,q >= 0, a <= p+q <= b (halb: p >= q).

## Messung 2: W durch Zaehlen der Maschen gegen Quelle S. 48 bis 52 und Formel

| Familie | Fig. | a,b | Format | Quelle W | Formel | Zaehlung (Varianten) | Maschen: ganz/halb/sonst | Befund |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| □N | 148 | 1,4 | ganz | 7,5 | 7,5 | 7,5 | 5/5/0 | bestaetigt |
| □N | 149 | 2,4 | ganz | 6 | 6 | 6 | 3/6/0 | bestaetigt |
| □N | 150 | 3,6 | halb | 6,8 | 6,75 | 6,75 | 4/5/1 | bestaetigt |
| DN | 151 | 1,3 | ganz | 8 | 8 | 8 | 6/4/0 | bestaetigt |
| DN | 152 | 2,4 | halb | 6 | 6 | 6 | 5/2/0 | bestaetigt |
| HDN | 153 | 3,7 | ganz | 10 | 10 | 10 | 4/10/4 | bestaetigt |
| □MN | 154 | 2,4 | ganz | 6 | 6 | 6 | 5/2/0 | bestaetigt |
| □MN | 155 | 2,4 | ganz | 6 | 6 | 6 | 5/2/0 | bestaetigt |
| △TN | 156 | 2,4 | halb | 12 | 12 | 12 | 12/0/0 | bestaetigt |
| △GN | 157/158 | 2,4 | ganz | 12 | 12 | 12 | 12/0/0 | bestaetigt |
| △N | 159/160 | 2,4 | ganz | 12 | 12 | 12 | 12/0/0 | bestaetigt |
| △N | 161/162 | 3,6 | halb | 13,5 | 13,5 | 13,5 | 12/3/0 | bestaetigt |
| △MN | 163/164 | 2,6 | halb | 8 | 8 | 8 | 6/4/0 | bestaetigt |
| *N | 165 | 3,7 | ganz | 6,7 | 6,67 | 6,67 | 40/0/0 | bestaetigt; Annahme: Sechseck = 6 Dreiecke des △N, Auslassregel nicht modelliert |
| *N | 166/167 | 3,9 | halb | 6 | 6 | 6 | 33/6/0 | bestaetigt; Annahme: Sechseck = 6 Dreiecke des △N, Auslassregel nicht modelliert |
| *MN | 168/169 | 4,12 | halb | 5,3 | 5,33 | 5,33 | 28/8/0 | bestaetigt; Annahme: Sechseck = 6 △MN-Maschen, Auslassregel nicht modelliert |

Nicht abbildbar im Prototyp: die Auslassregel der Sechsecknetze (*N, *MN, S. 52) und welche der "zwei Loesungen" das Bild zeigt; es wird nur gezaehlt, nicht gezeichnet.

## Messung 3: Randmaschen

Quadrat □N, Maschen des Ausschnitts nach Anteil (ganz = 1, halb = 0,5):

| a,b | Format | W | ganze Maschen | halbe Maschen | andere | Anteil der halben an W | halbe unten (v=a) | halbe oben (v=b) | halbe an T1-Achse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1,4 | ganz | 7,5 | 5 | 5 | 0 | 33,33 % | 1 | 4 | 0 |
| 2,4 | ganz | 6 | 3 | 6 | 0 | 50 % | 2 | 4 | 0 |
| 3,6 | ganz | 13,5 | 9 | 9 | 0 | 33,33 % | 3 | 6 | 0 |
| 3,6 | halb | 6,75 | 4 | 5 | 1 | 37,04 % | 1 | 3 | 1 |
| 2,6 | ganz | 16 | 12 | 8 | 0 | 25 % | 2 | 6 | 0 |
| 2,5 | halb | 5,25 | 3 | 4 | 1 | 38,1 % | 1 | 2 | 1 |
| 3,7 | halb | 10 | 7 | 5 | 2 | 25 % | 1 | 3 | 1 |
| 4,7 | ganz | 16,5 | 11 | 11 | 0 | 33,33 % | 4 | 7 | 0 |

Dreieck der App (60-Grad-Gitter; Rahmen v1 = C-B, v2 = C-A, Netzknoten ganzzahlig in (s,t)):

| Grösse | Wert |
| --- | --- |
| Winkel zwischen v1 und v2 | 60 Grad |
| |v1|, |v2| | 1, 1 |
| Richtung p+q = const (v1 - v2): Länge je Gitterschritt | 1 = Dreieckskante? JA |
| Richtung p-q = const (v1 + v2): Länge je Gitterschritt | 1,73 = Dreieckskante? nein (lange Rautendiagonale) |
| △N (Baren) a,b=2,4 ganz | W=12; ganze Dreiecke 12, halbe 0, andere 0 |
| △N (Baren) a,b=3,6 ganz | W=27; ganze Dreiecke 27, halbe 0, andere 0 |
| △N (Baren) a,b=3,6 halb | W=13,5; ganze Dreiecke 12, halbe 3, andere 0 (T1-Rand p=q liegt NICHT auf einer Dreieckskante, wenn andere/halbe > 0) |
| △N (Baren) a,b=2,6 halb | W=16; ganze Dreiecke 14, halbe 4, andere 0 (T1-Rand p=q liegt NICHT auf einer Dreieckskante, wenn andere/halbe > 0) |

## Messung 4: Kachelmuster unter H (Linien und Flaechen), Abweichung in px

| Pruefung | Zahl | groesste Abweichung (px, Canvas 600 x 900) |
| --- | --- | --- |
| Bild eines Streckenpunktes gegen die Sehne der Endpunktbilder (zufaellige Strecken im Ausschnitt a=2,b=4, 7 Punkte je Strecke) | 20000 | 0 (Gleitkomma-Rest) |
| Streckenzug aus Teilstuecken je Kachel (geteilt an p,q = ganz) gegen die Gesamtsehne (Kachelgrenzen ueberschritten) | 20000 | 0 |
| Flaechenkanten eines Musterpolygons je Kachel gegen die Bildsehne (Fuenfeck in 9 Kacheln) | 9 | 0 |
| Spalt zwischen Nachbarkacheln (dieselben Gitterpunkte, dieselbe Funktion) | - | 0 (gleiche Gleitkommawerte) |
| Vergleich: AFFINE Kachelabbildung (wie das Feld heute, 3 Kachelecken) gegen H, Ecken des Fuenfecks | 9 | 178,88 (so gross waere der Fehler ohne H) |

## Messung 5: Fluchtlinie und Kachelzahl (Kachelschleife = umschliessendes Rechteck [0,b] x [0,b] in (p,q))

| a,b | Format | Kacheln im Rechteck (halb: [0,b] x [0,b/2]) | davon mit Flaeche im Ausschnitt | ganz unterhalb (v_max <= a) | ganz oberhalb (v_min >= b) | Kachel mit v_min = 0 (Spitze) | Kacheln mit Segment ueber v = a | Kacheln mit Segment ueber v = b |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1,3 | ganz | 9 | 6 | 0 | 3 | 1 | 1 | 3 |
| 1,4 | ganz | 16 | 10 | 0 | 6 | 1 | 1 | 4 |
| 2,4 | ganz | 16 | 9 | 1 | 6 | 1 | 2 | 4 |
| 2,5 | ganz | 25 | 14 | 1 | 10 | 1 | 2 | 5 |
| 3,6 | ganz | 36 | 18 | 3 | 15 | 1 | 3 | 6 |
| 3,6 | halb | 18 | 10 | 3 | 3 | 1 | 3 | 3 |
| 3,7 | ganz | 49 | 25 | 3 | 21 | 1 | 3 | 7 |
| 4,8 | ganz | 64 | 30 | 6 | 28 | 1 | 4 | 8 |
| 2,6 | halb | 18 | 11 | 1 | 3 | 1 | 2 | 3 |

Spalten "ganz unterhalb/oberhalb" zaehlen Kacheln mit keiner Flaeche im Ausschnitt; beim halben Format kommen Kacheln hinzu, die nur ausserhalb der T1-Achse (p < q) liegen (Differenz der Spalten).
| Klemme v >= eps | y des Bildes der Spitze (Rahmenhoehen H) | Fehler im sichtbaren Bereich (px, Canvas 600 x 600): Strecke (0,0)-(2,1), Spitze auf (0,eps) geklemmt, gegen exakten Abschnitt bei v = a |
| --- | --- | --- |
| 0.1 | -38 | 6,9 px |
| 0.01 | -398 | 0,67 px |
| 0.001 | -3998 | 0,07 px |
| 0.0001 | -39998 | 0,01 px |
| 0.000001 | -3999998 | 0 px |

Vorschlag: Linien an der Senke an v >= a (exakt) teilen/abschneiden; Flaechen: Klemme v >= eps mit eps = 1e-3 ergibt oben genannten Fehler; Kacheln mit v_max <= a ueberspringen; Strecken zwischen v = a und v = b nie verwerfen.

## Messung 6: Streckung der Maschen und Optimum (□N, Rahmen 1 : 1, 1 : 2 hoch, 2 : 1 breit)

| a,b | Format | W | im Optimum 7 bis 12 | Streckung max bei 1:1 | bei 1:2 (hoch) | bei 2:1 (breit) | bestes Rahmenverhaeltnis B:H (min. max. Streckung) | dort max. Streckung |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1,4 | ganz | 7,5 | ja | 2,22 | 4,44 | 2,85 | 1,24 | 1,8 |
| 1,5 | ganz | 12 | ja | 2,08 | 4,17 | 3,84 | 1,03 | 2,01 |
| 2,5 | ganz | 10,5 | ja | 3,03 | 6,06 | 1,52 | 2,07 | 1,49 |
| 3,5 | ganz | 8 | ja | 4,69 | 9,38 | 2,34 | 3,82 | 1,23 |
| 4,6 | ganz | 10 | ja | 5,71 | 11,43 | 2,86 | 4,85 | 1,18 |
| 5,7 | ganz | 12 | ja | 6,73 | 13,46 | 3,37 | 5,91 | 1,15 |
| 7,8 | ganz | 7,5 | ja | 15,56 | 31,11 | 7,78 | 9,89 | 1,57 |
| 8,9 | ganz | 8,5 | ja | 17,56 | 35,12 | 8,78 | 9,89 | 1,78 |
| 1,6 | halb | 8,75 | ja | 4,83 | 2,42 | 9,67 | 0,42 | 2,05 |
| 2,6 | halb | 8 | ja | 1,93 | 2,73 | 3,87 | 0,83 | 1,64 |
| 1,7 | halb | 12 | ja | 5,83 | 2,91 | 11,66 | 0,38 | 2,21 |
| 2,7 | halb | 11,25 | ja | 2,43 | 2,55 | 4,86 | 0,72 | 1,76 |
| 3,7 | halb | 10 | ja | 1,64 | 3,28 | 2,59 | 1,12 | 1,46 |
| 4,7 | halb | 8,25 | ja | 2,22 | 4,44 | 1,46 | 1,73 | 1,28 |
| 4,8 | halb | 12 | ja | 1,9 | 3,81 | 1,95 | 1,39 | 1,37 |
| 5,8 | halb | 9,75 | ja | 2,56 | 5,13 | 1,28 | 2,11 | 1,23 |
| 6,8 | halb | 7 | ja | 3,87 | 7,74 | 1,94 | 3,46 | 1,13 |
| 6,9 | halb | 11,25 | ja | 2,9 | 5,81 | 1,45 | 2,42 | 1,2 |
| 7,9 | halb | 8 | ja | 4,38 | 8,75 | 2,19 | 3,98 | 1,11 |

Optimum fuer △N (W = b^2 - a^2 bzw. /2, 8 bis 16) und *N (W = (b^2 - a^2)/6, 6 bis 10): (a,b,Format) im Bereich:

| Familie | (a,b,Format) mit W im Optimum |
| --- | --- |
| □N | 1,4  1,5  2,5  3,5  4,6  5,7  7,8  8,9  9,10  10,11  11,12  1,6h  2,6h  1,7h  2,7h  3,7h  4,7h  4,8h  5,8h  6,8h  6,9h  7,9h  8,10h  9,11h  10,12h |
| △N | 1,3  1,4  2,4  3,5  4,5  5,6  6,7  7,8  1,5h  2,5h  3,5h  2,6h  3,6h  4,6h  5,7h  6,8h  7,9h  8,9h  9,10h  10,11h  11,12h |
| *N | 1,7  2,7  3,7  2,8  3,8  4,8  5,8  5,9  6,9  7,10  8,10  8,11  9,11  10,12  1,9h  2,9h  3,9h  1,10h  2,10h  3,10h  4,10h  5,10h  1,11h  2,11h  3,11h  4,11h  5,11h  6,11h  7,11h  5,12h  6,12h  7,12h  8,12h |

Brauchbar = W im Optimum UND max. Streckung <= 2 (b <= 9), je Rahmenverhaeltnis Breite : Hoehe; Streckung aus den Quadratmaschen (fuer △N und *N als Naeherung uebernommen, ihre Maschen liegen in denselben Zellen):

| Rahmen B:H | □N | △N | *N |
| --- | --- | --- | --- |
| 0,5 (1:2 hoch) | - | 1,5h | - |
| 0,67 | 2,7h | - | - |
| 1 (1:1) | 2,6h  3,7h  4,8h | 2,5h  2,6h  3,6h | 3,9h |
| 1,5 | 3,7h  4,7h  4,8h  5,8h  6,9h | 1,3  3,5h  3,6h  4,6h | 2,7 |
| 2 (2:1 breit) | 2,5  4,7h  4,8h  5,8h  6,8h  6,9h | 1,3  2,4  3,5h  3,6h  4,6h  5,7h  6,8h | 3,7  3,8  4,8 |

Vergleich mit der Quelle: Fig. 149 (a=2, b=4, ganz) hat Rahmen B:H = 388:281 = 1,38 (gemessen, Bild gedreht gelesen); dort max. Streckung 2,63; bestes Verhaeltnis nach Rechnung 2,79 mit 1,32.

(h = halbes Format; b hoechstens 12 gerechnet.) Streckung = max(Breite/Hoehe, Hoehe/Breite) der Bildbox einer ganzen Maschenzelle; Lesart: Auslegung der Quelle-Angabe S. 17 "hoechstens 1 x 2" fuer Maschen (nicht am Bild geprueft).

Ecken und Mitte (□N, ganz, Rahmen 1 : 1): Bildmasche Breite : Hoehe an den vier Rahmenecken und in der Mitte (lokal, Einheitsmasche):

| a,b | links unten | rechts unten | links oben | rechts oben | Mitte (x = 0, y = 1/2) | Verhaeltnis groesste/kleinste |
| --- | --- | --- | --- | --- | --- | --- |
| 2,4 | 0,25 | 0,25 | 0,5 | 0,5 | 0,33 | 2 |
| 3,5 | 0,2 | 0,2 | 0,33 | 0,33 | 0,25 | 1,67 |
| 2,5 | 0,3 | 0,3 | 0,75 | 0,75 | 0,43 | 2,5 |
| 3,6 | 0,25 | 0,25 | 0,5 | 0,5 | 0,33 | 2 |
| 1,4 | 0,37 | 0,37 | 1,5 | 1,5 | 0,6 | 4 |
| 4,7 | 0,21 | 0,21 | 0,37 | 0,37 | 0,27 | 1,75 |

## Messung 7: Sechseck *N (soweit der Prototyp es hergibt)

Zaehlung der feinen Dreiecke des △N-Gitters im Ausschnitt, geteilt durch 6 (ein Sechseck = 6 Dreiecke), gegen W = (b^2 - a^2)/6 (ganz) bzw. /12 (halb):

| a,b | Format | Dreiecke gezaehlt | Dreiecke/6 | Formel W | Quelle |
| --- | --- | --- | --- | --- | --- |
| 3,7 | ganz | 40 | 6,67 | 6,67 | 6,7 (Fig. 165) |
| 3,9 | halb | 36 | 6 | 6 | 6 (Fig. 166/167) |

Nicht geprueft: ob die Sechsecke (Auslassen von Linien nach S. 14/52) im Ausschnitt ganze Sechsecke ergeben, wie viele am Rand angeschnitten sind, und das Verhaeltnis zum feinen Rhombengitter der App (E_fein = 3 X Y): dafuer fehlt die Auslassregel im Prototyp.
