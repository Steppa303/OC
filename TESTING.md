# Testing mit Playwright

Dieses Projekt verwendet Playwright für End-to-End-Tests. Playwright ist ein leistungsstarkes Testing-Framework, das moderne Web-Apps testen kann.

## Installation

Die folgenden Abhängigkeiten sind bereits installiert:

```bash
npm install -D @playwright/test
npx playwright install
```

## Verfügbare Test-Befehle

### Grundlegende Tests ausführen
```bash
npm test
```
Führt alle Tests im Headless-Modus aus (ohne sichtbaren Browser).

### Tests mit sichtbarem Browser
```bash
npm run test:headed
```
Führt Tests mit sichtbarem Browserfenster aus - nützlich zum Debuggen.

### Interaktiver UI-Modus
```bash
npm run test:ui
```
Startet die Playwright UI, wo Tests interaktiv ausgeführt und debuggt werden können.

### Debug-Modus
```bash
npm run test:debug
```
Startet Tests im Debug-Modus mit eingebauter Pause und Step-Through-Funktion.

## Test-Struktur

Die Tests befinden sich im `tests/` Verzeichnis und sind nach folgender Struktur organisiert:

- `example.spec.js` - Beispiel-Testfälle zur Orientierung
- `melodie-generator.spec.js` - Tests für den Melodiegenerator
- `agent-dashboard.spec.js` - Tests für das Agent-Dashboard
- `threejs-blob.spec.js` - Tests für die Three.js Blob App

## Test-Typen

Unsere Test-Suite enthält verschiedene Arten von Tests:

### Smoke Tests
- Überprüfen, ob Seiten korrekt laden (HTTP 200)
- Basisfunktionalität schnell testen
- Geringer Aufwand, hoher Nutzen

### Funktionalitäts-Tests
- Überprüfen, ob Steuerelemente funktionieren
- Interaktionen mit UI-Elementen testen
- Geschäftslogik validieren

### Visuelle Tests
- Screenshots zur Qualitätssicherung
- Layout-Probleme erkennen
- Design-Konsistenz prüfen

### Performance-Tests
- Ladezeiten messen
- Rendering-Leistung bewerten
- Optimierungspotenzial finden

## Best Practices

- Tests sollten stabil und reproduzierbar sein
- Explicit waits statt sleep() verwenden
- Page Object Model für komplexe Anwendungen
- Screenshots bei Fehlern automatisch aktiviert
- Videos bei Fehlern optional aufbewahrt

## Reports

Nach jedem Testlauf wird ein HTML-Report generiert, der unter `playwright-report/` gefunden werden kann. Öffnen Sie `index.html` in einem Browser, um detaillierte Ergebnisse zu sehen.