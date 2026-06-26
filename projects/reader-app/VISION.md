# 📖 Reader App — VISION.md

**URL:** https://reader.steppa.online
**Stand:** 2026-06-20
**Status:** ✅ In Betrieb (Phase 0 abgeschlossen, Phase 1-2 teilweise umgesetzt)

---

## 🎯 Die Vision in einem Satz

Ein smarter EPUB-Reader mit KI-Vorlesefunktion — "Kindle ohne Amazon, aber mit TTS das nicht wie ein Roboter klingt."

---

## 👤 User-Workflow (Step by Step)

### 1. App öffnen

User landet auf `reader.steppa.online`.

**Shelf View:** Ein dunkles/helles Bücherregal. Entweder leer mit "Noch keine Bücher. Lade ein EPUB hoch!" + Upload-Button, oder voll mit Buch-Covern.
- Oben: Logo + Theme-Toggle (🌙/☀️)
- Mitte: Upload-Zone (Drag & Drop oder Klick)
- Darunter: Suchleiste (nur sichtbar wenn Bücher existieren)
- Raster: Buchkarten mit Cover, Titel, Autor, Lesefortschritt (%-Balken)

**User sieht sofort:** "Hier lade ich hoch, hier sehe ich meine Bücher."

---

### 2. EPUB hochladen

**Option A: Drag & Drop** — EPUB aus dem Explorer ins Browser-Fenster ziehen
**Option B: Klicken** — Auf die Dropzone klicken, Datei-Auswahl öffnet sich
- Nur `.epub` wird akzeptiert
- Falls was anderes: Toast "Nur .epub Dateien, Digga."

**Während Upload:**
- Fortschrittsbalken (0% → 100%)
- Text "42%" → "Verarbeitet!" → blendet aus
- Bei Fehler: roter Text "Upload failed: [Grund]"

**Nach Upload:**
- Buch erscheint sofort im Regal
- Cover wird angezeigt (entweder aus EPUB extrahiert oder generiert: farbiger Kreis mit Buchstaben-Initiale)
- Titel + Autor aus Metadaten gelesen
- Fortschritt: 0%

**User denkt:** "Hab's fallen lassen, jetzt ist es da. Easy."

---

### 3. Buch lesen

**Klick auf Buch-Cover:**
- **Loading State:** "Buch wird geöffnet…" mit Spinner
- Reader View öffnet sich
- Kapitel-Inhalt wird geladen
- User landet auf dem Kapitel, wo er/sie aufgehört hat (Lesezeichen)

**Reader View Layout:**
```
┌──────────────────────────────────────┐
│ ← [Buchtitel]        A- A+ 📋 🔖   │  ← Topbar (Zurück, Font-Größe, TOC, Bookmark)
├──────────────────────────────────────┤
│ ████████████████░░░░░░░░░ 37%       │  ← Fortschrittsbalken
├──────────────────────────────────────┤
│                                      │
│   Kapitel 3                          │  ← Content Area (scrollbar)
│                                      │
│   Lorem ipsum dolor sit amet,        │
│   consectetur adipiscing elit,       │
│   sed do eiusmod tempor...          │
│                                      │
│                                      │
├──────────────────────────────────────┤
│ ▶ Vorlesen  ⏮ ⏭ ⏹  Speed 1.0×     │  ← Player (IMMER sichtbar)
│              Auto 🔄  Stimme [Sarah▼]│
│                        0:00 / 12:34  │
└──────────────────────────────────────┘
```

**Lesen:**
- Scrollen im Kapitel
- ← → Tasten für vorheriges/nächstes Kapitel
- Leertaste: Vorlesen Start/Pause
- Escape: Zurück ins Regal
- Font-Größe anpassen: A- / A+ Buttons (14-28px, 2px Steps)
- Fortschritt wird automatisch alle 2 Sekunden gespeichert

**Inhaltsverzeichnis (TOC):**
- Klick auf 📋 → Panel schiebt sich von links
- Alle Kapitel als Liste
- Aktuelles Kapitel markiert
- Klick = Sprung zu Kapitel
- Klick außerhalb oder erneut 📋 → Panel schließt

**Lesezeichen:**
- Klick auf 🔖 setzt Lesezeichen
- Icon wechselt auf 🔖-checked wenn Lesezeichen existiert
- Toast "Lesezeichen gespeichert!"
- Beim erneuten Öffnen: Landet genau da, wo aufgehört
- Speichert: Kapitel + Scroll-Position

---

### 4. Vorlesen lassen (TTS)

**Start:**
1. Klick ▶ (oder Leertaste)
2. Player zeigt "Lade Audio…"
3. Audio streamt von ElevenLabs (kein Warten auf kompletten Download)
4. Wiedergabe startet sofort sobald erste Daten da sind
5. Icon wechselt auf ⏸

**Während Wiedergabe:**
- Aktuelle Zeit / Gesamtzeit
- Speed-Slider (0.5× — 2.0×) auf Desktop
- Speed-Presets (0.5×, 0.75×, 1.0×, 1.25×, 1.5×, 2.0×) auf Mobile
- Stop-Button ⏹

**Auto-Advance:**
- 🔄 Button aktivieren → nach Kapitel-Ende 3-Sekunden-Countdown
- "Nächstes Kapitel in 3… 2… 1…" 
- Automatischer Sprung + Start von nächstem Kapitel
- Klick auf ▶ während Countdown = sofort weiter
- Klick auf 🔄 erneut → deaktivieren
- Buch-Ende: Overlay "Buch beendet!" mit "Nochmal lesen" oder "Zurück zum Regal"

**Stimmen:**
| Stimme | Sprache | Typ |
|--------|---------|-----|
| Sarah | Englisch | Standard |
| Thomas | Deutsch 🇩🇪 | Gut für deutsche Bücher |
| Berta Berlin | Deutsch 🇩🇪 | Berliner Schnauze |
| Nervbold | Deutsch 🇩🇪 | Custom (toxisch) |
| Roger | Englisch | Männlich |
| Charlie | Englisch | Neutral |

**Bei Fehler:**
- Rote Retry-Leiste unter Player: "[Fehler] — Erneut versuchen"
- Klick auf Button → nochmal probieren
- Nach 4 Sekunden verschwindet sie automatisch

---

### 5. Theme umschalten

- Klick auf 🌙/☀️ im Header
- Schaltet zwischen Dark Mode und Light Mode
- Einstellung bleibt erhalten (localStorage)
- System-Preference wird beim ersten Besuch respektiert

**Dark Mode:** Schwarzer Hintergrund, weiße Schrift, Glassmorphism-Elemente
**Light Mode:** Weißer Hintergrund, dunkle Schrift, dezente Schatten

---

### 6. Bücher verwalten

**Suchen:**
- Suchleiste im Shelf View (erscheint sobald ≥ 1 Buch da)
- Filtert in Echtzeit nach Titel und Autor (300ms Debounce)
- Escape-Taste oder ✖ Button → leert Suche

**Fortschritt sehen:**
- Jede Buchkarte zeigt %-Balken gelesen
- "37%" — basierend auf letzten Lesezeichen / Kapitel

**Buch löschen:**
- (Aktuell nur via API: `DELETE /api/books/:id`)
- Löscht EPUB-Datei + DB-Eintrag + Lesezeichen + TTS-History

---

## 🧠 Wie die App denkt (User muss das nicht wissen, aber es erklärt warum die App tut was sie tut)

### EPUB-Parsing
- EPUB = ZIP mit XML drin
- Die App findet die `container.xml` → `content.opf` → `spine` (Lesereihenfolge)
- Extrahiert: Titel, Autor, Cover, Kapitel-Texte
- Heuristische Kapitel-Erkennung: h1-h3 Tags als Überschriften
- Fallback: "Kapitel X" wenn kein Titel gefunden
- Formatierung: Absätze via doppelte Newline, Überschriften via Heuristik (kurze Texte am Absatzanfang, ALL CAPS, Prefixe wie "Kapitel"/"Chapter")

### TTS (ElevenLabs)
- API-Key aus OpenClaw Config
- Streaming: Server holt Audio in chunks von ElevenLabs → leitet direkt an Browser weiter
- Kein komplettes Audio-File → schneller Start
- Blob URL im Browser → `<audio>` Element

### Datenhaltung
- **EPUB-Dateien:** `/srv/reader/epubs/` (UUID-Prefix, keine Namenskonflikte)
- **Metadaten + Lesezeichen:** SQLite (`/srv/reader/reader.db`, WAL-Modus)
- **Frontend-State:** localStorage (Theme, Font-Größe, Auto-Advance)
- **Kein User-Auth:** Single-User (Bastian + wer die URL kennt)

---

## ✅ Aktuelle Features (Komplettliste)

### 📥 Upload
- [x] Drag & Drop
- [x] File-Picker (.epub only)
- [x] XHR-Progress-Bar (0-100%)
- [x] Server-Validierung (50MB Limit)
- [x] EPUB-Parsing (Titel, Autor, Cover, Kapitel)
- [x] Error-Handling mit Toast
- [x] Auto-Close Progress nach 1.5s

### 📚 Bücherregal (Shelf)
- [x] Cover-Grid (responsive Raster)
- [x] Generierte Cover-Platzhalter (Initiale + Farbverlauf)
- [x] Fortschrittsanzeige (%-Balken pro Buch)
- [x] Suchfeld (Titel + Autor, 300ms Debounce)
- [x] Leerer State ("Keine Bücher" mit Upload-CTA)
- [x] Such-Empty-State ("Keine Bücher gefunden")
- [x] Error-State mit Retry-Button

### 📖 Reader
- [x] Kapitelansicht
- [x] Automatische Absatz-Erkennung
- [x] Überschriften-Formatierung (Heuristik)
- [x] Font-Größe: 14-28px (A- / A+ Buttons)
- [x] Persistenz Font-Größe (localStorage)
- [x] Lesezeichen (Kapitel + Scroll-Position)
- [x] Auto-Save Fortschritt (alle 2s via Throttle)
- [x] Wiederaufnahme an letzter Position
- [x] Keyboard: ← → Space Esc
- [x] Kapitel-Navigation (Prev/Next)

### 📋 Inhaltsverzeichnis
- [x] Side-Panel (280px)
- [x] Alle Kapitel gelistet
- [x] Aktives Kapitel markiert
- [x] Klick → Navigation
- [x] Toggle via Button + Klick außerhalb

### 🔊 TTS (Text-to-Speech)
- [x] ElevenLabs Streaming
- [x] Play / Pause / Stop
- [x] 6 Stimmen (Sarah, Thomas, Berta Berlin, Nervbold, Roger, Charlie)
- [x] Speed: 0.5-2.0×
- [x] Desktop: Speed-Slider
- [x] Mobile: Speed-Preset-Buttons
- [x] Auto-Advance mit 3s Countdown
- [x] Loading State ("Lade Audio…")
- [x] Error State (Retry-Bar)
- [x] Leere Kapitel → Fallback nächstes Kapitel
- [x] Stop → Audio-Ressourcen freigeben
- [x] Book-End Overlay ("Buch beendet!")

### 🎨 UI/UX
- [x] Dark Mode / Light Mode
- [x] Theme-Persistenz (localStorage)
- [x] System-Preference als Default
- [x] Responsive Design (ab 375px)
- [x] Sticky Player (immer sichtbar)
- [x] Toast-Notifications
- [x] Loading Spinner
- [x] Glas-Effekte (Backdrop-Filter)
- [x] Lucide Icons
- [x] Inter Font

### 🌐 Backend
- [x] Express Server
- [x] SQLite (WAL-Modus, Foreign Keys)
- [x] CORS für steppa.online + localhost
- [x] Healthcheck
- [x] EPUB-Parser (AdmZip + JSDOM)
- [x] TTS-Streaming (ElevenLabs API)
- [x] PM2 Prozess-Management
- [x] Caddy Reverse Proxy mit Let's Encrypt SSL

### 🧪 Tests
- [x] 16 Playwright E2E Tests
- [x] UI Tests (Upload, Reader, TTS, Bookmarks, Theme, Mobile)
- [x] API Tests (Upload, List, Content, TTS, Bookmarks, Health)

---

## 🗺 Geplante Features (Roadmap)

### 🔴 Phase 1 — UX-Basics (Priorität Hoch)

| Feature | Beschreibung |
|---------|-------------|
| Sprach-Konsistenz | Fallback-Titel auf Deutsch ("Kapitel X" statt "Chapter X") |
| Loading States verbessern | Skeleton-Loader beim Buch öffnen |
| Error Handling | Toasts für ALLE API-Fehler, Retry-Buttons |
| "Keine Bücher" State | Upload-CTA statt leerem Grid |

### 🟡 Phase 2 — Leseerlebnis (Teilweise umgesetzt ✅)

| Feature | Status |
|---------|--------|
| Font-Größen-Anpassung | ✅ Implementiert (A- / A+ Buttons) |
| Generierte Cover | ✅ Implementiert (Initiale + Farbverlauf) |
| Lesefortschritt-Bar | ✅ Implementiert (oberhalb Content) |
| Speed-Slider Mobile | ✅ Implementiert (Preset-Buttons statt Slider) |
| Auto-Advance | ✅ Implementiert (mit 3s Countdown) |
| Mobile Speed verbessern | ✅ Preset-Buttons (0.5/0.75/1.0/1.25/1.5/2.0) |

### 🟢 Phase 3 — Immersion (Priorität Niedrig)

| Feature | Beschreibung |
|---------|-------------|
| Auto-Hide Header/Player | Ausblenden beim Scrollen nach unten |
| Vollbild-Leseansicht | Fullscreen API |
| Swipe-Navigation (Mobile) | ← → Wischen für Kapitelwechsel |
| Text-Anpassung | Font-Familie, Zeilenhöhe, Content-Breite |
| Dark Mode Auto-Detection | prefers-color-scheme respektieren |

### 🔵 Phase 4 — Power Features (Nice-to-have)

| Feature | Beschreibung |
|---------|-------------|
| Echtes TTS-Streaming | MediaSource API für progressives Abspielen |
| Offline-Support (PWA) | Service Worker, IndexedDB, Install Prompt |
| Annotations / Hervorhebungen | Text markieren, farbig, Notizen |
| Multi-User / Auth | Login, persönliche Regale |
| Statistiken | Lesezeit, Bücher/Monat, TTS-Nutzung |
| OPDS-Integration | Bücher aus Calibre importieren |

---

## 🎨 Design-Philosophie

- **Kein AI-Watermark:** "No AI watermarks, no 'created with' nonsense." (Zitat aus app.js)
- **Dark first:** Dark Mode primär, Light sekundär
- **Glassmorphism:** Moderne, leicht transparente UI-Elemente
- **Always visible Player:** TTS-Player klebt am unteren Rand, immer erreichbar
- **Responsive ab 375px:** iPhone SE als Minimum
- **Schnelle Feedback-Loops:** Toasts für Erfolg/Fehler, Spinner für Loading
- **Deutsches UI:** Deutsch als Hauptsprache (mit ein paar englischen Überbleibseln)

---

## 📊 Datenfluss (User-Perspektive)

```
User öffnet reader.steppa.online
    │
    ├── App lädt Bücherliste (GET /api/books)
    │   ├── Bücher da? → Cover-Grid anzeigen
    │   └── Keine Bücher? → "Lade EPUB hoch!"
    │
    ├── User lädt EPUB hoch (POST /api/upload)
    │   ├── Server parsed EPUB (AdmZip + JSDOM)
    │   ├── Speichert EPUB + Metadaten in DB
    │   └── Gibt Buch zurück → erscheint im Regal
    │
    ├── User klickt auf Buch (GET /api/books/:id/content)
    │   ├── Server parsed EPUB erneut (Kapitel-Texte)
    │   ├── Lädt Lesezeichen (GET /api/bookmarks/:id)
    │   └── Zeigt Kapitel + letzte Position
    │
    ├── User liest/blättert
    │   ├── ← → Tasten oder Buttons für Kapitel
    │   ├── Auto-Save alle 2s (POST /api/bookmarks/:id)
    │   └── Manuelles Bookmark per Button
    │
    └── User startet Vorlesen (POST /api/books/:id/tts)
        ├── Server holt Audio von ElevenLabs (Streaming)
        ├── Browser spielt chunkweise ab
        ├── Speed, Stimme, Auto-Advance steuerbar
        └── Bei Ende: Countdown → nächstes Kapitel
```

---

## 🔗 Integrationen

| Service | Zweck | Fallback bei Ausfall |
|---------|-------|---------------------|
| **ElevenLabs API** | TTS-Vorlesen | Lesen funktioniert weiter, nur TTS down |
| **Google Fonts (Inter)** | Schriftart | System-Font |
| **Let's Encrypt** (via Caddy) | HTTPS | HTTP ohne SSL (unsicher) |
| **Caddy** | Reverse Proxy + SSL | Direkt auf Port 3003 ohne HTTPS |

---

## 📐 Technischer Überblick (für Entwickler)

| Komponente | Technologie | Datei |
|-----------|-------------|-------|
| **Frontend** | Vanilla JS (~890 Zeilen) | `public/app.js` |
| **HTML** | Semantisches HTML5 | `public/index.html` |
| **CSS** | Custom Properties, Flexbox, Glassmorphism | `public/styles.css` |
| **Backend** | Express.js (~348 Zeilen) | `server.js` |
| **Datenbank** | SQLite (better-sqlite3) | `db.js` |
| **EPUB-Parser** | AdmZip + JSDOM | `epub-parser.js` |
| **TTS-Service** | ElevenLabs API (Streaming) | `tts-service.js` |
| **Tests** | Playwright (16 E2E) | `tests/reader.spec.js` |
| **Process Manager** | PM2 | `ecosystem.config.js` |

---

## 🚫 Was die App NICHT ist (und auch nicht sein will)

- ❌ **Kein Kindle-Ersatz** — kein Einkauf, kein DRM, kein Cloud-Sync
- ❌ **Kein PDF-Reader** — EPUB-only
- ❌ **Kein Audio-Player** — TTS ist zum Vorlesen, nicht zum Musik hören
- ❌ **Kein Social Network** — keine Bewertungen, keine Kommentare
- ❌ **Kein Calibre** — keine Metadaten-Bearbeitung, keine Konvertierung
- ❌ **Kein Multi-User** — ein Regal für eine Person
- ❌ **Keine Offline-App** — braucht Internet (für ElevenLabs + EPUB-Load)

---

*VISION.md erstellt: 2026-06-20 — Basiert auf Code-Review von reader-app (890 Zeilen JS, 1276 Zeilen CSS, 348 Zeilen Server)*