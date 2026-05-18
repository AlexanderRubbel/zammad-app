# Changelog

Alle nennenswerten Änderungen an diesem Projekt.

## v0.2.0 — 2026-05-18

Erste veröffentlichte Version. Enthält Desktop- **und** Android-App.

### Hinzugefügt
- **Windows-Desktop-App** (Electron): Zammad in eigenem Fenster, native
  Windows-Benachrichtigungen, Tray/Hintergrund, Autostart, Ungelesen-Zähler,
  Ton, In-App-Einstellungen (URL + Optionen), Test-Benachrichtigung.
- **Android-App** (`mobile/`): native WebView-App mit Hintergrunddienst, der
  Zammad regelmäßig auf neue Benachrichtigungen abfragt (lokale
  Benachrichtigungen, kein Firebase/Server), Autostart nach Geräteneustart,
  einstellbare URL / Intervall / Ton über das ⋮-Menü.
- Google-SSO funktioniert in beiden Apps (sauberer Chrome-User-Agent).
- Zuverlässiges Windows-Build-Skript (`build.js`) inkl. Umgehung des
  electron-builder/winCodeSign-Symlink-Problems.
- README mit Anleitung sowie Disclaimer (inoffiziell, community-betrieben,
  nicht mit Zammad affiliiert).
- Signiertes Release-**AAB** für die Google Play Console (`gradle
  bundleRelease`); Signierung über nicht eingecheckte `keystore.properties`.

### Geändert
- **Keine fest verdrahtete Zammad-Instanz mehr.** Beide Apps fragen die
  Zammad-Adresse beim ersten Start ab. Die Apps können jetzt gefahrlos
  weitergegeben werden, ohne eine bestimmte Instanz zu verraten.

### Sicherheit / Privatsphäre
- Commits ohne persönliche E-Mail (GitHub-noreply-Adresse).
