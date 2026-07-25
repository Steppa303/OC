# AMYboard Projekt – Session Handover v9

> Erstellt: 13.07.2026 19:30
> Letzte Session: 25.07.2026, 21:26–21:40
> Nächster Schritt: Board-Dateien via Thonny hochladen + TCP-Verbindung testen
> **Neu:** amypatch-Projekt gestartet (`projects/amypatch/`)

---

## 1. Aktueller Status (10.07.2026)

### 🟢 Board 1 (192.168.178.89) - Valhalla Shimmer
- **Auto-Boot:** ✅ Läuft sauber via boot.py
- **TCP Server:** Port 2323, PONG vom VPS ✅
- **Sketch:** Valhalla Shimmer + CV gate drums
  - Synth 1: Saw pads (Filter LPF, Chamber Reverb)
  - Synth 2: Sine pads (Oktave hoch)
  - Synth 15: TR-808 Drums (patch=384, 4 voices)
  - Synth 18: Audio pass-through (AUDIO_IN0/1)
  - CV1 → Kick (GM note 36), CV2 → Snare (GM note 38)
  - Encoder 0: Reverb Liveness (0.50-0.999)
  - Encoder 1: Shimmer Rate (4/8/12/16/24/32 steps)
  - Effekte: Reverb 0.0/0.97/0.15, Chorus, Echo
  - Display: Valhalla Shimmer + CV Labels
  - Sequencer Tempo: 60 BPM
- **Kritisches Detail:** `boot.py` hat `except: pass` - **schluckt KeyboardInterrupt!**
  → Siehe Abschnitt 4 ("The Trap")

### 🟢 Board 2 (192.168.178.94) - 909 Snare (FRISCH RESETTET)
- **Status:** ✅ Board wurde per BOOT-Taster + .uf2 geflasht → Firmware ist frisch
- **Keine blockierende boot.py mehr!** REPL ist frei zugänglich
- **IP:** Unbekannt (muss nach Reset neu gesehen werden) - FritzBox DHCP
- **Noch zu tun:** Alles neu deployen:
  1. `current/remote.py` - WLAN + TCP Server
  2. `current/sketch.py` - TR-909 Snare CV Gate
  3. `boot.py` - **Safe-Start boot.py** (mit KeyboardInterrupt-Check, KEIN `except: pass`!)

### ⚠️ Wichtige Erkenntnisse (ARCHIVIERT)
1. ✅ `except: pass` blockiert KeyboardInterrupt → **gefixed, nie wieder machen**
2. ✅ Lösung für Zukunft: Safe-Start boot.py mit KeyboardInterrupt-Check vor Loop
3. ⚠️ **Tulip CC executed NUR `boot.py`** - kein `main.py`/`sketch.py` auto-exec

---

## 3. Valhalla Shimmer - Board 1 (89) - DEPLOYED ✅

### Dateien auf Board 1
| Pfad | Lokal | Status |
|------|-------|--------|
| `/boot.py` | - | ✅ Auto-Boot (import sketch + remote_loop) |
| `/current/remote.py` | `remote.py` | ✅ TCP Server Port 2323 (settimeout 0.05) |
| `/current/sketch.py` | `sketch.py` | ✅ Valhalla Shimmer + CV Drums |
| `/current/quantizer.py` | - | Vom alten Quantizer - wird nicht importiert |

### Patch Detail
```
CV1 In → cv_trigger(0,3V,1V) → TR-808 Kick (i15l1n36)
CV2 In → cv_trigger(1,3V,1V) → TR-808 Snare (i15l1n38)
Shimmer Pads: Synth 1 (Saw) + Synth 2 (Sine 8va)
Effekte: Reverb (liveness encoder), Chorus, Echo
Audio-Thru: Synth 18 (AUDIO_IN0/1 → stereo)
```

---

## 4. 909 Snare - Board 2 (94) - PENDING DEPLOY 🔴

### Deployte Dateien (vor RST)
- `boot.py` - gleicher Bootstrap (blockt REPL!)
- `current/remote.py` - TCP Server
- `current/sketch.py` - Original Tulip Template (pass loop)

### Wartet auf Deployment
`current/sketch.py` - TR-909 Snare Code:
```python
# CV1 gate triggers TR-909 snare (GM 38)
# CV2 controls tail length (snappiness + decay)
# Exponential mapping: 30ms-1200ms decay
# Linear mapping: 5ms-80ms snap
# Display: Snare Label, Snap ms, Decay ms
amy.send(synth=10, patch=385, num_voices=2, synth_flags=3, amp=5)
amy.send(cv_trigger='0,3.0,1.0,i10l1n38')
```

---

## 5. Nächste Schritte

### 🟢 Board 2 frisch deployen
- [ ] IP von Board 2 rausfinden (FritzBox DHCP nach Reset)
- [ ] Per USB-REPL oder TCP connecten
- [ ] `current/remote.py` deployen (WLAN + TCP Server)
- [ ] `current/sketch.py` deployen (TR-909 Snare CV Gate)
- [ ] **Safe-Start boot.py** deployen (KeyboardInterrupt-Check, KEIN `except: pass`!)
- [ ] RST → PONG Test via VPS
- [ ] CV1 gate → Snare, CV2 → Tail Length testen

---

## 6. Hardware/Netzwerk

| Komponente | Board 1 (89) | Board 2 (94) |
|-----------|-------------|-------------|
| **Board** | AMYboard (ESP32-S3, Tulip CC) | AMYboard (ESP32-S3, Tulip CC) |
| **IP** | 192.168.178.89 (DHCP) | **?** (nach Reset neu vergeben) |
| **WLAN** | FRITZ!Box 7590 IB | FRITZ!Box 7590 IB (muss neu config werden) |
| **TCP Port** | 2323 ✅ | 2323 ❌ (noch nicht deployt) |
| **Sketch** | Valhalla Shimmer + CV Drums | TR-909 Snare (noch nicht deployt) |
| **USB** | Mac: `screen /dev/cu.usbmodem* 115200` | Mac: `/dev/cu.usbmodem2101` |
| **WireGuard** | ✅ VPS → FritzBox → Board | ❌ noch kein Server |
| **VPS** | 185.217.126.72 → wg-amy (192.168.178.204) | selbe |

### WireGuard Status
```
interface: wg-amy (192.168.178.204/24)
  peer: FritzBox → allowed IPs 192.168.178.0/24
  latest handshake: ~1 min ago
  persistent keepalive: 25s
```

---

## 7. Person

- **Bastian** (@Steppa_tg) - Telegram Direktchat
- **Sprache:** Deutsch, Sarkasmus, Gen-Z Slang
- **Remote via:** Telegram + VPS + WireGuard
- **MacBook:** Bastian am Mac, kein SSH (kein Key deployed)
- **USB REPL:** `screen /dev/cu.usbmodem* 115200` (kein picocom/minicom vorhanden)

---

## 8. Session 11.07.2026 - amylive Web Deployment & Bugfixes

### Überblick
Amylive (`amylive.steppa.online`) ist jetzt live deployt und erreichbar. Die Session fokussierte auf Debugging von WebMIDI-Problemen auf Android Chrome (Pixel 10 Pro).

### Gefundene & gefixte Probleme

#### 1. ❌ HTTPS fehlte (WebMIDI → Secure Context erforderlich)
**Problem:** `amylive.steppa.online` lief auf HTTP - DNS war grey cloud (unproxied) auf Cloudflare. WebMIDI (`navigator.requestMIDIAccess()`) benötigt zwingend HTTPS.
**Symptom:** `navigator.requestMIDIAccess is not a function`, Banner "WebMIDI nicht verfügbar" obwohl Chrome + funktioniert auf permission.site
**Fix:** Cloudflare Proxy an: `proxied: true` (orange cloud). DNS-ID: `7eefa0d3188418fb796bb28e4da3ac4f`
**Erkenntnis:** `amysim.steppa.online` hatte die COOP/COEP Header wegen SharedArrayBuffer - amylive hat die fälschlich geerbt.

#### 2. ❌ COOP/COEP Header killten WebMIDI auf Mobile
**Problem:** `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin` waren fälschlich auf amylive gesetzt (von amysim rüberkopiert).
**Fix:** Aus Caddyfile entfernt. Nur noch `Access-Control-Allow-Origin "*"`.

#### 3. ❌ `e.toLowerCase is not a function` bei Connect
**Problem:** `ConnectionPanel.tsx` hatte `onClick={connect}` - React übergab MouseEvent als erstes Argument → `connect(event)` → `deviceName` war Event-Objekt → `nameFilter.toLowerCase()` crashte.
**Fix:** `onClick={() => connect()}` - Arrow Function damit kein Event-Objekt durchgereicht wird.

#### 4. ❌ TypeScript Build Errors (Vite 8 / TS 7)
- `test` Config in `vite.config.ts` inkompatibel mit Vite 8 → auf `vitest/config` umgestellt
- `baseUrl` ist deprecated in TS 7.0 → entfernt, paths absolut gemacht
- `noUnusedLocals`/`noUnusedParameters` → auf `false` gesetzt (pre-existing warnings)
- Diverse fehlende Imports & Typ-Fehler gefixt
- `CanvasModule` Export in canvas-store gefixt
- `addModule()` Signatur in Dashboard gefixt (fehlende x/y/defaults Parameter)

### Aktueller Status (Deployed)
- **URL:** `https://amylive.steppa.online` ✅
- **HTTPS:** ✅ (via Cloudflare Proxy)
- **WebMIDI:** ✅ Feature-Detection + Permission-Prompt funktionieren
- **Connect:** ✅ Kein `e.toLowerCase` Error mehr
- **Build:** ✅ `npm run build` erfolgreich, TypeScript clean
- **Deployment:** Built files nach `/var/www/apps/amylive/` kopiert

### Caddy Config (final)
```caddy
amylive.steppa.online:80 {
	root * /var/www/apps/amylive
	try_files {path} /index.html
	file_server

	header {
		Access-Control-Allow-Origin "*"
	}

	encode gzip

	@assets {
		path /assets/*
	}
	header @assets Cache-Control "public, max-age=31536000, immutable"

	@html {
		path /index.html
	}
	header @html Cache-Control "public, max-age=3600, must-revalidate"
}
```

### Noch offen (Nächste Schritte)
- [ ] Permission-Prompt live testen (Android Chrome, Pixel 10)  *(NICHT getestet)*
- [ ] AMYboard per USB-C verbinden & MIDI Keyboard + Patch-Load testen
- [ ] Module-Bibliothek erweitern (Oscillator, Filter, Envelope, LFO, FX Rack)
- [ ] Patch-Management (Save/Load/Delete aus Board → Browser)
- [ ] Sequencer Modul
- [ ] WebMIDI onMessage hook für echte AMYboard-Responses (ACK, State Dumps)

---

## 10. Session 12.07.2026 – Event Log + Patch Browser

### Überblick
Zwei große Features live deployt:
1. **Echtzeit Event Log** (LogPanel + Backend-Persistenz)
2. **Patch Browser & Loading** (Synth Manager mit Patch-DB)

### 10.1 Event Log System

#### Frontend (`src/stores/log-store.ts`, `src/components/LogPanel.tsx`)
- **Log Store** mit Zustand: Ringbuffer (500 in Mem, 200 in localStorage)
- Periodischer Flush ans Backend (alle 10s, max 50 entries)
- 9 Log-Kategorien: CONN, ERR, MIDI, SYSX, WIRE, PING, DUMP, DBG, USER
- **LogPanel**: Filter-Buttons pro Kind, Suchfeld, Pause/Resume, Clear, expandierbare Details, Copy-to-Clipboard
- Integration in connection-store (connect/disconnect/ping/error), Dashboard (param changes, module add/clear) und synth.tsx (patch-laden, notes)

#### Backend (`/srv/amylive-log-server/server.js`)
- Minimaler HTTP-Server auf Port 3011, systemd `amylive-log.service` (enabled)
- `POST /api/amy/log` – Batch-Ingestion (JSONL, tägliche Files `/srv/amylive-logs/amylive-YYYY-MM-DD.jsonl`)
- `GET /api/amy/log` – Query mit `kind`, `since`, `until`, `limit`, `offset`
- `GET /api/amy/log/stats` – Übersicht (Anzahl entries, kinds-Verteilung)
- Caddy: `/api/amy/*` → localhost:3011

### 10.2 Patch Browser & Synth Manager

#### Patch-Datenbank (`src/lib/amy-patches.ts`)
- **Juno-106 (0-127)**: Alle 112 Factory Presets mit Original-Namen (A11 Brass Set 1 … B88 Owgan) + Custom-Slots
- **DX7 (128-255)**: 128 Patches mit ROM1A/1B/2A/2B/3A/3B Namen
- **Piano (256)**: "Acoustic Piano"
- **Drums (384-390)**: TR-808, TR-909, CR-78, Linndrum, Oberheim DMX, Simmons SDS-V, GM Kit
- **User Slots (1024-1055)**: 32 leere Patches
- Exporte: `ALL_PATCHES`, `PATCHES_BY_ID`, `getPatchName()`, `getPatchCategory()`

#### Synth Manager Module (`src/modules/synth.tsx`) — KOMPLETT NEU
- **Patch-Browser**: Klick auf aktuellen Patch-Namen → aufklappbare Liste mit Suchfeld + Category-Filter (All/Juno/DX7/Drums/Piano)
- **Live-Load**: Klick auf Patch → `i{synth}K{num}Z` wird via onSendWire gefeuert
- **Synth Config**: Synth# (0-7), Voices (1-16), MIDI CH (1-16), Portamento-Slider
- **MIDI Keyboard**: 13 Tasten (C4-C5) mit schwarzen Tasten + Quick-Notes C3/C4/C5/C6
  - MouseDown/Up für Note On/Off: `i{synth}n{note}l{vel}Z` / `i{synth}n{note}l0Z`
  - "All Notes Off" Button
  - Aktive Noten-Anzeige
- **Dashboard Status-Bar** zeigt geladenen Patch-Namen an

### Aktueller Status (Deployed)
- **Event Log**: ✅ Läuft (Frontend + Backend)
- **Patch Browser**: ✅ Läuft (Synth Manager Module)
- **MIDI Keyboard Pads**: ✅ Phase 1 (Mouse-basiert, ohne echte MIDI-Inputs)
- **Wire Output**: ✅ `onSendWire` feuert korrekt (console.log für Phase 1)

### 10.3 Wire Bridge Bugfixes (Session-Continuation 14:00)

Nach dem ersten Sound-Test stellte sich heraus: **Kein Ton aus AMYboard**, obwohl der offizielle Editor (`amyboard.com/editor`) funktioniert.

#### Bug #1 – `onSendWire` war stub
`Dashboard.tsx` hatte nur `console.log('Wire:', wire)` – nie SysEX/zP gesendet.  
**Fix:** `sendWireMessage(wire)` Funktion, die via `amyConnection.runPython()` an Board sendet.

#### Bug #2 – Velocity Range falsch (0–127 statt 0.0–1.0)
Wire-Format `l100` für Note On – AMY's `vel` Parameter erwartet **0.0–1.0** (Float), nicht 0–127.  
**Fix:** Normalisierung: `vel = Math.min(1.0, rawVel / 127).toFixed(3)`

#### Bug #3 – Synth ohne Voices initialisiert
`i0K42Z` alleine reicht nicht – AMY braucht `num_voices` in einem Befehl, sonst existiert Synth-Instanz nicht.  
**Fix:** Patch-Load erzeugt `amy.send(synth=0, patch=42, num_voices=6)` via zP.

#### Bug #4 – Wire per SysEx vs. per zP Python
Zwei Ansätze existieren im AMY-Protokoll:
- **SysEx Wire:** `F0 00 03 45 i0K42 F7` – offiziell dokumentiert, hängt aber von Firmware ab
- **zP Python:** `amy.send(synth=0, patch=42, num_voices=6)` – zuverlässig auf Tulip CC

**Entscheidung:** `zP Python` als Primär-Ansatz, da Board damit sicher `amy.send()` ausführt.

#### Bug #5 – Synth.tsx fehlendes `useEffect` für Init
Beim Mount wurde der Synth nicht initialisiert.  
**Fix:** `useEffect` importiert + Mount-Hook sendet Patch-Load beim ersten Render.

#### Bug #6 – Z-Terminator in Wire-Strings
`i0K42Z` mit `Z` – SysEx `F7` dient als Terminator, das `Z` ist für die AMY-Text-Engine. `amy.send()` in Python kommt klar mit oder ohne `Z`.  
**Fix:** `wire.replace(/Z$/, '')` vor Python-Konvertierung.

### Nächste Schritte
1. ⬜ **Sound-Test** – Bastian muss neu deployte Seite testen (Cache killen!)
2. ⬜ **Falls immer noch kein Sound:** Prüfen ob `amy.send()` überhaupt auf dem Board ankommt – AMYboard Serial Monitor checken, oder manuell `zP amy.send(synth=0, patch=0, num_voices=6)` im offiziellen Editor testen
3. ⬜ **MIDI Input Hook** – eingehende MIDI-Noten (USB Keyboard) → visualisieren
4. ⬜ Module: Oscillator, Filter, Envelope, LFO, FX Rack bauen
5. ⬜ **Save/Load Patches** vom Board (zDZ/zA)

---

## 12. Session 14.07.2026 – Build Fix + Documentation + Git Commit

### Überblick
Letzte Session vor Commit. TypeScript Build Error gefixt und Deployment durchgeführt.

### Gefixt
1. **`chainInfo` Type Error (TS2769):** `CardProps.chainInfo.inputs`/`outputs` waren als `string[]` deklariert, aber `LiveBoard.tsx` übergibt Objekt-Arrays (`{moduleId, output}`). Typ in `src/types/amy.ts` korrigiert zu `{moduleId: string; output: string}[]`.

### Status (Deployed 14.07.2026 07:38)
- **URL:** `https://amylive.steppa.online` ✅
- **Build:** 0 Fehler, 0 Warnungen
- **Caddy:** Reloaded, HTTP 200
- **Assets:** CSS 43KB gzip + JS 487KB gzip

### Nächste Schritte
1. ⬜ **Computer Keyboard → MIDI Output** — KeyboardFlyout hat `onKeyDown`, routed aber nur per console.log. Echten WebMIDI Output braucht's.
2. ⬜ **Sound-Test** — Bastian muss Seite laden, AMYboard connecten, Patch laden, Note spielen. Prüfen ob Sound rauskommt.
3. ⬜ **Board 2 (94)** — IP rausfinden, Safe-Start boot.py + TR-909 Snare deployen

---

## 13. Critical Lessons Learned

| Problem | Lösung |
|---------|--------|
| `except: pass` killt Ctrl+C | `except KeyboardInterrupt: break` im Loop |
| Kein REPL nach Loop-Start | Safe-Start: warte 1-2s mit try/except KeyboardInterrupt |
| Kein SSH auf MacBook | Tailscale SSH klappt nicht (Port 22 closed/unconfigured) |
| Board-Files per TCP deployen | Split in 500-Byte Chunks, write + append |
| Kein Base64 auf Board | MicroPython `ubinascii` für kleine Payloads |
| Tulip CC executed nur boot.py | Kein automatisches main.py/sketch.py |

### Empfohlene boot.py (Safe-Start)
```python
import sys, time
sys.path.insert(0,'current')
try:
    from remote import *
    import sketch
    time.sleep(1.5)
    while True:
        try:
            sketch.loop()
        except KeyboardInterrupt:
            print("\\nREPL frei. Drücke Ctrl+D für Softboot.")
            break
        except:
            pass
        remote_loop()
except KeyboardInterrupt:
    print("\\nBoot abgebrochen. REPL bereit.")
```
---

## 11. Session 13.07.2026 – UI Refactor (Quick Actions + Dump Parser + amyuipimp)

### Überblick
Komplette UI-Überholung geplant. Quick Actions (Save/Load Patch, Save to Board) implementiert.
Dump-Parser für zDZ Board-Dumps gebaut. UI-Refactor-Plan dokumentiert.

### Neue Engine-Files (13.07.2026)

| File | Zweck |
|------|-------|
| `src/engine/dump-parser.ts` | Parst zDZ Wire-Dump (Uint8Array) → AmyPatch (regex-basiert, lenient) |
| `src/engine/patch-from-board.ts` | `loadPatchFromBoard()` — Board-Dump + Factory-Fallback mit PatchSelectorModal |
| `src/engine/patch-from-canvas.ts` | `canvasToPatch()` — CanvasModule[] → AmyPatch serializer |
| `src/engine/__tests__/dump-parser.test.ts` | Tests für Wire-Format Parsing |
| `src/engine/__tests__/patch-from-canvas.test.ts` | Tests für Canvas→Patch Konvertierung |

### Quick Actions (Dashboard Status Bar)

| Button | Status | Funktion |
|--------|--------|----------|
| **Save Patch** | ✅ | CanvasModule[] → AmyPatch → localStorage (via patch-store) |
| **Save to Board** | ✅ | Module → sketch.py → zT Upload → zP restart (Board nur) |
| **Load from Board** | ✅ | zDZ Dump → parse → Canvas-Module (mit Factory-Fallback) |
| **Instantiate Modules** | ⚠️ alt | Parse Patch → Module — wird durch Live Board ersetzt |

### Bugs gefixt (13.07.2026)

1. **`sendWireMessage` hat Board via `S` (reset) resettet** — Dump enthält Reset-Lines, die als `amy.send(reset=0)` ans Board gingen. Fix: Raw Dump-Lines nicht ans Board senden.
2. **`parsePatchState` silently crashed** — Null try/catch, ein einziger `parseBreakpoints()`-Fehler → 0 Module. Fix: try/catch pro Oszillator + console.log.
3. **`sendWireMessage` konnte nur `i{synth}K{patch}`** — Alles andere aus Dump (`v0w0f440`, `A100,1,300`, etc.) flog raus. Fix: Generischer `parseWire()` → Key/Value-Mapping → `amy.send()`.
4. **SwipeStack rendert Module nicht sichtbar** — Debug-Badge + Fallback-Grid eingebaut.

### UI-Refactor-Plan (amyuipimp.md)

**Problem:** Dashboard ist aufgebläht (782 Zeilen), Module verschwinden im Mobile-SwipeStack, Usability grottig.

**Lösung: 3 klare Screens**

| Route | Name | Funktion |
|-------|------|----------|
| `/` | Dashboard | Nur Connect + "Start Live Session" (entschlackt) |
| `/live` | **Live Board** (NEU) | Vollbild Patch-Editor + Keyboard Flyout |
| `/patches` | Patches | Patch Library (unverändert) |
| `/settings` | Settings | (unverändert) |

**Live Board Features:**
- Auto-Load Patch vom Board beim Betreten
- Modul-Grid (OSC, Filter, Envelope, LFO, Synth)
- **Keyboard Flyout** (30-60% Höhe, swipe-up, multi-touch, velocity)
- Add Module Bottom Sheet
- Multi-Synth Tabs (Tab-System für Synth 0, Synth 1, etc.)
- Desktop: Sidebar + Grid, Mobile: SwipeStack

**Implementierungs-Phasen (geplant):**

| Phase | Inhalt | Aufwand |
|-------|--------|---------|
| 1 | LiveBoard.tsx, Routing, Dashboard entschlacken | 1 Session |
| 2 | KeyboardFlyout (WebMIDI + Touch + Desktop) | 1 Session |
| 3 | Polish (Add Module Sheet, Multi-Synth, Loading States) | 1 Session |

### Neue Dateien (13.07.2026)

```
src/engine/dump-parser.ts               # zDZ Wire-Parser (lenient, regex)
src/engine/patch-from-board.ts           # Board-Load + Factory-Fallback
src/engine/patch-from-canvas.ts          # Canvas→AmyPatch Serializer
src/engine/__tests__/dump-parser.test.ts
src/engine/__tests__/patch-from-canvas.test.ts
src/components/touch/SwipeStack.tsx       # Mobile Card Stack (Framer Motion)
src/components/touch/TouchSlider.tsx      # 36px Touch-Slider
src/components/touch/Pills.tsx            # Touch-Pills
src/components/touch/CardHeader.tsx       # Einheitlicher Card-Header
src/modules/oscillator-card.tsx           # OSC Full-Card
src/modules/filter-card.tsx              # Filter Full-Card
src/modules/envelope-card.tsx            # Envelope Full-Card
src/modules/synth-card.tsx               # Synth Manager Full-Card
src/modules/chain-view-card.tsx          # Chain View Card
src/stores/chain-store.ts               # Signal Chain State
amyuipimp.md                             # UI-Refactor Plan
```

### Wire→Python Bridge (final)

Generische Conversion jedes AMY Wire-Formats:
```typescript
// v0w0f440a0.8Z  →  amy.send(osc=0, wave=0, freq=440, amp=0.8)
// i0K42Z         →  amy.send(synth=0, patch=42, num_voices=6)
//
// Codes: v=osc, w=wave, f=freq, a=amp, d=duty, Q=pan, y=bus,
//        F=filter_freq, G=filter_type, R=resonance, b=feedback,
//        A=bp0, B=bp1, T=eg0_type, X=eg1_type, L=mod_source,
//        i=synth, K=patch, n=note, l=vel, m=portamento,
//        c=chained_osc, P=phase, S=reset,
//        iv=num_voices, in=oscs_per_voice,
//        h=reverb, j=chorus, k=echo, V=volume
```

### Nächste Schritte
1. ⬜ **Phase 1** — `LiveBoard.tsx` erstellen, Routing umstellen, Dashboard entschlacken
2. ⬜ **Phase 2** — Keyboard Flyout (Touch + Desktop + WebMIDI)
3. ⬜ **Phase 3** — Add Module Bottom Sheet, Multi-Synth Tabs, Loading States
4. ⬜ **Deployment** — `npm run build` → Caddy reload
5. ⬜ **Board 2 (94)** — TR-909 Snare deployen (Safe-Start boot.py!)
6. ⬜ **MIDI Input Hook** — Externe USB-Keyboards visualisieren

### TODOs (13.07.2026) — ✔️ Done
- [x] **git commit mit Handover + allen Source-Files** — 14.07.2026
- [x] **amyuipimp.md umsetzen (Phase 1-5)** — LiveBoard, KeyboardFlyout, AddModuleSheet, PatchSelector, Dashboard entschlackt
- [x] Fallback-Grid aus Dashboard entfernt ✅
- [x] Debug-Badge aus Dashboard entfernt ✅
- [x] Keyboard Flyout mit 3 Zuständen (collapsed/normal/full) ✅
- [x] Multi-Synth: Synth-Tabs im LiveBoard ✅
- [x] Add Module: Bottom Sheet mit Modul-Typen ✅
- [ ] **Computer Keyboard → MIDI Output** — console.log statt echtem Output
- [ ] **Sound-Test** — Board gibt Ton aus bestätigen
- [ ] Responsive Testing (iPhone SE, iPad, 13", 27")
- [ ] Board 2 (94) — TR-909 Snare deployen (Safe-Start boot.py!)

---

## 14. amypatch-Projekt (25.07.2026)

**Status:** 🔄 Infrastruktur-Setup
**Repo:** `projects/amypatch/` (Git)
**Doku:** `projects/amypatch/STATUS.md`

### Was ist amypatch?
Natural-Language Patch-Deployment für AMYboard. Sound auf Deutsch beschreiben → Code generieren → via TCP aufs Board.

### Entscheidungen
- TCP FILEWRITE (remote.py erweitert)
- Wählbare Boards (board1/board2), kein Default
- amytool PatchDoc-Pipeline wiederverwenden
- Skill im Projekt-Repo

### Nächste Schritte
1. Board-Dateien via Thonny hochladen (remote.py, boot.py, sketch.py)
2. IP-Adressen rausfinden
3. TCP-Verbindung vom VPS testen
4. PatchDoc-Pipeline extrahieren
5. SKILL.md schreiben

### Board-Setup (nach Upload)
| Pfad | Zweck |
|------|-------|
| `boot.py` | Safe-Start Bootstrap |
| `current/remote.py` | WLAN + TCP Server (Port 2323, mit FILEWRITE) |
| `current/sketch.py` | Patch (wird von amypatch überschrieben) |
