# 📋 Projekt "Mia" – Status & Offene Punkte

**Stand:** 2026-05-24, 10:12 Uhr
**Letzte Aktivität:** Test-Reel V3, Pipeline validiert
**Status:** 🔧 Setup (wartet auf Instagram-Account-Registrierung)

---

## ✅ Was bereits erledigt ist

### 1. Projektstruktur (14 Dateien)
```
projects/mia-influencer/
├── KONZEPT.md              # Gesamtkonzept, Mechanik, Architektur
├── SOP.md                  # Standard Operating Procedure (aktualisiert)
├── CONTENT-PLAN.md         # 8-Wochen Content-Plan
├── SYSTEM-PROMPT.md        # 5-Layer Persona-Framework für LLMs
├── CONFIG.md               # Technische Config (APIs, Keys, Einstellungen)
├── SETUP.md                # Setup-Anleitung für Account-Registrierung
├── schedule.json           # 7 Leit-Posts als JSON (W1-W8)
├── post-state.json         # Posting-State-Tracking
├── dm-state.json           # DM-Checker-State
├── assets/
│   └── mia-master-reference.jpg  # Master-Bild für locked-in Identity
└── scripts/
    ├── mia-poster.py       # Auto-Poster (instagrapi, Gemini, ElevenLabs, Veo)
    ├── mia-dm-checker.py   # DM Auto-Checker
    ├── mia-health-check.py # Täglicher Health Check
    └── assembly.sh         # ffmpeg Reel-Assembly (Audio+Video+Subtitles)
```

### 2. Tech Stack – Festgelegt
| Komponente | Lösung | Status |
|------------|--------|--------|
| **Bildgenerierung** | Gemini 3 Pro Image + Reference Image | ✅ Getestet |
| **Video (Veo)** | Google Veo 3.1 Fast (4s-Clips) | ✅ Getestet |
| **Voiceover** | ElevenLabs Laura German (`LB5G0Z4EP98YaEgL654m`) | ✅ Bestätigt |
| **Posting** | instagrapi (Private API, kein Browser) | ✅ HaterBernd-Stack |
| **Scheduling** | Linux Cron + Python | ✅ Vorhanden |
| **DM-Management** | instagrapi + Auto-Responder | ✅ Vorhanden |

### 3. Locked-in Identity – Bestätigt ✅
- **Methode:** Master Reference Image + Text-Prompt
- **4 Settings getestet:** Café → Wald → Stadt → See (alle konsistent)
- **Ergebnis:** Gemini 3 Pro Image übernimmt Gesichtszüge aus Reference

### 4. Voice – Bestätigt ✅
- **Primary:** Laura German (`LB5G0Z4EP98YaEgL654m`) – native deutsche Stimme
- **Fallback:** Jessica (`cgSgspJ2msm6clMCkdW9`)
- **5 Stimmungen definiert:** Warm, Besorgt, Ernst, Fröhlich, Inspirierend
- **6 Test-MP3s generiert** (Jessica + Laura)

### 5. Reel-Pipeline – ⚠️ WORK IN PROGRESS (NOCH NICHT FERTIG)
- **V3 getestet:** Ein Bild → Veo 3× (unterschiedliche Motion) → Audio stripped → ElevenLabs → ffmpeg Amateur-Look → Untertitel
- **assembly.sh** Script liegt ready
- **Veo Limitation:** max 4s pro Clip (Fast), max 8s (Premium)
- **Amateur-Look:** noise + hue shift + unsharp (ffmpeg-Filter, `grain` nicht verfügbar auf diesem System)
- **Kritische offene Punkte:**
  - Veo-Produktion hängt teilweise (manche Jobs failen ohne klaren Grund)
  - Kein Lippen-Sync zum Audio (Mundbewegungen sind zufällig, nicht synchron zum gesprochenen Text)
  - ffmpeg Assembly ist fehleranfällig (concat + drawtext + Amateur-Filter überfordert das System teilweise)
  - Gesamt-Pipeline noch nicht robust genug für automatisierte Produktion
  - assembly.sh muss fürs Poster-Script in Python portiert werden

### 6. Mia's Archetyp
```
Alter: 22 Jahre
Haare: Naturally blonde, styled loosely, soft waves
Augen: Bright green, expressive
Gesicht: Soft youthful features, warm smile, healthy glowing skin
Make-up: Flawless natural minimal
Stil: Cozy Oversized-Knit, Trenchcoat, moderne Dirndl, weiße Blusen
Vibe: Wärme, Nahbarkeit, Unschuld – "Mädchen von nebenan"
```

---

## ❌ Was fehlt / Offene Punkte

### 1. 🔴 Instagram-Account registrieren (Höchste Priorität)
**Problem:** Kann ich nicht vom Server machen (Braucht Handynummer + Gerät)
**Was du tun musst:**
- Auf deinem Handy: `mia_influencer_de` (oder anderen Username) registrieren
- Email: `mia@steppa.online` verwenden
- Account 1-2 Wochen warmlaufen lassen (folgen, liken, keine Politik)
- Passwort + Username an mich geben → ich trage in Scripts ein

### 2. 🟡 Email für mia@steppa.online
- Cloudflare Email Routing manuell einrichten (Dashboard → Email → Routing Rules)
- Oder Google Mail Catch-All

### 3. 🟡 Bailian/qwen-image-2.0-pro API-Key tot
- `sk-sp-c47b7fe381c04d6a81206c6e5f3b7882` gibt 401 auf Image-Endpoint
- **Lösung:** Gemini für Bilder (bereits umgestellt)
- Bailian funktioniert noch für Text-Modelle (qwen3.6-plus)

### 4. 🟡 Reel-Qualität optimieren
- Veo 3.1 Fast macht nur 4s-Clips → für 12s+ brauchen wir 3 Clips
- Gesichts-Mimik von Veo ist noch rudimentär (keine Lippen-Sync zum Audio)
- Amateur-Look aktuell: `noise + hue + unsharp` (grain-Filter fehlt)
- **Idee:** Mehrere Clips generieren, beste auswählen

### 5. 🟡 schedule.json unvollständig
- Nur 7 Leit-Posts enthalten (W1D1-W1D4, W3D3, W6D6, W8D7)
- Muss auf alle 8 Wochen erweitert werden
- **Zeitbedarf:** ~30 Min für kompletten Plan

### 6. 🟡 Mia-Poster Script nicht vollständig
- `mia-poster.py` hat das Veo + ElevenLabs + Assembly noch als TODO
- Aktuelle Pipeline muss ins Script integriert werden
- Braucht: `openclaw` CLI-Calls für `image_generate` + `video_generate`

### 7. 🟢 ElevenLabs API hat Starter-Tier (39589 Zeichen/Monat)
- Laura Voice testen: Wie klingt sie bei längeren Texten?
- Character-Limit beachten – bei 12s-Reels ca. 2500 Zeichen/Monat nötig

---

## Nächste Schritte (priorisiert)

### Phase A: Account bereit machen (DU)
1. Instagram-Account registrieren
2. mir Username + Passwort geben
3. Account 1-2 Wochen warmlaufen lassen

### Phase B: Pipeline finalisieren (ICH)
4. `mia-poster.py` mit Veo + ElevenLabs + Assembly vervollständigen
5. schedule.json auf 8 Wochen erweitern
6. Cron-Jobs aktivieren
7. Ersten echten Testpost auslösen

### Phase C: Launch
8. Phase 1 starten (W1: reiner Lifestyle-Content)
9. DM-Checker aktivieren
10. Wöchentliche Performance-Reviews

---

## Wichtige Entscheidungen

| Datum | Entscheidung | 
|-------|-------------|
| 2026-05-23 | Projekt aufgesetzt, Konzept aus Dokument adaptiert |
| 2026-05-23 | ElevenLabs Jessica+Laura getestet → Laura German als Voice | 
| 2026-05-24 | Gemini 3 Pro Image mit Reference bestätigt (locked-in ✅) |
| 2026-05-24 | Bailian/qwen-image-2.0-pro tot (401) → Gemini als Fallback |
| 2026-05-24 | Reel-Pipeline V3: Ein Bild → 3×Veo → Audio strip → ElevenLabs → ffmpeg |
| 2026-05-24 | Amateur-Look via ffmpeg (`noise`+`hue`+`unsharp`) bestätigt |
