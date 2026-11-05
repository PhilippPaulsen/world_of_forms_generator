# 002 proof.sh: knappe Ausgabe und Cache
Stufe: L1
Basis: main, neuer Branch task/002-proof-ausgabe-cache; git status muss leer sein (sonst STOP)

Ziel (nur tools/proof.sh, docs/agent-rules.md, Claude.md, tasks/, reports/):
1. proof.sh druckt standardmäßig nur: Fehlzeilen (FAILED), die zwei geschützten Tests mit
   Zahl (61, 57), am Ende "files: N" und "overall (Lx): PASS|FAIL". Die volle Zeile pro Datei
   steht nur in reports/logs/NNN-summary.txt. Mit Umgebungsvariable VERBOSE=1 wie bisher.
2. Nach PASS bei L2 oder L3 auf sauberem Baum (git status --short leer, ohne ignorierte Dateien)
   schreibt proof.sh reports/last-green.json: {"commit":"<HEAD>","level":"L2|L3","files":N}.
   L3 überschreibt L2, L2 überschreibt kein L3 desselben Commits.
3. reports/last-green.json lokal ausblenden über reports/logs/.gitignore oder .git/info/exclude
   (nicht die Root-.gitignore ändern).
4. docs/agent-rules.md: Regel zur Suite ersetzen. Neu:
   - Zu Beginn: Ist HEAD gleich dem Commit in last-green.json, entfällt der Lauf vor der Änderung.
   - Vor Commit: die in der Aufgabe genannte Stufe, nicht automatisch die volle Suite.
   - L3 nur, wenn die Aufgabe L3 nennt.
   Die bisherige Regel zeigen, bevor du sie änderst (Plan-Schritt).
5. Claude.md bleibt unter 40 Zeilen.

Akzeptanz: proof.sh L1 002 druckt höchstens 8 Zeilen und zeigt 61 und 57;
proof.sh L2 002 druckt höchstens 8 Zeilen, PASS, und last-green.json existiert mit dem HEAD-Commit;
guard.sh grün; VERBOSE=1 zeigt die Zeile pro Datei.
Regeln: sketch.js und core/ unverändert. Kein Push. Vorher Plan in 5 Zeilen zeigen, dann arbeiten.
Bericht in reports/002.md (Status, Commit, diff --stat, Prüfausgabe, Abweichungen).