# Playwright Tests

## Setup

Install Playwright browsers:

```bash
npx playwright install chromium
```

## Run Tests

```bash
# Alle Tests
npx playwright test

# einzelne Testdatei
npx playwright test melodie-generator.spec.js

# Mit GUI
npx playwright test --ui

# Mit Report
npx playwright test --reporter=html,json
```

## Test Suites

1. **melodie-generator.spec.js** - 8 Tests für MelodieGenerator App
2. **agent-dashboard.spec.js** - 7 Tests für Agent Dashboard
3. **threejs-blob.spec.js** - 5 Tests für Three.js Blob

## Result

Alle Test-Suiten sind in `/playwright-tests/` erstellt.
