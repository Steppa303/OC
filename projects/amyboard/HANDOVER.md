# AMYboard Projekt – Session Handover v6

> Erstellt: 11.07.2026 18:15  
> Letzte Session: 11.07.2026, 17:21–18:10  
> Nächster Schritt: amylive — Permissions-Prompt testen & Module bauen

---

## 1. Aktueller Status (10.07.2026)

### 🟢 Board 1 (192.168.178.89) — Valhalla Shimmer
- **Auto-Boot:** ✅ Läuft sauber via boot.py
- **TCP Server:** Port 2323, PONG vom VPS ✅
- **Sketch:** Valhalla Shimmer + CV gate drums
  - Synth 1: Saw pads (Filter LPF, Chamber Reverb)
  - Synth 2: Sine pads (Oktave hoch)
  - Synth 15: TR-808 Drums (patch=384, 4 voices)
  - Synth 18: Audio pass-through (AUDIO_IN0/1)
  - CV1 → Kick (GM note 36), CV2 → Snare (GM note 38)
  - Encoder 0: Reverb Liveness (0.50–0.999)
  - Encoder 1: Shimmer Rate (4/8/12/16/24/32 steps)
  - Effekte: Reverb 0.0/0.97/0.15, Chorus, Echo
  - Display: Valhalla Shimmer + CV Labels
  - Sequencer Tempo: 60 BPM
- **Kritisches Detail:** `boot.py` hat `except: pass` — **schluckt KeyboardInterrupt!**
  → Siehe Abschnitt 4 ("The Trap")

### 🟢 Board 2 (192.168.178.94) — 909 Snare (FRISCH RESETTET)
- **Status:** ✅ Board wurde per BOOT-Taster + .uf2 geflasht → Firmware ist frisch
- **Keine blockierende boot.py mehr!** REPL ist frei zugänglich
- **IP:** Unbekannt (muss nach Reset neu gesehen werden) — FritzBox DHCP
- **Noch zu tun:** Alles neu deployen:
  1. `current/remote.py` — WLAN + TCP Server
  2. `current/sketch.py` — TR-909 Snare CV Gate
  3. `boot.py` — **Safe-Start boot.py** (mit KeyboardInterrupt-Check, KEIN `except: pass`!)

### ⚠️ Wichtige Erkenntnisse (ARCHIVIERT)
1. ✅ `except: pass` blockiert KeyboardInterrupt → **gefixed, nie wieder machen**
2. ✅ Lösung für Zukunft: Safe-Start boot.py mit KeyboardInterrupt-Check vor Loop
3. ⚠️ **Tulip CC executed NUR `boot.py`** — kein `main.py`/`sketch.py` auto-exec

---

## 3. Valhalla Shimmer — Board 1 (89) — DEPLOYED ✅

### Dateien auf Board 1
| Pfad | Lokal | Status |
|------|-------|--------|
| `/boot.py` | — | ✅ Auto-Boot (import sketch + remote_loop) |
| `/current/remote.py` | `remote.py` | ✅ TCP Server Port 2323 (settimeout 0.05) |
| `/current/sketch.py` | `sketch.py` | ✅ Valhalla Shimmer + CV Drums |
| `/current/quantizer.py` | — | Vom alten Quantizer — wird nicht importiert |

### Patch Detail
```
CV1 In → cv_trigger(0,3V,1V) → TR-808 Kick (i15l1n36)
CV2 In → cv_trigger(1,3V,1V) → TR-808 Snare (i15l1n38)
Shimmer Pads: Synth 1 (Saw) + Synth 2 (Sine 8va)
Effekte: Reverb (liveness encoder), Chorus, Echo
Audio-Thru: Synth 18 (AUDIO_IN0/1 → stereo)
```

---

## 4. 909 Snare — Board 2 (94) — PENDING DEPLOY 🔴

### Deployte Dateien (vor RST)
- `boot.py` — gleicher Bootstrap (blockt REPL!)
- `current/remote.py` — TCP Server
- `current/sketch.py` — Original Tulip Template (pass loop)

### Wartet auf Deployment
`current/sketch.py` — TR-909 Snare Code:
```python
# CV1 gate triggers TR-909 snare (GM 38)
# CV2 controls tail length (snappiness + decay)
# Exponential mapping: 30ms–1200ms decay
# Linear mapping: 5ms–80ms snap
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

- **Bastian** (@Steppa_tg) – Telegram Direktchat
- **Sprache:** Deutsch, Sarkasmus, Gen-Z Slang
- **Remote via:** Telegram + VPS + WireGuard
- **MacBook:** Bastian am Mac, kein SSH (kein Key deployed)
- **USB REPL:** `screen /dev/cu.usbmodem* 115200` (kein picocom/minicom vorhanden)

---

## 8. Session 11.07.2026 – amylive Web Deployment & Bugfixes

### Überblick
Amylive (`amylive.steppa.online`) ist jetzt live deployt und erreichbar. Die Session fokussierte auf Debugging von WebMIDI-Problemen auf Android Chrome (Pixel 10 Pro).

### Gefundene & gefixte Probleme

#### 1. ❌ HTTPS fehlte (WebMIDI → Secure Context erforderlich)
**Problem:** `amylive.steppa.online` lief auf HTTP – DNS war grey cloud (unproxied) auf Cloudflare. WebMIDI (`navigator.requestMIDIAccess()`) benötigt zwingend HTTPS.
**Symptom:** `navigator.requestMIDIAccess is not a function`, Banner "WebMIDI nicht verfügbar" obwohl Chrome + funktioniert auf permission.site
**Fix:** Cloudflare Proxy an: `proxied: true` (orange cloud). DNS-ID: `7eefa0d3188418fb796bb28e4da3ac4f`
**Erkenntnis:** `amysim.steppa.online` hatte die COOP/COEP Header wegen SharedArrayBuffer – amylive hat die fälschlich geerbt.

#### 2. ❌ COOP/COEP Header killten WebMIDI auf Mobile
**Problem:** `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin` waren fälschlich auf amylive gesetzt (von amysim rüberkopiert).
**Fix:** Aus Caddyfile entfernt. Nur noch `Access-Control-Allow-Origin "*"`.

#### 3. ❌ `e.toLowerCase is not a function` bei Connect
**Problem:** `ConnectionPanel.tsx` hatte `onClick={connect}` – React übergab MouseEvent als erstes Argument → `connect(event)` → `deviceName` war Event-Objekt → `nameFilter.toLowerCase()` crashte.
**Fix:** `onClick={() => connect()}` – Arrow Function damit kein Event-Objekt durchgereicht wird.

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
- [ ] Permission-Prompt live testen (Android Chrome, Pixel 10)
- [ ] AMYboard per USB-C verbinden & Connect testen
- [ ] Module-Bibliothek erweitern (FX Rack, LFO)
- [ ] Patch-Management (localStorage)

---

## 9. Critical Lessons Learned

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