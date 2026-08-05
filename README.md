# Prompt Board

Eine sehr einfache Seite, um wiederkehrende Basis-Prompts abzulegen, zu ordnen und per Knopfdruck zu kopieren.

## Funktionen

- **Grid aus Knöpfen** — jeder Prompt ist eine Kachel mit Titel und Vorschau. Klick öffnet den vollen Text.
- **Kopieren** — kopiert **nur den Prompt-Text**, niemals den Titel.
- **Schloss pro Kachel** — oben rechts auf jeder Kachel sitzt ein 🔒. Nur die entsperrte Kachel
  lässt sich bearbeiten, umfärben, löschen oder verschieben. Es gibt bewusst **keinen** Knopf,
  der alles auf einmal öffnet. „Alle sperren" oben rechts schliesst offene Kacheln wieder.
  **Ein Neuladen der Seite sperrt automatisch alles** — der entsperrte Zustand ist nur für die
  laufende Sitzung gültig und wird nie gespeichert.
- **Kategorien** — Oberkategorien anlegen, umbenennen, umfärben, sortieren und löschen.
  Prompts lassen sich einzeln oder in Gruppen zuordnen (🗂 Kategorien → „Prompts zuordnen").
  Vorlagen für einen Klick: Börse & Aktien, App-Entwicklung, Spiele-Entwicklung, Marktrecherche,
  Gesundheit & Analyse, Recherche & Web, Text & Content, Daten & Auswertung.
- **Immer sichtbare Prompt-Leiste** — Titel + Text eintippen, Kategorie und Farbe wählen,
  `+ Anlegen`. Funktioniert jederzeit, ohne vorher etwas zu entsperren.
- **10 Rahmenfarben** — Rot, Orange, Gelb, Grün, Türkis, Blau, Violett, Pink, Braun, Grau.
  Eine Kachel ohne eigene Farbe (`∅`) übernimmt die Farbe ihrer Kategorie.
- **Sortieren & Verschieben** — entsperrte Kacheln per Drag & Drop umordnen oder in einen
  anderen Kategorie-Abschnitt ziehen.
- **Suche** — filtert über Titel, Prompt-Inhalt und Kategoriename.
- **Export / Import** — alles als JSON sichern und wieder einlesen (Duplikate werden übersprungen).

## Speicherung — wichtig zu wissen

**Kurz:** Nach jeder Änderung wird sofort automatisch gespeichert. Du musst **nichts** exportieren,
damit die Prompts beim nächsten Aufruf wieder da sind. Aber: Die Daten liegen **im Browser**,
nicht auf einem Server.

### Wie es funktioniert

Die Prompts und Kategorien liegen im `localStorage` des Browsers — kein Server, kein Account,
keine Datenbank. Jede Änderung (anlegen, bearbeiten, verschieben, färben, löschen) schreibt sofort.
Beim nächsten Öffnen derselben Adresse im selben Browser ist alles wieder da.

### Wann die Prompts da sind — und wann nicht

| Situation | Prompts sichtbar? |
|---|---|
| Gleiche Adresse, gleicher Browser, gleiches Gerät | ✅ ja, automatisch |
| Anderer Computer | ❌ nein |
| Anderes Handy / Tablet | ❌ nein |
| Anderer Browser auf demselben Gerät (Chrome ↔ Firefox) | ❌ nein |
| Privates Fenster / Inkognito | ❌ nein (wird beim Schliessen verworfen) |
| `localhost:8000` statt `deine-seite.vercel.app` | ❌ nein (andere Adresse = anderer Speicher) |
| Browserdaten / Cookies / Websitedaten gelöscht | ❌ weg |

Die Statuszeile unter der Kopfleiste zeigt jederzeit an, wie gespeichert wird und wann zuletzt
exportiert wurde. Wenn der Browser gar nicht speichern kann (privater Modus), erscheint dort
eine rote Warnung.

### Umzug auf einen anderen Computer

1. Auf dem alten Gerät: **Export** → JSON-Datei wird heruntergeladen.
2. Datei mitnehmen (USB, Cloud, E-Mail an sich selbst).
3. Auf dem neuen Gerät die Seite öffnen → **Import** → Datei wählen. Kategorien werden über den
   Namen zusammengeführt, inhaltlich identische Prompts werden übersprungen.

Der Export ist also **kein Pflicht-Schritt nach jedem Prompt**, sondern das Backup- und
Umzugswerkzeug. Empfehlung: alle paar Wochen exportieren — die Statuszeile erinnert nach 7 Tagen
mit einem „Jetzt sichern"-Link daran.

### Wirklich geräteübergreifend?

Dafür bräuchte es einen Server, der die Prompts hält (z. B. Supabase, ein kleines API-Backend
oder ein privates Git-Repo als Ablage). Das ist bewusst **nicht** eingebaut: sobald Daten auf
einem Server liegen, braucht es Login, Rechteverwaltung und Datenschutz-Überlegungen.
Solange nur ein Gerät im Spiel ist, ist die aktuelle Lösung schneller, privater und ausfallsicherer.

## Tastatur

| Taste | Wirkung |
|---|---|
| `Ctrl`/`Cmd` + `Enter` | im Prompt-Feld oben: anlegen · im Editor: speichern |
| `Esc` | Farbwahl / Fenster schliessen |
| `Enter` / `Leertaste` | auf einer fokussierten Kachel: öffnen |

## Lokal starten

Einfach `index.html` im Browser öffnen, oder:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Deployment auf Vercel

Reine statische Seite, kein Build-Schritt nötig.

1. Repository auf Vercel importieren.
2. Framework Preset: **Other**.
3. Build Command leer lassen, Output Directory auf das Repo-Root (Standard).
4. Deploy.

Alternativ per CLI:

```bash
npx vercel
```

## Dateien

```
index.html   Aufbau der Seite
styles.css   Layout und Design
app.js       Logik: Speichern, Kategorien, Schloss pro Kachel, Farben, Kopieren, Import/Export
```
