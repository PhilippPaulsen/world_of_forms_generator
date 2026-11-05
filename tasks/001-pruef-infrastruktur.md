# 001 Prüf-Infrastruktur
Stufe: L0
Basis: aktueller Branch, git status muss leer sein (sonst STOP)

Ziel (nur Dateien in tools/, docs/, tasks/, reports/, Claude.md):
1. tools/proof.sh L0|L1|L2|L3 NNN: kapselt die beiden Einzeiler aus Claude.md
   (L2 = schnelle Variante, L3 = volle Suite). Schreibt Rohausgaben nach reports/logs/NNN-*.log,
   druckt nur eine Zeile pro Datei plus overall PASS/FAIL. L1 = test-p5-names.js plus die zwei
   geschützten Tests (je eigene Zahl, 61 und 57).
2. tools/guard.sh BASIS-COMMIT: leerer Diff für sketch.js und core/ gegen BASIS-COMMIT.
3. docs/agent-rules.md: die Standardregeln aus Claude.md, einmal, knapp.
4. docs/baselines.md: die Baseline-Historie aus Claude.md (Zeile ca. 76) hierher verschieben.
5. Claude.md auf unter 40 Zeilen kürzen: Verweis auf docs/agent-rules.md und docs/baselines.md,
   nur aktuelle Referenzen (phone-5, cleanup-11) und die Aufnahme-Regeln in 5 Zeilen.

Akzeptanz: tools/proof.sh L1 001 grün mit 61 und 57; tools/proof.sh L2 001 meldet dieselbe
Dateizahl wie der Einzeiler aus Claude.md; guard.sh grün.
Regeln: sketch.js und core/ unverändert. Kein Push. Vorher den Plan in 5 Zeilen zeigen,
dann arbeiten. Bericht in reports/001.md (Status, Commit, diff --stat, Prüfausgabe, Abweichungen).