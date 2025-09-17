# 🌐 Raumharmonik – Welt der Formen

Ein exploratives, interaktives 3D-Projekt zur Umsetzung von Wilhelm Ostwalds Idee einer „Welt der Formen“. Ziel ist es, geometrische Strukturen im Raum zu erzeugen, zu analysieren und durch Symmetrieoperationen zu vervielfältigen – als Grundlage einer raumästhetischen Ordnung.

## 🎯 Zielsetzung

- Interaktive Konstruktion geometrischer Formen im Raum  
- Anwendung von Symmetrieoperationen (Reflexion, Rotation, Translation, Inversion, Schraubung, Rotospiegelung)  
- Visualisierung geschlossener Linien, Flächen und Volumina  
- Untersuchung ästhetischer und strukturierender Prinzipien im Sinne Ostwalds

---

## 🛠️ Aktueller Funktionsumfang

- ✅ Orthografische 3D-Kamera mit OrbitControls  
- ✅ Rasterisierter Raumwürfel mit einstellbarer Teilung  
- ✅ Platzierung von Punkten per Klick auf das Raster  
- ✅ Verbinden von Punkten zu Linien  
- ✅ Rückgängig/Wiederholen (Undo/Redo)  
- ✅ Symmetrieoperationen:
  - Spiegelung an XY, YZ, ZX  
  - Rotation um X, Y, Z (auch kombiniert)  
  - Translation in x/y/z-Richtung (repetitiv)  
  - Inversion durch Ursprung  
  - Rotationsspiegelung (Rotoreflektion)  
  - Schraubsymmetrie (Rotation + Translation)  
- ✅ Zufallsgenerator für neue Linienkonfigurationen  
- ✅ Presets: Würfelrahmen, Tetraeder, Diagonalkreuz, Stern  
- ✅ Automatische Erkennung geschlossener Flächen (Dreiecke) und Volumina (Tetraeder)  
- ✅ Rendering von Linien, Flächen und Volumen mit transparentem Shading

---

## 🔄 Geplante Features (nächste Schritte)

### 1. **Erweiterung des Form-Generators**
- [ ] Optionale **automatische Flächen- und Volumenschließung**
- [ ] Möglichkeit, **Flächen manuell zu definieren**
- [ ] **Kurvige Formen** (Bézier, Splines)

### 2. **Ästhetische Kontrolle & Analyse**
- [ ] Farbcodierung nach Symmetrie, Regelmäßigkeit
- [ ] Exportfunktionen (PNG, SVG, GLB)
- [ ] „Ästhetik-Modus“ nach Ostwald

### 3. **Interaktion & UI**
- [ ] Tastenkürzel für zentrale Aktionen
- [ ] Vorschau visueller Transformationen
- [ ] Interaktive Punkte-Highlights

---

## 📁 Projektstruktur (Kurzüberblick)

raumharmonik/
├── public/
│   └── index.html
├── src/
│   ├── RaumharmonikApp.js
│   ├── SymmetryEngine.js
│   └── styles.css
├── README.md
└── package.json

---

## 📚 Bezug zu Wilhelm Ostwald

Wilhelm Ostwalds Vision einer „Welt der Formen“ basiert auf der Idee, dass Ordnung, Regelmäßigkeit und Symmetrie eine universale ästhetische und wissenschaftliche Relevanz besitzen. Dieses Projekt versucht, diese Konzepte **nicht nur visuell darzustellen**, sondern **strukturierbar und explorativ erfahrbar** zu machen.

---

## 🧭 Langfristige Vision

- Aufbau einer offenen **Form-Datenbank**  
- Klassifikation von Formtypen  
- Veröffentlichung als **Lehr- und Analysewerkzeug** für Kunst, Gestaltung, Mathematik, Philosophie