# 🗺️ Reader App — Roadmap

**Projekt:** reader.steppa.online
**Stand:** 2026-06-18
**Status:** Phase 0 abgeschlossen (Core-App funktional)

---

## ✅ Phase 0 — Core App (ABGESCHLOSSEN)

- [x] EPUB-Upload (Drag & Drop + File-Picker)
- [x] EPUB-Parsing (Metadaten, Kapitel, Cover)
- [x] Bookshelf mit Cover-Grid und Fortschrittsanzeige
- [x] Reader-View mit Kapitel-Inhalt
- [x] Inhaltsverzeichnis (TOC) Side-Panel
- [x] Kapitel-Navigation (Prev/Next + Keyboard)
- [x] Lesezeichen (Kapitel + Scroll-Progression)
- [x] TTS-Vorlesen (ElevenLabs, Play/Pause/Stop, Speed, Voice)
- [x] Dark/Light Theme mit Persistenz
- [x] Responsive Design (Mobile)
- [x] Sticky Player Bar (immer sichtbar)
- [x] Playwright E2E-Tests (16 Tests)
- [x] Caddy Reverse Proxy mit SSL

---

## 🔴 Phase 1 — UX-Basics (NÄCHSTE SESSION, ~2-3h)

Ziel: Die häufigsten UX-Friction Points eliminieren.

### 1.1 Sprach-Konsistenz
- [ ] EPUB-Parser: Fallback-Titel auf "Kapitel X" ändern (statt "Chapter X")
- [ ] Alle UI-Texte auf Deutsch prüfen und vereinheitlichen
- [ ] Kapitel-Titel aus EPUB übernehmen (wenn vorhanden), sonst "Kapitel X"

### 1.2 Loading States
- [ ] Skeleton-Loader oder Spinner beim Buch öffnen (`openBook()`)
- [ ] "Lade Audio..." Text im Player während TTS-Request
- [ ] Progress-Indikator beim EPUB-Parsing (bei großen Büchern)

### 1.3 Suchfeld im Bookshelf
- [ ] Suchfeld oben im Shelf-View
- [ ] Filtert Bücher nach Titel und Autor (client-seitig)
- [ ] Debounced Input (300ms)

### 1.4 Besseres Error-Handling
- [ ] Toast-Messages für alle API-Fehler (Upload, TTS, Bookmarks)
- [ ] Retry-Button bei fehlgeschlagenen TTS-Requests
- [ ] "Keine Bücher" State mit Upload-CTA (statt leerer Grid)

---

## 🟡 Phase 2 — Leseerlebnis (FOLGENDE SESSION, ~3-4h)

Ziel: Die Kernfunktion "Lesen" signifikant verbessern.

### 2.1 Font-Größen-Anpassung
- [ ] A+/A- Buttons im Reader-Header oder Player
- [ ] Persistenz in localStorage
- [ ] Bereich: 14px–28px, Steps: 2px

### 2.2 Generierte Cover-Bilder
- [ ] Wenn EPUB kein Cover hat: farbiger Platzhalter mit Titel-Initialen
- [ ] Farbpalette basierend auf Titel-Hash (deterministisch)
- [ ] CSS-Only Lösung (kein Server-Call nötig)

### 2.3 Lesefortschritt-Bar
- [ ] Dünne Progress-Bar am oberen Rand des Readers
- [ ] Zeigt aktuellen Fortschritt im Buch (Kapitel X von Y)
- [ ] Optional: Prozent-Anzeige

### 2.4 Speed-Slider Mobile verbessern
- [ ] Größerer Touch-Target für Speed-Slider
- [ ] Alternative: Tap-to-Increment Buttons (0.5x → 1.0x → 1.5x → 2.0x)
- [ ] Oder: Preset-Buttons statt Slider

### 2.5 Auto-Advance verbessern
- [ ] Kapitel-Ende: Kurze Pause (2s) bevor nächstes Kapitel startet
- [ ] Option "Automatisch weiterlesen" (Toggle)
- [ ] Buch-Ende: "Nochmal lesen?" / "Zurück zum Regal" Screen

---

## 🟢 Phase 3 — Immersion (SPÄTER, ~4-5h)

Ziel: Leseerlebnis auf Reader-App-Niveau (Kindle, Apple Books).

### 3.1 Auto-Hide Header/Player
- [ ] Header und Player ausblenden beim Scrollen nach unten
- [ ] Einblenden beim Scrollen nach oben oder Tap
- [ ] Smooth Animation (transform: translateY)

### 3.2 Vollbild-Leseansicht
- [ ] Fullscreen-Button im Header
- [ ] Browser Fullscreen API
- [ ] Auto-Hide Controls im Fullscreen

### 3.3 Swipe-Navigation (Mobile)
- [ ] Touch-Events für Swipe-links/rechts
- [ ] Swipe links = nächstes Kapitel
- [ ] Swipe rechts = vorheriges Kapitel
- [ ] Momentum-basiert (nicht nur Distanz)

### 3.4 Text-Anpassung
- [ ] Einstellungspanel für:
  - Font-Familie (Inter, Georgia, System-UI, Serif)
  - Zeilenhöhe (1.2–2.0)
  - Content-Breite (600px–900px)
- [ ] Persistenz in localStorage

### 3.5 Dark Mode Auto-Detection
- [ ] `prefers-color-scheme` Media Query respektieren
- [ ] Beim ersten Besuch: System-Preference als Default
- [ ] Manueller Override bleibt erhalten

---

## 🔵 Phase 4 — Power Features (IRGENDWANN, ~5-8h)

Ziel: Features für Power-User und langfristige Nutzbarkeit.

### 4.1 Echtes TTS-Streaming
- [ ] Audio chunkweise abspielen statt komplett laden
- [ ] MediaSource API für progressive Wiedergabe
- [ ] Sofortiger Start, während Rest noch lädt

### 4.2 Offline-Support (PWA)
- [ ] Service Worker für Caching
- [ ] Install Prompt (Add to Home Screen)
- [ ] EPUBs lokal im Browser speichern (IndexedDB)
- [ ] Offline lesen möglich

### 4.3 Annotations / Hervorhebungen
- [ ] Text markieren (Long-Press auf Mobile)
- [ ] Farbige Hervorhebungen (3 Farben)
- [ ] Notizen zu Hervorhebungen
- [ ] Export (Markdown oder JSON)

### 4.4 Multi-User / Auth
- [ ] Login mit Passwort oder Magic Link
- [ ] Persönliche Bücherregale pro User
- [ ] Sessions / Cookies

### 4.5 Statistiken
- [ ] Lesezeit pro Buch
- [ ] Bücher pro Monat
- [ ] TTS-Nutzung (Minuten, Stimmen)
- [ ] Fortschritts-History

### 4.6 OPDS-Integration
- [ ] Bücher aus Calibre-OPDS-Quellen importieren
- [ ] Automatischer Sync

---

## 📊 Aufwandsschätzung

| Phase | Aufwand | Wann | Priorität |
|-------|---------|------|-----------|
| Phase 0 — Core | ✅ fertig | — | — |
| Phase 1 — UX-Basics | ~2-3h | Nächste Session | 🔴 Hoch |
| Phase 2 — Leseerlebnis | ~3-4h | Danach | 🟡 Mittel |
| Phase 3 — Immersion | ~4-5h | Später | 🟢 Niedrig |
| Phase 4 — Power Features | ~5-8h | Irgendwann | 🔵 Nice-to-have |

**Gesamt (Phase 1-4):** ~14-20h Entwicklungszeit

---

## 🎯 Entscheidungspunkte

### Vor Phase 2:
- **Framework-Wechsel?** Wenn die App wächst (Multi-User, Sync, mehr Views), lohnt sich React/Vue/Svelte. Vanilla JS ist aktuell noch OK für 2 Views.
- **Echtes Streaming?** Die aktuelle TTS-Lösung (kompletter Blob) funktioniert, aber bei langen Kapiteln (>10min) gibt es Wartezeit. MediaSource API wäre die Lösung.

### Vor Phase 4:
- **Auth-System?** Single-User reicht für Bastian. Multi-User nur wenn andere Zugang bekommen.
- **Hosting?** Aktuell auf VPS (Contabo). Bei mehr Usern: eigener Server oder Cloud.

---

## 📝 Technische Schulden

1. **EPUB-Parser Robustheit:** Die Kapitel-Erkennung basiert auf Heuristiken (h1-h3 + Prefixe). Bei manchen EPUBs funktioniert das nicht richtig. Bessere Lösung: EPUB-Nav-Dokument parsen.

2. **TTS Error Recovery:** Wenn ElevenLabs einen Fehler gibt (Rate Limit, API Down), gibt es keinen Retry. Sofortiger Retry mit Backoff wäre besser.

3. **DB-Migrationen:** Aktuell kein Migrationssystem. Bei Schema-Änderungen muss manuell `ALTER TABLE` laufen.

4. **Frontend State Management:** Alles in globalen Variablen. Bei mehr Features wird das unübersichtlich. Event-Bus oder einfacher State-Manager wäre sinnvoll.

---

_Zuletzt aktualisiert: 2026-06-18_
