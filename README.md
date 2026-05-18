# Zammad Desktop

Eine schlanke Desktop-App für [Zammad](https://github.com/zammad/zammad): die
Zammad-Weboberfläche in einem eigenen Fenster, mit echten
**Windows-Benachrichtigungen**. Gebaut mit Electron.

Zammad bietet selbst keine native Windows-App – diese App schließt diese Lücke.

## Funktionen

- **Eigenes Fenster** – Zammad als eigenständiges Programm statt im Browser-Tab
- **Windows-Benachrichtigungen** – neue Tickets/Updates erscheinen als native
  Toast-Meldung; Klick öffnet das Fenster
- **Im Hintergrund (Tray)** – Fenster schließen beendet nicht, sondern
  minimiert ins Tray; Benachrichtigungen laufen weiter
- **Autostart mit Windows** – startet unsichtbar mit und benachrichtigt sofort
- **Ungelesen-Zähler** – roter Marker auf dem Taskleisten-Symbol
- **Ton** – optionaler Benachrichtigungston
- **Google SSO** – funktioniert (eingebetteter Login wird unterstützt)
- **Selbst-gehostet** – optionales Ignorieren selbst-signierter
  SSL-Zertifikate

## Installation

1. `Zammad Desktop Setup <version>.exe` ausführen (aus den
   [Releases](../../releases) bzw. dem `dist/`-Ordner nach einem Build).
2. Erscheint die SmartScreen-Warnung „Der Computer wurde durch Windows
   geschützt": **Weitere Informationen → Trotzdem ausführen**. Das ist bei
   nicht signierten Apps normal und einmalig.
3. App starten. Beim ersten Start öffnet sich das Einstellungsfenster.

## Einrichtung

Im Einstellungsfenster:

1. **Zammad-Adresse** eintragen, z. B. `https://deinefirma.zammad.com`
2. Optionen wählen (Tray, Autostart, Zähler, Ton) – sinnvoll vorbelegt
3. Bei selbst-gehosteten Servern mit selbst-signiertem Zertifikat:
   „Zertifikatfehler ignorieren" aktivieren
4. **Speichern** – Zammad lädt im Fenster, normal anmelden

Die Einstellungen sind später jederzeit über das **Tray-Symbol →
Einstellungen** erreichbar.

### Benachrichtigungen in Zammad aktivieren

Die App liest Zammads eigenes Benachrichtigungssystem aus. Dafür in Zammad
unter **Profil → Benachrichtigungen** die gewünschten Ereignisse aktivieren
(z. B. „Neu erstellt", „Update"). Benachrichtigungen sind an **Gruppen**
gebunden – du wirst über Tickets in deinen Gruppen informiert, auch über noch
nicht zugewiesene.

Zum Testen ohne zweiten Account: in den Benachrichtigungseinstellungen „Auch
über meine eigenen Aktionen benachrichtigen" aktivieren, dann ein Test-Ticket
sich selbst zuweisen. Oder im Tray-Menü **Test-Benachrichtigung senden**, um
nur den Windows-Teil zu prüfen.

## Aus dem Quellcode bauen

Voraussetzung: [Node.js](https://nodejs.org/) (Version 18+).

```bash
npm install      # Abhängigkeiten installieren
npm start        # App im Entwicklungsmodus starten
npm run dist     # Windows-Installer nach dist/ bauen
```

`npm run dist` erzeugt `dist/Zammad Desktop Setup <version>.exe`.

> Das Build-Skript (`build.js`) umgeht automatisch ein bekanntes
> electron-builder-Problem unter Windows (macOS-Symlinks im
> winCodeSign-Paket, die ohne Admin-Rechte nicht entpackt werden können).
> Bei ganz leerem Cache kann der erste `npm run dist`-Lauf mit einem
> Symlink-Fehler abbrechen – dann einfach ein zweites Mal ausführen.

## Projektstruktur

| Datei           | Zweck                                                        |
|-----------------|--------------------------------------------------------------|
| `main.js`       | Electron-Hauptprozess: Fenster, Tray, Autostart, Benachrichtigungen, SSO |
| `preload.js`    | Liest ungelesene Benachrichtigungen über Zammads API         |
| `settings.html` | Einstellungsfenster (URL + Optionen)                         |
| `make-icon.js`  | Generiert die App-/Tray-Icons (ohne externe Abhängigkeiten)  |
| `build.js`      | Zuverlässiger Windows-Build (electron-builder-Workaround)    |

## Lizenz

MIT
