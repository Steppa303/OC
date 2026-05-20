# Instagram Trends → AI Content Pipeline: Deep Research Analysis

**Datum:** 2026-05-15  
**Zweck:** Systematische Analyse wie man Instagram-Trends erfasst und in generierte Bild-Content umwandelt

---

## 1. Trend-Erfassung

### 1.1 Instagram Graph API (Official)

**Was ist möglich:**
- **Hashtag Search:** `GET /ig-hashtag-id` + `GET /ig-hashtag-id/media` — Liest Posts zu Hashtags aus
- **Media Analytics:** Engagement-Daten (Likes, Comments, Saves) für eigene Posts
- **Account Insights:** Reichweite, Impressions, Follower-Wachstum

**Limits:**
- **Rate Limit:** 200 API Calls/Hour (2025 reduziert von 5,000 → 200, ein 96% Cut!)
- **Publishing Limit:** 100 API-publizierte Posts pro 24h Rolling Window
- **Kein "Trending" Endpoint:** Instagram bietet KEINE offizielle API für "trending hashtags" oder "explore page"
- **Business/Creator Account REQUIRED** — verknüpft mit Facebook Page
- **OAuth 2.0** mit `instagram_content_publish` + `instagram_manage_insights` Scopes

**Tools/SDKs:**
- Meta Graph API Explorer: https://developers.facebook.com/docs/instagram-platform/
- Python: `facebook-sdk`, `requests` direkt
- Node.js: `@meta-js/facebook-sdk`

**Vor-/Nachteile:**
| Pro | Contra |
|-----|--------|
| 100% offiziell, kein Shadowban-Risiko | Kein Trending/Explore-Endpoint |
| Kostenlos (keine API-Kosten) | Nur eigene Insights, keine Competitor-Daten |
| Publishing direkt möglich | Rate Limits sehr restriktiv (200/h) |
| Langzeit-stabil | PNG wird abgelehnt → nur JPEG |

---

### 1.2 Third-Party Trend-Analyse Tools

| Tool | Preis | Features | Link |
|------|-------|----------|------|
| **Iconosquare** | ab $79/Mo | Analytics, Best Posting Times, Competitor Tracking, Hashtag Performance | https://www.iconosquare.com |
| **Later** | ab $25/Mo | Visual Planner, Link in Bio, Hashtag Suggestions, Auto-Post | https://later.com |
| **HypeAuditor** | ab $299/Mo | Influencer Analytics, Fake Follower Detection, Hashtag Audit | https://hypeauditor.com |
| **Sprout Social** | ab $249/Mo | Vollständige Social Suite, Trend Reports, AI-Content | https://sproutsocial.com |
| **Buffer** | ab $6/Mo | Scheduling, Analytics, Hashtag Library | https://buffer.com |
| **Hootsuite** | ab $99/Mo | Multi-Platform, Streams für Trend-Monitoring | https://hootsuite.com |
| **Apify Instagram Actors** | ab $49/Mo | Scraping von Hashtags, Profiles, Reels-Daten | https://apify.com/store/hashtag-conductor |
| **PostNitro** | ab $19/Mo | AI Carousel Generator, Direct API Publishing | https://postnitro.ai |

**Bestes Preis-Leistungs-Verhältnis für Trend-Erfassung:**
- **Later** (ab $25/Mo) — gut für Hashtag-Suggestions + Scheduling
- **Apify** (ab $49/Mo) — wenn man Rohdaten braucht für eigene Analyse

---

### 1.3 Web Scraping Strategien

**Mögliche Quellen:**
- **Instagram Hashtag Pages** (`instagram.com/explore/tags/{tag}/`) — aber stark geschützt, Login-Wall
- **Instagram Explore Page** — personalisiert, schwer zu scrapen
- **Reddit** als Trend-Quelle: r/trending, r/Instagram, r/socialmedia, r/marketing
- **TikTok Creative Center** (kostenlos!): https://ads.tiktok.com/business/creativecenter/inspiration/popular_hashtag — zeigt trending Hashtags, Songs, Creator
- **Pinterest Trends** (kostenlos): https://trends.pinterest.com — zeigt aufsteigende Suchbegriffe
- **Google Trends** (kostenlos): https://trends.google.com — filterbar nach "Instagram Search"

**Scraping-Tools:**
- **Apify** — fertige Instagram-Actoren, legaler Gray Area
- **Playwright/Puppeteer** — headless Browser, aber Instagram blockiert aktiv
- **Selenium** — ähnlich, hoher Wartungsaufwand

**⚠️ Risiko:** Scraping von Instagram verstößt gegen ToS. Account-Sperre möglich. Reddit/TikTok/Pinterest sind sicherere Alternativen.

---

### 1.4 Cross-Platform Trend-Quellen

**Empfohlener Stack für Trend-Detection:**

```
┌─────────────────────────────────────────────────┐
│              TREND DETECTION LAYER              │
├─────────────────────────────────────────────────┤
│ 1. TikTok Creative Center (free API)            │
│    → trending hashtags, songs, formats          │
│                                                 │
│ 2. Reddit API (free)                            │
│    → r/trending, r/socialmedia, r/Instagram     │
│    → subreddits nach Nische filtern             │
│                                                 │
│ 3. Pinterest Trends (free)                      │
│    → aufsteigende visuelle Trends               │
│                                                 │
│ 4. Google Trends (free)                         │
│    → "Instagram Search" Filter                  │
│                                                 │
│ 5. Instagram Hashtag API (Graph API)            │
│    → validiere ob Trend auf IG angekommen       │
│    → post volume, engagement check              │
└─────────────────────────────────────────────────┘
```

**Warum dieser Ansatz?**
- Reddit/TikTok Trends schwappen typisch 24-72h später auf Instagram über
- Kostenlos, keine API-Kosten
- Keine ToS-Verstöße (alle haben offizielle APIs)
- Lässt sich voll automatisieren

---

## 2. Content-Typen auf Instagram 2025/2026

### 2.1 Performance nach Content-Typ

| Content-Typ | Avg. Engagement Rate | Reichweite | Algorithmus-Gewichtung |
|-------------|---------------------|------------|----------------------|
| **Reels** | ~1.5-2.0% | ⭐⭐⭐⭐⭐ | Höchste Priorität |
| **Carousels** | ~1.7% | ⭐⭐⭐⭐ | Sehr hoch |
| **Single Photos** | ~1.17% | ⭐⭐ | Niedrig |
| **Stories** | ~1-2% (interaktiv) | ⭐⭐⭐ | Mittel |

**Key Insights 2025/2026:**
- **Carousels sind Engagement-Könige** — Swipe-Zeit = langer View-Time = Algorithmus boost
- **Reels für Discovery** — maximale Reichweite zu neuen Followern
- **Static Photos sind "mid"** — nur für unterstützende Posts nutzen
- **Saves & Sends** sind die WICHTIGSTEN Metriken (nicht Likes!)
- Der Algorithmus kategorisiert Content nach **Micro-Nischen** (basierend auf letzten 9-12 Posts)

### 2.2 Beste Content-Typen für AI-Generierte Bilder

| Nische | Bestes Format | Beispiel |
|--------|--------------|----------|
| **Motivational/Quotes** | Single Image + Carousel | Text-in-Image mit Nano Banana Pro |
| **Aesthetic/Lifestyle** | Carousel (3-5 Slides) | Konsistenter visueller Stil |
| **AI Art Showcase** | Single Image | Hochauflösend, kreativ |
| **Educational/Infographics** | Carousel (5-10 Slides) | Nano Banana Pro mit Text-Rendering |
| **Memes/Humor** | Single Image | Trend-basiert, aktuell |
| **Product Photography** | Carousel | AI-generierte Produktbilder |

### 2.3 Posting-Zeiten & Frequenz

**Optimale Frequenz (2025/2026 Daten):**
- **3-5 Posts/Woche** = 2x Baseline-Wachstum
- **6-9 Posts/Woche** = 3.7x Wachstum (aber Quality > Quantity!)
- **Konsistenz ist wichtiger als Frequenz** — besser 3x/Woche regelmäßig als 7x dann 2 Wochen Pause

**Beste Posting-Tage:**
- **Mittwoch & Donnerstag** = höchste Engagement-Raten (2025/2026 Daten)
- **Sonntag** = zweitbest für Carousels
- **Vermeiden:** Montag früh, Freitag nachmittag

**Beste Posting-Zeiten (allgemein):**
- **10:00-11:00** und **19:00-21:00** (lokale Zeit der Zielgruppe)
- Hootsuite/Buffer empfehlen: **9:00-11:00** und **14:00-16:00**
- **WICHTIG:** Instagram Insights zeigen die besten Zeiten für DEINEN Account

### 2.4 Hashtag-Strategie 2025/2026

**WICHTIGER CHANGE:** Hashtags haben an Bedeutung VERLOREN!
- Instagram hat die Gewichtung von Hashtags reduziert (Anti-Spam)
- Hashtag-Folgen wurde entfernt
- **Empfehlung:** 3-8 RELEVANTE Hashtags pro Post (nicht mehr 30!)
- Fokus auf **Content-Qualität und Keywords in Caption** statt Hashtag-Studien
- Keyword-Optimierung in Captions ist jetzt wichtiger als Hashtags

---

## 3. Nano Banana Pro Integration

### 3.1 Nano Banana Modelle im Überblick

| Modell | Basis | Use Case | API verfügbar |
|--------|-------|----------|--------------|
| **Nano Banana 2** | Gemini 3.1 Flash Image | Schnelle Generation, Alltags-Content | ✅ Vertex AI |
| **Nano Banana Pro** | Gemini 3 Pro Image | Komplexe Prompts, Text-Rendering, High-Fidelity | ✅ Vertex AI |

**Key Features:**
- **Text-in-Image:** Nano Banana Pro kann Text präzise rendern (Logos, Zitate, Infographics)
- **Multi-Reference:** Bis zu 14 Referenzbilder pro Prompt
- **Aspect Ratios:** 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
- **Resolutions:** 0.5K, 1K, 2K, 4K
- **Web Search Integration:** Echtzeit-Wissen für aktuelle Trends
- **C2PA + SynthID:** Generierte Bilder werden automatisch gekennzeichnet

### 3.2 Prompt-Engineering Templates für Instagram Content

#### Template 1: Motivational Quote (Nano Banana Pro)
```
Generate a motivational quote image for Instagram.

[Subject] Elegant typography on a textured dark background
[Text] "The only way to do great work is to love what you do."
[Composition] Center-aligned text, generous whitespace, subtle gradient overlay
[Style] Premium minimalist, dark luxury aesthetic, serif font, gold accent color
[Text Rendering] The exact quote text must be perfectly legible and spelled correctly
[Aspect Ratio] 1:1
```

#### Template 2: Educational Carousel Slide (Nano Banana Pro)
```
Create an educational infographic slide for Instagram carousel.

[Subject] Step-by-step guide visual
[Text] "5 Steps to Better Photos" as title, numbered list below
[Composition] Clean layout with numbered steps, icons for each point
[Style] Modern flat design, brand colors (primary: #2563EB, accent: #F59E0B), sans-serif font
[Text Rendering] All text must be perfectly rendered and readable
[Aspect Ratio] 1:1
```

#### Template 3: Aesthetic Lifestyle (Nano Banana 2)
```
Generate a high-quality aesthetic lifestyle image.

[Subject] Minimalist workspace setup with warm lighting
[Action] Soft morning light streaming through window
[Location/context] Scandinavian-style home office, plants, coffee cup
[Composition] Overhead shot, rule of thirds, warm color palette
[Style] Instagram aesthetic, soft shadows, natural tones, editorial photography
[Aspect Ratio] 4:5
```

#### Template 4: Trend-Based Meme (Nano Banana Pro)
```
Create a meme-style image based on current trend: [TREND_DESCRIPTION]

[Subject] [Describe the meme format]
[Text] Top text: "[TOP_TEXT]" / Bottom text: "[BOTTOM_TEXT]"
[Composition] Classic meme layout or [specific format]
[Style] Clean, recognizable, shareable
[Text Rendering] Text must be perfectly spelled and positioned
[Aspect Ratio] 1:1
```

### 3.3 Stil-Konsistenz (Brand Identity)

**Strategien für konsistenten Look über Posts hinweg:**

1. **Style Reference Images:** Nutze 1-2 Referenzbilder als Style-Vorlage für alle Generationen
2. **Color Palette Definition:** Definiere feste Hex-Farben im Prompt (z.B. "brand colors: #2563EB, #F59E0B, #1F2937")
3. **Font Specification:** Immer gleiche Font-Typen nennen ("Inter", "Montserrat", "Playfair Display")
4. **Prompt Templates mit Variablen:** Basis-Prompt beibehalten, nur [SUBJECT] und [TEXT] ändern
5. **Seed/Style Token:** Bei Nano Banana Pro kann man Referenzbilder für Konsistenz verwenden

**Beispiel Brand-Prompt-Template:**
```
[STYLE_PREFIX] Consistent brand style: dark luxury aesthetic, 
deep navy (#0A1628) and gold (#C9A96E) color palette, 
Montserrat Bold for headlines, Inter Regular for body text, 
subtle grain texture overlay, cinematic lighting

[CONTENT] Generate: [CONTENT_TYPE] about [TOPIC]
[TEXT] "[QUOTE_OR_TEXT]"
[ASPECT] 1:1
```

### 3.4 API-Kosten für Nano Banana (Vertex AI)

| Modell | Input | Output | Geschätzte Kosten/Monat (100 Posts) |
|--------|-------|--------|-------------------------------------|
| **Nano Banana 2** | $0.0001/1K tokens | $0.0003/1K tokens | ~$5-15 |
| **Nano Banana Pro** | $0.0025/1K tokens | $0.015/1K tokens | ~$30-80 |

---

## 4. Auto-Posting Pipeline

### 4.1 Instagram Graph API Publishing

**Voraussetzungen:**
- **Business oder Creator Account** (kein personal Account!)
- **Facebook Page** verknüpft mit dem Instagram Account
- **Facebook App** mit Instagram Basic Display oder Instagram Graph API permission
- **Access Token** mit `instagram_content_publish` Scope
- **App Review** durch Meta für Production Mode

**Publishing Flow (2-Step):**

```
Step 1: Media Container erstellen
POST /{ig-user-id}/media
  ?media_type=IMAGE
  &image_url=https://example.com/image.jpg
  &caption=Your caption here
  &alt_text=Accessibility text
  &access_token=...

→ Response: { "id": "{container-id}" }

Step 2: Container veröffentlichen (wenn status=FINISHED)
POST /{ig-user-id}/media_publish
  ?creation_id={container-id}
  &access_token=...

→ Response: { "id": "{published-media-id}" }
```

**Carousel Publishing (mehrere Bilder):**
```
Step 1a: Child Container für jedes Bild erstellen
POST /{ig-user-id}/media
  ?media_type=IMAGE
  &is_carousel_item=true
  &image_url=https://example.com/image1.jpg
  &access_token=...
→ { "id": "{child-id-1}" }

Step 1b: Parent Container mit children-IDs
POST /{ig-user-id}/media
  ?media_type=CAROUSEL
  &caption=Carousel caption
  &children={child-id-1},{child-id-2},{child-id-3}
  &access_token=...
→ { "id": "{parent-container-id}" }

Step 2: Parent veröffentlichen
POST /{ig-user-id}/media_publish
  ?creation_id={parent-container-id}
```

**Wichtige Limits:**
- **100 API-Publishes pro 24h** (rolling window)
- **Carousels zählen als 1 Post**
- **Nur JPEG** (kein PNG!)
- **Container expiren** nach ~30 Minuten wenn nicht published
- **Rate Limit:** 200 API Calls/Hour

### 4.2 Third-Party Posting Tools

| Tool | Preis | Carousel Support | API-basiert | Link |
|------|-------|-----------------|-------------|------|
| **Meta Business Suite** | Kostenlos | ✅ | ✅ Official | https://business.facebook.com |
| **Buffer** | ab $6/Mo | ✅ | ✅ | https://buffer.com |
| **Later** | ab $25/Mo | ✅ | ✅ | https://later.com |
| **Hootsuite** | ab $99/Mo | ✅ | ✅ | https://hootsuite.com |
| **PostNitro** | ab $19/Mo | ✅ (bis 20 Slides) | ✅ Direct API | https://postnitro.ai |
| **n8n** (self-hosted) | Kostenlos | ✅ | ✅ Workflow | https://n8n.io |

### 4.3 Eigene Automation vs. Third-Party

| Kriterium | Eigene Automation | Third-Party Tool |
|-----------|------------------|------------------|
| **Kosten** | ~$50-100/Mo (API + Hosting) | $25-100/Mo |
| **Control** | 100% | Limitiert |
| **Wartung** | Hoch (API Changes) | Niedrig |
| **Integration** | Voll (AI Pipeline) | Begrenzt |
| **Setup-Zeit** | 1-2 Wochen | 30 Minuten |

**Empfehlung für diesen Use Case:** Eigene Automation, weil die AI-Generation-Pipeline integriert werden muss.

---

## 5. Praktische Umsetzung

### 5.1 Empfohlene Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    INSTAGRAM AI CONTENT PIPELINE                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │ TREND DETECT │───▶│ PROMPT GENERATOR │───▶│ IMAGE GEN    │  │
│  │              │    │ (LLM)            │    │ (Nano Banana)│  │
│  │ Reddit/TikTok│    │                  │    │              │  │
│  │ Pinterest/IG │    │ Template + Data  │    │ 1:1 / 4:5    │  │
│  │ Google Trends│    │                  │    │ JPEG output  │  │
│  └──────────────┘    └──────────────────┘    └──────┬───────┘  │
│                                                      │          │
│                                                      ▼          │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │   SCHEDULER  │◀───│   POST PROCESS   │◀───│ QUALITY CHECK│  │
│  │              │    │ (Caption, Tags)  │    │ (Auto/Manual)│  │
│  │ Cron/Queue   │    │                  │    │              │  │
│  │ 3-5x/Woche   │    │ Auto-caption LLM │    │ Review Queue │  │
│  └──────┬───────┘    └──────────────────┘    └──────────────┘  │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              INSTAGRAM GRAPH API                         │   │
│  │  POST /media (container) → POST /media_publish           │   │
│  │  Support: Single Photos, Carousels, Stories, Reels       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Tech Stack Empfehlung

**Backend:**
- **Python** (FastAPI oder Flask) — beste AI/ML Integration
- **Node.js** (n8n) — wenn No-Code/Low-Code bevorzugt wird

**AI/ML:**
- **Google Vertex AI** — Nano Banana Pro/2 API
- **Gemini API** — für Caption-Generierung und Prompt-Engineering
- **Reddit API** (PRAW) — Trend-Detection
- **TikTok Creative Center API** — Trend-Detection

**Infrastructure:**
- **Docker** für Containerisierung
- **PostgreSQL** oder **SQLite** für Content-Queue
- **Redis** für Job-Queue (Celery)
- **Cron/Scheduler** für Posting-Zeiten

**Deployment:**
- **VPS** (bereits vorhanden: 185.217.126.72)
- **Caddy** als Reverse Proxy
- **GitHub Actions** für CI/CD

### 5.3 Kostenabschätzung (Monatlich)

| Komponente | Kosten |
|------------|--------|
| **Nano Banana Pro API** (100-150 Images) | $30-80 |
| **Gemini API** (Caption/Text Generation) | $5-15 |
| **VPS Hosting** (bereits vorhanden) | $0 |
| **Third-Party Tools** (optional: Later/Buffer) | $0-25 |
| **Domain/SSL** (bereits vorhanden) | $0 |
| **GESAMT** | **~$35-120/Mo** |

### 5.4 Risiko-Bewertung

#### ⚠️ Shadowban-Risiken

| Risiko | Level | Prävention |
|--------|-------|------------|
| **Bot-Erkennung** | 🔴 Hoch | Niemals auto-like, auto-follow, auto-comment |
| **Spam-Hashtags** | 🟡 Mittel | Max 3-8 relevante Hashtags, keine wiederholten Sets |
| **Zu schnelles Posten** | 🟡 Mittel | Max 1 Post/Stunde, menschliche Pausen |
| **AI-Content Flag** | 🟢 Niedrig | Instagram erlaubt AI-Content (mit Kennzeichnung) |
| **Mass-DMs** | 🔴 Hoch | Vermeiden komplett oder innerhalb Limits (200/h) |

#### ✅ Was SICHER ist:
- **API-basiertes Publishing** (über Instagram Graph API) — 100% erlaubt
- **AI-generierte Bilder** — erlaubt, aber mit C2PA/SynthID Kennzeichnung
- **Scheduling** — über offizielle API oder Meta Business Suite
- **Analytics** — über offizielle Insights API

#### ❌ Was NICHT erlaubt ist:
- Auto-Liken/Followen/Commenting
- Scraping ohne Erlaubnis
- Fake Engagement (Pods, Bots)
- Unbegrenztes Posten (>100/24h via API)

#### 🤖 AI Content Policy 2025/2026:
- Instagram **erlaubt** AI-generierten Content
- **Kennzeichnung empfohlen** (Meta's SynthID ist automatisch eingebaut)
- Keine zusätzlichen Strafen für AI-Content im Algorithmus
- **Wichtig:** Content-Qualität zählt, nicht die Herkunft

### 5.5 Empfohlener Start-Ansatz

**Phase 1: MVP (1-2 Wochen)**
1. Instagram Business Account einrichten + Facebook Page verknüpfen
2. Meta Developer App erstellen + Access Token generieren
3. Einfaches Python Script: Nano Banana Pro → JPEG → Instagram API
4. Manuelle Trend-Auswahl (noch kein Auto-Detection)
5. 3 Posts/Woche manuell scheduled

**Phase 2: Automation (2-4 Wochen)**
1. Trend-Detection integrieren (Reddit + TikTok Creative Center)
2. Prompt-Template-System aufbauen
3. Auto-Caption-Generierung (Gemini)
4. Content-Queue mit PostgreSQL
5. Posting-Scheduler (Cron/Celery)

**Phase 3: Scale (4-8 Wochen)**
1. Carousel-Generation (mehrere Nano Banana Pro Images)
2. Style-Konsistenz-System (Reference Images)
3. Analytics-Tracking (Engagement-Metriken)
4. A/B Testing für Content-Typen
5. Multi-Niche Support

---

## 6. EMPFEHLUNG: Der beste Ansatz

### 🏆 Recommended Stack

```
TREND DETECTION:  Reddit API + TikTok Creative Center (beide free)
PROMPT GEN:       Gemini 2.5 Flash (cheap, fast, good at text)
IMAGE GEN:        Nano Banana Pro via Vertex AI (best text rendering)
POSTING:          Instagram Graph API (official, safe)
SCHEDULING:       Python + Celery + Redis (self-hosted on VPS)
STORAGE:          SQLite/PostgreSQL (Content Queue)
```

### 💰 Budget: ~$50-80/Mo
### ⏱️ Setup-Zeit: 2-4 Wochen für MVP
### 🛡️ Risiko: Niedrig (alles offizielle APIs)

### 🎯 Warum dieser Ansatz?

1. **100% offiziell** — keine ToS-Verstöße, kein Shadowban-Risiko
2. **Günstig** — nur API-Kosten, keine teuren Third-Party Tools
3. **Skalierbar** — Python-Backend lässt sich beliebig erweitern
4. **Nano Banana Pro** — aktuell bestes Model für Text-in-Image (perfekt für Quotes, Infographics, Memes)
5. **Cross-Platform Trends** — Reddit/TikTok als Frühindikatoren, 24-72h Vorsprung

---

## 7. Nächste Schritte

### Sofort (diese Woche):
- [ ] Instagram Business Account einrichten (falls noch nicht geschehen)
- [ ] Facebook Page erstellen/verknüpfen
- [ ] Meta Developer App registrieren: https://developers.facebook.com
- [ ] Instagram Graph API Permissions anfordern
- [ ] Google Cloud Vertex AI Account einrichten (Nano Banana API)

### Kurzfristig (1-2 Wochen):
- [ ] Python Backend Skeleton erstellen (FastAPI)
- [ ] Nano Banana Pro API Integration testen
- [ ] Erstes Bild generieren und via API posten
- [ ] Posting-Flow manuell testen (Container → Publish)

### Mittelfristig (2-4 Wochen):
- [ ] Trend-Detection Module integrieren
- [ ] Prompt-Template-System aufbauen
- [ ] Content-Queue mit Scheduler
- [ ] Erste automatisierte Posts live schalten

---

## Quellen & Links

- **Instagram Graph API Docs:** https://developers.facebook.com/docs/instagram-platform/
- **Content Publishing Guide:** https://developers.facebook.com/docs/instagram-platform/content-publishing/
- **Nano Banana Pro Blog:** https://blog.google/innovation-and-ai/products/nano-banana-pro/
- **Nano Banana Prompting Guide:** https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana
- **Nano Banana Pro Prompts (GitHub):** https://github.com/ZeroLu/awesome-nanobanana-pro
- **Max Woolf Prompt Guide:** https://minimaxir.com/2025/11/nano-banana-prompts/
- **Iconosquare:** https://www.iconosquare.com
- **Later:** https://later.com
- **Buffer:** https://buffer.com
- **HypeAuditor:** https://hypeauditor.com
- **TikTok Creative Center:** https://ads.tiktok.com/business/creativecenter/inspiration/popular_hashtag
- **Pinterest Trends:** https://trends.pinterest.com
- **Google Trends:** https://trends.google.com
- **Sprout Social Trends 2026:** https://sproutsocial.com/insights/instagram-trends/
- **Hootsuite Social Trends 2026:** https://blog.hootsuite.com/social-media-trends/
- **Social Insider Benchmarks:** https://www.socialinsider.io/social-media-benchmarks/instagram

---

*Ende der Analyse. Bei Fragen zu einzelnen Abschnitten einfach nachfragen.*
