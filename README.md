# Zammad Desktop

Eine schlanke Desktop-App für [Zammad](https://github.com/zammad/zammad): die
Zammad-Weboberfläche in einem eigenen Fenster, mit echten
**Windows-Benachrichtigungen**. Gebaut mit Electron.

Zammad bietet selbst keine native Windows-App – diese App schließt diese Lücke.

## Hinweis (Disclaimer)

> **Dieses Projekt ist nicht offiziell und steht in keiner Verbindung zur
> Zammad GmbH oder zum Zammad-Projekt.** Es handelt sich um ein
> unabhängiges, community-betriebenes Open-Source-Projekt eines
> inoffiziellen Drittanbieter-Clients.
>
> „Zammad" ist eine Marke der jeweiligen Rechteinhaber; die Verwendung des
> Namens dient ausschließlich der Beschreibung der Kompatibilität. Diese App
> wird von Zammad weder herausgegeben, geprüft, unterstützt noch
> gesponsert.
>
> Die Nutzung erfolgt auf eigene Verantwortung – ohne jegliche Gewährleistung
> (siehe Lizenz). Bug-Reports, Pull Requests und Verbesserungen aus der
> Community sind willkommen; ein offizieller Support besteht nicht.

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

## Downloads

Fertige Builds gibt es unter **[Releases](../../releases)** (aktuell `v0.2`):

- `Zammad Desktop Setup 0.2.0.exe` – Windows-Installer
- `Zammad-Android-0.2.0.apk` – Android-App (Sideload)

Beide Apps fragen beim **ersten Start nach deiner Zammad-Adresse** – es ist
keine bestimmte Instanz fest eingebaut, die Apps können gefahrlos
weitergegeben werden. Änderungen siehe [CHANGELOG](CHANGELOG.md).

## Installation (Windows)

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

## Android-App (`mobile/`)

Im Ordner `mobile/` liegt das Gegenstück für Android: eine native App, die
die mobile Zammad-Oberfläche in einem eigenen Fenster lädt und über einen
**Hintergrunddienst** regelmäßig nach neuen Benachrichtigungen fragt
(lokale Benachrichtigungen, kein Firebase/Server nötig).

- Eigene App mit Icon und Autostart (auch nach Geräteneustart)
- Hintergrunddienst mit dauerhafter Mini-Notiz (von Android vorgeschrieben);
  Latenz = Abfrageintervall (Standard 30 Sek., einstellbar)
- Google-SSO funktioniert (WebView meldet sich als echter Chrome)
- URL/Intervall/Ton über das ⋮-Menü oben rechts einstellbar

> Hinweis: Mangels Firebase/Server ist dies **kein** echtes Push wie bei
> WhatsApp, sondern Polling im Hintergrund – „quasi sofort", abhängig vom
> Intervall, mit etwas mehr Akkuverbrauch.

### Installation (Sideload)

1. `Zammad-Android-<version>.apk` aufs Android-Gerät kopieren.
2. Datei öffnen → bei Nachfrage „Installation aus unbekannten Quellen"
   für die jeweilige App (z. B. Dateimanager) erlauben.
3. Beim **ersten Start** die Zammad-Adresse eintragen (z. B.
   `https://deinefirma.zammad.com`) – es ist keine Instanz fest eingebaut.
4. Die Benachrichtigungs-Berechtigung **zulassen** und die Akku-Optimierung
   für „Zammad" möglichst deaktivieren (sonst pausiert Android den
   Hintergrunddienst). URL/Intervall/Ton später über das ⋮-Menü.

### Android aus dem Quellcode bauen

Voraussetzung: JDK 17, Android SDK (Plattform 34, Build-Tools 34) und
Gradle 8.7.

```bash
cd mobile
node make-android-icons.js          # Launcher-Icons erzeugen
gradle assembleDebug                 # APK bauen
# Ergebnis: mobile/app/build/outputs/apk/debug/app-debug.apk
```

`local.properties` mit `sdk.dir=<Pfad zum Android-SDK>` ist erforderlich
(maschinenspezifisch, nicht eingecheckt).

### Google Play (AAB)

Für den Upload in die Play Console wird ein **signiertes Release-AAB**
benötigt (debug-signiert lehnt Google ab). Die Signierung wird aus
`mobile/keystore.properties` gelesen (zusammen mit dem Keystore **nicht**
eingecheckt):

```
storeFile=release.keystore
storePassword=<…>
keyAlias=<…>
keyPassword=<…>
```

Keystore einmalig erzeugen und dann bauen:

```bash
cd mobile
keytool -genkeypair -v -keystore release.keystore -alias zammad \
  -keyalg RSA -keysize 2048 -validity 10000
gradle bundleRelease
# Ergebnis: mobile/app/build/outputs/bundle/release/app-release.aab
```

> **Wichtig:** `release.keystore` und das Passwort sicher aufbewahren und
> sichern. Ohne sie sind keine App-Updates in der Play Console mehr möglich
> (außer über Play App Signing mit Upload-Key-Reset). Beide Dateien sind
> bewusst von Git ausgeschlossen.

## Projektstruktur

| Datei / Ordner   | Zweck                                                       |
|------------------|-------------------------------------------------------------|
| `main.js`        | Electron-Hauptprozess: Fenster, Tray, Autostart, Benachrichtigungen, SSO |
| `preload.js`     | Liest ungelesene Benachrichtigungen über Zammads API        |
| `settings.html`  | Einstellungsfenster (URL + Optionen)                        |
| `make-icon.js`   | Generiert die App-/Tray-Icons (ohne externe Abhängigkeiten) |
| `build.js`       | Zuverlässiger Windows-Build (electron-builder-Workaround)   |
| `mobile/`        | Native Android-App (WebView + Hintergrund-Benachrichtigungsdienst) |

## Lizenz

MIT
