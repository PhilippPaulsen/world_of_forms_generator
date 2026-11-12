# Auftrag 068c1 — Positionsabgleich Lage-Bedienung (nur Bestand und Entwurf)

Du arbeitest read-only, mit genau diesen Ausnahmen: tasks/068c1-positionsabgleich.md und reports/068c1.md anlegen und auf dem Branch task/068c1-positionsabgleich (von main, erwarteter HEAD 578f0ce5) committen. Sonst nur lesende Befehle (git, grep, cat, sed, ls, node nur zur Auswertung ohne Dateischreiben); Browser nur lesend/Screenshots. Kein Merge, kein Push. Regeln: docs/agent-rules.md. Bericht höchstens 50 Zeilen, Datei:Selektor belegt.

**UI-Regel (Auftraggeber):** Keine neuen Bedienelemente bauen, bevor die Position freigegeben ist. Dieser Auftrag liefert nur Bestand und Entwurf.

**Entscheidung des Auftraggebers (aus 068a):** Lage 2 wird per ZWEITEM KLICK auf die bereits aktive Formtaste (Dreieck, Quadrat, Sechseck) gewählt, gekennzeichnet durch einen PUNKT auf der Taste; für die Basis (#nav-shapes, .shape-icon-btn) und für Ebenen (#layer-shape-group, .layer-shape-icon-btn). Zu große Ordnung: Lage 2 gesperrt mit Hinweis. Lagewechsel leert Linien, danach Hinweis. Knotenzahl und v2-Name in der Info-Karte (#info-card), Knotenzahl auch im Hinweis des Ordnungs-Steppers. Reduzierte Symmetrie: Name noch unverändert.

**Aufgabe:**
1. Bestand: Was passiert HEUTE beim Klick auf die bereits aktive Formtaste (Basis und Ebene): Handler, Wirkung (Neuaufbau? Linien gelöscht?), Dateien/Funktionen (sketch.js setup, rebuildGrid, ui-form.js, ui-layer.js). Wie sind Tastenzustände dargestellt (.active, aria-pressed, Punkt .has-state am "Mehr"-Knopf, andere Tasten mit Zweitklick wie der Linien-Button in ui-lines.js und die Farb-Tasten "erneut tippen")? Welche CSS-Mittel für einen Punkt existieren (Größe, Position, Farbe, Fokus/Kontrast), wie sehen sie bei 36 px und 48 px Tasten aus?
2. Entwurf: Aussehen und Position des Punkts auf der Taste (zwei Varianten, mit Maßen bei 36 px und 48 px, ASCII-Skizze), Kennzeichnung für Screenreader (aria-pressed/aria-label/aria-description), Tooltip-Texte de/en ("erneut klicken: Lage 2" / "erneut klicken: Lage 1"), Entdeckbarkeit auf dem Handy (kein Mouseover): Vorschlag (z. B. kurzer Hinweis beim ersten Klick, Info-Karte), Verhalten bei gesperrter Lage 2 (Taste ohne Wirkung? Hinweistext aus ui-i18n.js reason.*, Ton wie bei den Nachbarn), Verhalten beim Wechsel der Form mit Lage 2 (bleibt Lage 2, solange die Ordnung innerhalb des Limits liegt), Ebene: gleiches Muster, Zeitleisten-Ebene gesperrt.
3. Info-Karte: Position von Knotenzahl und Gittername (#pattern-name-group), Tooltip am Ordnungs-Stepper; Texte de/en (Terminologie docs/terminology.md Teil B).
4. Beschriftung "Knoten" -> "Ordnung" im Stepper (#nav-node-stepper, #layer-node-count-group): ALLE betroffenen Texte (ui-i18n.js-Schlüssel node.*, layer.node.*, reason.node.*, Tooltips) mit alt/neu de/en listen; Pin-Tests, die diese Texte lesen.
5. Aufwand (Dateien, Pin-Tests), Risiken, Aufteilung in Bauaufträge (höchstens zwei), offene Fragen an den Auftraggeber (höchstens 3).

Abschluss im Chat: Hash, git status --short, Zeilenzahl.
