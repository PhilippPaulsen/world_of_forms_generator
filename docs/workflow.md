# Workflow: Entwicklung, Sync, Veröffentlichung

Stand: 2026-11-26 (Tasks 133 bis 142). Ergänzt `docs/agent-rules.md` (die verbindlichen Regeln) und `CLAUDE.md`.

## Repos und Rollen
- **`world_of_forms_generator`** (dieses Repo): kanonischer Generator ("Studio"), eigene GitHub-Pages-Seite. Features nur hier.
- **`die-welt-der-formen`** (Website): Startseite, Editionen, About. `studio/` ist eine **erzeugte Kopie** des Generators (`tools/sync-studio.sh`), nie von Hand ändern. `studio-site/` ist website-eigen (Menü und Sprachschalter im Studio, ein Haken im Sync, siehe unten). `p5_prototype/` ist ein ungenutzter Rest (von keiner Seite geladen), `notebooks/p5.min.js` gehört den Notebooks.
- **Backups und Alt-Klone:** `~/Documents/flip/_F4-backup-2026-11-25` (Mirror, Commit-Maps `gen-A/gen-B.commit-map.txt`), `*.PRE-F4` (Klone vor der Historienbereinigung, mit den alten Hashes).

## Entwickeln
1. Aufgabe `tasks/NNN-*.md`, Branch `task/NNN-name`; für Parallelarbeit ein Worktree: `git worktree add ../world_of_forms_generator-taskNNN-name -b task/NNN-name main`.
2. Kleine Commits, ein Thema je Commit, Trailer `Co-Authored-By`. `?v=` gemeinsam in `index.html`, `gallery.html`, `color-harmony/ui/index.html` erhöhen; Form `YYYYMMDD` plus **nur Buchstaben** (z. B. `20270108moden`), sonst schlägt `tools/color/test-esm-cachebust.js` fehl.
3. Oberfläche in zwei Ansichten ("Einfach" / "Erweitert", Plus-Button in der Kopfleiste): `data-level="advanced"` im Markup, die Liste steht in `tools/ui/test-mode-markup.js`. Tests und Messskripte laden mit `?mode=advanced`, sonst verschiebt der Standard neuer Besucher (einfach) alle Messwerte. Details: `docs/claude-context.md` ("The interface mode").
4. Sprache: `?lang=en|de` (Standard Deutsch), Wörterbuch `ui-i18n.js`. Die Session ignoriert `lang` (`core/session-store.js`), ein Sprachwechsel ist ein Neuladen mit anderem `?lang=` und behält die Arbeit.
5. Vorschau: `.claude/launch.json` (außerhalb der Repos, in `The World of Forms/`): 8420 Generator, 8421 Worktree, 8430 Website.

## Prüfen
- `tools/proof.sh L0|L1` nach jedem Commit; **L2 vor dem Merge** (ca. 25 Minuten, die langsamen Feldnetz-Tests brauchen mehrere Minuten); L3 nur auf Anweisung. Auf einem sauberen Baum.
- **Pins gegen alte Commits:** viele Tests vergleichen Dateien mit einem historischen Stand (`git show <hash>:…`, `git diff <hash>`). Ändert ein Task eine so gepinnte Datei, wird der Pin im **selben** Task nachgezogen ("pinned against X (was Y)") oder die Ausnahme eingetragen (`f !== 'datei.js' /* task NNN */`). Fehlt der Pin-Commit, **überspringen** manche Tests ihre Prüfung stillschweigend; das hat bis Task 142 Regressionen verdeckt.
- **Hashes nach F4:** alle Commit-Hashes wurden neu geschrieben. `tools/dev/remap-hashes.py --map "$BK/gen-B.commit-map.txt"` schreibt alte 8-stellige Hashes in `tools/**/*.js` auf die neuen um (nie `baseline-*.json`, Reports, Docs). Idempotent.
- **Layout-Baselines:** nie ändern. Vergleich **main gegen Branch** in derselben Umgebung (`tools/ui/record-baseline.js`, `compare-baseline.js`), Ziel 0 Unterschiede im erweiterten Modus. Gegen die eingecheckte `baseline-netzart-13.json` weicht schon unveränderter main um 105 Rechtecke ab (Schrift-Umgebung).
- **Website:** `node tools/test-no-suisse-fonts.cjs`, `node tools/test-start-page.cjs`, `node tools/test-site-nav.cjs`.
- **Browser** (Chromium-Pane): Konsole leer, SuisseIntl geladen, Breiten 320/360/375/430/768/1280, DE und EN. Safari, iPhone, Firefox und Screenreader **von Hand**.

## Studio in die Website bringen (Sync)
1. Generator-Branch lokal nach `main` mergen (`--no-ff`).
2. Website: Branch `task/NNN-studio-sync`; `tools/sync-studio.sh main --dry-run` **zeigen**, dann ohne `--dry-run`; Commit "studio/ = copy of world_of_forms_generator @ <sha>".
3. Das Skript (Version 3) kopiert nur die Allowlist, prüft Schriften (nie kopieren), lokale Referenzen und Pflichtdateien (`ui-mode.js` u. a.) und fügt in die **Kopie** von `index.html` genau eine Zeile ein: `<script src="../studio-site/site-nav.js" defer data-site-hook></script>`. Der Generator-Quelltext kennt die Website nicht. `studio/SYNC.md` nennt Quell-SHA und Haken.
4. Das Studio-Menü (`studio-site/site-nav.js/.css`): Ring-Button mit drei Linien links neben Plus (ab 375 px; darunter im Hilfe-Overlay), Links Start/Studio/Harmony/World/About in der Studio-Sprache, `EN | DE` per Neuladen. Von der Website tragen alle Studio-Links `?lang=en` bzw. `?lang=de`.
5. Website-Merge nach `main` lokal.

## Veröffentlichen (nur mit ausdrücklicher Freigabe, eigener Auftrag)
1. `git status` sauber, SHAs nennen, `test-no-suisse-fonts.cjs`, `git ls-files | grep -i suisse` (nur Lizenzdatei und Tests).
2. `git push origin main` im Generator, danach im Website-Repo. Keine Tags, kein Force, Branches nicht pushen.
3. Live prüfen: `/studio/` 200, `/studio/SYNC.md` nennt die Quell-SHA, Konsole leer, Schriften `loaded`, Plus- und Menü-Button, Startseite (Einstieg `studio/?lang=…`), Generator-Pages.
4. Branches und Worktrees nicht löschen, bis Philipp es sagt.
- **Soft-Launch:** `robots.txt` der Website enthält `Disallow: /studio/`, bis Philipp den Soft-Launch freigibt (dann die Zeile entfernen).

## Bekannte Schulden
- Farborgel: "Nächster Farbton" ändert nur die Code-Anzeige des Steppers, nicht die aktive Komposition (Backlog).
- Formorgel (`gallery.html`) nur englisch; Farborgel hat eine eigene Sprachwahl (folgt `?lang=en` beim Öffnen, ein Wechsel im Studio danach nicht).
- "Neu anfangen" (nur erweitert) setzt den Modus auf den Standard neuer Besucher zurück (einfach).
- Nicht in Safari, Firefox, mit Screenreader oder auf einem echten Telefon geprüft.
- Das Hilfe-Overlay hat nur in der Kopfzeile "Close" englisch (Rest über das Wörterbuch).
