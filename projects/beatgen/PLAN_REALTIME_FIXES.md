# BeatGen — Umsetzungsplan: Echtzeit-Änderungen & MIDI I/O

_Stand: 2026-08-08 19:20 CEST_

---

## 🔍 Analyse: Drei Probleme

### 1️⃣ MIDI-Device in beiden Listen (Output + Input)
**Problem:** Ein Gerät (z.B. TR-8S, Audio Interface) taucht oft als Output- UND Input-Port auf, aber mit unterschiedlichen IDs. Der User will dasselbe physische Gerät für beides auswählen können — aktuell muss er in zwei getrennten Dropdowns suchen.

**Root Cause:** Die Output- und Input-Listen sind komplett getrennt. Kein Link zwischen beiden. Wenn der User sein Output-Device ausgewählt hat, muss er im Input-Dropdown manuell den passenden Port suchen.

**Lösung:** Ein "🔗 Use same device for input" Button/Toggle, der automatisch den korrespondierenden Input-Port zum gewählten Output-Gerät matched (Name-Matching).

### 2️⃣ Parameter-Änderungen erst nach Play/Stop wirksam
**Problem:** Änderungen an Genre, Mood, Swing etc. setzen `patternDirty = true`, werden aber erst am Takt-Ende (nach 16 Steps) ins laufende Pattern übernommen. Der User muss warten — oder sogar Play/Stop drücken damit was passiert.

**Root Cause:** `MidiScheduler.markDirty()` + `_scheduleSteps()` wendet neue Patterns nur bei `nextStepIndex >= 16` (Bar-End) an. Im `App.jsx` gibt's keinen Mechanismus der bei Parameter-Änderungen sofort das Pattern neu generiert und in den Scheduler lädt.

**Lösung:** Pattern sofort (nicht erst am Bar-End) regenerieren und in den laufenden Scheduler laden. Der Scheduler merged das neue Pattern ab dem nächsten Step.

### 3️⃣ Externer MIDI Transport (Start/Stop/Continue)
**Problem:** Externe MIDI Start/Stop/Continue-Nachrichten werden nur im `clockSource === 'midi'` Mode beachtet. Wenn der User auf Internal Clock steht, werden externe Transport-Befehle ignoriert.

**Root Cause:** In `App.jsx` checken die Callbacks `clockParser.onStart`/`onStop` auf `state.clockSource === 'midi'`.

**Lösung:** Externe Transport-Befehle immer beachten — unabhängig vom Clock-Source-Mode. Bei Start: Play triggern. Bei Stop: Stop triggern. Bei Continue: Play triggern (resume).

---

## 📋 Umsetzungsplan

### Fix 1: MIDI I/O Device Linking

**Betroffene Dateien:**
- `src/midi/MidiEngine.js` — `matchInputForOutput(deviceId)` Methode
- `src/components/SettingsPanel.jsx` — "Use same device" Button + Logik
- `src/store/useStore.js` — `selectedInputDevice` State

**Änderungen:**

#### A. `MidiEngine.js` — Neue Methode
```javascript
/**
 * Find matching input device for a given output device ID
 * Matches by device name (manufacturer prefix stripped)
 */
matchInputForOutput(outputDeviceId) {
  const output = this.access?.outputs.get(outputDeviceId)
  if (!output) return null
  const outName = (output.name || '').toLowerCase().trim()
  // Find input with matching name
  for (const [id, input] of this.access.inputs) {
    const inName = (input.name || '').toLowerCase().trim()
    if (inName === outName || inName.includes(outName) || outName.includes(inName)) {
      return { id, name: input.name }
    }
  }
  return null
}
```

#### B. `SettingsPanel.jsx` — Link-Button
- Im MIDI Input-Bereich (nur wenn Output ausgewählt + clockSource=midi):
  - Button: "🔗 Use [Output-Device-Name] for input"
  - Ruft `midiEngine.matchInputForOutput(outputId)` auf
  - Setzt `selectedInputDevice` auf den gematchten Port
  - Visuelles Feedback: grüner Haken wenn Input = Output-Device

#### C. Zusätzlich: Input-Liste IMMER anzeigen
- Aktuell zeigt SettingsPanel MIDI-Input nur wenn `clockSource === 'midi'`
- Ändern: Input-Select immer sichtbar, damit User das Device auch im Internal-Mode für Transport auswählen kann
- Label anpassen: "MIDI Input (Clock + Transport)"

---

### Fix 2: Echtzeit-Pattern-Updates (Kein Play/Stop nötig)

**Betroffene Dateien:**
- `src/App.jsx` — Parameter-Change → Pattern-Regeneration + Scheduler-Load
- `src/midi/MidiScheduler.js` — `loadPatternLive()` Methode für Mid-Bar Update

**Änderungen:**

#### A. `MidiScheduler.js` — Neue Methode `loadPatternLive()`
```javascript
/**
 * Load new pattern immediately at next step boundary (not bar end)
 * Smoother than bar-end: pattern switches within 1 step
 */
loadPatternLive(pattern, tracks) {
  if (!this.isPlaying) return
  this.rawPattern = pattern
  this.tracks = tracks
  // Map immediately — will be picked up by _scheduleSteps lookahead
  this.pattern = this.mapper.mapPattern(pattern, tracks)
  this.patternDirty = false
}
```

Aktuell funktioniert `markDirty()` erst am Bar-End. `loadPatternLive()` überschreibt das aktive Pattern sofort — der Scheduler-Lookahead (100ms) pickt die neuen Steps automatisch auf.

#### B. `App.jsx` — Pattern-Regeneration bei Parameter-Änderung
Neuer `useEffect` der auf Genre/Mood/Swing-Änderungen reagiert:

```javascript
// Real-time pattern update on parameter change
useEffect(() => {
  const scheduler = schedulerRef.current
  if (!scheduler?.isPlaying) return
  // Skip in external clock mode — pattern regenerates on bar end there
  if (useStore.getState().clockSource === 'midi') return

  const pattern = generatePattern()
  scheduler.loadPatternLive(pattern, tracks)
}, [genres, mood, swingMode, swingAmount, trackSwing, tracks])
```

⚠️ **Wichtig:** Der existierende `markDirty`/`onPatternRequest` Mechanismus kann bleiben als Fallback für den External-Clock-Mode.

#### C. `useStore.js` — `patternDirty` Flag entfernen
- `patternDirty` wird nicht mehr benötigt (Pattern lädt sofort live)
- Aus allen `set*` Actions entfernen (Genre, Mood, Swing)
- ODER: `patternDirty` auf `false` setzen und die Bar-End-Regeneration komplett deaktivieren
- **Entscheidung:** `patternDirty` beibehalten für External-Clock-Mode. Im Internal-Mode via `loadPatternLive()` sofort anwenden.

---

### Fix 3: Externer MIDI Transport immer beachten

**Betroffene Dateien:**
- `src/App.jsx` — `clockParser.onStart/onStop/onContinue` Callbacks (Logik ändern)
- `src/store/useStore.js` — State für "externer Transport aktiv"
- `src/components/TransportBar.jsx` — Play-Button Verhalten
- `src/components/Header.jsx` — Play-Button Verhalten

**Änderungen:**

#### A. `App.jsx` — Transport-Callbacks umbauen

```javascript
// Transport Start from external device (ALWAYS listen)
clockParser.onStart = () => {
  useStore.getState().setIsExternalRunning(true)
  const state = useStore.getState()
  const scheduler = schedulerRef.current
  if (!scheduler) return

  // Generate pattern
  const pattern = generateCurrentPattern(state)

  if (state.clockSource === 'midi') {
    // External clock mode: let master clock drive steps
    scheduler.start(pattern, state.bpm, state.tracks, 'midi')
    scheduler.startExternal(pattern, state.tracks)
  } else {
    // Internal clock mode: start with internal timer
    scheduler.start(pattern, state.bpm, state.tracks, 'internal')
    useStore.getState().play()
  }
}

// Transport Stop from external device (ALWAYS listen)
clockParser.onStop = () => {
  useStore.getState().setIsExternalRunning(false)
  const scheduler = schedulerRef.current
  scheduler?.stop()
  useStore.getState().stop()
}

// Transport Continue from external device (ALWAYS listen)
clockParser.onContinue = () => {
  // Behaves like Start — resumes from beginning
  clockParser.onStart()
}
```

#### B. `TransportBar.jsx` & `Header.jsx` — Play-Button State
- Wenn `isExternalRunning && clockSource === 'internal'`: Play-Button zeigt Pause-Icon (aktiv), aber Click stoppt nur intern
- Badge: "EXT" anzeigen wenn externer Transport aktiv (unabhängig von clockSource)

#### C. `useStore.js` — Neuer State
```javascript
externalTransportActive: false,  // true when external device is running
```
- `setIsExternalRunning` renamed to `setExternalTransportActive` (oder neuer State zusätzlich)
- `isExternalRunning` behält aktuelle Semantik (clock läuft). Neuer State: `externalTransportActive` (Master-Transport läuft)

---

## 🔄 Auswirkungen & Risiken

| Änderung | Risiko | Mitigation |
|----------|--------|------------|
| Live-Pattern-Load (Fix 2) | Timing-Glitch beim Mid-Bar-Wechsel | Pattern nur bei nextStep akivieren, nicht mid-step Noten killen |
| Live-Pattern-Load (Fix 2) | Zu viele Regenerations (Performance) | Debounce 50ms auf Pattern-Regeneration |
| Externer Transport (Fix 3) | Konflikt: User klickt Play während extern läuft | Play-Button disablen wenn externer Transport aktiv |
| Device-Matching (Fix 1) | Namens-Matching zu aggressiv | Nur exakten Match ODER Substring-Match mit min. 3 Zeichen |

---

## 📁 Datei-Änderungsliste

```
projects/beatgen/
├── src/
│   ├── App.jsx                    ← Fix 2+3: Live-Pattern + Transport-Callbacks
│   ├── midi/
│   │   ├── MidiEngine.js          ← Fix 1: matchInputForOutput()
│   │   └── MidiScheduler.js       ← Fix 2: loadPatternLive()
│   ├── components/
│   │   ├── SettingsPanel.jsx      ← Fix 1: Link-Button + Input immer sichtbar
│   │   ├── TransportBar.jsx       ← Fix 3: Externer Transport UI
│   │   └── Header.jsx             ← Fix 3: Play-Button + EXT-Badge
│   └── store/
│       └── useStore.js            ← Fix 3: externalTransportActive State
```

---

## ✅ Reihenfolge

1. **Fix 1** (MIDI I/O Linking) — isoliert, keine Abhängigkeiten
2. **Fix 2** (Echtzeit-Pattern) — hängt von nichts ab, ändert Scheduler + App
3. **Fix 3** (Externer Transport) — baut auf Fix 2 auf (braucht `loadPatternLive`)

---

---

## ✅ Umsetzungs-Status (2026-08-08 ~19:36)

### Fix 1: MIDI I/O Device Linking → ✅ Erledigt
- `MidiEngine.js`: `matchInputForOutput(deviceId)` — matched per Name (case-insensitive, exact first, then substring)
- `SettingsPanel.jsx`: Input-Select jetzt **immer sichtbar** (nicht nur bei clockSource=midi). "🔗 Use [device] for input" Button wenn Output ausgewählt + Match existiert

### Fix 2: Echtzeit-Pattern-Updates → ✅ Erledigt
- `MidiScheduler.js`: `loadPatternLive(pattern, tracks)` — mapped und setzt `this.pattern` sofort, nur wenn `isPlaying`
- `App.jsx`: Neuer `useEffect` auf `[genres, mood, swingMode, swingAmount, trackSwing, tracks]` mit 50ms Debounce
- `markDirty`/`onPatternRequest` bleibt als Fallback erhalten

### Fix 3: Externer MIDI Transport → ✅ Erledigt
- `useStore.js`: Neuer `externalTransportActive` State + `setExternalTransportActive` Action
- `App.jsx`: Alle `clockSource === 'midi'` Guards aus Transport-Callbacks entfernt
- `TransportBar.jsx`: Play-Button disabled bei `externalTransportActive`, EXT Badge (amber bei internal, purple bei midi)
- `Header.jsx`: Play-Button disabled, EXT Badge bei `externalTransportActive`

---

## 🐛 Bugfix: Externer Clock + Echtzeit-Pattern (2026-08-08 ~19:44)

**Problem:** Nach Fix 2 + 3 funktionierte Echtzeit-Pattern-Änderung nur im Internal-Mode.
Im External-Clock-Mode griff der `clockSource === 'midi'` Guard im Live-Update-Effect → Pattern wechselte nur am Bar-End.

**Root Cause:** `App.jsx` Live-Update-Effect hatte zwei Guards:
```javascript
if (useStore.getState().clockSource === 'midi') return  // ← außen
// ...
if (currentState.clockSource === 'midi') return          // ← innen im Debounce
```

**Fix:** Beide Guards entfernt. `loadPatternLive()` funktioniert für beide Modi identisch —
es überschreibt `this.pattern` direkt, und sowohl `_onExternalStep()` als auch
`_scheduleSteps()` lesen aus demselben Array.

**Betroffene Dateien:** Nur `App.jsx` (2 Zeilen entfernt, Kommentar aktualisiert)

---

_Erstellt: 2026-08-08 | Status: ✅ UMGESETZT + BUGFIX_
_Letzter Build: `index-Ce6s1V5h.js` (2026-08-08 19:44)_