# AMYlive UI Refactor Plan

**Stand:** 2026-07-13
**Problem:** Dashboard ist aufgebläht (782 Zeilen), Module verschwinden im Mobile-SwipeStack, Usability grottig.

## Ziel: 3 klare Screens

Aktuell: Dashboard + Patches + Settings.
Neu: **Dashboard → Live Board → Patches → Settings**

### Neue Navigation

```
[🏠 Dashboard] [🎛️ Live Board] [📚 Patches] [⚙️ Settings]
```

- **Dashboard** (Startseite) — Verbindung, MIDI-Status, Quick-Overview, "Connect & Go"
- **Live Board** (NEU) — Vollbild-Patch-Editor mit Keyboard-Flyout, das Herz der App
- **Patches** (unverändert) — Patch Library
- **Settings** (kann warten)

---

## 1. Dashboard → Leanscreen ("Connect & Go")

**Aktuell:** Dashboard hat ALLES — Canvas, Log, Buttons, Module.
**Neu:** Nur das Nötigste:

- MIDI Connect/Status (großer Button)
- Verbundene Device-Info
- Log nur als minimiertes Overlay
- "Start Live Session" Button → switcht zu Live Board + läd Patch vom Board

Der ganze Modul-Kram, Log-Panel und Quick-Actions kommen da raus.

---

## 2. Live Board (NEU) — Der Hauptscreen

**Route:** `/live`
**Bottom-Nav Tab:** Zwischen Dashboard und Patches

### Was passiert beim Betreten:

```
[Connect] → [Auto-Load Patch vom Board]
         → [Oscillatoren als Karten im Grid]
         → [Keyboard ist ausgeklappt]
```

**Ohne Verbindung:**
- Patch-Selector (Factory Patches) als Fallback
- "Connect to AMYboard" Banner oben

### Layout (mobile-first):

```
┌─────────────────────────┐
│ 🔵 AMYboard connected   │ ← Status-Bar (klein)
│ Patch: Juno Brass #42   │
├─────────────────────────┤
│                         │
│  [OSC 0]  [FILTER 0]   │ ← Modul-Grid (scrollbar)
│  [ENV 0]               │
│  [OSC 1]               │
│  [LFO 0]               │
│                         │
│  [+ Add Module]         │ ← Floating Action Button
├─────────────────────────┤
│ ═══ Keyboard (Flyout) ═══ │ ← 30%–60% der Höhe
│ C  C# D  D# E  F  F# ...│    Swipe-Up zum maximieren
│ ════════════════════════ │
└─────────────────────────┘
```

### Desktop:

```
┌────────────────────────────────────────┐
│ Status | Patch Info | Quick Actions    │
├──────────────────────┬─────────────────┤
│                      │   🎹           │
│   Module Grid        │   Keyboard     │
│   (3 columns)        │   (sidebar)    │
│                      │                │
│                      │                │
├──────────────────────┴─────────────────┤
│ Bottom Controls: Save | Load | Export  │
└────────────────────────────────────────┘
```

### Keyboard Flyout (kritisch)

**Mobile:**
- Fixed am unteren Rand, ca 30% Bildschirmhöhe
- Swipe-Up → Maximierung auf 60%
- Swipe-Down → Minimieren auf Tab-Leiste
- Multi-Touch (mindestens 3 Finger)
- Oktav-Wahl via +/- Buttons oben
- Velocity-sensitive (Druck/Touch-Dauer simuliert)

**Desktop:**
- Sidebar rechts (oder optional unten)
- Computer-Keyboard als MIDI-Input (C–B Reihe)
- Mausklick + Scroll für Velocity

### Modul-Verwaltung

- "Add Module" → Bottom Sheet / Dropdown: OSC, Filter, Envelope, LFO, Synth, Mixer
- Remove: Swipe-to-delete oder X-Button
- Jedes Modul zeigt seine Parametern (Slider, Pills) wie aktuell im OscillatorCard
- **Multi-Synth Support:** Jeder Synth hat eigenes OSC-Set, sichtbar als "Synth 0", "Synth 1" Tabs oder Sections im Grid

---

## 3. Was aus Dashboard rausfliegt / umzieht

| Aktuell | Neu |
|---------|-----|
| Save Patch | → Live Board Bottom Bar |
| Load from Board | → Live Board Auto-Load |
| Save to Board | → Live Board Bottom Bar |
| Instantiate Modules | → Live Board (automatisch beim Load) |
| Log Panel | → Overlay/Tab (toggle bar) |
| Modul-Grid | → Live Board |
| SwipeStack | → Live Board (mobile) |
| Patch-Selector Modal | → Live Board Fallback |
| Factory Patches | → Bleibt in Patches + Live Board Fallback |

---

## 4. Implementierungs-Schritte

### Phase 1 — Struktur (1 Session)
1. `LiveBoard.tsx` erstellen (Route `/live`)
2. Bottom Nav erweitern: Dashboard - Live - Patches - Settings
3. Dashboard entschlacken (Log + Module raus, "Start Live" Button rein)
4. Auto-Navigation: Connect → switch zu `/live`

### Phase 2 — Keyboard (1 Session)
5. `KeyboardFlyout.tsx` — WebMIDI Note-Out + Touch-Keyboard
6. Multi-Touch + Velocity + Oktav-Steuerung
7. Desktop-Version (sidebar + Computer-Keyboard)

### Phase 3 — Polish (1 Session)
8. Add-Module Bottom Sheet
9. Multi-Synth Tabs
10. Loading States + Error States
11. Responsive Testen

---

## 5. Technische Notizen

- **Keyboard:** `navigator.requestMIDIAccess()` für Hardware-Keyboard, Touch-KI für Software-Keyboard
- **Multi-Synth:** `AmyPatch.state.synths[]` enthält bereits mehrere Synths — jede kriegt eigenen Tab/Section
- **Velocity via Pointer Events:** `event.pressure` für Druck-sensitive Displays, Fallback auf Swipe-Geschwindigkeit
- **Auto-Load:** `useConnectionStore` hat `state === 'connected'` → useEffect triggert `loadPatchFromBoard()` + `applyPatchToCanvas()`
- **Log bleibt erhalten** als minimiertes Overlay (Icon unten links), expandiert bei Klick
- **Module Grid** bleibt wie aktuell (grid-cols-1 sm:grid-cols-2 xl:grid-cols-3) — nur im Live Board statt Dashboard