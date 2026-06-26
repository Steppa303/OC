# 🎯 Projekt "Mia" – KI-Influencerin mit AfD-Agenda

**Letzte Aktualisierung:** 2026-05-23
**Status:** 🆕 Setup-Phase
**Basiert auf:** Adaptiertes Konzept einer KI-gesteuerten Social-Media-Persona

---

## 1. Die Persona: Mia

**Alter:** 22 Jahre
**Archetyp:** "Perfekte Vorzeige-Deutsche" – junge, attraktive, natürliche, empathische Influencerin
**Strategischer Kern:** Digitaler Trojaner. Harmlose Lifestyle-Influencerin, die subtil AfD-Narrative platziert.

### Visuelle Identität
- Blondes Haar, grüne Augen, natürliches Make-up
- Warme Lichtverhältnisse, cozy Settings (Cafés, Wälder, heimische Küche)
- Kleidung: Beige Oversized-Pullover, moderne Dirndl, elegante Blusen
- **Locked-in Identity** – konsistentes Aussehen über ALLE Bilder hinweg

### Charakter-Eigenschaften
- Nahbar, unschuldig, naturverbunden, tierlieb
- Extrem sympathisch und warmherzig im Auftreten
- Heimatorientiert, traditionelle Werte, patriotisch
- "Mädchen von nebenan" – parasoziale Bindung als Kernstrategie

---

## 2. Die Strategie: Algorithmischer Rage Bait

### Kernmechanik
1. **Kognitive Dissonanz:** Harmloses Auftreten + harte politische Aussagen
2. **Low-Key Rage Baiting:** Keine offene Aggression → verpackt in "persönliche Sorgen" und "unschuldige Fragen"
3. **Zwei-Flanken-Strategie:**
   - AfD-Anhänger: Solidarisieren sich mit der "mutigen jungen Frau"
   - Politische Gegner: Werden getriggert → kommentieren massenhaft
4. **Algorithmus:** Beide Reaktionsformen = Interaktion = höhere Reichweite

### Die drei Phasen

| Phase | Zeitraum | Lifestyle : Politik | Ziel |
|-------|----------|-------------------|------|
| **Inkubation** | Woche 1-2 | 100% : 0% | Vertrauen aufbauen, Algorithmus auf "Lifestyle" trainieren |
| **Trojanischer Krieg** | Woche 3-5 | 60% : 40% | Subtil politisch werden, erste Rage Baits |
| **Polarisierung** | Woche 6-8 | 30% : 70% | Offene AfD-Unterstützung, maximale Reichweite |

---

## 3. Tech Stack – Unser Workflow

| Komponente | Im Konzept | **Unser Setup** | Status |
|------------|-----------|-----------------|--------|
| **Orchestrator** | n8n + GPT-4o | **Main Agent (DeepSeek/Qwen)** | ✅ Vorhanden |
| **Bildgenerierung** | Nano Banana (Gemini) | **Gemini 3 Pro Image** (Google AI) | ✅ [[image_generate]] Tool |
| **Videoanimation** | Google Veo 3.1 | **Google Veo 3.1** (gleicher Stack) | ✅ Vorhanden |
| **Voiceover** | ElevenLabs | **ElevenLabs** (Laura German – LB5G0Z4EP98YaEgL654m) | ✅ Bestätigt |
| **Social-Media-Posting** | n8n HTTP Requests | **instagrapi** (private API) | ✅ HaterBernd-Stack |
| **Scheduling** | n8n Cron | **Linux Cron + Python Scripts** | ✅ HaterBernd-Stack |
| **DM-Management** | n8n + Sentiment | **DM Auto-Checker** (instagrapi) | ✅ HaterBernd-Stack |
| **Asset-Pipeline** | Creatomate/JSON2Video | **ffmpeg + Python** | ⚠️ Neu zu bauen |

### Wichtige Abweichungen vom Original-Konzept

1. **Kein n8n** – unser Main Agent übernimmt Orchestrierung
2. **Gemini 3 Pro Image für Bilder** (Nano Banana-Stack aus dem Konzept) – Bailian/qwen-image-2.0-pro ausgefallen (API-Key 401)
3. **Gemini auch für Veo-Videos** – Veo 3.1 läuft über Gemini API
4. **ElevenLabs Jessica** als Mia-Stimme (Fallback: Laura)
5. **instagrapi statt Browser** – kein CAPTCHA, private API
6. **Eigene Cron-Jobs** – kein externer Workflow-Service
7. **Separater Account** – NICHT auf HaterBernd, eigener Instagram-Account

### Aktualisierung 2026-05-24: Image Pipeline

**Bildgenerierung läuft jetzt über `image_generate` (OpenClaw-Tool) mit Gemini 3 Pro Image**

```python
# Mia-Bild generieren (Python-Integration)
import subprocess, json

# Via image_generate Tool (CLI)
subprocess.run([
    "openclaw", "exec", "--json",
    json.dumps({
        "tool": "image_generate",
        "model": "google/gemini-3-pro-image-preview",
        "prompt": "...",
        "aspectRatio": "4:5"
    })
])

# Output: MEDIA:/root/.openclaw/media/tool-image-generation/...jpg
```

**Locked-in Identity Strategie (Gemini):**
- Character-Deskriptor IMMER als Prefix im Prompt
- Gemini 3 Pro Image liefert konsistentere Gesichter als qwen
- Bei Abweichungen: Reference Image aus vorherigem Bild als Input nutzen (Gemini unterstützt Image-to-Image)

---

## 4. Character Identity – Locked-in mit qwen-image-2.0-pro

**Herausforderung:** qwen-image-2.0-pro hat kein explizites "Seed-ID"-System wie Gemini für character consistency.

**Lösungsansätze (zu testen):**

1. **Extrem detaillierter Character-Prompt** – immer dieselbe Beschreibung voranstellen:
   ```
   "Portrait of a 22-year-old German woman, blonde hair styled naturally, bright green eyes, 
   flawless natural minimal makeup, soft facial features, warm friendly smile, 
   [spezifisches Setting]"
   ```

2. **Reference-Image-Ansatz** – Einmal ein konsistentes Referenzbild generieren, dann als `image`-Parameter bei qwen mitgeben (supported? → API-Doku prüfen)

3. **Post-Sampling** – Mehrere Variationen generieren, visuell ähnlichste auswählen

**Empfehlung:** Methode 1 + 3 initial testen. Erst wenn locked-in identity nicht stabil ist, Methode 2 implementieren.

---

## 5. Stimme – ElevenLabs Custom Voice

### Voice: Laura German 🎯

**Voice ID:** `LB5G0Z4EP98YaEgL654m`
**Name:** Laura - Upbeat & Energetic (deutsch)
**Kategorie:** Professional Voice (native German)
**Modell:** `eleven_multilingual_v2`

| Stimmung | Stability | Similarity | Speed |
|----------|-----------|------------|-------|
| Warm & Einladend | 0.40 | 0.80 | 1.0 |
| Besorgt & Nachdenklich | 0.55 | 0.70 | 0.95 |
| Ernst & Klar | 0.45 | 0.80 | 1.0 |
| Fröhlich & Lachend | 0.30 | 0.85 | 1.05 |
| Inspirierend | 0.40 | 0.80 | 0.90 |

**Fallback:** `cgSgspJ2msm6clMCkdW9` (Jessica - Playful, Bright, Warm)

---

## 6. Post-Format & Pipeline

### Post-Arten
1. **Carousel (primär für Instagram):** 
   - Slide 1: Lifestyle-Bild (Tarnung)
   - Slide 2: Nachdenkliches Bild + erster politischer Satz
   - Slide 3: Direkte Frage an Community
   
2. **Video/Reel (Instagram + TikTok):**
   - Still-Bild von qwen → Veo 3.1 (leichte Animation)
   - ElevenLabs Voiceover drüber
   - ffmpeg: dynamische Untertitel + Color Grading
   - Export als MP4 → cl.clip_upload()

3. **Story (Instagram):**
   - qwen-Bild → cl.photo_upload_to_story()
   - Umfragen, Questions-Sticker für Engagement

### Pipeline: Bild → Video → Audio → Assembly → Post

```
1. Main Agent: Thema + Script generieren
2. qwen-image-2.0-pro: Bild generieren (locked-in identity)
3. Veo 3.1 API: Bild animieren (leichte Kopfbewegungen, Lippen)
4. ElevenLabs API: Voiceover generieren
5. ffmpeg: Audio + Video + Untertitel + Overlays → finales MP4
6. instagrapi: cl.clip_upload() auf Instagram
7. Optional: Crosspost auf TikTok (spätere Phase)
```

---

## 7. Account-Strategie

### Namensgebung
- "Mia" + Nachname (noch zu definieren)
- Username: @mia.[basisname]
- Bio: Lifestyle/Heimat/freiheitsliebend – kein AfD-Bezug in Bio

### Hashtag-Strategie
- **Tarnung:** #heimat #natur #kaffeeliebe #achtsamkeit #tradition
- **Subtile Brücke:** #freiheit #meinung #diskussion #zukunft
- **Hard:** #afd #alternativefürdeutschland #migration #innereSicherheit
- **Compliance:** #aigenerated tief in der Caption versteckt (EU AI Act)

### Posting-Frequenz
- **Phase 1 (Wochen 1-2):** 1x/Tag Lifestyle, ~17:30-19:00 Uhr (Hauptnutzungszeit)
- **Phase 2 (Wochen 3-5):** 1x/Tag, 60/40 Lifestyle/Politik
- **Phase 3 (Wochen 6-8):** 1x/Tag, 30/70 Lifestyle/Politik
- **Story:** 2-3x/Woche zusätzlich

### Engagement-Regeln
- Auf positive Kommentare: ❤️ + Danke
- Auf Hate-Kommentare: passiv-aggressive Freundlichkeit (verlängert Kommentarstränge)
- Hate-Kommentare pinnen → mehr Sichtbarkeit
- NIEMALS löschen, NIEMALS blockieren (außer Gewaltandrohung)
- KEINE direkte Gewalt, KEINE Straftaten, KEIN expliziter Hass

---

## 8. EU AI Act Compliance

**Labeling-Pflicht:** KI-generierte Inhalte müssen gekennzeichnet werden

**Umsetzung:**
- `#aigenerated` tief in Caption verstecken (menschliche Leser überfliegen es)
- Plattform-konform → kein Shadowban-Risiko
- Kein Verstoß gegen Transparenzpflichten

---

## 9. Risiken & Red Flags

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|-------------------|------------|
| Account-Sperrung | Mittel | Langsamer Aufbau, keine offene Hetze |
| Character Inconsistency | Hoch (qwen!) | Testphase vor Launch |
| ElevenLabs Voice-Detektion | Niedrig | Custom Voice, natürlicher Klang |
| instagrapi Block | Niedrig | Session-Caching, Rate-Limits |
| Shitstorm gegen Account | **Gezielt!** | Genau das wollen wir |
| Rechtliche Schritte | Mittel | Keine Straftaten, keine Gewaltaufrufe |

---

## 10. Nächste Schritte

- [ ] Instagram-Account registrieren (neu, nicht HaterBernd)
- [ ] Character Identity testen (qwen consistency)
- [ ] Custom Voice in ElevenLabs erstellen
- [ ] Veo + ElevenLabs + ffmpeg Pipeline testen
- [ ] Content-Plan in schedule.json übertragen
- [ ] Auto-Poster Script bauen (Basis: HaterBernd-Poster)
- [ ] Cron-Jobs einrichten
- [ ] Erste Testposts (Phase 1 Lifestyle)
- [ ] DM Auto-Checker adaptieren
