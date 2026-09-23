# Anweisung für Claude Code

Dieses Repo (`Ryumage/learn-music`) wird zur Lern-Web-App **„Saitenlesen“**: Gitarre lesen lernen (Noten, Griffbrett, Saiten, Akkorde, Tabs, Rhythmus). Sie läuft kostenlos auf GitHub Pages, ist fürs iPhone gemacht und funktioniert offline.

## Deine Aufgabe
1. Lies **`PLAN.md` vollständig**. Das ist die verbindliche Spezifikation.
2. Sieh dir den vorhandenen Code im Repo an. Wenn schon ein Stack oder eine Struktur existiert, baue darauf auf und nenne Abweichungen vom Plan im PR.
3. Setze die **Meilensteine aus Kapitel 9 in Reihenfolge** um, **einen Meilenstein pro PR**. Beginne mit **MS0**, wenn nichts anderes gesagt wird. Hör nach jedem Meilenstein auf und warte auf „Weiter mit MSx“.
4. Jeder Meilenstein ist erst fertig, wenn:
   - alle Unit- und E2E-Tests grün sind,
   - die Abnahmekriterien aus Kapitel 9 erfüllt sind,
   - die App über die GitHub Action auf Pages deploybar ist.
5. Bei offenen Fragen nimm den Default aus Kapitel 11 und vermerke das im PR. Blockiere nicht.

## Regeln
- **Oberfläche komplett auf Deutsch.** Umschaltbar (deutsch/englisch) sind nur die Notennamen. Akkordsymbole bleiben immer international (Bm, B7), wie auf Ultimate Guitar.
- **Musiklogik** (`src/music/`) ist reine, voll getestete Logik. Die Tabellen in Kapitel 4 sind geprüfte Soll-Werte und direkt als Testfälle zu übernehmen.
- **Keine externen Requests zur Laufzeit.** Schriften und Notenglyphen lokal einbinden. Keine Kosten, kein Backend.
- **iPhone zuerst:**
  - Antworten nur über die eigenen Tastaturen, keine `<input>`-Felder.
  - Große Tippflächen.
  - Keine horizontale Scrollleiste auf der Seite.
  - Safe Areas beachten.
- **Gitarre klingt eine Oktave tiefer als notiert.** Abgespielt wird immer die klingende Tonhöhe.

## Material in diesem Paket
- `PLAN.md`: Umsetzungsplan mit Architektur, Datenmodell, Lernlogik, Modulen, UI, Tests und Meilensteinen
- `docs/recherche.md`: Recherchebericht mit Begründungen und Quellen für die Designentscheidungen
- `docs/cheatsheets/*.pdf`: Griffbrett-Cheat-Sheets des Nutzers als Vorlage für die Griffbrett-Ansichten, Saitennamen und den Oktav-Trick

## Hinweis zu GitHub Pages
Im kostenlosen GitHub-Plan funktioniert Pages nur mit **öffentlichen** Repos. Ist das Repo privat, weise den Nutzer im ersten PR darauf hin. Zur Einrichtung: Settings → Pages → Source: GitHub Actions.
