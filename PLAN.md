# Saitenlesen – Umsetzungsplan

Arbeitstitel „Saitenlesen“. Repo: `Ryumage/learn-music`. Lern-Web-App für Gitarre: Noten lesen, Griffbrett, Saiten, Akkorde, Tabs und Rhythmus. Kostenlos auf GitHub Pages, gemacht fürs iPhone, läuft offline.

Hintergrund und Begründungen stehen im Recherchebericht („Gitarre Noten und Tabs lernen“). Lege ihn als `docs/recherche.md` ins Repo, die beiden Cheat-Sheet-PDFs („Notes on the Fretboard“, Standard View und Student View) nach `docs/cheatsheets/`.

---

## 0. Hinweise für Claude Code

1. **Erst den Bestand lesen.** Wenn im Repo schon Code, ein Framework oder eine Pages-Konfiguration liegt, baue darauf auf und nenne Abweichungen von diesem Plan im PR.
2. **Meilensteine in Reihenfolge** (Kapitel 9). Nach jedem Meilenstein ist die App auf GitHub Pages benutzbar und alle Tests sind grün. Ein Meilenstein = ein PR.
3. **Oberfläche komplett auf Deutsch.** Nur die Notennamen sind umschaltbar (deutsch/englisch).
4. **Musiklogik ist Kern-Code und wird per Unit-Test abgesichert.** Die Tabellen in Kapitel 4 sind geprüfte Soll-Werte und direkt als Testfälle nutzbar.
5. Bei offenen Fragen den Default aus Kapitel 11 nehmen und im PR vermerken, nicht blockieren.

---

## 1. Ziel und Nutzer

- Erwachsener, deutschsprachiger Gitarren-Anfänger. Übt allein, zu Hause und unterwegs, auf dem **iPhone** (Safari, als Home-Bildschirm-App).
- **Keine Kosten:** keine Abos, kein Server, keine externen Dienste zur Laufzeit.
- Fernziel: Songs aus **Ultimate Guitar** spielen, besonders die „Official“-Tabs im Practice-Modus. Dort gibt es: Kopfzeile *Tuning: E A D G B E · Capo: 2nd fret · Key: A*, Tempo ♩ = 100, Taktarten 4/4 und 6/8, Taktnummern, gestapelte Bundzahlen, Bögen mit „H“ (Hammer-on), Haltebögen, Rhythmus-Hälse und -Balken unter dem Tab, Punktierungen, *mf*, Akzente >, „let ring“, Abschnitte (Intro, Verse 1), Songtext.
- Grundidee des Nutzers (Kern von Modul M2): **ein Notensystem mit einer Reihe Zufallsnoten** (ursprünglich ca. 16). Unter jeder Note gibt man den Namen ein. Stehen mehrere Noten übereinander, alle **von oben nach unten**.
- Vorgaben des Nutzers für jedes Modul:
  - **20 Fragen** pro Runde
  - **Prüfen nach jeder Frage**; richtig = **grün**, dann **Weiter**
  - falsch = **Nochmal** oder **Lösung zeigen**, wählbar
  - **Gesamtauswertung** am Ende
  - **Deutsche oder englische Notennamen** umschaltbar

---

## 2. Umfang im Überblick

| # | Modul | Kurzbeschreibung | Priorität |
|---|---|---|---|
| M1 | Saiten & Eselsbrücken | Namen, Nummern, Lage der Leersaiten in Griffbrett, Tab, Diagramm, Notensystem | P1 |
| M2 | Noten lesen | Notenzeile mit Zufallsnoten, auch übereinander; Namen eintippen | P1 (Kernidee) |
| M3 | Noten → Griffbrett | Note im System → Stelle auf dem Griffbrett antippen | P1 |
| M4 | Griffbrett | Markierten Ton benennen · Ton auf Saite finden · alle Stellen finden | P1 |
| M5 | Akkorde | Diagramm → Name · Name → Griff setzen · Name → Töne | P2 |
| M6 | Tabs lesen | Tab-Grundlagen, Zeichen (h p / b ~ x PM), Bögen, gestapelte Akkorde, Capo, H/B-Falle | P2 |
| M7 | Rhythmus | Notenwerte unter dem Tab, Zählen, Schlagmuster, Taktart, Tempo | P2 |
| W | Akkordwechsel-Trainer | 60 s zwischen zwei Akkorden wechseln, Wechsel zählen, Bestwert | P2 |
| – | Tagesübung | Alle heute fälligen Wiederholungen aus allen Modulen | P1 |
| – | Statistik | Trefferquote pro Modul, Griffbrett-Heatmap, Schwachstellen | P2 |

Reihenfolge der Module auf der Startseite = empfohlener Lernweg: M1 → M2 → M3 → M4 → M5 → M6 → M7.

---

## 3. Technik

### 3.1 Stack (falls das Repo noch keinen hat)
- **Vite + TypeScript, ohne UI-Framework.** Die App ist klein, und Vanilla-TS mit SVG-Rendering hält sie schnell und abhängigkeitsarm. Wenn das Repo schon Preact oder React nutzt, das beibehalten.
- **vite-plugin-pwa** (Manifest und Service Worker, `registerType: 'autoUpdate'`, alle Build-Assets vorab cachen). Ziel: nach dem ersten Aufruf voll offline.
- **Vitest** für Unit-Tests, **Playwright** (WebKit, Geräteprofil „iPhone 13“) für End-to-End-Smoke-Tests.
- **GitHub Actions → GitHub Pages** (offizielle Actions `configure-pages`, `upload-pages-artifact`, `deploy-pages`). In `vite.config.ts`: `base: '/learn-music/'`.
- **Keine Laufzeit-Requests nach außen.** Schriften lokal einbinden (z. B. per `@fontsource`):
  - Fließtext: Atkinson Hyperlegible
  - Überschriften: eine charaktervolle Display-Schrift, z. B. Bricolage Grotesque
  - Tabs: Monospace, z. B. IBM Plex Mono
  - Notenschrift: **Noto Music**, auf wenige Glyphen reduziert (fonttools `pyftsubset`, ca. 4 KB). Benötigt werden U+1D120 (Violinschlüssel mit 8 darunter), U+266F ♯, U+266D ♭, U+266E ♮.

### 3.2 Vorgeschlagene Struktur
```
src/
  music/        notes.ts, names.ts, guitar.ts, chords.ts, rhythm.ts   (reine Logik, 100 % getestet)
  learn/        store.ts (Speicher, Leitner), picker.ts (gewichteter Zufall), session.ts (Runde, Fehlerschleife)
  render/       staff.ts, fretboard.ts, chordDiagram.ts, tab.ts, icons.ts   (SVG-Strings)
  input/        noteKeyboard.ts, chordKeyboard.ts, choices.ts, tapTargets.ts
  modules/      strings.ts, staffReading.ts, staffToFret.ts, fretboard.ts, chords.ts, tabs.ts, rhythm.ts
  screens/      home.ts, setup.ts, quiz.ts, summary.ts, stats.ts, settings.ts, chordChanges.ts
  audio/        pluck.ts
  styles/       tokens.css, app.css
tests/unit/     *.test.ts
tests/e2e/      smoke.spec.ts
docs/           recherche.md, cheatsheets/
```

### 3.3 Modul-Schnittstelle
Jedes Modul ist ein Objekt mit:
- `id`, `name`, `desc`, `prefixes` (Präfixe seiner Element-Schlüssel)
- `settings`: Liste von Einstellungen (Typ `choice`, `multi` oder `toggle`, mit Default)
- `count(settings)` → Anzahl Fragen der Runde
- `make(settings, {forced?: string[], recent: string[]})` → **Frage-Objekt**. `forced` erzwingt bestimmte Elemente, gebraucht für Fehlerschleife, Tagesübung und „Fehler üben“.
- `label(key)` → lesbarer Text für Auswertung und Statistik

Frage-Objekt:
- `kind`: eine der Eingabearten `notes` (Notentastatur, Felder), `choice` (Auswahl), `chord` (Akkordtastatur), `tap` (Griffbrett antippen, einzeln oder mehrfach) oder `shape` (Akkordgriff setzen)
- `prompt`, `items` (Element-Schlüssel), `render(state)`
- Prüfdaten je nach Art, `explain(state)` für die Lösung/Herleitung
- `sound` (klingende MIDI-Töne), `hint` (ausklappbare Merkhilfe)

Die **Sitzungs-Engine** ist für alle Module gleich: Ablauf, Prüfen, Nochmal/Lösung, Speichern, Fehlerschleife, Auswertung.

---

## 4. Musik-Datenmodell (Kern)

### 4.1 Töne
- Note = `{letter: 0–6 (C D E F G A B), acc: −2…+2, octave}`. MIDI = `12·(octave+1) + [0,2,4,5,7,9,11][letter] + acc`. Diatonischer Schritt = `octave·7 + letter`. Tonklasse = MIDI mod 12.
- **Gitarre klingt eine Oktave tiefer als notiert.** Violinschlüssel mit kleiner 8 darunter. Notiert = klingend + 12.
- Leersaiten klingend (MIDI):

  | Saite | Name | MIDI |
  |---|---|---|
  | 6 | E | 40 |
  | 5 | A | 45 |
  | 4 | D | 50 |
  | 3 | G | 55 |
  | 2 | H | 59 |
  | 1 | e | 64 |

  Bund f auf Saite s = Leersaite + f.

### 4.2 Namen
**Deutsch**
- Stammtöne: C D E F G A **H**
- Kreuz: +is (Cis, Dis, Eis, Fis, Gis, Ais, His)
- Be: +es (Ces, Des, Fes, Ges), mit den Ausnahmen **Es, As, B** (= englisch B♭)

**Englisch**
- Stammtöne: C D E F G A B
- Vorzeichen: ♯ und ♭ (C♯, B♭)

**Weitere Regeln**
- Tonklassen ohne Schreibweise (Griffbrett, Tab) werden mit beiden Namen angezeigt: „Cis/Des“ bzw. „C♯/D♭“.
- **Akkordsymbole bleiben immer international**, genau wie auf Ultimate Guitar: `Bm`, `B7`, `Bb`, `F#m`, mit ASCII `#` und `b`. Im Deutsch-Modus steht zusätzlich die deutsche Aussprache dabei:
  - Dur: Grundton + „-Dur“ (G-Dur, B-Dur)
  - Moll: Grundton klein + „-Moll“ (a-Moll, **h-Moll** für Bm, fis-Moll)
  - sonst Grundton + Zusatz (**H7** für B7)
- Deutsche Oktavschreibweise der Leersaiten (nur Erklärtext): **E A d g h e'**

### 4.3 Antworten vergleichen
- **Notensystem (M2, M3):** exakte Schreibweise. Buchstabe und Vorzeichen müssen stimmen, denn die Position im System bestimmt den Buchstaben.
- **Griffbrett, Tab, Akkordtöne:** nur die Tonklasse zählt. Cis und Des sind beide richtig.
- Eingabe per eigener Notentastatur, nie per Freitext. Damit gibt es keine Tippfehler oder Groß-/Kleinschreibungs-Probleme.

### 4.4 Lage im Notensystem – Soll-Werte (Unit-Test)
Beschreibung relativ zur untersten Linie (e'). Spalte „Gitarre“ = Stelle in der 1. Lage (Bund 0–4).

| notiert | Beschreibung | Gitarre (1. Lage) |
|---|---|---|
| E3 | unter der 3. Hilfslinie unten | tiefe E-Saite leer |
| F3 | 3. Hilfslinie unten | tiefe E-Saite, 1. Bund |
| G3 | unter der 2. Hilfslinie unten | tiefe E-Saite, 3. Bund |
| A3 | 2. Hilfslinie unten | A-Saite leer |
| B3 (H) | unter der 1. Hilfslinie unten | A-Saite, 2. Bund |
| C4 | 1. Hilfslinie unten | A-Saite, 3. Bund |
| D4 | direkt unter dem System | D-Saite leer |
| E4 | 1. Linie | D-Saite, 2. Bund |
| F4 | 1. Zwischenraum | D-Saite, 3. Bund |
| G4 | 2. Linie | G-Saite leer |
| A4 | 2. Zwischenraum | G-Saite, 2. Bund |
| B4 (H) | 3. Linie | H-Saite leer (oder G-Saite, 4. Bund) |
| C5 | 3. Zwischenraum | H-Saite, 1. Bund |
| D5 | 4. Linie | H-Saite, 3. Bund |
| E5 | 4. Zwischenraum | hohe E-Saite leer |
| F5 | 5. Linie | hohe E-Saite, 1. Bund |
| G5 | direkt über dem System | hohe E-Saite, 3. Bund |
| A5 | 1. Hilfslinie oben | (ab 5. Bund) |
| C6 | 2. Hilfslinie oben | |
| E6 | 3. Hilfslinie oben | hohe E-Saite, 12. Bund |

### 4.5 Herleitung am Griffbrett (Lösungsweg)
- Beispiel: „A-Saite, 3. Bund: A → Ais/B → H → C“.
- Ab dem 12. Bund: „12. Bund = Oktave der Leersaite“, dann weiterzählen.
- Grundregel für Erklärtexte: 1 Bund = 1 Halbton. Halbtonschritte ohne Vorzeichen gibt es nur bei E–F und H–C.

### 4.6 Akkorde (geprüft: Griff-Töne = Akkordformel)
Griffe von der tiefen E- zur hohen e-Saite, `x` = nicht spielen. Fingersätze sind nur Empfehlungen.

| Set | Symbol | Griff | Finger | Töne (deutsch) |
|---|---|---|---|---|
| basic | A | x02220 | x01230 | A Cis E |
| basic | D | xx0232 | xx0132 | D Fis A |
| basic | E | 022100 | 023100 | E Gis H |
| basic | Am | x02210 | x02310 | A C E |
| basic | Em | 022000 | 023000 | E G H |
| basic | Dm | xx0231 | xx0231 | D F A |
| basic | G | 320003 | 210003 | G H D |
| basic | C | x32010 | x32010 | C E G |
| plus | F (klein) | xx3211 | xx3211 | F A C |
| plus | Fmaj7 | xx3210 | xx3210 | F A C E |
| plus | Cadd9 | x32030 | – | C E G D |
| plus | Dsus4 | xx0233 | xx0134 | D G A |
| plus | Dsus2 | xx0230 | xx0130 | D E A |
| plus | Asus2 | x02200 | x01200 | A H E |
| plus | Asus4 | x02230 | – | A D E |
| plus | Em7 | 022030 | – | E G H D |
| plus | Am7 | x02010 | x02010 | A C E G |
| plus | Cmaj7 | x32000 | x32000 | C E G H |
| seven | E7 | 020100 | 020100 | E Gis H D |
| seven | A7 | x02020 | x02030 | A Cis E G |
| seven | D7 | xx0212 | xx0213 | D Fis A C |
| seven | G7 | 320001 | 320001 | G H D F |
| seven | C7 | x32310 | x32410 | C E (G) B – **Quinte fehlt im Griff** |
| seven | B7 (= H7) | x21202 | x21304 | H Dis Fis A |
| barre | F (Barré) | 133211 | 134211 | F A C |
| barre | Bm (= h-Moll) | x24432 | x13421 | H D Fis |
| barre | E5 | 022xxx | 013xxx | E H |
| barre | A5 | x022xx | x013xx | A E |

Akkordformeln (Halbtöne über dem Grundton):

| Zusatz | Formel |
|---|---|
| Dur | 0 4 7 |
| m | 0 3 7 |
| 7 | 0 4 7 10 |
| m7 | 0 3 7 10 |
| maj7 | 0 4 7 11 |
| sus2 | 0 2 7 |
| sus4 | 0 5 7 |
| add9 | 0 4 7 14 |
| 5 | 0 7 |

Unit-Test: Für jeden Griff sind die Tonklassen gleich der Formel. **Ausnahme: Bei Septakkorden darf die Quinte fehlen** (C7).

**Capo:** Kapodaster im Bund k hebt alles um k Halbtöne. Klingender Grundton = (Griff-Grundton + k) mod 12, geschrieben wie auf UG üblich: C C# D Eb E F F# G Ab A Bb B.
- Soll-Werte: G + Capo 2 = A · C + Capo 2 = D · Em + Capo 3 = Gm.
- „Welcher Bund?“ = (Ziel − Griff) mod 12.

---

## 5. Lernlogik

### 5.1 Ablauf einer Frage (für alle Module gleich)
```
Antworten ──[Prüfen]──► richtig ──► grün + kurze Erklärung + Ton ──[Weiter]──►
                    └─► falsch (1. Versuch) ──► rot + [Nochmal] [Lösung zeigen]
                                  [Nochmal] ──► richtige Teile bleiben gesperrt, falsche werden geleert ──► Antworten
                                  2. Versuch falsch oder [Lösung zeigen] ──► Lösung + Herleitung + Ton ──[Weiter]──►
```
- „Prüfen“ ist erst aktiv, wenn die Antwort vollständig ist (alle Felder, eine Auswahl, mindestens ein Tipp).
- **„Nochmal“ gibt es genau einmal.** Die Recherche zeigt: Selbst weiterprobieren und Lösung ansehen führen zum gleichen Lernerfolg, solange keine Endlosschleife entsteht.
- Bei Mehrfach-Antworten wird jedes Teil einzeln grün oder rot markiert (z. B. jede Note einer Zeile).
- Bei falscher Antwort sagt die Rückmeldung konkret, was getippt wurde. Beispiel: „Das war Cis (A-Saite, 4. Bund).“
- Tastatur (Desktop): Enter = Hauptknopf, Buchstaben = Noten, `#` bzw. `+` = ♯, `-` = ♭, Backspace = löschen, 1–9 = Auswahl.

### 5.2 Fehlerschleife in der Runde
- Elemente, die im 1. Versuch falsch waren, kommen **einmal** etwa 4 Fragen später wieder, mit Hinweis „Wiederholung“.
- Wiederholungen zählen nicht zur Punktzahl der Runde. Sie werden in der Auswertung aber separat gezeigt.

### 5.3 Wiederholung über Tage (Leitner)
- Gespeichert pro **Element** (eine Note, ein Bund, ein Akkord, eine Wissensfrage):
  - `n` Antworten, `c` richtig, `w` falsch
  - `box` 0–5, `due` (Zeitstempel)
  - `t` letzte Antwortzeit in ms, `last`
- Gewertet wird **nur der erste Versuch** pro Frage.
- **Richtig und fällig (oder neu):** `box + 1`, fällig in `[–, 1, 3, 7, 14, 30]` Tagen. Stichtag ist der Tagesbeginn plus 3 h, damit „morgen früh“ fällig ist.
- **Richtig, aber nicht fällig:** keine Änderung. Das verhindert, dass mehrfaches Üben am selben Tag die Box hochtreibt.
- **Falsch:** `box = 0`, sofort fällig.
- **Tagesübung** (Startseite): alle fälligen Elemente aus allen Modulen, maximal 20 Fragen, gemischt. Pro Frage gilt das Einstellungs-Set des jeweiligen Moduls. In M2 werden fällige Noten zu Zeilen gebündelt.
- Startseite zeigt: **„Heute fällig: N“**, Tagesziel (Default 20 Antworten, als Fortschrittsbalken) und „X Tage in Folge“.

### 5.4 Auswahl der Fragen
Gewichteter Zufall über die erlaubten Elemente:

| Zustand | Gewicht |
|---|---|
| neu | 1,3 |
| fällig | +3 |
| nicht fällig | +0,5 |
| Fehlerquote | +3 · (w + 0,5) / (n + 1) |
| langsam (> 7 s) | +0,6 |
| unter den letzten 2 Elementen | × 0,03 |

Die letzte Zeile verhindert direkte Wiederholungen („dieselben zwei Noten 20-mal“ ist eine dokumentierte Beschwerde über Fretonomy).

### 5.5 Gesamtauswertung (am Ende jeder Runde)
- Ring mit Prozent und „X von N Fragen auf Anhieb richtig“, dazu ein Satz Einordnung
- Kennzahlen:
  - Einzelelemente richtig/gesamt (z. B. Noten in M2)
  - Wiederholungen richtig
  - Dauer
  - Tage in Folge
- **Fehlerliste** mit korrekter Antwort (z. B. „A · 2. Hilfslinie unten“, „A-Saite 3. Bund = C“)
- M4: **Griffbrett-Heatmap** (Bund 0–12, Farbe = Trefferquote). M2/M3: schwächste Noten.
- Knöpfe: **Fehler üben** (neue Runde nur aus den Fehlern), **Neue Runde**, **Zur Übersicht**
- Abbrechen während der Runde: Rückfrage direkt in der Seite (kein `confirm()`), bisherige Antworten bleiben gespeichert.

### 5.6 Speicherung
- `localStorage`, ein Schlüssel, JSON mit Versionsfeld. Enthält:
  - globale Einstellungen
  - Einstellungen pro Modul (werden gemerkt!)
  - Element-Statistik
  - Antworten pro Tag
  - Bestwerte des Wechseltrainers
- **Export:** „Lernstand kopieren“ (Zwischenablage) und „Als Datei sichern“ (.json). **Import:** Text einfügen. **Löschen:** zweistufig („Wirklich alles löschen?“).
- Hinweis in der App: Safari löscht Website-Daten nach 7 Tagen ohne Besuch. **Als Home-Bildschirm-App ist das nicht der Fall.** Auf iOS in Safari (nicht standalone) daher einen dezenten Installationshinweis zeigen.

### 5.7 Statistik-Seite
Enthält:
- Gesamt-Antworten, heute, Serie, fällig
- Tabelle pro Modul (Trefferquote, Antworten, fällig)
- Griffbrett-Heatmap, gespeist aus M4 und den Tab-Noten aus M6
- Top 10 Schwachstellen mit Balken

---

## 6. Module im Detail

Für alle Module gilt: Default **20 Fragen**, wählbar 10/20/(30). Einstellungen sind Chips auf einer Startseite pro Modul, mit „Los geht’s“ und „Nur fällige üben (N)“.

### M1 – Saiten & Eselsbrücken
Element-Schlüssel `str:<typ>:<saite>`.

| Typ | Frage | Darstellung | Eingabe |
|---|---|---|---|
| name | „Wie heißt die 5. Saite?“ | Griffbrett 0–3, Saiten nummeriert, gefragte Saite hervorgehoben | Notentastatur, 1 Feld |
| num | „Welche Nummer hat die G-Saite?“ | Griffbrett mit Namen, Saite hervorgehoben | Auswahl 1–6 („1. Saite (hohe E-Saite)“ …) |
| all up / down | „Nenne alle Saiten von tief nach hoch“ (bzw. umgekehrt) | – | 6 Felder, beschriftet 6.–1. |
| tab | „Welche Saite ist die markierte Tab-Linie?“ | Tab mit hervorgehobener Linie | Notentastatur |
| dia | „Welche Saite ist im Akkorddiagramm markiert?“ | leeres Diagramm, eine Saite hervorgehoben, ohne Namen | Notentastatur |
| staff | „Diese Note ist eine Leersaite. Welche?“ | Notensystem mit notierter Leersaite | Auswahl 1–6 |

**Eselsbrücken** werden nach jeder Antwort gezeigt, zufällig aus der Liste. Die Anfangsbuchstaben sind hervorgehoben.

Deutsch, tief → hoch (E A D G H E):
- „Ein Anfänger der Gitarre habe Eifer“
- „Eine alte dumme Gans hat Eier“
- „Eine alte Dame ging Hering essen“
- „Eine alte deutsche Gitarre hält ewig“
- „Eine alte Dame geht heute einkaufen“

Deutsch, hoch → tief (e H G D A E):
- „Ein hungriger Gitarrist darf alles essen“
- „Emil half gestern dem alten Esel“

Englisch-Modus:
- tief → hoch: „Eddie ate dynamite, good bye Eddie“, „Even after dinner giant boys eat“ (aus dem Cheat Sheet)
- hoch → tief: „Every boy gets dinner at eight“

Erklärtexte:
- Die dünnste Saite ist Nr. 1.
- Im **Tab ist oben die hohe e-Saite** (beim Spielen die Saite, die dem Boden am nächsten ist).
- Im **Akkorddiagramm ist links die tiefe E-Saite**.

### M2 – Noten lesen (Notenzeile) – Kernidee des Nutzers
Element-Schlüssel `staff:<Note>` (z. B. `staff:F#4`).

**Einstellungen**
- **Stufe** 1–7, Default 1
- **Noten pro Zeile** 4/8/12/16, Default **8**
- **Noten übereinander** an/aus, Default an, wirkt ab Stufe 3
- **Anordnung:** Zufall oder Melodie (kleine Schritte)
- **Zeilen pro Runde** 3/5/10/20, Default **5**

Warum nicht 16 Noten × 20 Zeilen: Das wären 320 Eingaben. Die Recherche empfiehlt kurze Runden und anfangs 4–8 Noten pro Zeile. 16 bleibt als Einstellung.

**Stufen** (notierte Tonhöhe; Stufen 1–4 folgen der Reihenfolge klassischer Gitarrenschulen wie Werner, 5–7 sind eigene Fortsetzung):

| Stufe | Inhalt | Töne (notiert) | max. Bund |
|---|---|---|---|
| 1 | Leersaiten G, H, E | G4 B4 E5 | 4 |
| 2 | Saiten 1–2: E F G · H C D | G4 B4 C5 D5 E5 F5 G5 | 4 |
| 3 | + G-Saite: G A | G4 … G5 Stammtöne | 4 |
| 4 | Alle Saiten, 1. Lage (Hilfslinien unten) | E3 … G5 Stammtöne | 4 |
| 5 | 1. Lage mit ♯ und ♭ | MIDI 52–80 chromatisch, jede schwarze Taste als ♯- **und** ♭-Variante | 4 |
| 6 | Bis 12. Bund (Hilfslinien oben) | E3 … E6 Stammtöne | 12 |
| 7 | Bis 12. Bund mit ♯ und ♭ | MIDI 52–88 chromatisch | 12 |

Stufenbeschriftung im Englisch-Modus mit B statt H.

**Übereinanderstehende Noten** (Zwei- und Dreiklänge)
- Etwa 30 % der Spalten; 2 Töne (70 %) oder 3 Töne.
- Abstand zwischen zwei Tönen mindestens eine Terz (≥ 2 diatonische Schritte, sonst kollidieren die Notenköpfe) und höchstens eine Dezime.
- **Auf der Gitarre greifbar:** jeder Ton auf einer eigenen Saite, alle im erlaubten Bundbereich der Stufe, gegriffene Bünde höchstens 3 auseinander. Per Backtracking prüfen.
- Eingabe von **oben nach unten** (passt zur Tab-Logik).

**Darstellung**
- Violinschlüssel mit 8 (U+1D120), ganze Noten (hohl), Hilfslinien, Vorzeichen versetzt, wenn sie sich überlappen.
- Zeilen umbrechen je nach Breite. Richtwert: Linienabstand ≥ 9,5 px auf dem iPhone, bei 375 px Breite also 8 Noten pro System.
- Direkt unter jeder Notenspalte stehen die Eingabefelder, übereinander bei Mehrklängen.
- Das aktive Feld und die zugehörige Note sind farbig hervorgehoben. Tippen auf eine Note wählt ihr Feld.

**Prüfen**
- Jede Note einzeln grün oder rot. „Nochmal“ leert nur die roten.
- Die Lösung zeigt pro falscher Note: Name · Lage („2. Hilfslinie unten“) · wo auf der Gitarre („A-Saite leer“).
- Nach dem Prüfen: Tippen auf eine Note spielt sie ab.

**Merkhilfe** (ausklappbar)
- Deutsch: Linien E G H D F – „Es geht hurtig durch Fleiß“. Zwischenräume F A C E – „Fritz aß Citronen-Eis“.
- Englisch: Linien E G B D F – „Every good boy does fine“. Zwischenräume F A C E.
- Leersaiten als Orientierungsnoten:

  | Leersaite | Lage im System |
  |---|---|
  | tiefes E | unter der 3. Hilfslinie |
  | A | auf der 2. Hilfslinie |
  | D | direkt unter dem System |
  | G | 2. Linie |
  | H | Mittellinie |
  | hohes E | oberster Zwischenraum |

### M3 – Noten → Griffbrett
Element-Schlüssel `read:<Note>`.
- **Einstellungen:** Stufe wie M2.
- **Frage:** eine Note im System, darunter ein Griffbrett-Ausschnitt. In der 1. Lage Bund 0–5, sonst ein 8-Bund-Fenster um eine gültige Stelle. „Tippe die Stelle an.“
- **Richtig ist jede Stelle mit exakt der klingenden Tonhöhe.** Gleicher Ton in anderer Oktave: eigene Meldung „richtiger Ton, falsche Oktave – Gitarre klingt eine Oktave tiefer als notiert“.
- **Nach dem Prüfen:** alle Stellen im Fenster anzeigen, weitere außerhalb als Text.

### M4 – Griffbrett
Element-Schlüssel `fret:s:f` (benennen), `find:s:f` (auf Saite finden), `fall:<Tonklasse>` (alle finden).

**Einstellungen**
- **Aufgabe:** benennen / auf einer Saite finden / alle Stellen finden / gemischt
- **Saiten:** Mehrfachauswahl, Default **6 + 5**. Das Cheat Sheet empfiehlt, mit tiefer E- und A-Saite zu beginnen.
- **Bünde:** 0–4 (Default) / 0–7 / 5–12 / 0–12
- **Mit ♯/♭:** an/aus, Default aus
- **Punkte beim Benennen:** 1 oder 2–4 (nummeriert, jede Saite höchstens einmal, alle im Fenster)

**Fragetypen**
- **Benennen:** Punkt(e) markiert → Notentastatur. Vergleich nach Tonklasse, beide Namen gültig. Lösung mit Herleitung (4.5).
- **Finden:** „Tippe Cis/Des auf der A-Saite.“ Andere Saiten sind abgedunkelt und nicht tippbar.
- **Alle finden:** Mehrfachauswahl (nochmal tippen hebt die Auswahl auf), nur auf den gewählten Saiten, 8-Bund-Fenster. Rückmeldung „3 von 4 gefunden, 1 falsch getippt“.

**Griffbrett-Zeichnung**
- Höchstens 8 Bünde pro Ansicht, als Fenster innerhalb des gewählten Bereichs. Sonst werden die Tippflächen auf dem iPhone zu klein.
- Bundnummern oben, Einlagen bei 3 5 7 9 (12 doppelt) 15 17 19 21.
- Leersaiten-Spalte links vom Sattel.
- Umwicklung der tiefen Saiten farblich abgesetzt.
- **Zwei Ansichten wie in den Cheat Sheets** (globale Einstellung):
  - „Tiefe E-Saite unten“ (Standard View, wie Tabs, Sattel links)
  - „Tiefe E-Saite oben“ (Student View, Spieler-Sicht, Sattel rechts)

**Merkhilfe „Oktav-Trick“** (aus dem Cheat Sheet)
- Von der tiefen E- und A-Saite: 2 Saiten höher, 2 Bünde weiter.
- Von der D- und G-Saite: 2 Saiten höher, 3 Bünde weiter.
- Von der H-Saite: 3 Saiten tiefer (A-Saite), 2 Bünde weiter.
- 12. Bund = Oktave der Leersaite.

### M5 – Akkorde
Element-Schlüssel `chn:<id>` (Diagramm → Name), `chs:<id>` (Griff setzen), `cht:<id>` (Töne).

**Einstellungen**
- **Akkord-Sets:** 8 Grundakkorde (Default) / plus / seven / barre. Tabelle 4.6.
- **Aufgabe:** eine der drei oder gemischt.

**Lernreihenfolge** (JustinGuitar): A, D → E → Am, Em → Dm → C, G → F/Fmaj7 → sus/7. G ist laut Chordonomicon (rund 680.000 Songs von Ultimate Guitar) der häufigste Akkord. G und C machen zusammen rund 24 % aller Akkorde aus.

**Diagramm → Name**
- Senkrechtes Diagramm, **tiefe E-Saite links**, × und ○ über dem Sattel, Fingernummern in den Punkten, Barré als Balken, „3fr“ bei höheren Lagen.
- Eingabe per **Akkordtastatur:**
  - Grundton C D E F G A B; im Deutsch-Modus steht unter B klein „= H“
  - Vorzeichen `#` und `b`
  - Zusätze: Dur, m, 7, m7, maj7, sus2, sus4, add9, 5
- Prüfung: Grundton-Tonklasse und Zusatz.

**Name → Griff setzen**
- Editierbares Diagramm (5 Bünde). Tippen in eine Zelle setzt oder entfernt den Punkt, tippen über dem Sattel wechselt ○/×. Start: alle Saiten leer (○).
- Unter dem Diagramm stehen live die Tonnamen jeder Saite.
- Prüfung über **Tonklassen:** alle Akkordtöne vorhanden, keine fremden. Bei Septakkorden darf die Quinte fehlen. Mindestens 3 gespielte Saiten (Powerchord: 2).
- Andere Griffvarianten zählen als richtig. Ist der Basston nicht der Grundton: richtig, mit Hinweis „Umkehrung“.
- Die Lösung zeigt den Standardgriff.

**Name → Töne**
- Felder = Anzahl der Akkordtöne, Reihenfolge egal, Vergleich nach Tonklasse.

**Erklärtext** immer mit:
- Formel in Worten („Moll-Dreiklang: Grundton, kleine Terz, Quinte“)
- Töne
- deutsche Aussprache
- bei B-Akkorden die **H/B-Falle:** „Auf Ultimate Guitar steht B7, auf Deutsch sagt man H7.“

### M6 – Tabs lesen (Ultimate Guitar)
Element-Schlüssel `tab:<typ>:…`.

**Einstellungen:** Themen (Mehrfachauswahl) Grundlagen / Spieltechniken / Akkorde & Capo.

**Grundlagen**

| Typ | Frage | Eingabe |
|---|---|---|
| line | Markierte Tab-Linie → welche Saite? | Auswahl 1–6 |
| note | Kurzes Riff auf einer Saite, eine Zahl markiert (Bund 0–7) → welcher Ton? | Notentastatur, Tonklasse, mit Herleitung |
| Wissen | Senkrechte Striche = **Taktstriche** (nicht Bünde – das steht sogar auf manchen deutschen Seiten falsch) · 0 = Leersaite · übereinander = gleichzeitig · oberste Linie = hohe e-Saite · Zahl = Bund, nicht Finger | Auswahl mit 4 Optionen |

**Spieltechniken**

Zeichen in Text-Tabs (Monospace, UG-Stil `e|---5h7---|`) → Auswahl mit 4 Optionen.

| Zeichen | Bedeutung | Spielanleitung für die Lösung |
|---|---|---|
| `5h7` | Hammer-on (Aufschlagbindung) | nur ersten Ton anschlagen, auf den höheren Bund „hämmern“ |
| `7p5` | Pull-off (Abzugbindung) | beide greifen, höheren anschlagen, Finger seitlich abziehen |
| `5/7` | Slide aufwärts | anschlagen und zum höheren Bund rutschen |
| `7\5` | Slide abwärts | anschlagen und zum tieferen Bund rutschen |
| `7b9` | Bending | ziehen, bis es wie Bund 9 klingt (2 Bünde = full) |
| `7b9r7` | Bending mit Release | hochziehen und ohne neuen Anschlag zurücklassen |
| `5~~` | Vibrato | Ton mit kleinen Zieh-Bewegungen schwingen lassen |
| `x` | Dead Note | Saite nur berühren und anschlagen: Klick ohne Tonhöhe |
| `PM----` (über dem Tab) | Palm Mute | Handballen am Steg auflegen, gilt über die Länge der Linie |
| `<12>` | Flageolett | leicht über dem Bundstäbchen auflegen, nicht drücken |

Weitere Fragen:
- **Bögen** (Official-Tab-Grafik, zwei Zahlen auf einer Saite mit Bogen, ohne Buchstaben):
  - gleiche Zahl = **Haltebogen** (nicht neu anschlagen)
  - zweite Zahl höher = **Hammer-on (H)**
  - zweite Zahl tiefer = **Pull-off (P)**
- **„let ring“** = Töne ausklingen lassen.
- **Klammern** `( )` sind je nach Quelle mehrdeutig: nur erklären, nicht bewerten.

**Akkorde & Capo**
- **Gestapelte Spalte → Akkord** (Grundakkorde plus Septakkorde) → Akkordtastatur.
- **Capo → klingender Akkord:** „Capo im 2. Bund, du greifst G – was klingt?“ Shapes G C D Em Am A E Dm, Bund 1–7. Lösung mit Halbtonkette „G → Ab → A“.
- **Capo-Bund:** „Der Song klingt in A, du willst G-Griffe spielen – welcher Bund?“ → Auswahl 1–7.
- **Kopfzeile** „Tuning: E A D G B E“ = Normalstimmung (deutsch E A D G H E).
- „Capo: 2nd fret“ = Kapodaster in Bund 2, Griffe wie notiert.
- **Nur im Deutsch-Modus, H/B-Fangfragen:**
  - Bm = h-Moll
  - B7 = H7 (H Dis Fis A)
  - Bb = B-Dur
  - B = H-Dur
- **Nicht bewerten**, weil nicht belegt: ob UGs Feld „Key“ die klingende Tonart meint und ob Tab-Zahlen relativ zum Capo gezählt werden.

### M7 – Rhythmus
Element-Schlüssel `rh:<typ>:…`.

**Einstellungen:** Themen Notenwerte / Zählen & Schlagmuster / Taktart & Tempo.

**Notenwerte, so wie sie unter dem Tab stehen** (UG Practice-Modus / Guitar-Pro-Stil):

| Wert | Darstellung | Schläge |
|---|---|---|
| Ganze | eingekreiste Zahl, kein Hals | 4 |
| Punktierte Halbe | eingekreiste Zahl, kurzer Hals, Punkt | 3 |
| Halbe | eingekreiste Zahl, kurzer Hals | 2 |
| Punktierte Viertel | langer Hals + Punkt | 1½ |
| Viertel | langer Hals | 1 |
| Achtel | Hals + 1 Fähnchen oder Balken | ½ |
| Sechzehntel | 2 Fähnchen oder Balken | ¼ |

Hälse zeigen nach unten, die Balken liegen unten, wie in den UG-Screenshots. Die Darstellung von Halben und Ganzen vor der Umsetzung einmal in der UG-App gegenprüfen (Kap. 11).

**Fragetypen**
- **Wert erkennen:** Auswahl, 7 Optionen.
- **Schläge:** Auswahl ¼ ½ 1 1½ 2 3 4.
- **Takt ergänzen:** 4/4-Takt, eine Stelle „?“ → welcher Wert fehlt?
- **Zählzeit:** 4/4-Takt aus Vierteln, Achtelpaaren, Halben und punktierter Viertel + Achtel; eine Note markiert → „1“, „1 +“ … „4 +“. Die Lösung zählt den ganzen Takt vor.
- **Schlagmuster** (UG-Stil, 8 Achtel, ↓ ↑ und leer = Luftschlag), z. B. `D.DU.UDU` („Old Faithful“), `D.D.DUDU`, `DUDUDUDU`. Markierter Schlag → Zählzeit. Regel: ↓ auf den Zahlen, ↑ auf „und“.
- **Taktart:**
  - 4/4 = 4 Viertel pro Takt
  - 3/4 = 3 Viertel
  - 6/8 = 6 Achtel, gefühlt 2 × 3 („1-und-a-2-und-a“)
- **Tempo:** ♩ = 60/80/100/120 → Dauer eines Schlags (60/bpm s) bzw. eines 4/4-Takts (240/bpm s). Beispiel: ♩ = 100 → 0,6 s bzw. 2,4 s. Deutsches Dezimalkomma.

### W – Akkordwechsel-Trainer (Werkzeug, kein Quiz)
- Zwei Akkorde wählen (Grundakkorde, F, Fmaj7, Septakkorde), beide Diagramme anzeigen.
- Start → 60 s Countdown. Große Tippfläche zählt jeden Wechsel. Bildschirm wach halten (Wake Lock, Fehler still ignorieren).
- Ergebnis und **Bestwert pro Paar** speichern. Richtwert: 30 Wechsel/min (JustinGuitar Grade 1).
- Die gewählten Akkorde werden gemerkt. Dass das fehlt, ist die Hauptkritik an der Original-App „One Minute Changes“.

---

## 7. Oberfläche (iPhone zuerst)

### 7.1 Bildschirme
1. **Übersicht:**
   - Logo und Titel, Zahnrad
   - Karte „Heute fällig: N“ mit Tagesziel-Balken, Serie und Knopf „Tagesübung starten“
   - Modulliste: Symbol, Name, ein Satz Beschreibung, „85 % richtig · 120 Antworten · 3 fällig“
   - Werkzeuge: Akkordwechsel, Statistik
   - iOS-Installationshinweis
2. **Modul-Start:** Beschreibung, Einstellungs-Chips, „Los geht’s · 20 Fragen“, „Nur fällige üben (N)“, bisherige Quote.
3. **Quiz:**
   - Kopfzeile: sticky, ✕, Modulname, „7 / 20“, Fortschrittsbalken, Hinweis „Wiederholung“
   - Aufgabentext, Grafik, ggf. Auswahlknöpfe, ausklappbare Merkhilfe
   - **Dock unten** (sticky, mit Abstand für die Home-Leiste): Tastatur und Prüfen. Nach dem Prüfen: farbiges Feedback-Feld mit Erklärung, „▶ anhören“ und Knöpfen.
4. **Auswertung** (5.5), **Statistik** (5.7), **Einstellungen:**
   - Notennamen DE/EN (mit Hinweis, dass Akkordsymbole international bleiben)
   - Griffbrett-Ansicht mit Live-Vorschau
   - Ton an/aus mit Probe
   - Merkhilfen an/aus
   - Tagesziel
   - Export, Import, Löschen
   - kurzer „Über“-Text

### 7.2 Eingabe
- **Keine `<input>`-Felder für Antworten.** Die iOS-Tastatur soll nicht aufgehen. Felder sind Buttons, getippt wird auf der eigenen Tastatur.
- **Notentastatur:**
  - Zeile 1: C D E F G A H (EN: B)
  - Zeile 2: ♯ (DE mit Unterzeile „-is“), ♭ („-es“), ⌫
  - ♯/♭ ändern die **zuletzt eingegebene** Note und schalten bei zweitem Druck zurück. Der Hinweis dazu steht unter der Tastatur: „H + ♭ = B, E + ♭ = Es, A + ♭ = As“.
  - Nach jeder Note springt der Cursor zum nächsten leeren Feld.
  - Vorzeichentasten nur zeigen, wenn die Aufgabe Vorzeichen enthalten kann (sonst verraten sie nichts, stören aber).
- **Tippflächen möglichst 44 × 44 pt**, Knöpfe und Tasten immer. Beim Griffbrett sind ≈ 42 × 31 px pro Zelle (bei 375 px Breite) das Minimum. Deshalb zeigt eine Ansicht höchstens 8 Bünde.
- Keine horizontale Scrollleiste auf der Seite. Einzige Ausnahme: die breite Heatmap in einem eigenen Scroll-Container.

### 7.3 Zeichnen (SVG, als Strings erzeugt)
- **Notensystem:**
  - Linienabstand = Einheit `sp`
  - Violinschlüssel mit 8 als Glyphe U+1D120, Schriftgröße 4·sp, Grundlinie auf der untersten Notenlinie; einmal visuell prüfen
  - Ganze Note als Ellipse mit schräg gestelltem Loch (fill-rule evenodd)
  - Hilfslinien ober- und unterhalb aus dem extremsten Ton der Spalte
  - Vorzeichen links vom Kopf; bei weniger als einer Sexte Abstand zum vorherigen Vorzeichen eine Spalte weiter links
- **Griffbrett:** Palisander-Holz, Bundstäbe in Nickel, Sattel in Knochenfarbe, Perlmutt-Einlagen. Markierungen als Kreise mit Nummer oder „?“. Farben:
  - ausgewählt: Akzentfarbe
  - richtig: grün
  - falsch: rot
  - Lösung: grün gestrichelt
- **Akkorddiagramm:** siehe M5.
- **Tab:**
  - 6 Linien, oben = hohe e-Saite, „TAB“ links oder Saitennamen
  - Zahlen mit Hintergrund-Aussparung, gestapelte Zahlen in einer Spalte
  - Bögen über den Zahlen (mit optionalem „H“/„P“)
  - Rhythmus darunter wie in Tabelle M7, Balken unten
- Farben **nur über CSS-Variablen**, heller und dunkler Modus (`prefers-color-scheme`).

### 7.4 Klang
- WebAudio, synthetisch gezupfte Saite (Karplus-Strong). Keine Samples, keine Downloads.
- **Immer die klingende Tonhöhe spielen** (notiert − 12).
- Wann Klang ertönt:
  - nach „richtig“ oder „Lösung“ automatisch (abschaltbar)
  - beim Antippen auf dem Griffbrett
  - Akkorde leicht „geschlagen“ (35 ms Versatz)
- AudioContext erst bei der ersten Nutzeraktion starten. Hinweis in den Einstellungen: der iPhone-Stummschalter muss aus sein.

### 7.5 Gestaltung
- Eigenständig, ruhig, musikalisch.
- Neutraler, leicht kühler Grund; eine kräftige Akzentfarbe (z. B. Kobaltblau) für aktive Elemente; Holz- und Saitenfarben nur im Griffbrett.
- Semantisch Grün und Rot für richtig und falsch, **nicht** als Akzent.
- Deutliche Typo-Hierarchie. Barrierearm: sichtbarer Fokus, ARIA-Labels an Grafiken, `prefers-reduced-motion`.

---

## 8. Tests

**Unit (Vitest), Pflicht ab Meilenstein 1**
- Namen DE/EN:
  - C#4 → „Cis“ / „C♯“
  - Bb → „B“ / „B♭“
  - Eb → „Es“, Ab → „As“, B → „H“ / „B“
  - Tonklassen-Label 1 → „Cis/Des“, 10 → „Ais/B“
- Lage im Notensystem: komplette Tabelle 4.4
- Stelle auf der Gitarre: Tabelle 4.4, Spalte „Gitarre“
- Herleitung: A-Saite 3 → „A → Ais/B → H → C“
- Akkorde: jeder Griff aus 4.6 gegen seine Formel (Septakkord-Ausnahme); Akkordtöne-Schreibweise (A → A Cis E, B7 → H Dis Fis A); deutsche Aussprache (Bm → h-Moll, B7 → H7)
- Capo-Soll-Werte aus 4.6
- Spielbarkeit von Mehrklängen (Positiv- und Negativbeispiele)
- Leitner-Übergänge (richtig fällig / richtig nicht fällig / falsch)
- Gewichtung: keine direkte Wiederholung
- Rhythmus: Summen der Takte = 4 Schläge; Zählzeit-Berechnung; Tempo-Rechnung

**E2E (Playwright, WebKit iPhone 13)**
- Jedes Modul: Runde starten, 3 Fragen richtig (über den Frage-Zustand), 1 Frage falsch → „Nochmal“ → „Lösung zeigen“ → Weiter, Runde bis zur Auswertung
- Keine horizontale Seiten-Scrollbreite bei 375 px
- Einstellungen DE/EN wirken sofort
- Export/Import-Rundlauf
- Offline: Seite laden, Netzwerk trennen, neu laden → App startet

---

## 9. Meilensteine (je ein PR, je auf Pages deploybar)

| # | Inhalt | Abnahme |
|---|---|---|
| **MS0** | Projekt-Setup (Vite/TS, Lint, Vitest, Playwright), Pages-Deploy per Action, PWA-Manifest und Icons, Service Worker | `https://ryumage.github.io/learn-music/` lädt; auf dem iPhone per „Zum Home-Bildschirm“ installierbar; startet offline |
| **MS1** | Musik-Kern (Kap. 4), Speicher + Leitner (5.3/5.6), Sitzungs-Engine mit Ablauf 5.1/5.2, Notentastatur, Auswahl-Knöpfe, Übersicht, Modul-Start, einfache Auswertung, **M1 Saiten** | Alle Unit-Tests grün; M1 komplett durchspielbar inkl. Nochmal/Lösung; Einstellungen bleiben nach Neuladen erhalten |
| **MS2** | **M2 Noten lesen** mit allen Stufen, Mehrklängen, Zeilen-Umbruch, Einzelmarkierung, Merkhilfe | 8 Noten passen bei 375 px in eine Zeile; Mehrklänge korrekt von oben nach unten; nur falsche Noten werden bei „Nochmal“ geleert |
| **MS3** | Griffbrett-Renderer (beide Ansichten), **M4 Griffbrett** (alle drei Aufgaben), **M3 Noten → Griffbrett**, Klang | Tippen trifft zuverlässig die richtige Zelle; Oktavfehler-Meldung; Ansicht umschaltbar |
| **MS4** | Tagesübung, Fehlerschleife, volle Auswertung (Fehlerliste, Heatmap, „Fehler üben“), Statistik-Seite, Export/Import/Löschen | Fehler kommen ~4 Fragen später einmal wieder; „Heute fällig“ stimmt nach Tageswechsel (Zeit im Test mocken) |
| **MS5** | **M5 Akkorde** (drei Aufgaben, Akkordtastatur, editierbares Diagramm), **Akkordwechsel-Trainer** | Alternative Griffe werden akzeptiert; C7 ohne Quinte gilt als richtig; Bestwert pro Paar bleibt gespeichert |
| **MS6** | **M6 Tabs** und **M7 Rhythmus** inkl. Tab-Renderer mit Bögen und Rhythmus | Alle Fragetypen erscheinen; H/B-Fragen nur im Deutsch-Modus |
| **MS7** | Feinschliff: Dunkelmodus, Barrierefreiheit, Performance (erste Anzeige < 1 s auf dem iPhone), Texte gegenlesen, Installationshinweis | Lighthouse Performance und Accessibility ≥ 90; Installation und Offline-Start manuell auf echtem iPhone geprüft |

---

## 10. Deployment und Nutzung auf dem iPhone

1. Im Repo: **Settings → Pages → Source: GitHub Actions**.
2. Die Action baut bei jedem Push auf `main` und veröffentlicht `dist/`. Adresse: `https://ryumage.github.io/learn-music/`. Beim Umbenennen des Repos `base` anpassen.
3. Auf dem iPhone in **Safari** öffnen → **Teilen → Zum Home-Bildschirm**. Dann:
   - startet die App ohne Browserleiste
   - funktioniert sie offline
   - bleibt der Lernstand erhalten
4. Updates kommen automatisch beim nächsten Start (Service Worker `autoUpdate`).
5. GitHub Pages ist für öffentliche Repos kostenlos. Für private Repos braucht Pages einen bezahlten Plan, das Repo muss dafür also öffentlich sein.

---

## 11. Offene Entscheidungen (Default in Klammern)

| Thema | Default | Anmerkung |
|---|---|---|
| App-Name | „Saitenlesen“ | vom Nutzer änderbar, nur Titel/Manifest |
| Noten pro Zeile | 8 | Nutzeridee war 16; als Einstellung vorhanden |
| „Nochmal“ | 1× pro Frage | danach Lösung |
| Standardsprache der Notennamen | Deutsch | |
| Griffbrett-Ansicht | tiefe E-Saite unten | wie Tabs und Standard-View-Cheat-Sheet |
| Halbe/Ganze unter dem Tab | eingekreiste Zahl (+ kurzer Hals) | vor MS6 in der UG-App gegenprüfen |
| UG-Feld „Key“, Tab-Zahlen mit Capo | nur erklären, nicht bewerten | Konvention nicht belegt |
| Mikrofon-Eingabe („spiel den Ton“) | nicht umsetzen | laut Recherche häufigste Beschwerdequelle; später optional |
| Einstufungstest beim ersten Start | nicht umsetzen | später, P3 |
| Muster statt Einzelnoten (Terzen, Dreiklänge, kurze Melodien in C/G-Dur) | Anordnung „Melodie“ als erster Schritt | P3 ausbauen |
| Hör-Modul („hören und finden“) | später | P3 |

---

## 12. Quellen im Repo
- `docs/recherche.md` – Recherchebericht mit Begründungen und Quellen: Leitner/verteiltes Lernen, Abrufen statt Ankreuzen, Stufenfolge der Gitarrenschulen, App-Vergleich, UG-Notation
- `docs/cheatsheets/Notes on the Fretboard (Standard View).pdf` und `(Student View).pdf` – Vorlage für Griffbrett-Ansichten, Saitennamen und Oktav-Formen
