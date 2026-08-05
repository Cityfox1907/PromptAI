# Prompt Board

Eine sehr einfache Seite, um wiederkehrende Basis-Prompts abzulegen und per Knopfdruck zu kopieren.

## Funktionen

- **Grid aus Knöpfen** — jeder Prompt ist eine kleine Kachel mit Titel und Vorschau.
- **Klick = gross lesen** — die Kachel öffnet ein Fenster mit dem vollständigen Prompt.
- **Kopieren** — der Button kopiert **nur den Prompt-Text**, niemals den Titel.
- **Schloss** — solange gesperrt (🔒), lässt sich nichts anlegen, ändern, löschen oder verschieben.
  Erst mit Klick auf 🔓 erscheinen „Neuer Prompt", Bearbeiten, Löschen und Sortieren.
- **Sortieren** — im entsperrten Zustand Kacheln per Drag & Drop umordnen.
- **Suche** — filtert über Titel und Prompt-Inhalt.
- **Export / Import** — alle Prompts als JSON-Datei sichern und wieder einlesen.

## Speicherung

Die Prompts liegen im `localStorage` des Browsers — kein Server, kein Account, keine Datenbank.
Das heisst: Prompts sind an diesen Browser auf diesem Gerät gebunden. Für Backup oder Umzug
auf ein anderes Gerät den **Export**-Button nutzen und die Datei drüben wieder importieren.

## Tastatur

| Taste | Wirkung |
|---|---|
| `Esc` | Fenster schliessen |
| `Ctrl`/`Cmd` + `Enter` | im Editor speichern |
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
app.js       Logik: Speichern, Lock, Kopieren, Sortieren, Import/Export
```
