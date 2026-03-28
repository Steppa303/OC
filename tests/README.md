# Test-Suite

Diese Test-Suite verwendet Playwright für End-to-End-Tests unserer Anwendungen.

## Ordnerstruktur

```
tests/
├── example.spec.js         # Beispiel-Testfälle
├── melodie-generator.spec.js  # Tests für Melodiegenerator
├── agent-dashboard.spec.js    # Tests für Agent-Dashboard
└── threejs-blob.spec.js       # Tests für Three.js Blob App
```

## Test-Kategorien

### 1. Smoke Tests
- Überprüfen grundlegende Seite-Ladefähigkeit
- HTTP-Status-Codes validieren
- Hauptelemente sichtbar machen
- Schnelle Validierung vor komplexeren Tests

### 2. Funktionalitäts-Tests
- UI-Elemente Interaktion
- Formular-Validierung
- Button-Klicks und Aktionen
- Datenfluss durch Anwendung

### 3. Visuelle Regressionstests
- Layout-Konsistenz
- Design-Änderungen erkennen
- Screenshot-Vergleich
- Responsive Design Prüfung

### 4. Performance-Tests
- Ladezeit-Messung
- Rendering-Geschwindigkeit
- Ressourcen-Nutzung
- Skalierbarkeit prüfen

## Naming Convention

Test-Dateien folgen dem Muster: `{feature-name}.spec.js`

- `describe()` Blöcke beschreiben die Feature-Gruppe
- `test()` Beschreibungen sind in Deutsch und sprechend
- `beforeEach()` für Setup-Logik
- `afterEach()` für Cleanup-Operationen

## Page Object Pattern

Für komplexe Seiten sollten Page Objects erstellt werden:

```javascript
// Beispiel für ein Page Object
class DashboardPage {
  constructor(page) {
    this.page = page;
    this.statsCard = page.locator('.stats-card');
    this.refreshButton = page.locator('button.refresh');
  }

  async navigate() {
    await this.page.goto('/dashboard');
  }

  async refreshStats() {
    await this.refreshButton.click();
  }
}
```

## Best Practices

- Tests sollten unabhängig voneinander laufen
- Explizite Wartebedingungen statt fester Zeit-Pausen
- Aussagekräftige Namen für Testfälle
- Fehlerfälle sollten sinnvolle Screenshots erstellen
- Tests sollten deterministisch sein