# AMYlive UI Refactor Plan

**Stand:** 2026-07-13 (v2 — optimiert auf Board-Connected Workflow + Mobile)
**Status:** Phase 1-5 implementiert ✅ + TypeScript Build Fix (14.07. 07:38)
**Problem:** Dashboard aufgebläht (782 Zeilen), kein dedizierter Live-Editor, Modul-Verwaltung umständlich, Mobile-Erfahrung grottig.

## 🎯 Kern-Philosophie

**Board anschließen → Zustand laden → bearbeiten → speichern.**

Der gesamte Flow muss sich anfühlen wie: AMYboard aus der Tasche holen, USB/WebMIDI rein, und *zack* — alles da. Kein rumgeklicke, kein "wo war nochmal der Patch?". Der Editor ist das Produkt, nicht das Dashboard.

---

## 1. Navigation (Bottom Nav, mobile-first)

```
[🏠] [🎛️] [📚] [⚙️]
```

1. **Dashboard** — Connect & Go (Startseite)
2. **Live Board** — Der Haupteditor (NEU)
3. **Patches** — Patch Library (unverändert)
4. **Settings** — Config (kann warten)

---

## 2. Board-Connected Workflow (Der ganze Sinn)

### 2.1 Auto-Discovery + Connect

Beim Seiten-Laden:
1. `navigator.requestMIDIAccess()` → nach AMYboard-Devices scannen
2. Wenn bekanntes Board (MIDI-Name matcht): **Auto-Connect** (kein Button-Klick nötig)
3. Wenn mehrere Boards: Bottom-Sheet "Wähle Board" mit Device-Namen + Signal-Stärke-Icon
4. Wenn kein Board: Großer "Connect to AMYboard" Button + hilfreicher Text ("USB einstecken? WebMIDI erlauben?")

### 2.2 Auto-Load (Patch vom Board holen)

Nach erfolgreichem Connect:
1. **Sofort** `zDZ Dump` an Board senden → Board schickt kompletten State zurück
2. Während des Ladens: **Skeleton Loader** (kein Spinner!) — graue Module-Karten mit Pulsing-Animation
3. State parsen + in Canvas-Module rendern
4. **Fertigmeldung:** Subtiler Checkmark + "Patch geladen" für 2s, dann verschwindet's
5. Keyboard-Flyout klappt automatisch auf (bei Touch-Geräten)

**Ohne Verbindung:**
- Patch-Selector (Factory Patches, 256 Stück) als Fallback
- "🔌 Connect to AMYboard" Banner oben, nicht aufdringlich
- Alle Änderungen lokal speicherbar (localStorage)

### 2.3 Auto-Save (optional, per Setting)

- **"Auto-Save to Board"** Toggle in Settings (default: ON)
- Bei jeder Änderung: Debounced (500ms) → neue Wire-Commands an Board senden
- Kein expliziter "Save" Button nötig, aber optional in der Bottom Bar
- **Visuelles Feedback:** Kleiner "Saved ✓" Indicator oben rechts, erscheint nach jedem Auto-Save

### 2.4 Manuelles Speichern

- **Save to Board** → Patch als `sketch.py` auf Board schreiben (persistent nach Reboot)
- **Save to Local** → Patch in localStorage (eigene Patches)
- **Save as** → Neue Patch-Nummer + Name
- **Export** → Patch-String kopieren / als JSON download

---

## 3. Live Board (Der Hauptscreen)

**Route:** `/live`
**Bottom-Nav Tab:** Zwischen Dashboard und Patches

### 3.1 Layout (mobile-first)

```
┌──────────────────────────────┐
│ 🔵 AMYboard · Juno Brass #42 │ ← Status-Bar (kompakt, einzeilig)
├──────────────────────────────┤
│                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ OSC 0│→│FLTR 0│→│ENV 0 │ │ ← Signal Chain (horizontal scrollbar)
│  │ Saw  │ │LPF   │ │A:0.5 │ │    Jede Karte = 160px breit
│  │ C4   │ │1.2kHz│ │D:0.3 │ │    Verbindungspfeile zwischen Karten
│  └──────┘ └──────┘ └──────┘ │
│  ┌──────┐ ┌──────────────┐   │
│  │ LFO 0│ │ CHAIN VIEW   │   │ ← Weitere Module + Chain Overview
│  │ 0.2Hz│ │ [OSC→FLTR→ENV]│  │
│  └──────┘ └──────────────┘   │
│                              │
│       [+ Add Module]         │ ← Floating Action Button (unten rechts)
│                              │
├──────────────────────────────┤
│  ═══ C C# D D# E F F# ... ═══ │ ← Keyboard Flyout (~30% Höhe)
│  C3  ──── Octave ────  C5  │ │    Swipe-Up zum Maximieren (60%)
│  ════════════════════════════ │
└──────────────────────────────┘
```

### 3.2 Desktop Layout

```
┌──────────────────────────────────────────────┐
│ 🔵 AMYboard · Juno Brass #42  [Save] [Load] │
├────────────────────────────┬─────────────────┤
│                            │                 │
│  ┌──────┐ ┌──────┐ ┌──────┐│  🎹 Keyboard   │
│  │ OSC 0│→│FLTR 0│→│ENV 0 ││  (Sidebar)     │
│  │ Saw  │ │LPF   │ │A:0.5 ││                 │
│  └──────┘ └──────┘ └──────┘│  C C# D D# ...  │
│  ┌──────┐ ┌──────────────┐  │                 │
│  │ LFO 0│ │ CHAIN VIEW   │  │                 │
│  └──────┘ └──────────────┘  │                 │
│                            │                 │
│  [+ Add Module]            │                 │
└────────────────────────────┴─────────────────┘
```

### 3.3 Signal Chain (Der Kern)

**Nicht nur ein Grid!** Module müssen eine visuelle Kette bilden:

**Darstellung:**
- Jedes Modul ist eine kompakte Karte (160px breit, ~120px hoch)
- **Horizontale Anordnung** (scrollbar, wie ein Flow-Chart)
- **Pfeile/Verbindungslinien** zwischen Modulen (OSC → Filter → ENV → Output)
- **Desktop:** 3-4 Module nebeneinander sichtbar
- **Mobile:** 1-2 Module nebeneinander, horizontal scrollbar

**Signal Chain Logik:**
```
OSC ──→ FILTER ──→ AMP (ENV) ──→ OUTPUT
LFO ──→ (moduliert) ──→ FILTER
ENV ──→ (moduliert) ──→ AMP
```

**Interaktion:**
- **Drag & Drop** zum Neu-Anordnen (Modul-Karten verschieben)
- **Langer Tap / Rechtsklick** auf Modul → Kontextmenü: Edit, Remove, Duplicate, Mute
- **Swipe-to-Delete** auf Mobile (mit Undo-Toast)
- **Tap auf Modul** → Expandiert zu Full-Card (alle Parameter sichtbar)
- **Modul muten** → Kleiner Mute-Button oben rechts auf jeder Karte, gedimmtes Aussehen

**Chain Overview (Bottom Sheet):**
- Kompakte Übersicht: `[OSC 0] → [FLTR 0] → [ENV 0] → [BUS 0]`
- Tap auf ein Glied → Scrollt direkt zum Modul
- Zeigt auch Routing (z.B. LFO 0 → FLTR 0 Cutoff)

### 3.4 Module Karten (Komponenten)

| Modul | Mobile (kompakt) | Expanded (Full-Card) |
|-------|------------------|---------------------|
| **OSC** | Waveform-Icon + Note + Freq | + Amp, Detune, PW, Pulse Width Mod |
| **FILTER** | Type (LPF/HPF) + Cutoff + Res | + Env Amount, Key Track, Q |
| **ENV** | A/D/S/R als Mini-Bars | + Attack Curve, Decay Curve, Amount |
| **LFO** | Waveform + Rate | + Sync, Phase, Amount, Dest |
| **SYNTH** | Patch# + Voices | + Amp, Pan, Flags, Portamento |
| **MIXER** | Level + Pan | + Mute, Solo, FX Send |
| **CHAIN** | Mini-Übersicht | Tap-to-Scroll zu Modulen |

### 3.5 Keyboard Flyout (Mobile)

**Zustände:**
1. **Eingeklappt** (ca. 30px Tab-Leiste) — "🎹 Tap to open" mit Oktav-Anzeige
2. **Normal** (30% Höhe) — 1 Oktave + Oktav-Wahl
3. **Maximiert** (60% Höhe) — 2 Oktaven + Velocity-Strip

**Steuerung:**
- **Swipe-Up** → Normal → Maximiert
- **Swipe-Down** → Normal → Eingeklappt
- **Pinch-Zoom** → Oktav-Spanne ändern (2-5 Oktaven)
- **Multi-Touch** → Mindestens 3 gleichzeitig, 5 ideal
- **Velocity:** Druck-sensitive Displays (3D Touch / Apple Pencil) → `event.pressure`
  Fallback: Swipe-Geschwindigkeit (schneller Anschlag = lauter)
- **Octave +/-** Buttons oben links/rechts
- **Pitch Bend / Mod Wheel** → Touch-Strip über den Keys

**Desktop Alternativ:**
- **Computer-Keyboard** als MIDI-Input (Z-Reihe = C-Dur, S-Reihe = #)
- Sidebar rechts (oder unten, per Preference)
- Mausklick + Scroll-Rad für Velocity

---

## 4. Dashboard → "Connect & Go" (Leanscreen)

**Radikale Entschlackung:** Das Dashboard ist nur noch der Einstiegspunkt.

### Was bleibt:
- **Großer Connect-Button** (oder Auto-Connect Status)
- **Verbundene Device-Info** (Name, Firmware-Version, Signal)
- **"Start Live Session" Button** → Switcht zu `/live` + triggert Auto-Load
- **Letzte Patches** (Recent Patches, 5 Stück, aus localStorage)
- **Schnellzugriff:** "Weiter mit letztem Patch" (wenn kein Board da)

### Was fliegt:
- ❌ Canvas (komplett)
- ❌ Log Panel (wird mini-Overlay)
- ❌ Modul-Grid
- ❌ Quick Actions (Save/Load Buttons)
- ❌ SwipeStack
- ❌ Patch-Selector Modal

### Layout (mobile-first):

```
┌──────────────────────────────┐
│        🎹 AMYlive            │
│                              │
│  ┌────────────────────────┐  │
│  │  🔵 AMYboard v2.1      │  │ ← Connect-Status oder Connect-Button
│  │  192.168.178.89        │  │
│  │  [Start Live Session]  │  │
│  └────────────────────────┘  │
│                              │
│  Recent Patches:             │
│  ┌──────┐ ┌──────┐ ┌──────┐ │
│  │Juno  │ │DX7   │ │Pad   │ │ ← Horizontale Chip-Liste
│  │Brass │ │EP    │ │Warm  │ │
│  └──────┘ └──────┘ └──────┘ │
│                              │
│  ℹ️ Log (minimiert)  🔴3    │ ← Nur Icon + Error-Count
│                              │
└──────────────────────────────┘
```

---

## 5. Modul-Verwaltung (Add/Remove/Edit)

### 5.1 Add Module

**Floating Action Button (FAB):** Unten rechts, über dem Keyboard.

**Bottom Sheet ("Add Module"):**
- Kategorien: Oscillators, Filters, Envelopes, LFOs, Synths, Mixers, Effects
- Jede Kategorie: Kompakte Liste mit Modul-Namen + Kurzbeschreibung
- **Search Bar** oben (für viele Module später)
- Favoriten (zuletzt verwendet) als erste Kategorie
- Tap → Modul wird am Ende der Chain eingefügt

### 5.2 Remove Module

**Mobile:**
- **Swipe-to-Delete** auf der Modul-Karte (nach links) → Rotes "Delete" erscheint
- **Long Press** → Kontextmenü mit "Remove"
- **Nach dem Löschen:** 3s Undo-Toast ("🗑️ Filter 0 removed · Undo")

**Desktop:**
- **X-Button** oben rechts auf Hover (Desktop)
- **Rechtsklick** → "Remove" + "Duplicate" + "Mute"

### 5.3 Reorder

**Mobile:**
- **Drag Handle** (≡ Icon) auf jeder Karte → Drag & Drop
- Haptisches Feedback (Vibration on mobile)

**Desktop:**
- Drag & Drop wie mobile
- Oder: ↑↓ Buttons in der Toolbar

### 5.4 Edit Module

- **Tap** auf kompakte Karte → expandiert zur Full-Card
- Full-Card hat alle Parameter als Slider, Pills, Toggles
- **Collapse** wieder per Tap außerhalb oder "Done" Button
- Änderungen sind **sofort live** (werden an Board gesendet)

---

## 6. Multi-Synth Support

AMY kann mehrere Synths gleichzeitig. Jeder Synth hat eigene Oszillatoren, Filter, etc.

### UX:
- **Synth-Tabs** über dem Modul-Grid (horizontal scrollbar)
  ```
  [Synth 0: Juno] [Synth 1: DX7] [Synth 2: Drums] [+]
  ```
- **Active Synth** = hervorgehoben
- Module unter dem Tab gehören zu diesem Synth
- **Neuer Synth**: Tap auf `[+]` → neuer Tab + Default-Setup (OSC + Filter + ENV)
- **Synth löschen**: Long-Press auf Tab → "Remove Synth" (löscht alle zugehörigen Module)
- **Synth umbenennen**: Long-Press auf Tab → "Rename"

### Chain View pro Synth:
```
[Synth 0: Juno Brass]
  [OSC 0] → [FILTER 0] → [ENV 0] → [BUS 0] → OUTPUT
  [LFO 0] ──→ moduliert ──→ FILTER 0 Cutoff

[Synth 1: 808 Drums]
  [OSC 2] → [ENV 2] → [BUS 1] → OUTPUT
```

---

## 7. Mobile UX (Touch-Gesten)

| Aktion | Geste | Feedback |
|--------|-------|----------|
| Modul öffnen | Tap | Animation + Expand |
| Modul löschen | Swipe left | Rotes Overlay + Undo |
| Modul duplizieren | Long press → Menu | Context Menu |
| Chain reorder | Drag handle | Haptik + Ghost-Element |
| Keyboard öffnen | Swipe up | Smooth Slide-Up |
| Keyboard schließen | Swipe down | Smooth Slide-Down |
| Oktave wechseln | Pinch (2 Finger) | Oktav-Zahl ändert sich |
| Parameter ändern | Touch-Slider | Live-Wert + Tooltip |
| Add Module | Tap FAB | Bottom Sheet Slide-Up |
| Synth wechseln | Swipe left/right on tabs | Tab-Scroll |
| Log öffnen | Tap Log-Icon | Overlay von unten |
| Zurück zu Dashboard | Tap 🏠 | Smooth Transition |

**Touch-Zielgrößen:** Mindestens 44×44px (Apple HIG). Slider 48px hoch.

---

## 8. Loading & Error States

### Loading (Auto-Load vom Board)
```
┌──────────────────────────────┐
│ ⏳ Loading Patch from Board  │
│                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ ░░░░░│ │ ░░░░░│ │ ░░░░░│ │ ← Skeleton Cards
│  │ ░░░░░│ │ ░░░░░│ │ ░░░░░│ │    (pulsing gray)
│  └──────┘ └──────┘ └──────┘ │
│                              │
│  [Synth 0 ░░░░] [Synth 1 ░░]│
└──────────────────────────────┘
```

### Error: Board nicht erreichbar
```
┌──────────────────────────────┐
│ ⚠️ Board disconnected        │
│                              │
│  Letzter Patch: Juno Brass   │
│  [Continue with last patch]  │
│  [Try reconnect]             │
│                              │
│  (Änderungen werden lokal    │
│   gespeichert, nicht auf     │
│   Board geschrieben)         │
└──────────────────────────────┘
```

### Error: Patch Load fehlgeschlagen
```
┌──────────────────────────────┐
│ ❌ Patch Load failed          │
│  "Board antwortet nicht"     │
│                              │
│  [Retry] [Load Factory]      │
└──────────────────────────────┘
```

### Empty State (kein Patch, kein Board)
```
┌──────────────────────────────┐
│  🎹                           │
│  No patch loaded              │
│  Connect your AMYboard or     │
│  browse the patch library.    │
│                              │
│  [Browse Patches]             │
└──────────────────────────────┘
```

---

## 9. Log Panel (Overlay, nicht mehr Screen)

**Aktuell:** Nimmt Platz im Dashboard weg.
**Neu:** Minimiertes Overlay, per Tap expandierbar.

```
┌──────────────────────────────────┐
│ ℹ️ Event Log                     │
│──────────────────────────────────│
│ 14:23:42 → Patch loaded from     │
│           board (Juno Brass #42)  │
│ 14:23:45 → OSC 0: freq→440      │
│ 14:23:47 → FILTER 0: cutoff→1.2k│
│ 14:24:01 → Saved to board ✅     │
│──────────────────────────────────│
│ [Clear]                       [X]│
└──────────────────────────────────┘
```

- **Minimiert:** Kleines ℹ️-Icon + Error-Count (rot) in der Status-Bar
- **Expandiert:** Bottom Sheet mit Log-Einträgen
- **Filter:** Error/Warning/Info Tabs
- **Auto-Scroll:** Neue Einträge scrollen nach

---

## 10. Implementierungs-Phasen

## Implementierungs-Status

### ✅ Phase 1 — Struktur + Navigation (DONE 13.07.)
1. ✅ `LiveBoard.tsx` erstellt (Route `/live`) — 619 Zeilen
2. ✅ Bottom Nav: Dashboard - Live - Patches - Settings
3. ✅ Dashboard radikal entschlackt (nur Connect + "Start Live" + Recent Patches)
4. ✅ Auto-Navigation: Connect → `/live` + Auto-Load
5. ✅ Routing + Store-Integration

### ✅ Phase 2 — Signal Chain + Module (DONE 13.07.)
6. ✅ Signal Chain Visual (horizontales Flow-Chart mit Pfeilen)
7. ✅ Module Cards (kompakt/expanded) für alle Modul-Typen)
8. ✅ Add Module Bottom Sheet (Kategorien, Search)
9. ✅ Remove Module mit Undo-Toast
10. ✅ Drag & Drop Reorder (native HTML5 DnD)

### ✅ Phase 3 — Keyboard Flyout (DONE 13.07.)
11. ✅ `KeyboardFlyout.tsx` — Touch-Keyboard + Multi-Touch
12. ✅ Velocity via Touch-Position
13. ✅ Octave-Steuerung (+/- Buttons)
14. ✅ Desktop-Version (Sidebar rechts) + Computer-Keyboard Input

### 🔄 Phase 4 — Multi-Synth + Board Workflow (DONE 13.07.)
15. ✅ Synth-Tabs (add/remove, auto-delete modules)
16. ✅ Auto-Load bei Connect + Auto-Save (debounced 500ms)
17. ✅ Loading/Error/Empty States (Skeleton Loader)
18. ⬜ Manual Save/Load (Board + Local) — Grundstruktur da, Save-to-Board fehlt noch

### ⬜ Phase 5 — Polish (NEXT)
19. ✅ Touch-Gesten (Swipe, Long Press, Pinch) — Framer Motion layout + AnimatePresence
20. ✅ Animationen (Framer Motion für Transitions) — Chain Cards, Overlays, Toasts, FAB, Status
21. ⬜ Responsive Testing (iPhone SE, iPad, 13" Laptop, 27" Monitor)
22. ⬜ Error Handling + Edge Cases — Disconnected Overlay mit Reconnect ✅, Board disconnect während Edit ✅, Save-to-Board ✅

---

## 11. Technische Notizen

- **Keyboard:** `navigator.requestMIDIAccess()` für Hardware-Keyboard, eigener Touch-Handler für Software-Keyboard
- **Velocity:** `PointerEvent.pressure` (0-1) für Druck-sensitive Displays, Fallback auf Swipe-Geschwindigkeit
- **Auto-Load:** `useConnectionStore.state === 'connected'` → `useEffect` triggert `loadPatchFromBoard()` + `applyPatchToCanvas()`
- **Auto-Save:** Debounced (500ms) via `useEffect` auf `canvasStore.modules` → `sendPatchToBoard()`
- **Signal Chain:** Chain-Store hat `links[]` (source, target, modulationType). Visualisierung via SVG/Canvas-Overlay über dem Modul-Grid
- **Multi-Synth:** `AmyPatch.state.synths[]` — jeder Synth kriegt eigenen Tab. Module-Store filtert nach `synthId`
- **Drag & Drop:** `@dnd-kit/core` (react-dnd ist zu alt, framer-motion reorder zu langsam für mobile)
- **Swipe-to-Delete:** `framer-motion` `useDragControls` + `AnimatePresence`
- **Undo-Toast:** `useCallback` mit `setTimeout(() => removeModule(id), 3000)` — abbrechbar durch "Undo" Button
- **Module bleiben im Store:** `canvas-store.ts` (CanvasModule[]), Chain-Store nur für Routing/Links
- **PWA:** Service Worker für offline-ready, Install-Banner für "Add to Home Screen"
- **Log bleibt erhalten** als minimiertes Overlay, nicht mehr im Screen-Flow