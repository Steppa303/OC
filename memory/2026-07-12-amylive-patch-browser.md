## 🎹 amylive Patch Browser System (12.07.2026)

**Status:** ✅ Deployed auf amylive.steppa.online

### Was gebaut wurde:

**1. `src/lib/amy-patches.ts`** — Patch-Datenbank
- **Juno-106 (0-127)**: Alle 112 Factory Patches mit Original-Namen (A11 Brass Set 1, A14 Flutes, etc.) + 16 Custom-Slots
- **DX7 (128-255)**: 128 Patches mit ROM1A, ROM1B, ROM2A, ROM2B, ROM3A, ROM3B Namen + Custom
- **Piano (256)**: "Acoustic Piano"
- **Drums (384-390)**: TR-808, TR-909, CR-78, Linndrum, DMX, SDS-V, GM Kit
- **User Slots (1024-1055)**: 32 leere Patches
- Hilfsfunktionen: `getPatchName()`, `getPatchCategory()`, `ALL_PATCHES`, `PATCHES_BY_ID`

**2. `src/modules/synth.tsx`** — Synth Manager (komplett neu)
- **Patch-Browser**: Klick auf aktuellen Patch öffnet Browser
  - Suchfeld (durchsucht Namen + Nummern)
  - Category-Filter (All / Juno-6 / DX7 / Drums / Piano) mit Icons
  - Scrollbare Patch-Liste mit Highlight für aktiven Patch
  - Klick lädt Patch via `i{synth}K{number}Z`
- **Synth Config**: Synth# (0-7), Voices (1-16), MIDI CH (1-16), Portamento-Slider
- **MIDI Keyboard**: 13 Tasten (C4-C5) mit schwarzen Tasten + Quick-Notes (C3, C4, C5, C6)
  - MouseDown/Up für Note On/Off
  - Anzeige aktiver Noten
  - "All Notes Off" Button
- **Wire Protocol**: `i{synth}K{num}Z` für Patch Load, `i{synth}n{note}l{vel}Z` für Noten

**3. Dashboard.tsx** — Status-Bar zeigt aktiven Patch-Namen an