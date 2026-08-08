# 🎛️ BeatGen UI/Logic Refactoring — Masterplan

_Erstellt: 2026-08-08 23:14 CEST — aus Session mit Bastian_
_Status: 📋 Plan finalized, ready for implementation_

---

## Entscheidungen (Bastian)

1. **Sync pro Track** — ein Sync-Toggle pro Track, nicht pro Genre
2. **Lokal verwerfen** — bei Re-Sync werden lokale Genre-Werte verworfen
3. **TR-8S Mapping** ✅ — 11 Drum-Instrumente nach TR-8S Standard-Kit
4. **Flat List** — Drum-Slider als flache Liste, keine Sub-Tabs

---

## A) Sync-System — "Sync with Global" pro Track

### Konzept
- Jeder Track hat **einen** Sync-Toggle (nicht pro Genre)
- Default: ✅ Synced → alle 6 Genre-Slider des Tracks spiegeln Global
- User schaltet Sync aus → Track bekommt eigene Genre-Slider, initial kopiert von Global
- User schaltet Sync wieder ein → lokale Werte werden **verworfen**, Track folgt wieder Global

### Store-Änderung
```js
trackGenreOverrides: {
  drums: null,  // null = synced, sonst { techno: 40, house: 15, ... }
  bass: null,
  synth: null,
}
```
- `null` → Global-Werte werden verwendet
- `{ techno: 65, ... }` → diese Werte ersetzen Global für diesen Track
- `trackGenres` (altes volles Objekt) fliegt komplett raus

### UI in Track-Card
```
🎸 Bass                    [🔗 Synced ●]
─────────────────────────────────────
Wenn Synced:
  "Following Global Mix" (dimmed info text)
  Keine Genre-Slider sichtbar

Wenn Unsynced:
  6 Genre-Slider (genau wie Global-Card, aber nur für diesen Track)
  Reset-Button: "↺ Reset to Global"
```

### Engine-Integration
- `PatternEngine.generate()` prüft pro Track: `trackGenreOverrides[track] ?? genres`
- Keine Änderung an `GenreMixer.mixTrack()` nötig — kriegt einfach die aufgelösten Weights

---

## B) Tab-basierte Track-Auswahl

### Layout (von oben nach unten)
```
┌─────────────────────────────────┐
│ Header (MIDI-Status, Settings)  │
├─────────────────────────────────┤
│ Track Tabs:                     │
│  [🌍 Global] [🥁 Drums] [🎸 Bass] [🎹 Synth] │
│   Active glow in track color    │
│   Mini-Badges: MUTE/SOLO/SYNC   │
├─────────────────────────────────┤
│                                 │
│  Aktive Card (wechselt per Tab) │
│                                 │
├─────────────────────────────────┤
│ TransportBar (fixed bottom)     │
└─────────────────────────────────┘
```

### Cards
| Card | Inhalt |
|------|--------|
| 🌍 **Global** | Genre Mix (Master-Slider, 6 Stück), Mood Knobs (6), Swing Control |
| 🥁 **Drums** | Sync-Toggle, ggf. eigene Genre-Slider, Drum Mix (11 Instrumente), Density/Complexity/Groove Knobs, Mute/Solo/Volume, 🎲 Mutate |
| 🎸 **Bass** | Sync-Toggle, ggf. eigene Genre-Slider, Density/Complexity/Groove Knobs, Darkness/Weirdness/Octave Sliders, Note Range, Mute/Solo/Volume, 🎲 Mutate |
| 🎹 **Synth** | Sync-Toggle, ggf. eigene Genre-Slider, Density/Complexity/Groove Knobs, Darkness/Weirdness/Octave Sliders, Note Range, Chord Mode, Mute/Solo/Volume, 🎲 Mutate |

### Tab-Pill Design
- Inaktiv: `bg-black/20` mit Icon + Name
- Aktiv: leuchtet in Track-Farbe (`boxShadow: 0 0 12px ${color}40`)
- Mute-Indikator: kleiner roter Punkt links oben
- Solo-Indikator: kleiner gelber Punkt
- Unsynced-Indikator: `[✕]` Badge

### Vorteile
- Nur eine Card im DOM → bessere Performance
- Klar, was gerade editiert wird
- Mobile-friendly (Tabs sind finger-groß)
- Global hat endlich einen klaren Platz als "Master"

---

## C) Drum-Spur: 5 → 11 Instrumente (TR-8S)

### Neues Drum-Instrument-Mapping
| # | Key | Label | MIDI Note |
|---|-----|-------|-----------|
| 1 | `kick` | BD Kick | 36 |
| 2 | `snare` | SD Snare | 38 |
| 3 | `loTom` | LT Low Tom | 45 |
| 4 | `midTom` | MT Mid Tom | 47 |
| 5 | `hiTom` | HT Hi Tom | 50 |
| 6 | `rim` | RS Rim Shot | 37 |
| 7 | `clap` | HC Clap | 39 |
| 8 | `chh` | CH Closed HH | 42 |
| 9 | `ohh` | OH Open HH | 46 |
| 10 | `crash` | CR Crash | 49 |
| 11 | `ride` | RC Ride | 51 |

### DrumMixPanel Layout (Flat List)
```
🦶 Kick & Snare ─────────────────
BD Kick  [████████░░] 100%
SD Snare [████████░░] 100%

🪘 Toms ─────────────────────────
LT Low   [████████░░] 80%
MT Mid   [████████░░] 60%
HT Hi    [████████░░] 40%

💿 Hihats & Cymbals ────────────
CH Closed[████████░░] 100%
OH Open  [████████░░] 40%
CR Crash [████████░░] 20%
RC Ride  [████████░░] 30%

👏 Percussion ───────────────────
RS Rim   [████████░░] 50%
HC Clap  [████████░░] 60%
```

### Änderungen
- `drumMap.js`: `TEMPLATE_KEYS` um die 6 neuen erweitern
- `GenreLibrary.js`: Alle Genre-Templates um Toms, Rim, Open HH, Crash, Ride erweitern
- `DrumMixPanel.jsx`: 11 Slider statt 5, gruppiert mit Section-Headern
- `GenreMixer.js`: `mixTrack('drums', ...)` ruft `mixDrumPattern` für alle 11 Keys auf
- `PatternEngine.js` → `_applyDrumWeights()`: 11 Instrumente durchiterieren
- Store `trackParams.drums`: 11 Weight-Felder

---

## D) Edge Cases & Verhalten

### Sync-Interaktionen
- Global-Änderung bei synced Track → Track folgt sofort (wie jetzt)
- Global-Änderung bei **unsynced** Track → Track bleibt auf eigenen Werten, keine Änderung
- Sync OFF → Werte werden 1:1 von Global kopiert als Startpunkt
- Sync wieder ON → lokales `trackGenreOverrides[track]` wird auf `null` gesetzt, lokale Werte verworfen
- 🔄 Next Pattern → betrifft ALLE Tracks global (nonce), egal ob synced oder nicht. Unsynced Tracks verwenden ihre eigenen Genre-Weights + neuen Nonce
- 🎲 Mutate → betrifft nur diesen Track (eigenes mutationCount-Feld), verwendet dessen aufgelöste Genre-Weights

### Presets
- `trackGenreOverrides` wird mitgespeichert
- `null` = synced, Objekt = unsynced mit diesen Werten
- Alte Presets ohne `trackGenreOverrides` → Migration: alles `null` (synced)

### Reset-Regeln (bleiben gleich)
- Genre/Mood/Swing-Änderung → `mutationCount = {0,0,0}`
- Per-Track-Parameter → kein Reset

---

## E) Was wegfällt

- `GenreWeights.jsx` → wird Teil der Global-Card + Track-Cards (wiederverwendbare `GenreSliders`-Komponente)
- `TrackPanel.jsx` — komplett ersetzt durch Tab-System
- `genreScope` State → fliegt raus, ersetzt durch `activeTab` + `trackGenreOverrides`
- `trackGenres` State → ersetzt durch `trackGenreOverrides`
- `setGenreScope()`, `setTrackGenreWeight()` Actions → ersetzt durch `setTrackSync()` + `setTrackGenreOverride()`
- `SCOPE_CONFIG` → ersetzt durch `TAB_CONFIG`

---

## F) Neue/geänderte Dateien

| Datei | Aktion |
|-------|--------|
| `src/store/useStore.js` | `trackGenreOverrides` statt `trackGenres`, Sync-Actions, `activeTab` |
| `src/App.jsx` | Tab-State, nur eine Card rendern, keine Genre-Scope-Logik mehr |
| `src/components/TrackTabs.jsx` | **Neu** — Tab-Pills mit Badges |
| `src/components/GenreSliders.jsx` | **Neu** — Extrahiert aus GenreWeights, mit optionalem Sync-Mode |
| `src/components/GlobalCard.jsx` | **Neu** — Global: Genre Mix + Mood + Swing |
| `src/components/TrackCard.jsx` | **Neu** — Eine Track-Card (Drums/Bass/Synth) |
| `src/components/GenreWeights.jsx` | 🗑️ Gelöscht |
| `src/components/TrackPanel.jsx` | 🗑️ Ersetzt |
| `src/components/DrumMixPanel.jsx` | 🔧 11 Slider, gruppiert |
| `src/utils/drumMap.js` | 🔧 TEMPLATE_KEYS um 6 erweitert |
| `src/engine/GenreLibrary.js` | 🔧 Templates um 6 Drum-Instrumente erweitert |
| `src/engine/GenreMixer.js` | 🔧 mixTrack für 11 Drum-Instrumente |
| `src/engine/PatternEngine.js` | 🔧 trackGenreOverrides auflösen + 11 Drums |

---

## G) Implementierungs-Reihenfolge

1. **Store-Refactoring** — `trackGenreOverrides`, `activeTab`, Sync-Actions
2. **Tab-System UI** — `TrackTabs.jsx`, `App.jsx` Umbau
3. **Genre-Sync-Logik** — `GenreSliders.jsx`, `GlobalCard.jsx`, `TrackCard.jsx`
4. **Drum-Expansion (11 Instrumente)** — `drumMap.js`, `GenreLibrary.js`, `DrumMixPanel.jsx`, Engine-Integration
5. **Cleanup** — Alte Komponenten löschen, Preset-Migration, Build & Deploy & Test

### Geschätzte Komplexität

| Aufgabe | Aufwand | Risiko |
|---------|---------|--------|
| Store-Refactoring | Mittel | Niedrig |
| Tab-System UI | Mittel | Niedrig |
| Genre-Sync-Logik | Mittel | Mittel |
| 11 Drum-Instrumente | **Hoch** | Mittel |
| Alte Komponenten-Cleanup | Niedrig | Niedrig |
| Preset-Migration | Niedrig | Niedrig |
| Build & Deploy | Niedrig | Niedrig |

---

## H) GenreLibrary Templates

Für die 6 neuen Drum-Instrumente pro Genre (6 Genres × 6 Instrumente × 16 Steps):
- Auto-generiert basierend auf typischen Genre-Konventionen
- Techno: Toms spärlich (nur Fills), Ride auf Offbeat, Crash nur am Taktanfang
- House: Open HH auf Offbeat, Toms in Fills, Rim Shot als Backbeat-Alternative
- Acid: Toms für Acid-Roll-Effekte, Crash sporadisch
- Trance: Ride durchgehend 8tel, Open HH builds, Toms in Breakdowns
- D&B: Breakbeat-Toms, Crash als Akzent, Ride für Blast-Beats
- Hip-Hop: Rim Shot als Snare-Alternative, Open HH für Groove, Toms in Fills

---

_Status: 📋 Plan finalized. Bastian's answers: sync pro track, lokal verwerfen, TR-8S mapping confirmed, flat list for drums._